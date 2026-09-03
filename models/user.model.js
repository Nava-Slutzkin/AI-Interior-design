const mongoose = require('mongoose'); // ייבוא הסיפרייה כדי לאפשר בניית סכמה
const bcrypt = require('bcrypt'); // ספריה המשתמשת להצפנה מאובטחת

// הגדרת מבנה נתונים חדש
const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true, // שדה חובה
        trim: true, // מסיר רווחים מתחילת וסוף המשפט
        maxlength: 100
    },
    phone: { 
        type: String,
        required: true,
        trim: true,
        maxlength: 20
    },
    email: {
        type: String,
        required: true,
        unique: true, // מונע הכנסת משתמשים עם אותו אימייל
        lowercase: true, // ממיר לאותיות קטנות אוטומטי
        trim: true,
        maxlength: 254
    },
    password: {
        type: String,
        required: true,
        select: false,//מונע מהסיסמה לחזור כברירת מחדל בשאילתות חיפוש
        minlength: 8,
        maxlength: 12 
    }
}, { timestamps: true }); // מוסיף אוטומטי שתי שדות למסמך: תאריך יצירה ותאריך שינוי ארוך.

// פונקציה שמופעלת לפני שמירת המשתמש במסד הנתונים
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next(); // אם הסיסמה לא השתנתה מאז הפעם האחרונה, אין צורך להצפין אותה שוב – ממשיכים הלאה

    try {
        const salt = await bcrypt.genSalt(10);// מייצרת "מלח"  – מחרוזת אקראית שמחוזקת לתהליך ההצפנה כדי להפוך אותה לבטוחה יותר מפני פריצה.
        this.password = await bcrypt.hash(this.password, salt); // מצפינה את הסיסמא הגולמית יחד עם "המלח" ושמירה של הסיסמא המוצפנת
        next();
    } catch (error) {
        next(error);
    }
});


//מוסיפה פונקציה מותאמת אישית לכל אובייקט משתמש, שמשווה בין סיסמה שהוזנה בזמן התחברות (candidatePassword) לבין הסיסמה המוצפנת השמורה במסד
userSchema.methods.comparePassword = async function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password); // מחזירה תוצאה בוליאנית האם הסיסמאות תואמות או לא
};

// ייצור המודל על שם USER וייצוא לשימוש במקומות אחרים
module.exports = mongoose.model('User', userSchema);
