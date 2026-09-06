const { OpenAI } = require('openai');
const Render = require('../models/render.model.js');
const mongoose = require('mongoose'); // ייבוא Mongoose כדי לבדוק מזהי ObjectId.

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

// שליפת כל ההדמיות של המשתמש המאומת עם חיפוש ודפדוף בין עמודים.
const getUserRenders = async (req, res) => {
    try { // התחלת בלוק טיפול בשגיאות עבור פעולות מסד הנתונים.
        const userId = req.userId; // קבלת מזהה המשתמש שה-middleware אימת.
        const page = Number.parseInt(req.query.page, 10) || 1; // קריאת מספר העמוד או שימוש בעמוד הראשון.
        const limit = Number.parseInt(req.query.limit, 10) || 10; // קריאת גודל העמוד או שימוש בעשרה פריטים.
        const search = typeof req.query.search === 'string' ? req.query.search.trim() : ''; // ניקוי טקסט החיפוש אם נשלח.

        if (!userId || !mongoose.isValidObjectId(userId)) { // בדיקה שקיים מזהה משתמש תקין.
            return res.status(401).json({ message: 'Authentication required.' }); // החזרת שגיאת הרשאה אם המשתמש אינו מאומת.
        }

        if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100) { // הגבלת ערכי הדפדוף לטווח בטוח.
            return res.status(400).json({ message: 'Page and limit must be valid positive numbers.' }); // החזרת שגיאה עבור פרמטרים לא תקינים.
        }

        const filter = { userId }; // התחלת מסנן שמחזיר רק הדמיות של המשתמש המאומת.
        if (search) { // הוספת חיפוש רק אם הלקוח שלח טקסט.
            const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // הגנה מפני תווי Regex מיוחדים שהמשתמש שלח.
            const searchRegex = new RegExp(escapedSearch, 'i'); // יצירת חיפוש שאינו תלוי באותיות גדולות או קטנות.
            filter.$or = [{ promptText: searchRegex }, { 'formDetails.roomType': searchRegex }]; // חיפוש בתיאור החדר או בסוג החדר.
        }

        const renders = await Render.find(filter) // שליפת ההדמיות המתאימות מהמסד.
            .sort({ createdAt: -1 }) // הצגת ההדמיות החדשות ביותר קודם.
            .skip((page - 1) * limit) // דילוג על הרשומות של העמודים הקודמים.
            .limit(limit); // הגבלת מספר הרשומות בעמוד הנוכחי.

        return res.status(200).json(renders); // החזרת מערך ההדמיות ללקוח.
    } catch (error) { // תפיסת שגיאות בלתי צפויות בשליפה.
        console.error('Error fetching user renders:', error); // רישום פרטי השגיאה בצד השרת.
        return res.status(500).json({ message: 'Failed to fetch renders.' }); // החזרת שגיאת שרת כללית ללא חשיפת פרטים פנימיים.
    }
};

// שליפת הדמיה יחידה לפי מזהה, רק אם היא שייכת למשתמש המאומת.
const getRenderById = async (req, res) => {
    try { // התחלת בלוק טיפול בשגיאות עבור פעולת מסד הנתונים.
        const userId = req.userId; // קבלת מזהה המשתמש שה-middleware אימת.
        const { id } = req.params; // קבלת מזהה ההדמיה מכתובת הבקשה.

        if (!userId || !mongoose.isValidObjectId(userId)) { // בדיקה שקיים משתמש מאומת עם מזהה תקין.
            return res.status(401).json({ message: 'Authentication required.' }); // החזרת שגיאת הרשאה אם המשתמש אינו מאומת.
        }

        if (!mongoose.isValidObjectId(id)) { // בדיקה שמזהה ההדמיה הוא ObjectId תקין.
            return res.status(404).json({ message: 'Render not found.' }); // החזרת 404 כדי לא לחשוף מידע על מזהים קיימים.
        }

        const render = await Render.findOne({ _id: id, userId }); // שליפת ההדמיה תוך הגבלת הגישה לבעלים שלה.
        if (!render) { // בדיקה שההדמיה קיימת ושייכת למשתמש.
            return res.status(404).json({ message: 'Render not found.' }); // החזרת שגיאה אם ההדמיה לא נמצאה.
        }

        return res.status(200).json({ // החזרת מבנה תגובה יציב וברור ללקוח.
            id: render._id, // החזרת מזהה ההדמיה.
            resultImage: render.resultImage, // החזרת כתובת תמונת ההדמיה.
            items: render.items, // החזרת רשימת הרהיטים והאביזרים.
            promptText: render.promptText, // החזרת תיאור החדר המקורי.
            formDetails: render.formDetails, // החזרת פרטי הטופס אם נשמרו.
            createdAt: render.createdAt // החזרת מועד יצירת ההדמיה.
        });
    } catch (error) { // תפיסת שגיאות בלתי צפויות בשליפת ההדמיה.
        console.error('Error fetching render:', error); // רישום פרטי השגיאה בצד השרת.
        return res.status(500).json({ message: 'Failed to fetch render.' }); // החזרת שגיאת שרת כללית ללא פרטים פנימיים.
    }
};

// ייצוא של פונקציית היצירה ושתי פונקציות השליפה לשימוש בנתיבי Express.
module.exports = { createRender, getUserRenders, getRenderById };