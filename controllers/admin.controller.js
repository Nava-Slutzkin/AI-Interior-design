const User = require('../models/user.model');
const Render = require('../models/render.model');

//פונקציה לקבלת כל המשתמשים, עם בדיקת הרשאות של admin בלבד
exports.getAllUsers = async (req, res) => {
    try {
        const isAdmin = req.user && String(req.user.role || '').toLowerCase() === 'admin';
        // בודק אם המשתמש הוא admin
       if (!isAdmin) {
            return res.status(403).json({ message: 'אין לך הרשאה לצפות במשתמשים' });
        } 
        // שליפת המשתמשים ללא שדה הסיסמה (סודיות ואבטחה)
        const users = await User.find()
            .select('-password')
            .sort({ createdAt: -1 });
    
        return res.status(200).json(users);

    } catch (error) {
        // אם קרתה שגיאה, מחזיר 500 עם פרטי השגיאה
        res.status(500).json({ message: 'שגיאת שרת בקבלת המשתמשים', error: error.message });
    }
};

exports.getAllRenders = async (req, res) => {
    try {
        const isAdmin = req.user && String(req.user.role || '').toLowerCase() === 'admin';
        if (!isAdmin) {
            return res.status(403).json({ message: 'אין לך הרשאה לצפות בהדמיות' });
        }

        const renders = await Render.find()
            .populate('userId', 'name email')
            .sort({ createdAt: -1 })
            .lean();

        return res.status(200).json(renders.map((render) => ({
            id: render._id,
            name: render.formDetails?.roomType ? `עיצוב ${render.formDetails.roomType}` : 'עיצוב',
            ownerName: render.userId?.name || render.userId?.email || 'משתמש שנמחק',
            style: render.formDetails?.style || '-',
            budget: Number(render.formDetails?.budget || 0),
            createdAt: render.createdAt,
            userId: render.userId?._id || render.userId || null
        })));
    } catch (error) {
        return res.status(500).json({ message: 'שגיאת שרת בקבלת ההדמיות', error: error.message });
    }
};


// פונקציה לעדכון תפקיד המשתמש, עם בדיקת הרשאות של admin בלבד   
exports.updateUserRole = async (req, res) => {
    const { id } = req.params;
    const { role } = req.body;
    try {
        const isAdmin = req.user && String(req.user.role || '').toLowerCase() === 'admin';
        // בודק אם המשתמש הוא admin
        if (!isAdmin) {
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

        // בדיקה אם המשתמש קיים במסד הנתונים
        if (!updatedUser) {
            return res.status(404).json({ message: 'משתמש לא נמצא' });
        }

        return res.status(200).json(updatedUser);

    } catch (error) {
        res.status(500).json({ message: 'שגיאת שרת בעדכון תפקיד המשתמש', error: error.message });
    }
};


exports.deleteUser = async (req, res) => {
    const { id } = req.params;
    try {
        const isAdmin = req.user && String(req.user.role || '').toLowerCase() === 'admin';
        // בודק אם המשתמש הוא admin
        if (!isAdmin) {
            return res.status(403).json({ message: 'אין לך הרשאה למחוק משתמשים' });
        }

               // הגנה: מניעת מחיקת החשבון של המנהל עצמו
        if (req.user._id && req.user._id.toString() === id) {
            return res.status(400).json({ message: 'אינך יכול למחוק את החשבון של עצמך' });
        }

        const deletedUser = await User.findByIdAndDelete(id);

        if (!deletedUser) {
            return res.status(404).json({ message: 'המשתמש לא נמצא' });
        }

        await Render.deleteMany({ userId: id });

        return res.status(200).json({ message: 'המשתמש נמחק בהצלחה' });

    } catch (error) {
        res.status(500).json({ message: 'שגיאת שרת במחיקת המשתמש', error: error.message });
    }
};

exports.deleteRender = async (req, res) => {
    try {
        const isAdmin = req.user && String(req.user.role || '').toLowerCase() === 'admin';
        if (!isAdmin) {
            return res.status(403).json({ message: 'אין לך הרשאה למחוק הדמיות' });
        }

        const deletedRender = await Render.findByIdAndDelete(req.params.id);
        if (!deletedRender) {
            return res.status(404).json({ message: 'ההדמיה לא נמצאה' });
        }

        return res.status(200).json({ message: 'ההדמיה נמחקה בהצלחה' });
    } catch (error) {
        return res.status(500).json({ message: 'שגיאת שרת במחיקת ההדמיה', error: error.message });
    }
};


exports.getSystemStats = async (req, res) => {
    try {
        const isAdmin = req.user && String(req.user.role || '').toLowerCase() === 'admin';
        // בודק אם המשתמש הוא admin
        if (!isAdmin) {
            return res.status(403).json({ message: 'אין לך הרשאה לצפייה בסטטיסטיקות המערכת' });
        }

        const totalUsers = await User.countDocuments();
        const totalRenders = await Render.countDocuments();

        // חישוב ממוצע תקציב מתוך כל ההדמיות
        const avgBudgetResult = await Render.aggregate([
            { $group: { _id: null, avgBudget: { $avg: '$formDetails.budget' } } }
        ]);
        const avgBudget = avgBudgetResult.length > 0 ? avgBudgetResult[0].avgBudget : 0;
        const topStyleResult = await Render.aggregate([
            { $match: { 'formDetails.style': { $exists: true, $ne: '' } } },
            { $group: { _id: '$formDetails.style', count: { $sum: 1 } } },
            { $sort: { count: -1, _id: 1 } },
            { $limit: 1 }
        ]);

        return res.status(200).json({
            totalUsers,
            totalRenders,
            topStyle: topStyleResult[0]?._id || '-',
            avgBudget
        });

    } catch (error) {
        res.status(500).json({ message: 'שגיאת שרת בקבלת סטטיסטיקות המערכת', error: error.message });
    }
};





