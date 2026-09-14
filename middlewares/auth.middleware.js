const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const requireAuth = (req, res, next) => {
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

        req.userId = payload.id;
        return next();
    } catch (error) {
        console.error('Authentication error:', error);
        return res.status(401).json({ message: 'Invalid or expired authentication token.' });
    }
};

module.exports = requireAuth;
