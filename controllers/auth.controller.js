const jwt = require('jsonwebtoken'); // ייבוא ספריית JWT ליצירת טוקנים מאובטחים המאמתים את זהות המשתמש
const User = require('../models/user.model.js'); // מייבאת את מודל המשתמש על מנת להשתמש  בו

// הגדרת פונקציה שמקבלת מזהה משתמש ומחזירה טוקן מוצפן
const generateToken = (userId) => {
    return jwt.sign({ id: userId }, process.env.JWT_SECRET || 'fallback-secret-key', {
        expiresIn: '7d' // הטוקן יהיה בתוקף למשך 7 ימים
    });
};

// פונקציה אסינכרונית להתחברות לקוח
const loginUser = async (req, res) => {
    const { email, password } = req.body || {}; // פירוק אובייקט הbody שהתקבל כדי לחלץ אימייל וסיסמא

    // שגיאה במקרה וחסרים פרטים
    if (!email || !password) {
        return res.status(400).json({
            message: 'Email and password are required.'
        });
    }

    try {
        // חיפוש משתמש לפי האימייל שהתקבל מהבקשה במסד נתונים
        const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password');

        // אם המשתמש לא נמצא, מחזירים שגיאה
        if (!user) {
            return res.status(401).json({
                message: 'Invalid email or password.'
            });
        }
        
        // השוואת הסיסמה שהזין המשתמש לסיסמה המוצפנת במסד הנתונים באמצעות פונקציית השוואה
        const isPasswordValid = await user.comparePassword(password);

        // אם הסיסמה לא תואמת, מחזירים שגיאה
        if (!isPasswordValid) {
            return res.status(401).json({
                message: 'Invalid email or password.'
            });
        }

        // יצירת טוקן חדש עבור המשתמש  לצורך המשך הפעילות באתר
        // השרת לא זוכר את המשתמש מפעולה לפעולה ולכן צריך ליצור לו מזהה
        // כך השרת "יזכור" אותו מבלי לדרוש סיסמא כל פעם מחדש
        const token = generateToken(user._id);

        // הגדרת אובייקט המשתמש ללא הנתונים החסויים כדי להחזיר אותו
        const userResponse = {
            _id: user._id,
            name: user.name,
            email: user.email,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt
        };

        return res.status(200).json({
            token,
            user: userResponse
        });
    } catch (error) {
        return res.status(500).json({
            message: 'Login failed.',
            error: error.message
        });
    }
};

//ייצוא הפונקציות על מנת להשתמש בהם במקומות אחרים
module.exports = {
    loginUser
};
