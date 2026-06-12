const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
    sender: {
        type: String,
        default: ''
    },
    receiver: {
        type: String,
        default: ''
    },
    msgType: {
        type: String,
        default: ''
    },
    content: {
        type: String,
        default: ''
    },
    body: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Message', MessageSchema);
