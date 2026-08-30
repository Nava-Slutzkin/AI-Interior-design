const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middlewares
app.use(cors());
app.use(express.json()); // מאפשר לקבל מידע בפורמט JSON בבקשות POST

// בדיקת תקינות שהשרת עובד
app.get('/', (req, res) => {
    res.send('Server is running successfully!');
});

// הגדרת הפורט והרצת השרת
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});