const Message = require('../models/Message');

const wecomService = require('../services/wecomService');
const WXBizMsgCrypt = require('../services/wecomCrypto');
const wecomLogger = require('../utils/wecomLogger');

const wxCrypt = new WXBizMsgCrypt(
    process.env.WECOM_TOKEN,
    process.env.WECOM_ENCODING_AES_KEY,
    process.env.WECOM_CORP_ID,
);

const verifyWebhook = (req, res) => {

    const { msg_signature, timestamp, nonce, echostr } = req.query;

    wecomLogger.logEvent('in', 'verify_request', { query: req.query });

    if (!wxCrypt.verifySignature(msg_signature, timestamp, nonce, echostr)) {
        wecomLogger.logEvent('out', 'verify_failed', { reason: 'signature mismatch' });
        return res.status(401).send('Invalid signature');
    }

    try {
        const { msg } = wxCrypt.decrypt(echostr);
        wecomLogger.logEvent('out', 'verify_success', { echo: msg });
        res.send(msg);
    } catch (error) {
        wecomLogger.logEvent('out', 'verify_failed', { reason: error.message });
        res.status(401).send('Invalid echostr');
    }
};

const receiveMessage = async (req, res) => {

    try {

        const { msg_signature, timestamp, nonce } = req.query;

        const rawBody = req.body;
        let outer = rawBody;

        wecomLogger.logEvent('in', 'message_request', { query: req.query, body: rawBody });

        // XML support
        if (typeof outer === 'string') {
            const parsed = await wecomService.parseXML(outer);
            outer = parsed.xml;
        }

        const encrypted = outer.Encrypt;

        if (!wxCrypt.verifySignature(msg_signature, timestamp, nonce, encrypted)) {
            wecomLogger.logEvent('out', 'message_failed', { reason: 'signature mismatch' });
            return res.status(401).send('Invalid signature');
        }

        const { msg } = wxCrypt.decrypt(encrypted);
        const parsed = await wecomService.parseXML(msg);
        const body = parsed.xml;

        wecomLogger.logEvent('in', 'message_decrypted', { body });

        // Save message
        const message = new Message({

            sender: body.FromUserName,

            receiver: body.ToUserName,

            msgType: body.MsgType,

            content: body.Content,

            body

        });

        await message.save();

        wecomLogger.logEvent('out', 'message_saved', { id: message._id });

        res.send('success');

    } catch (error) {

        wecomLogger.logEvent('out', 'message_failed', { reason: error.message });

        res.status(500).send('Server Error');
    }
};

const renderLogsPage = (key) => `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>WeCom Webhook Logs</title>
<style>
  body { font-family: -apple-system, Segoe UI, sans-serif; background: #0f1115; color: #ddd; margin: 0; padding: 16px; }
  h1 { font-size: 16px; margin: 0 0 12px; }
  .entry { border: 1px solid #2a2d34; border-radius: 6px; margin-bottom: 8px; padding: 8px 10px; background: #16181d; }
  .meta { font-size: 12px; color: #888; margin-bottom: 4px; }
  .badge { display: inline-block; padding: 1px 6px; border-radius: 3px; font-size: 11px; margin-right: 6px; }
  .in { background: #17402a; color: #6fdc9a; }
  .out { background: #3a2a17; color: #f0a860; }
  pre { white-space: pre-wrap; word-break: break-all; margin: 0; font-size: 12px; }
  #status { font-size: 12px; color: #666; margin-bottom: 10px; }
</style>
</head>
<body>
<h1>WeCom Webhook Logs</h1>
<div id="status">loading...</div>
<div id="logs"></div>
<script>
  const key = ${JSON.stringify(key)};
  async function refresh() {
    try {
      const res = await fetch('/api/wecom/logs?key=' + encodeURIComponent(key) + '&limit=200');
      const json = await res.json();
      const container = document.getElementById('logs');
      container.innerHTML = '';
      (json.data || []).forEach((entry) => {
        const div = document.createElement('div');
        div.className = 'entry';
        div.innerHTML = '<div class="meta"><span class="badge ' + entry.direction + '">' + entry.direction.toUpperCase() + '</span>' +
          entry.timestamp + ' — ' + entry.event + '</div>' +
          '<pre>' + JSON.stringify(entry.data, null, 2).replace(/</g, '&lt;') + '</pre>';
        container.appendChild(div);
      });
      document.getElementById('status').textContent = 'last updated ' + new Date().toLocaleTimeString();
    } catch (e) {
      document.getElementById('status').textContent = 'error loading logs: ' + e.message;
    }
  }
  refresh();
  setInterval(refresh, 3000);
</script>
</body>
</html>`;

const getLogs = (req, res) => {
    const requiredKey = process.env.LOG_VIEWER_KEY;

    if (requiredKey && req.query.key !== requiredKey) {
        return res.status(403).json({ success: false, message: 'Invalid key' });
    }

    const limit = Math.min(parseInt(req.query.limit, 10) || 200, 500);

    res.json({ success: true, data: wecomLogger.readRecentLogs(limit) });
};

const viewLogs = (req, res) => {
    const requiredKey = process.env.LOG_VIEWER_KEY;

    if (requiredKey && req.query.key !== requiredKey) {
        return res.status(403).send('Invalid key');
    }

    res.send(renderLogsPage(req.query.key || ''));
};

module.exports = {
    verifyWebhook,
    receiveMessage,
    getLogs,
    viewLogs,
};
