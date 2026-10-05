const Render = require('../models/render.model');
const { OpenAI } = require('openai');
const mongoose = require('mongoose');

// 1. פונקציה לעדכון רשומת Render לפי מזהה
const updateRender = async (req, res) => {
    const { id } = req.params;
    const { items = [] } = req.body;

    try {
        if (!Array.isArray(items)) {
            return res.status(400).json({ message: 'Items must be an array.' });
        }

        const render = await Render.findById(id);
        if (!render) {
            return res.status(404).json({ message: 'ההדמיה לא נמצאה' });
        }

        const isAdmin = String(req.user?.role || '').toLowerCase() === 'admin';
        const isOwner = String(render.userId) === String(req.userId || req.user?._id);
        if (!isAdmin && !isOwner) {
            return res.status(403).json({ message: 'אין לך הרשאה לעדכן הדמיה זו' });
        }

        render.items = items;
        await render.save();

        return res.status(200).json({
            id: render._id,
            items: render.items
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

        const isAdmin = String(req.user?.role || '').toLowerCase() === 'admin';
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
const aiModel = process.env.AI_MODEL || 'nvidia/nemotron-3-super-120b-a12b:free';

const openai = new OpenAI({
    apiKey: aiApiKey || 'missing-api-key',
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
    if (!aiApiKey) {
        throw new Error('OPENAI_API_KEY is not configured on the server.');
    }

    try {
        const chatResponse = await openai.chat.completions.create({
            model: aiModel,
            messages: [
                {
                    role: 'system',
                    content: `You are an interior designer creating a specific, practical plan for a real customer's room. Use the customer's room type, dimensions, existing conditions, needs, style, colors, budget, and constraints. Do not give generic living-room suggestions when the request describes another room. Return ONLY valid JSON with:
- "summary": a concise Hebrew description of the requested room design
- "items": 3 to 5 Hebrew furniture/accessory suggestions that fit this exact design
Each item must include "name" (specific item in Hebrew) and "price" (realistic estimated price in ILS). Keep the total within the stated budget when one is provided. Prices are estimates, not live store quotes. Do not invent store URLs. Do not include markdown, comments, or extra text.`
                },
                {
                    role: 'user',
                    content: aiPrompt
                }
            ],
            response_format: { type: 'json_object' },
            max_tokens: 1200
        });

        return parseAiResponse(chatResponse.choices[0].message.content);
    } catch (err) {
        console.error('OpenAI/OpenRouter call failed:', err.message);
        throw err;
    }
};

// 3. יצירת הדמיה חדשה בעזרת AI
const createRender = async (req, res) => {
    try {
        const body = req.body || {};
        const { text: submittedText, promptText, formDetails: submittedFormDetails, form, uploadedImage, audioUrl } = body;
        const formValues = form && typeof form === 'object'
            ? form
            : (submittedFormDetails && typeof submittedFormDetails === 'object' ? submittedFormDetails : body);
        const formDetails = submittedFormDetails && typeof submittedFormDetails === 'object'
            ? submittedFormDetails
            : {
                roomType: formValues.roomType || formValues.customRoomType || '',
                style: formValues.style || '',
                budget: Number(formValues.budget) || 0,
                dimensions: formValues.dimensions || formValues.roomSize || ''
            };
        const text = submittedText || promptText || Object.entries(formValues)
            .filter(([, value]) => ['string', 'number'].includes(typeof value) && String(value).trim())
            .map(([key, value]) => `${key}: ${value}`)
            .join('. ');
        
        // שליפת ה-userId מתוך המידלוור של האימות (תומך ב-req.userId או req.user._id)
        const userId = req.userId || (req.user && req.user._id);

        if (!userId) {
            return res.status(401).json({ message: 'משתמש חייב להיות מחובר כדי ליצור הדמיה.' });
        }

        const aiPrompt = [
            text,
            `Room type: ${formDetails.roomType || 'not specified'}`,
            `Style: ${formDetails.style || 'not specified'}`,
            formDetails.dimensions ? `Room dimensions: ${formDetails.dimensions}` : '',
            formDetails.budget ? `Maximum budget: ${formDetails.budget} ILS` : ''
        ].filter(Boolean).join('\n');

        const aiData = await buildAiDesignPayload(aiPrompt);
        const generatedItems = (Array.isArray(aiData.items) ? aiData.items : [])
            .filter((item) => typeof item?.name === 'string' && item.name.trim() && Number.isFinite(Number(item.price)) && Number(item.price) >= 0)
            .slice(0, 5)
            .map((item) => ({
                name: item.name.trim(),
                price: Number(item.price),
                link: `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(item.name.trim())}`
            }));

        if (!aiData.summary || generatedItems.length < 3) {
            throw new Error('The design model returned an incomplete summary or fewer than three suitable items.');
        }

        const newRender = await Render.create({
            userId,
            promptText: text || aiPrompt,
            uploadedImage,
            audioUrl,
            formDetails,
            resultImage: '',
            items: generatedItems,
            summary: aiData.summary || ''
        });

        return res.status(201).json({
            id: newRender._id,
            items: newRender.items,
            summary: newRender.summary,
            source: 'OpenRouter free text model'
        });

    } catch (error) {
        const statusCode = error.statusCode || ([402, 429].includes(error.status) ? error.status : 502);
        console.error('Error generating render:', error.message);
        return res.status(statusCode).json({
            message: statusCode === 402
                ? 'המודל החינמי לא זמין בחשבון OpenRouter כרגע.'
                : statusCode === 429
                    ? 'המודל החינמי עמוס כרגע. נסי שוב מאוחר יותר.'
                    : 'יצירת רשימת העיצוב נכשלה. בדקו את הגדרות ה־AI ונסו שוב.',
            error: [402, 429].includes(statusCode) ? `OpenRouter returned HTTP ${statusCode}.` : error.message
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
            .select('_id promptText formDetails summary items createdAt isSaved')
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
            summary: render.summary,
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