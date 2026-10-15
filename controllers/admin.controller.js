import User from '../models/user.model.js';
import Render from '../models/render.model.js';
import { calculateEstimatedBudget } from '../utils/render.utils.js';
import { isAdminEmail } from '../config/admin.config.js';

//פונקציה לקבלת כל המשתמשים, עם בדיקת הרשאות של admin בלבד
export const getAllUsers = async (req, res) => {
    try {
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

// פונקציה לעדכון תפקיד המשתמש, עם בדיקת הרשאות של admin בלבד   
export const updateUserRole = async (req, res) => {
    const { id } = req.params;
    const { role } = req.body;
    try {
        // בדיקה שנשלח תפקיד לעדכון
        if (!role) {
            return res.status(400).json({ message: 'יש לספק תפקיד חדש לעדכון' });
        }

        const targetUser = await User.findById(id);
        if (!targetUser) {
            return res.status(404).json({ message: 'משתמש לא נמצא' });
        }
        if (String(role).toLowerCase() === 'admin' && !isAdminEmail(targetUser.email)) {
            return res.status(403).json({ message: 'לא ניתן להעניק הרשאת מנהל לחשבון זה.' });
        }
        if (String(targetUser.role).toLowerCase() === 'admin' && String(role).toLowerCase() !== 'admin') {
            return res.status(403).json({ message: 'לא ניתן להסיר הרשאת מנהל מחשבון מנהל מוגן.' });
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


export const deleteUser = async (req, res) => {
    const { id } = req.params;
    try {
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

export const getSystemStats = async (req, res) => {
    try {
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

export const getAllRenders = async (req, res) => {
    try {
        const renders = await Render.find()
            .select('_id userId formDetails promptText summary items estimatedBudget createdAt')
            .populate('userId', 'name email')
            .sort({ createdAt: -1 });
        return res.status(200).json(renders.map((render) => ({
            ...render.toObject(),
            estimatedBudget: Number(render.estimatedBudget || calculateEstimatedBudget(render.items)),
            ownerName: render.userId?.name || render.userId?.email || 'לא ידוע',
            userId: render.userId?._id || render.userId
        })));
    } catch (error) {
        return res.status(500).json({ message: 'שגיאת שרת בקבלת ההדמיות.' });
    }
};

export const deleteRender = async (req, res) => {
    try {
        const deleted = await Render.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ message: 'ההדמיה לא נמצאה.' });
        return res.status(200).json({ message: 'ההדמיה נמחקה.' });
    } catch (error) {
        return res.status(400).json({ message: 'לא ניתן למחוק את ההדמיה.' });
    }
};





