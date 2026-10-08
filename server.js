// טוען משתני סביבה מקובץ .env, כמו PORT ו-MONGODB_URI
require('dotenv').config();

// מייבא את הספריות הנדרשות לשרת
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const { MongoStore } = require('connect-mongo');
const mongoose = require('mongoose');
const authRoutes = require('./routers/auth.router.js'); //מייבאת את הנתונים מהקובץ הזה
const renderRoutes = require('./routers/render.router.js'); // ייבוא נתיבי ההדמיות.
const adminRoutes = require('./routers/admin.router.js');
const {createScheduleBlocker,createIpBlocker,createErrorLogger} = require('./middlewares/custom.middleware.js'); // ייבוא המידלוור המותאם אישית


// יוצר מופע של השרת
const app = express();

// מאפשר בקשות מכל   דומיין/פורט לשרת
const allowedOrigins = new Set([
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  ...(process.env.CLIENT_ORIGINS || '').split(',').map((origin) => origin.trim()).filter(Boolean)
]);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(new Error('Origin is not allowed by CORS.'));
  },
  credentials: true
}));

// מאפשר לקבל ולעבד בקשות JSON
app.use(express.json());
app.use(session({
  name: 'aihome.sid',
  secret: process.env.JWT_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    collectionName: 'sessions',
    ttl: 60 * 60 * 24 * 7

  }),
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 24 * 7
  }
}));


// בדיקת תקינות
app.get('/', (req, res) => {
  res.send('Server is running successfully!');
});

// הגדרת Middleware לחסימת גישה לפי לוח זמנים
app.use(createScheduleBlocker([6], { message: 'האתר סגור כעת' }));

// מאפשר לקבל בקשות URL-encoded, לדוגמה טפסים רגילים
app.use(express.urlencoded({ extended: true }));
// רישום ה-Routes בשרת
app.use('/api/renders', renderRoutes);

app.use('/api/admin', adminRoutes);

app.use('/api/auth', authRoutes);// במקרה והכתובת מתחילה במה שכתוב פה, השרת ילך לקובץ המוגדר


//  חיבור לוגר השגיאות - בסוף כל הראוטרים!
app.use(createErrorLogger({
  logFilePath: './error.log'
}));

const PORT = process.env.PORT || 1000; // הגדרת הכתובת שעליה ירוץ האתר והוספת ערך ברירת מחדל

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
