// מייבא את Mongoose כדי להגדיר את הסכמה למסד הנתונים
const mongoose = require('mongoose');

// מגדיר את הסכמה של אובייקט Render
const renderSchema = new mongoose.Schema({
    // מזהה המשתמש שההדמיה שייכת לו
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    // תמונה מקורית, לא חובה
    originalImage: { type: String },

    // טקסט ההנחיה/פרומפט, לא חובה
    promptText: { type: String },

    // תמונת התוצאה הסופית, חובה
    resultImage: { type: String, required: true },

    // מערך של פריטים/מוצרים שקשורים להדמיה
    items: [{
        name: String,
        price: Number,
        link: String
    }],

    // תקציב אפשרי עבור ההדמיה
    budget: { type: Number },

    // סגנון עיצובי/סטייל
    style: { type: String }
}, { timestamps: true });

// מייצא את המודל בשם Render כדי להשתמש בו ב-controller
module.exports = mongoose.model('Render', renderSchema);