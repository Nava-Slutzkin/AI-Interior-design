const { OpenAI } = require('openai');
const Render = require('../models/render.model.js');

// הפעלת החיבור ל-OpenAI באמצעות המפתח מקובץ ה-.env
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const createRender = async (req, res) => {
    try {
        // 1. חילוץ הנתונים שהגיעו מהלקוח (אחרי שסודרו באובייקט)
        const { text, formDetails, uploadedImage, audioUrl } = req.body;

        // מציאת מזהה המשתמש (בהנחה שיש Middleware של התחברות ששם את ה-ID ב-req.user)
        const userId = req.userId;

        if (!userId) {
            return res.status(401).json({ message: 'User must be authenticated.' });
        }
        // 2. בניית הפרומפט (ההנחיה) ל-AI מתוך שלל הנתונים
        let aiPrompt = text ? `${text}. ` : '';
        if (formDetails) {
            aiPrompt += `Room type: ${formDetails.roomType || 'any'}. `;
            aiPrompt += `Style: ${formDetails.style || 'modern'}. `;
            if (formDetails.budget) aiPrompt += `Budget: ${formDetails.budget} ILS. `;
        }

        // 3. קריאה ל-DALL-E 3 ליצירת תמונת ההדמיה
        const imageResponse = await openai.images.generate({
            model: "dall-e-3",
            prompt: `A highly realistic interior design photo of: ${aiPrompt}. Photorealistic, beautifully lit, 8k resolution.`,
            n: 1, // תמונה אחת
            size: "1024x1024",
        });
        const resultImageUrl = imageResponse.data[0].url;

        // 4. קריאה ל-GPT-4o-mini ליצירת רשימת הרהיטים (רשימת הקניות)
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
            // הכרחת המודל להחזיר אובייקט JSON תקני כדי שנוכל לשמור ב-DB
            response_format: { type: "json_object" }
        });

        // המרת התשובה מה-AI (שהיא טקסט בפורמט JSON) לאובייקט JavaScript אמיתי
        const aiData = JSON.parse(chatResponse.choices[0].message.content);
        const generatedItems = aiData.items || [];

        // 5. שמירת ההדמיה והנתונים ב-MongoDB
        const newRender = await Render.create({
            userId,
            promptText: text,
            uploadedImage,
            audioUrl,
            formDetails, // הנתונים נשמרים כפי שהם כדי לשמש את הסטטיסטיקות של דף המנהל
            resultImage: resultImageUrl,
            items: generatedItems
        });

        // 6. החזרת התשובה ללקוח כדי שיוכל להציג את דף התוצאה
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

module.exports = { createRender };