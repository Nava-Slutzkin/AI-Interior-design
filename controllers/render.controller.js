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

// הגדרת החיבור ל-AI
const aiApiKey = process.env.OPENAI_API_KEY;
const aiBaseUrl = process.env.OPENAI_BASE_URL || 'https://openrouter.ai/api/v1';
const aiModel = process.env.AI_MODEL || 'google/gemini-2.0-flash-exp:free';

const openai = new OpenAI({
    apiKey: aiApiKey || 'dummy_key', // מונע קריסה בטעינה ראשונית אם אין מפתח
    baseURL: aiBaseUrl,
    defaultHeaders: {
        'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000',
        'X-Title': 'AI Interior Design'
    }
});

const parseAiResponse = (content) => {
    if (!content || typeof content !== 'string') {
        throw new Error('AI returned an empty response.');
    }

    let cleaned = content.trim();

    if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    }

    try {
        const parsed = JSON.parse(cleaned);
        if (parsed && typeof parsed === 'object') {
            return parsed;
        }
    } catch (error) {
        const match = cleaned.match(/\{[\s\S]*\}/);
        if (match) {
            const parsed = JSON.parse(match[0]);
            if (parsed && typeof parsed === 'object') {
                return parsed;
            }
        }
        throw new Error('AI returned a malformed JSON payload.');
    }

    throw new Error('AI response was not a valid object.');
};

const buildAiDesignPayload = async (aiPrompt) => {
    // אם אין מפתח מוגדר ב-env, נחזיר נתוני ברירת מחדל במקום לקרוס
    if (!process.env.OPENAI_API_KEY) {
        console.warn('OPENAI_API_KEY is missing. Using fallback mock data.');
        return {
            summary: 'עיצוב פנים מודרני ונקי עם אווירה חמה ונעימה.',
            items: [
                { name: 'ספה מודרנית', price: 3500, link: '[https://example.com/sofa](https://example.com/sofa)' },
                { name: 'שולחן קפה מעץ', price: 1200, link: '[https://example.com/table](https://example.com/table)' },
                { name: 'מנורת עמידה מעצבים', price: 650, link: '[https://example.com/lamp](https://example.com/lamp)' }
            ]
        };
    }

    try {
        const chatResponse = await openai.chat.completions.create({
            model: aiModel,
            messages: [
                {
                    role: 'system',
                    content: `You are an expert interior designer. Return ONLY valid JSON. The JSON must have:
- "summary": a short, helpful design summary in Hebrew
- "items": an array with 3 to 5 items suitable for the room
Each item must include:
- "name": string in Hebrew
- "price": number in ILS
- "link": a realistic placeholder link to a store
Do not include markdown fences, comments, or extra text.`
                },
                {
                    role: 'user',
                    content: aiPrompt
                }
            ],
            response_format: { type: 'json_object' }
        });

        return parseAiResponse(chatResponse.choices[0].message.content);
    } catch (err) {
        console.error('OpenAI/OpenRouter call failed:', err.message);
        // במקרה של שגיאת תקשורת מול ה-AI נחזיר נתוני ברירת מחדל
        return {
            summary: 'עיצוב פנים מודרני מותאם אישית.',
            items: [
                { name: 'כורסה מעוצבת', price: 1800, link: '[https://example.com](https://example.com)' },
                { name: 'שטיח סלון', price: 950, link: '[https://example.com](https://example.com)' }
            ]
        };
    }
};

// 3. יצירת הדמיה חדשה בעזרת AI
const createRender = async (req, res) => {
    try {
        const { text, formDetails, uploadedImage, audioUrl } = req.body;
        
        // שליפת ה-userId מתוך המידלוור של האימות (תומך ב-req.userId או req.user._id)
        const userId = req.userId || (req.user && req.user._id);

        if (!userId) {
            return res.status(401).json({ message: 'משתמש חייב להיות מחובר כדי ליצור הדמיה.' });
        }

        let aiPrompt = text ? `${text}. ` : '';
        if (formDetails) {
            aiPrompt += `Room type: ${formDetails.roomType || 'any'}. `;
            aiPrompt += `Style: ${formDetails.style || 'modern'}. `;
            if (formDetails.budget) aiPrompt += `Budget: ${formDetails.budget} ILS. `;
        }

        const aiData = await buildAiDesignPayload(aiPrompt || 'Create a modern interior design concept.');
        const generatedItems = Array.isArray(aiData.items) ? aiData.items.slice(0, 5) : [];

        // יצירת קישור ישיר לתמונה מ-Pollinations
        const detailedPrompt = `A highly realistic interior design photo of: ${aiPrompt || 'modern room'}. Photorealistic, beautifully lit, 8k resolution.`;
        const encodedPrompt = encodeURIComponent(detailedPrompt);
        const seed = Math.floor(Math.random() * 1000000);
        const resultImageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&seed=${seed}&nologo=true&model=flux`;

        const newRender = await Render.create({
            userId,
            promptText: text,
            uploadedImage,
            audioUrl,
            formDetails,
            resultImage: resultImageUrl,
            items: generatedItems,
            summary: aiData.summary || ''
        });

        return res.status(201).json({
            id: newRender._id,
            resultImage: newRender.resultImage,
            items: newRender.items,
            summary: newRender.summary,
            source: 'AI-generated'
        });

    } catch (error) {
        console.error('Error generating render:', error);
        return res.status(500).json({
            message: 'נכשל ביצירת ההדמיה מול ה-AI.',
            error: error.message
        });
    }
};

// 4. שליפת כל ההדמיות של המשתמש
const getUserRenders = async (req, res) => {
    try {
        const userId = req.userId || (req.user && req.user._id);
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
        const userId = req.userId || (req.user && req.user._id);
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

module.exports = { 
    createRender, 
    getUserRenders, 
    getRenderById, 
    updateRender, 
    deleteRender 
};