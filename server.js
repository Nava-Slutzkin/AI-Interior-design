// טוען משתני סביבה מקובץ .env, כמו PORT ו-MONGODB_URI
require('dotenv').config();

// מייבא את הספריות הנדרשות לשרת
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const authRoutes = require('./routers/auth.router.js'); //מייבאת את הנתונים מהקובץ הזה
const renderRoutes = require('./routers/render.router.js'); // ייבוא נתיבי ההדמיות.
const adminRoutes = require('./routers/admin.router.js');
const createScheduleBlocker = require('./middlewares/scheduleBlocker.middleware.js');


// יוצר מופע של השרת
const app = express();

// מאפשר בקשות מכל דומיין/פורט לשרת
app.use(cors());

// מאפשר לקבל ולעבד בקשות JSON
app.use(express.json());

//  הגדרת רשימת ה-IP החסומות
// ניתן להזין כאן כתובות IP שברצונך לחסום
const blockedIpsList = [
  '123.45.67.89', 
  '::1' // כתובת IP של localhost (לצורך בדיקה מקומית)
];

// הפעלת ה-Middleware גלובלית
// מומלץ לשים את שורה זו בראש הקובץ (לפני הראוטרים) כדי לחסום גישה מיד בכניסה
app.use(createIpBlocker(blockedIpsList, {
  message: 'הגישה מכתובת ה-IP שלך נחסמה על ידי מנהל המערכת.'
}));

// הגדרת Middleware לחסימת גישה לפי לוח זמנים
app.use(createScheduleBlocker([6], { message: 'האתר סגור כעת' }));

// מאפשר לקבל בקשות URL-encoded, לדוגמה טפסים רגילים
app.use(express.urlencoded({ extended: true }));
// רישום ה-Routes בשרת
app.use('/api/renders', renderRoutes);

app.use('/api/admin', adminRoutes);

app.use('/api/auth', authRoutes);// במקרה והכתובת מתחילה במה שכתוב פה, השרת ילך לקובץ המוגדר

app.use('/api/renders', renderRoutes); // חיבור נתיבי ההדמיות לכתובת הבסיסית.


// בדיקת תקינות
app.get('/', (req, res) => {
  res.send('Server is running successfully!');
});

//  חיבור לוגר השגיאות - בסוף כל הראוטרים!
app.use(createErrorLogger({
  logFilePath: './error.log'
}));

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
