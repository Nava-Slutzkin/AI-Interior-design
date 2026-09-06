require('dotenv').config(); // טוענת משתני סביבה מקובץ .env
const express = require('express'); // ייבוא ספריית Express 
const cors = require('cors'); // ייבוא ספריית CORS שהיא מאפשרת לקבל בקשות לשרת ממקורות שונים
const mongoose = require('mongoose'); //חיבור לדטא-בייס
const authRoutes = require('./routers/auth.router.js'); //מייבאת את הנתונים מהקובץ הזה
const renderRoutes = require('./routers/render.router.js'); // ייבוא נתיבי ההדמיות.

const app = express(); // יצירת מופע של אפליקציית Express

app.use(cors()); // הגדרה לשרת לקבל בקשות ממקורות שונים
app.use(express.json()); // הגדרה לשרת לקבל בקשות עם תוכן JSON

// בדיקת תקינות
app.get('/', (req, res) => {
    res.send('Server is running successfully!');
});

app.use('/api/auth', authRoutes);// במקרה והכתובת מתחילה במה שכתוב פה, השרת ילך לקובץ המוגדר
app.use('/api/renders', renderRoutes); // חיבור נתיבי ההדמיות לכתובת הבסיסית.

const PORT = process.env.PORT || 5000; // הגדרת הכתובת שעליה ירוץ האתר והוספת ערך ברירת מחדל

// חיבור הדטאבייס
const startServer = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB connected successfully');

        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });
    } catch (error) {
        console.error('MongoDB connection failed:', error.message);
        process.exit(1);
    }
};

startServer(); // קריאה לפונקציה שמתחילה את השרת
