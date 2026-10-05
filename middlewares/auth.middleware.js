const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/user.model');

const requireAuth = async (req, res, next) => {
    const authorization = req.get('authorization') || '';
    const [scheme, token] = authorization.split(' ');

    if (scheme !== 'Bearer' || !token) {
        return res.status(401).json({ message: 'Authentication required.' });
    }

    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
        if (!payload.id || !mongoose.isValidObjectId(payload.id)) {
            return res.status(401).json({ message: 'Invalid authentication token.' });
        }

        const user = await User.findById(payload.id).select('-password');
        if (!user) {
            return res.status(401).json({ message: 'User not found.' });
        }

        req.userId = payload.id;
        req.user = user;
        return next();
    } catch (error) {
        console.error('Authentication error:', error);
        return res.status(401).json({ message: 'Invalid or expired authentication token.' });
    }
};





module.exports = requireAuth;
