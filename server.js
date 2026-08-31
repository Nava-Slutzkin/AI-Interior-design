// טוען משתני סביבה מקובץ .env, כמו PORT ו-MONGODB_URI
require('dotenv').config();

// מייבא את הספריות הנדרשות לשרת
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const renderRoutes = require('./routes/render.routes');

// יוצר מופע של השרת
const app = express();

// מאפשר בקשות מכל דומיין/פורט לשרת
app.use(cors());

// מאפשר לקבל ולעבד בקשות JSON
app.use(express.json());

// מאפשר לקבל בקשות URL-encoded, לדוגמה טפסים רגילים
app.use(express.urlencoded({ extended: true }));

// כל הנתיבים של Render יהיו תחת /api/renders
app.use('/api/renders', renderRoutes);

// נתיב בסיסי לבדיקה שהשרת חי
app.get('/', (req, res) => {
  res.send('Server is running successfully!');
});
