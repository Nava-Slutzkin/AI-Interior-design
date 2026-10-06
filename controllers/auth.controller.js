const User = require('../models/user.model.js'); // מייבאת את מודל המשתמש על מנת להשתמש בו

const ADMIN_EMAILS = new Set([
    process.env.ADMIN1_EMAIL,
    process.env.ADMIN2_EMAIL
]);

const normalizeRole = (email) => {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    return ADMIN_EMAILS.has(normalizedEmail) ? 'Admin' : 'User';
};

const startSession = (req, userId) => new Promise((resolve, reject) => {
    req.session.regenerate((regenerateError) => {
        if (regenerateError) return reject(regenerateError);
        req.session.userId = String(userId);
        req.session.save((saveError) => {
            if (saveError) return reject(saveError);
            resolve();
        });
    });
});

const clearSessionCookie = (res) => res.clearCookie('aihome.sid', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/'
});

// פונקציה שמקבלת אובייקט משתמש ומחזירה אובייקט חדש להחזרה שמכיל רק נתונים לא רגישים
const toUserResponse = (user) => ({
    _id: user._id,
    name: user.name,
    phone: user.phone,
    email: user.email,
    role: user.role || 'User',
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
});

// פונקציה אסינכרונית לרישום משתמש חדש
const registerUser = async (req, res) => {
    const { name, phone, email, password, accountMode, adminCode } = req.body || {}; // חילוץ הנתונים מהבאדי
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''; // נירמול הנתונים שיהיו בתבנית אחידה
    const normalizedName = typeof name === 'string' ? name.trim() : '';
    const normalizedPhone = typeof phone === 'string' ? phone.trim() : '';

    // זריקת שגיאה במקרה וחסר נתון
    if (!normalizedName || !normalizedPhone || !normalizedEmail || typeof password !== 'string' || !password) {
        return res.status(400).json({ message: 'Name, phone, email, and password are required.' });
    }

    // בדיקת תקינות למייל מספר טלפון וסיסמא
    if (normalizedName.length > 100 || normalizedEmail.length > 254 || normalizedPhone.length > 20 || password.length < 8 || password.length > 128 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) || !/^\+?[\d\s().-]{7,20}$/.test(normalizedPhone)) {
        return res.status(400).json({ message: 'Name, phone, email, or password is invalid.' });
    }

    const isAdminEmail = ADMIN_EMAILS.has(normalizedEmail);
    const requestedAdmin = accountMode === 'Admin';
    if (requestedAdmin && (!isAdminEmail || !process.env.ADMIN_REGISTRATION_CODE || adminCode !== process.env.ADMIN_REGISTRATION_CODE)) {
        return res.status(403).json({ message: 'הרשמת מנהלים דורשת כתובת מאושרת וקוד הזמנה תקין.' });
    }
    if (isAdminEmail && !requestedAdmin) {
        return res.status(403).json({ message: 'כתובת זו שמורה למנהל. יש לבחור במצב מנהל.' });
    }

    try {
        // בדיקה במסד הנתונים אם כבר קיים משתמש עם כתובת האימייל הזו.
        const existingUser = await User.findOne({ email: normalizedEmail }).select('_id');
        if (existingUser) {
            return res.status(409).json({ message: 'A user with this email already exists.' });
        }

        // יצירת משתמש חדש לשמירה במסד נתונים
        const user = await User.create({
            name: normalizedName,
            phone: normalizedPhone,
            email: normalizedEmail,
            password,
            role: requestedAdmin ? 'Admin' : 'User'
        });
        await startSession(req, user._id);

        return res.status(201).json({
            user: toUserResponse(user)
        });
    } catch (error) { // טיפול בשגיאות
        if (error.code === 11000) {
            return res.status(409).json({ message: 'A user with this email already exists.' });
        }
        console.error('Registration failed:', error);
        return res.status(500).json({ message: 'Registration failed.' });
    }
};

// פונקציה אסינכרונית להתחברות לקוח
const loginUser = async (req, res) => {
    const { email, password } = req.body || {}; // פירוק אובייקט הbody שהתקבל כדי לחלץ אימייל וסיסמא

    // שגיאה במקרה וחסרים פרטים
    if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
        return res.status(400).json({ message: 'Email and password are required.' });
    }

    try {  
        // מנסים למצוא את המשתמש לפי כתובת המייל, מנקים רווחים והופכים לאותיות קטנות, שולפים גם את הסיסמא המוצפנת לצורך אימות
        const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+password');
        // אם המשתמש לא נמצא או שהסיסמא שגויה מוחזרת שגיאה
        if (!user || !(await user.comparePassword(password))) {
            return res.status(401).json({ message: 'Invalid email or password.' });
        }

        const actualRole = normalizeRole(user.email);
        if (user.role !== actualRole) {
            user.role = actualRole;
            await user.save();
        }

        // יצירת סשן חדש עבור המשתמש לצורך המשך הפעילות באתר
        await startSession(req, user._id);
        return res.status(200).json({
            user: toUserResponse(user)
        });
    } catch (error) {
        console.error('Login failed:', error);
        return res.status(500).json({ message: 'Login failed.' });
    }
};

// פונקציה לשליפת המשתמש המחובר הנוכחי (מסתמכת על המידלוור שאבטח את הנתיב)
const getCurrentUser = (req, res) => {
    return res.status(200).json({ user: toUserResponse(req.user) });
};

// פונקציה להתנתקות משתמש
const logoutUser = (req, res) => {
    req.session.destroy((error) => {
        clearSessionCookie(res);
        if (error) return res.status(500).json({ message: 'Logout failed.' });
        return res.status(200).json({ message: 'Logged out.' });
    });
};

module.exports = { loginUser, registerUser, getCurrentUser, logoutUser };