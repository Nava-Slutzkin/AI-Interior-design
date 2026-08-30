const mongoose = require('mongoose');

const renderSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    originalImage: { type: String },
    promptText: { type: String },
    resultImage: { type: String, required: true },
    items: [{
        name: String,
        price: Number,
        link: String
    }],
    budget: { type: Number },
    style: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Render', renderSchema);