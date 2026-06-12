const Message = require('../models/Message');

const wecomService = require('../services/wecomService');

const verifyWebhook = (req, res) => {

    const echostr = req.query.echostr;

    res.send(echostr);
};

const receiveMessage = async (req, res) => {

    try {

        const rawBody = req.body;
        let body = rawBody;

        // XML support
        if (typeof body === 'string') {

            const parsed = await wecomService.parseXML(body);

            body = parsed.xml;
        }

        // Save message
        const message = new Message({

            sender: body.FromUserName,

            receiver: body.ToUserName,

            msgType: body.MsgType,

            content: body.Content,

            body

        });

        await message.save();

        console.log('Message Saved');

        res.json({
            success: true,
            message: 'Message received',
            data: body
        });

    } catch (error) {

        console.log(error);

        res.status(500).json({
            success: false,
            error: 'Server Error',
            details: error.message
        });
    }
};

module.exports = {
    verifyWebhook,
    receiveMessage
};