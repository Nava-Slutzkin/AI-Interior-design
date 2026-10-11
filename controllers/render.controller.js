const Render = require('../models/render.model');
const { OpenAI } = require('openai');
const mongoose = require('mongoose');
const fs = require('fs/promises');
const path = require('path');
const { randomInt } = require('crypto');

const roomImagesDirectory = process.env.ROOM_IMAGES_DIR || path.join(__dirname, '..', 'public', 'room-images');
const supportedImageExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

const getRoomFolderName = (roomType) => String(roomType || '')
    .normalize('NFKC')
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
    .replace(/\.{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

const selectRoomImages = async (roomType, excluded = [], count = 3) => {
    const folderName = getRoomFolderName(roomType);
    if (!folderName) return { images: [], hasMore: false };

    const roomDirectory = path.resolve(roomImagesDirectory, folderName);
    if (!roomDirectory.startsWith(`${path.resolve(roomImagesDirectory)}${path.sep}`)) {
        return { images: [], hasMore: false };
    }

    let files;
    try {
        files = await fs.readdir(roomDirectory, { withFileTypes: true });
    } catch (error) {
        if (error.code === 'ENOENT') return { images: [], hasMore: false };
        throw error;
    }

    const excludedNames = new Set(excluded);
    const candidates = files
        .filter((file) => file.isFile() && supportedImageExtensions.has(path.extname(file.name).toLowerCase()))
        .map((file) => file.name)
        .filter((name) => !excludedNames.has(name));

    for (let index = candidates.length - 1; index > 0; index -= 1) {
        const swapIndex = randomInt(index + 1);
        [candidates[index], candidates[swapIndex]] = [candidates[swapIndex], candidates[index]];
    }

    return {
        images: candidates.slice(0, count).map((name) => ({
            name,
            url: `/room-images/${encodeURIComponent(folderName)}/${encodeURIComponent(name)}`
        })),
        hasMore: candidates.length > count
    };
};

const getRoomImages = async (req, res) => {
    try {
        const submittedRoomType = req.body?.roomType ?? req.query.roomType;
        const roomType = typeof submittedRoomType === 'string' ? submittedRoomType.trim() : '';
        if (!roomType) return res.status(400).json({ message: 'Room type is required.' });

        const submittedExcluded = req.body?.exclude ?? req.query.exclude;
        const excluded = Array.isArray(submittedExcluded)
            ? submittedExcluded.filter((name) => typeof name === 'string')
            : (typeof submittedExcluded === 'string' ? [submittedExcluded] : []);
        const { images, hasMore } = await selectRoomImages(roomType, excluded);

        return res.status(200).json({
            images,
            hasMore
        });
    } catch (error) {
        console.error('Error fetching room images:', error);
        return res.status(500).json({ message: 'Failed to fetch room images.' });
    }
};

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
const aiApiKey = process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY;
const aiBaseUrl = process.env.OPENAI_BASE_URL || 'https://openrouter.ai/api/v1';
const aiModel = process.env.AI_MODEL || 'google/gemini-2.0-flash-exp:free';
const aiMultimodalModel = process.env.AI_MULTIMODAL_MODEL || 'google/gemini-2.5-flash';
const openai = new OpenAI({
    apiKey: aiApiKey || 'missing_api_key',
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

const parseEstimatedPrice = (value) => {
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return value;
    if (typeof value !== 'string') return null;

    const normalized = value.trim().replace(/,/g, '').match(/\d+(?:\.\d+)?/);
    if (!normalized) return null;

    const price = Number(normalized[0]);
    return Number.isFinite(price) && price >= 0 ? price : null;
};

const estimateItemPrice = (name) => {
    const priceBands = [
        [/ספה|כורס/, 2600],
        [/מיטה|מזרן/, 2800],
        [/ארון|מזנון|ספריה|ספרייה/, 1900],
        [/שולחן|אי למטבח/, 1250],
        [/כיסא|כורסה/, 650],
        [/מנורה|תאורה|גוף תאורה/, 520],
        [/שטיח/, 850],
        [/וילון/, 600],
        [/שידה|מדף/, 750],
        [/מקרר|תנור|מדיח|כיריים/, 2400]
    ];
    return priceBands.find(([pattern]) => pattern.test(name))?.[1] || 700;
};

const normalizeDesignItems = (items, budget) => {
    const normalizedItems = items.slice(0, 5).map((item) => {
        const name = String(item.name || 'פריט עיצוב');
        const parsedPrice = parseEstimatedPrice(item.price ?? item.estimatedPrice ?? item.cost);
        return {
            name,
            price: parsedPrice && parsedPrice > 0 ? parsedPrice : estimateItemPrice(name),
            link: `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(name)}`
        };
    });

    const total = normalizedItems.reduce((sum, item) => sum + item.price, 0);
    const maxBudget = Number(budget);
    if (Number.isFinite(maxBudget) && maxBudget > 0 && total > maxBudget) {
        let remaining = maxBudget;
        normalizedItems.forEach((item, index) => {
            const proportional = index === normalizedItems.length - 1
                ? remaining
                : Math.max(1, Math.floor((item.price / total) * maxBudget));
            item.price = proportional;
            remaining -= proportional;
        });
    }

    return normalizedItems;
};

const buildAiDesignPayload = async (aiPrompt, attachments = []) => {
    if (!aiApiKey) throw new Error('AI_PROVIDER_NOT_CONFIGURED');

    try {
        const messageContent = [{ type: 'text', text: aiPrompt }];
        attachments.forEach((attachment) => {
            if (attachment.type === 'image') {
                messageContent.push({
                    type: 'image_url',
                    image_url: { url: attachment.dataUrl }
                });
            } else if (attachment.type === 'audio') {
                messageContent.push({
                    type: 'input_audio',
                    input_audio: {
                        data: attachment.base64,
                        format: attachment.format
                    }
                });
            }
        });

        const chatResponse = await openai.chat.completions.create({
            model: attachments.length ? aiMultimodalModel : aiModel,
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
                    content: messageContent
                }
            ],
            response_format: { type: 'json_object' },
            max_tokens: 1200
        });

        const parsed = parseAiResponse(chatResponse.choices[0]?.message?.content);
        if (!Array.isArray(parsed.items) || !parsed.items.length || typeof parsed.summary !== 'string') {
            throw new Error('AI returned an incomplete design.');
        }
        return parsed;
    } catch (err) {
        console.error('OpenAI/OpenRouter call failed:', err.message);
        throw new Error('AI_PROVIDER_UNAVAILABLE');
    }
};

// 3. יצירת הצעת עיצוב ושליפת תמונות מהמאגר המקומי
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
        
        const userId = req.userId || (req.user && req.user._id);

        if (!userId) {
            return res.status(401).json({ message: 'משתמש חייב להיות מחובר כדי ליצור הדמיה.' });
        }

        if (!aiApiKey) {
            return res.status(503).json({ message: 'שירות ה־AI עדיין לא הוגדר. הוסיפו מפתח ספק AI לקובץ .env של השרת.' });
        }

        const attachments = [];
        const addAttachment = (value, expectedType) => {
            if (!value) return;
            if (typeof value !== 'string' || value.length > 14 * 1024 * 1024) {
                throw Object.assign(new Error('קובץ שצורף אינו תקין או גדול מדי (מקסימום 10MB).'), { status: 400 });
            }

            const match = value.match(/^data:(image\/(?:jpeg|png|webp|gif)|audio\/(?:wav|x-wav));base64,([A-Za-z0-9+/]+={0,2})$/i);
            if (!match || !match[1].toLowerCase().startsWith(`${expectedType}/`)) {
                throw Object.assign(new Error(`סוג קובץ ${expectedType === 'image' ? 'התמונה' : 'השמע'} אינו נתמך.`), { status: 400 });
            }
            const base64 = match[2];
            const size = Buffer.from(base64, 'base64').length;
            if (!size || size > 10 * 1024 * 1024) {
                throw Object.assign(new Error('גודל כל קובץ חייב להיות עד 10MB.'), { status: 400 });
            }

            attachments.push({
                type: expectedType,
                dataUrl: value,
                base64,
                format: 'wav'
            });
        };

        addAttachment(uploadedImage, 'image');
        addAttachment(audioUrl, 'audio');

        let aiPrompt = text ? `${text}. ` : '';
        if (formDetails) {
            aiPrompt += `Room type: ${formDetails.roomType || 'any'}. `;
            aiPrompt += `Style: ${formDetails.style || 'modern'}. `;
            if (formDetails.budget) aiPrompt += `Budget: ${formDetails.budget} ILS. `;
        }

        if (attachments.some((attachment) => attachment.type === 'audio')) {
            aiPrompt += ' התייחסו גם להעדפות ולבקשות שנאמרו בהקלטת השמע.';
        }
        if (attachments.some((attachment) => attachment.type === 'image')) {
            aiPrompt += ' התייחסו לתמונה המצורפת כהשראה למצב הקיים ולסגנון המבוקש.';
        }

        const aiData = await buildAiDesignPayload(aiPrompt || 'צור הצעת עיצוב פנים מודרנית ומזמינה.', attachments);
        const generatedItems = normalizeDesignItems(aiData.items, formDetails.budget);

        const { images: roomImages, hasMore } = await selectRoomImages(formDetails.roomType);

        const newRender = await Render.create({
            userId,
            promptText: text || aiPrompt,
            uploadedImage: (uploadedImage?.length || 0) + (audioUrl?.length || 0) <= 14 * 1024 * 1024
                ? uploadedImage
                : undefined,
            audioUrl: (uploadedImage?.length || 0) + (audioUrl?.length || 0) <= 14 * 1024 * 1024
                ? audioUrl
                : undefined,
            formDetails,
            resultImage: roomImages[0]?.url || '',
            resultImages: roomImages.map((image) => image.url),
            imageHasMore: hasMore,
            items: generatedItems,
            summary: aiData.summary || ''
        });

        return res.status(201).json({
            id: newRender._id,
            images: roomImages,
            hasMore,
            source: 'room-library'
        });

    } catch (error) {
        console.error('Error generating render:', error);
        if (error.message === 'AI_PROVIDER_UNAVAILABLE') {
            return res.status(503).json({ message: 'שירות ה־AI אינו זמין כרגע. נסו שוב בעוד כמה דקות.' });
        }
        return res.status(error.status || 500).json({
            message: error.status === 400 ? error.message : 'נכשל ביצירת ההדמיה מול ה-AI.',
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

        const imageUrls = render.resultImages?.length
            ? render.resultImages
            : (render.resultImage?.startsWith('/room-images/') ? [render.resultImage] : []);

        return res.status(200).json({
            id: render._id,
            resultImage: imageUrls[0] || '',
            images: imageUrls.map((url) => ({
                url,
                name: path.basename(decodeURIComponent(url))
            })),
            hasMoreImages: Boolean(render.imageHasMore),
            items: render.items,
            summary: render.summary,
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
    getRoomImages,
    updateRender, 
    deleteRender 
};