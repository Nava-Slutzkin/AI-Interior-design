const User = require('../models/user.model.js');
const jwt = require('jsonwebtoken');

const ADMIN_EMAILS = new Set([
    process.env.ADMIN1_EMAIL,
    process.env.ADMIN2_EMAIL
]);

const normalizeRole = (email) => {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    return ADMIN_EMAILS.has(normalizedEmail) ? 'Admin' : 'User';
};

// יצירת טוקן JWT
const generateToken = (userId) => {
    return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

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
    const { name, phone, email, password, accountMode, adminCode } = req.body || {};
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const normalizedName = typeof name === 'string' ? name.trim() : '';
    const normalizedPhone = typeof phone === 'string' ? phone.trim() : '';

    if (!normalizedName || !normalizedPhone || !normalizedEmail || typeof password !== 'string' || !password) {
        return res.status(400).json({ message: 'Name, phone, email, and password are required.' });
    }

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
        const existingUser = await User.findOne({ email: normalizedEmail }).select('_id');
        if (existingUser) {
            return res.status(409).json({ message: 'A user with this email already exists.' });
        }

        const user = await User.create({
            name: normalizedName,
            phone: normalizedPhone,
            email: normalizedEmail,
            password,
            role: requestedAdmin ? 'Admin' : 'User'
        });

        const token = generateToken(user._id);

        return res.status(201).json({
            token,
            user: toUserResponse(user)
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ message: 'A user with this email already exists.' });
        }
        console.error('Registration failed:', error);
        return res.status(500).json({ message: 'Registration failed.' });
    }
};

// פונקציה אסינכרונית להתחברות לקוח
const loginUser = async (req, res) => {
    const { email, password } = req.body || {};

    if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
        return res.status(400).json({ message: 'Email and password are required.' });
    }

    try {  
        const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+password');
        if (!user || !(await user.comparePassword(password))) {
            return res.status(401).json({ message: 'Invalid email or password.' });
        }

        const actualRole = normalizeRole(user.email);
        if (user.role !== actualRole) {
            user.role = actualRole;
            await user.save();
        }

        const token = generateToken(user._id);

        return res.status(200).json({
            token,
            user: toUserResponse(user)
        });
    } catch (error) {
        console.error('Login failed:', error);
        return res.status(500).json({ message: 'Login failed.' });
    }
};

// שליפת המשתמש הנוכחי באמצעות טוקן מההדר (Header)
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

const logoutUser = (req, res) => {
    // בשיטת JWT ההתנתקות מתבצעת בצד לקוח על ידי מחיקת הטוקן
    return res.status(200).json({ message: 'Logged out.' });
};

module.exports = { loginUser, registerUser, getCurrentUser, logoutUser };