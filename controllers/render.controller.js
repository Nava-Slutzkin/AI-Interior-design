// מייבא את המודל של Render כדי לשוחח עם MongoDB
const Render = require('../models/render.model');
const { OpenAI } = require('openai');
const mongoose = require('mongoose');

// 1. פונקציה לעדכון רשומת Render לפי מזהה
const updateRender = async (req, res) => {
    const { id } = req.params;
    const { items = [] } = req.body;

    try {
        const updatedRender = await Render.findByIdAndUpdate(
            id,
            { items },
            { new: true, runValidators: true }
        );

        if (!updatedRender) {
            return res.status(404).json({ message: 'ההדמיה לא נמצאה' });
        }

        return res.status(200).json({
            id: updatedRender._id,
            items: updatedRender.items
        });
    } catch (error) {
        return res.status(500).json({ message: 'שגיאת שרת בעדכון ההדמיה', error: error.message });
    }
};

// 2. פונקציה למחיקת Render לפי מזהה
const deleteRender = async (req, res) => {
    const { id } = req.params;

    try {
        const render = await Render.findById(id);

        if (!render) {
            return res.status(404).json({ message: 'ההדמיה לא נמצאה' });
        }

        const isAdmin = req.user && req.user.role === 'Admin';
        const isOwner = req.user && render.userId && render.userId.toString() === req.user._id.toString();

        if (!isAdmin && !isOwner) {
            return res.status(403).json({ message: 'אין לך הרשאה למחוק הדמיה זו' });
        }

        await Render.findByIdAndDelete(id);

        return res.status(200).json({ message: 'ההדמיה נמחקה בהצלחה' });
    } catch (error) {
        res.status(500).json({ message: 'שגיאת שרת במחיקת ההדמיה', error: error.message });
    }
};

// הפעלת החיבור ל-OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// 3. יצירת הדמיה חדשה בעזרת AI
const createRender = async (req, res) => {
    try {
        const { text, formDetails, uploadedImage, audioUrl } = req.body;
        const userId = req.userId;

        if (!userId) {
            return res.status(401).json({ message: 'User must be authenticated.' });
        }
        
        let aiPrompt = text ? `${text}. ` : '';
        if (formDetails) {
            aiPrompt += `Room type: ${formDetails.roomType || 'any'}. `;
            aiPrompt += `Style: ${formDetails.style || 'modern'}. `;
            if (formDetails.budget) aiPrompt += `Budget: ${formDetails.budget} ILS. `;
        }

        const detailedPrompt = `A highly realistic interior design photo of: ${aiPrompt}. Photorealistic, beautifully lit, 8k resolution.`;
        const encodedPrompt = encodeURIComponent(detailedPrompt);
        const seed = Math.floor(Math.random() * 1000000);
        
        const resultImageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&seed=${seed}&nologo=true&model=flux`;

        const chatResponse = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: `You are an expert interior designer. Based on the user's room description, generate a JSON object with a single array called "items". 
          This array should contain 3-5 items (furniture or accessories) suitable for the room. 
          Each item must have:
          - "name" (string, the item name in Hebrew)
          - "price" (number, estimated average price in ILS)
          - "link" (string, a placeholder or real link to a store)`
                },
                {
                    role: "user",
                    content: aiPrompt
                }
            ],
            response_format: { type: "json_object" }
        });

        const aiData = JSON.parse(chatResponse.choices[0].message.content);
        const generatedItems = aiData.items || [];

        const newRender = await Render.create({
            userId,
            promptText: text,
            uploadedImage,
            audioUrl,
            formDetails,
            resultImage: resultImageUrl,
            items: generatedItems
        });

        return res.status(201).json({
            id: newRender._id,
            resultImage: newRender.resultImage,
            items: newRender.items
        });

    } catch (error) {
        console.error('Error generating render:', error);
        return res.status(500).json({ message: 'Failed to generate render with AI.', error: error.message });
    }
};

// 4. שליפת כל ההדמיות של המשתמש
const getUserRenders = async (req, res) => {
    try {
        const userId = req.userId;
        const page = Number.parseInt(req.query.page, 10) || 1;
        const limit = Number.parseInt(req.query.limit, 10) || 10;
        const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';

        if (!userId || !mongoose.isValidObjectId(userId)) {
            return res.status(401).json({ message: 'Authentication required.' });
        }

        if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100) {
            return res.status(400).json({ message: 'Page and limit must be valid positive numbers.' });
        }

        const filter = { userId };
        if (search) {
            const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const searchRegex = new RegExp(escapedSearch, 'i');
            filter.$or = [{ promptText: searchRegex }, { 'formDetails.roomType': searchRegex }];
        }

        const renders = await Render.find(filter)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        return res.status(200).json(renders);
    } catch (error) {
        console.error('Error fetching user renders:', error);
        return res.status(500).json({ message: 'Failed to fetch renders.' });
    }
};

// 5. שליפת הדמיה יחידה לפי מזהה
const getRenderById = async (req, res) => {
    try {
        const userId = req.userId;
        const { id } = req.params;

        if (!userId || !mongoose.isValidObjectId(userId)) {
            return res.status(401).json({ message: 'Authentication required.' });
        }

        if (!mongoose.isValidObjectId(id)) {
            return res.status(404).json({ message: 'Render not found.' });
        }

        const render = await Render.findOne({ _id: id, userId });
        if (!render) {
            return res.status(404).json({ message: 'Render not found.' });
        }

        return res.status(200).json({
            id: render._id,
            resultImage: render.resultImage,
            items: render.items,
            promptText: render.promptText,
            formDetails: render.formDetails,
            createdAt: render.createdAt
        });
    } catch (error) {
        console.error('Error fetching render:', error);
        return res.status(500).json({ message: 'Failed to fetch render.' });
    }
};

// ייצוא מרוכז של כל 5 הפונקציות
module.exports = { 
    createRender, 
    getUserRenders, 
    getRenderById, 
    updateRender, 
    deleteRender 
};
