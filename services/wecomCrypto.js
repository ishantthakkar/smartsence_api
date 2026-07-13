const crypto = require('crypto');

const PKCS7_BLOCK_SIZE = 32;

const pkcs7Encode = (buffer) => {
    const amountToPad = PKCS7_BLOCK_SIZE - (buffer.length % PKCS7_BLOCK_SIZE);
    const pad = Buffer.alloc(amountToPad, amountToPad);
    return Buffer.concat([buffer, pad]);
};

const pkcs7Decode = (buffer) => {
    let pad = buffer[buffer.length - 1];
    if (pad < 1 || pad > PKCS7_BLOCK_SIZE) {
        pad = 0;
    }
    return buffer.slice(0, buffer.length - pad);
};

class WXBizMsgCrypt {
    constructor(token, encodingAESKey, corpId) {
        this.token = token;
        this.corpId = corpId;
        this.aesKey = Buffer.from(`${encodingAESKey}=`, 'base64');
        this.iv = this.aesKey.slice(0, 16);
    }

    getSignature(timestamp, nonce, encrypted) {
        const arr = [this.token, timestamp, nonce, encrypted].sort();
        return crypto.createHash('sha1').update(arr.join('')).digest('hex');
    }

    verifySignature(signature, timestamp, nonce, encrypted) {
        return this.getSignature(timestamp, nonce, encrypted) === signature;
    }

    decrypt(encryptedText) {
        const decipher = crypto.createDecipheriv('aes-256-cbc', this.aesKey, this.iv);
        decipher.setAutoPadding(false);

        const decrypted = pkcs7Decode(
            Buffer.concat([decipher.update(encryptedText, 'base64'), decipher.final()]),
        );

        const msgLen = decrypted.readUInt32BE(16);
        const msg = decrypted.slice(20, 20 + msgLen).toString('utf8');
        const receiveId = decrypted.slice(20 + msgLen).toString('utf8');

        if (receiveId !== this.corpId) {
            throw new Error('Decrypted message receiveId does not match configured CorpID');
        }

        return { msg, receiveId };
    }

    encrypt(replyMsg) {
        const randomStr = crypto.randomBytes(16);
        const msgBuf = Buffer.from(replyMsg, 'utf8');
        const msgLenBuf = Buffer.alloc(4);
        msgLenBuf.writeUInt32BE(msgBuf.length, 0);
        const corpIdBuf = Buffer.from(this.corpId, 'utf8');

        const raw = pkcs7Encode(Buffer.concat([randomStr, msgLenBuf, msgBuf, corpIdBuf]));

        const cipher = crypto.createCipheriv('aes-256-cbc', this.aesKey, this.iv);
        cipher.setAutoPadding(false);

        return Buffer.concat([cipher.update(raw), cipher.final()]).toString('base64');
    }
}

module.exports = WXBizMsgCrypt;
