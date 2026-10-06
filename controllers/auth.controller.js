const jwt = require('jsonwebtoken'); // ייבוא ספריית JWT ליצירת טוקנים מאובטחים המאמתים את זהות המשתמש
const User = require('../models/user.model.js'); // מייבאת את מודל המשתמש על מנת להשתמש  בו

const ADMIN_EMAILS = new Set([
    '0556758176nr@gmail.com',
    'nava0533160319@gmail.com'
]);

const normalizeRole = (email) => {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    return ADMIN_EMAILS.has(normalizedEmail) ? 'Admin' : 'User';
};

// הגדרת פונקציה שמקבלת מזהה משתמש ומחזירה טוקן מוצפן
const generateToken = (userId) => {
    if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET is not configured.');
    }

    return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
        expiresIn: '15m', // הטוקן יפוג לאחר 15 דקות מטעמי אבטחה
        algorithm: 'HS256'
    });
};

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

const getCurrentUser = async (req, res) => {
    const authorization = req.get('authorization') || '';
    const [scheme, token] = authorization.split(' ');
    if (scheme !== 'Bearer' || !token) {
        return res.status(401).json({ message: 'Authentication required.' });
    }

    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
        const user = await User.findById(payload.id);
        if (!user) return res.status(401).json({ message: 'User not found.' });
        const actualRole = normalizeRole(user.email);
        if (user.role !== actualRole) {
            user.role = actualRole;
            await user.save();
        }
        return res.status(200).json({ user: toUserResponse(user) });
    } catch (error) {
        return res.status(401).json({ message: 'Invalid or expired authentication token.' });
    }
};

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
        //בדיקה במסד הנתונים אם כבר קיים משתמש עם כתובת האימייל הזו.
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

        // אם הגענו עד לכאן זה אומר שהכל היה תקין
        return res.status(201).json({
            // מחזירים את הטוקן שנוצר עבור המשתמש החדש ומחזירים את הנתונים שלו ללא פרטים רגישים
            token: generateToken(user._id),
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

    // שיגאה במקרה וחסרים פרטים
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

        // יצירת טוקן חדש עבור המשתמש  לצורך המשך הפעילות באתר
        // השרת לא זוכר את המשתמש מפעולה לפעולה ולכן צריך ליצור לו מזהה
        // כך השרת "יזכור" אותו מבלי לדרוש סיסמא כל פעם מחדש
        const token = generateToken(user._id);

        // הגדרת אובייקט המשתמש ללא הנתונים החסויים כדי להחזיר אותו
        return res.status(200).json({
            token,
            user: toUserResponse(user)
        });
    } catch (error) {
        console.error('Login failed:', error);
        return res.status(500).json({ message: 'Login failed.' });
    }
}


module.exports = { loginUser, registerUser, getCurrentUser };
