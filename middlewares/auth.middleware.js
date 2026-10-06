const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const User = require('../models/user.model');

const requireAuth = async (req, res, next) => {
    const authorization = req.get('authorization') || '';
    const [scheme, token] = authorization.split(' ');
    let userId = req.session?.userId;

    if (scheme === 'Bearer' && token) {
        try {
            const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
            userId = payload.id;
        } catch (error) {
            return res.status(401).json({ message: 'Invalid or expired authentication token.' });
        }
    }

    if (!userId) {
        return res.status(401).json({ message: 'Authentication required.' });
    }

    try {
        if (!mongoose.isValidObjectId(userId)) {
            return res.status(401).json({ message: 'Invalid authentication token.' });
        }

        const user = await User.findById(userId).select('-password');
        if (!user) {
            return res.status(401).json({ message: 'User not found.' });
        }

        req.userId = userId;
        req.user = user;
        return next();
    } catch (error) {
        console.error('Authentication failed:', error.message);
        return res.status(401).json({ message: 'Authentication required.' });
    }
};





module.exports = requireAuth;
