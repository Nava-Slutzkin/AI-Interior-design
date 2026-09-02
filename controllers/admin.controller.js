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


// פונקציה לעדכון תפקיד המשתמש, עם בדיקת הרשאות של admin בלבד   
exports.updateUserRole = async (req, res) => {
    const { id } = req.params;
    const { role } = req.body;
    try {
        // בודק אם המשתמש הוא admin
        if (!req.user || req.user.role !== 'Admin') {
            return res.status(403).json({ message: 'אין לך הרשאה לעדכן את תפקיד המשתמש' });
        }   

        // בדיקה שנשלח תפקיד לעדכון
        if (!role) {
            return res.status(400).json({ message: 'יש לספק תפקיד חדש לעדכון' });
        }

        const updatedUser = await User.findByIdAndUpdate(
            id,
            { role },
            { new: true, runValidators: true }
        ).select('-password'); // לא מחזיר את הסיסמה 

        return res.status(200).json(updatedUser);

    } catch (error) {
        res.status(500).json({ message: 'שגיאת שרת בעדכון תפקיד המשתמש', error: error.message });
    }
};


