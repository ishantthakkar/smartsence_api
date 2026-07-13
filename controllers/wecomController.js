const Message = require('../models/Message');

const wecomService = require('../services/wecomService');
const WXBizMsgCrypt = require('../services/wecomCrypto');

const wxCrypt = new WXBizMsgCrypt(
    process.env.WECOM_TOKEN,
    process.env.WECOM_ENCODING_AES_KEY,
    process.env.WECOM_CORP_ID,
);

const verifyWebhook = (req, res) => {

    const { msg_signature, timestamp, nonce, echostr } = req.query;

    if (!wxCrypt.verifySignature(msg_signature, timestamp, nonce, echostr)) {
        console.error('WeCom webhook verification failed: signature mismatch');
        return res.status(401).send('Invalid signature');
    }

    try {
        const { msg } = wxCrypt.decrypt(echostr);
        res.send(msg);
    } catch (error) {
        console.error('WeCom webhook verification failed to decrypt echostr:', error);
        res.status(401).send('Invalid echostr');
    }
};

const receiveMessage = async (req, res) => {

    try {

        const { msg_signature, timestamp, nonce } = req.query;

        const rawBody = req.body;
        let outer = rawBody;

        // XML support
        if (typeof outer === 'string') {
            const parsed = await wecomService.parseXML(outer);
            outer = parsed.xml;
        }

        const encrypted = outer.Encrypt;

        if (!wxCrypt.verifySignature(msg_signature, timestamp, nonce, encrypted)) {
            console.error('WeCom message verification failed: signature mismatch');
            return res.status(401).send('Invalid signature');
        }

        const { msg } = wxCrypt.decrypt(encrypted);
        const parsed = await wecomService.parseXML(msg);
        const body = parsed.xml;

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

        res.send('success');

    } catch (error) {

        console.log(error);

        res.status(500).send('Server Error');
    }
};

module.exports = {
    verifyWebhook,
    receiveMessage
};