
import 'dotenv/config';

// מייבא את הספריות הנדרשות לשרת
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import session from 'express-session';
import { MongoStore } from 'connect-mongo';
import mongoose from 'mongoose';
import authRoutes from './routers/auth.router.js'; //מייבאת את הנתונים מהקובץ הזה
import renderRoutes from './routers/render.router.js'; // ייבוא נתיבי ההדמיות.
import adminRoutes from './routers/admin.router.js';
import { createScheduleBlocker, createIpBlocker, createErrorLogger } from './middlewares/custom.middleware.js'; // ייבוא המידלוור המותאם אישית

const __dirname = path.dirname(fileURLToPath(import.meta.url));


// יוצר מופע של השרת
const app = express();

// מאפשר בקשות מכל   דומיין/פורט לשרת
// מאפשר בקשות מהדומיין של האתר ב-Render ומהסביבה המקומית
const allowedOrigins = new Set([
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:1000',
  'https://ai-home-design.onrender.com', // הוספת הדומיין של האתר הסטטי
  ...(process.env.CLIENT_ORIGINS || '').split(',').map((origin) => origin.trim()).filter(Boolean)
]);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(new Error('Origin is not allowed by CORS.'));
  },
  credentials: true
}));

app.use('/room-images', express.static(
  process.env.ROOM_IMAGES_DIR || path.join(__dirname, 'public', 'room-images'),
  { fallthrough: false, index: false }
));

// מאפשר לקבל ולעבד בקשות JSON
app.use(express.json({ limit: '16mb' }));
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
app.use(createScheduleBlocker([6], {
  message: 'האתר סגור כעת',
  timeZone: 'Asia/Jerusalem',
  saturdayReopenHour: 19
}));

// מאפשר לקבל בקשות URL-encoded, לדוגמה טפסים רגילים
app.use(express.urlencoded({ extended: true }));
// רישום ה-Routes בשרת
app.use('/api/renders', renderRoutes);

app.use('/api/admin', adminRoutes);

app.use('/api/auth', authRoutes);// במקרה והכתובת מתחילה במה שכתוב פה, השרת ילך לקובץ המוגדר


// חיבור לוגר השגיאות - בסוף כל הראוטרים!
app.use(createErrorLogger({
  logFilePath: './error.log'
}));

// הגדרת הפורט לשרת (תמיכה בפורט דינמי של Render או ברירת מחדל 1000)
const PORT = process.env.PORT || 1000;

// חיבור הדטאבייס והפעלת השרת
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