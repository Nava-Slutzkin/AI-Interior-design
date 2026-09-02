const User = require('../models/user.model');

//פונקציה לקבלת כל המשתמשים, עם בדיקת הרשאות של admin בלבד
exports.getAllUsers = async (req, res) => {
    try {
        // בודק אם המשתמש הוא admin
       if (!req.user || req.user.role !== 'Admin') {
            return res.status(403).json({ message: 'אין לך הרשאה לצפות במשתמשים' });
        } 
        // שליפת המשתמשים ללא שדה הסיסמה (סודיות ואבטחה)
        const users = await User.find()
            .select('-password')
            .skip(skip)
            .limit(limit);

        return res.status(200).json(users);

    } catch (error) {
        // אם קרתה שגיאה, מחזיר 500 עם פרטי השגיאה
        res.status(500).json({ message: 'שגיאת שרת בקבלת המשתמשים', error: error.message });
    }
};