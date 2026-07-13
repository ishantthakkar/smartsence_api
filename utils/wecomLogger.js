const fs = require('fs');
const path = require('path');

const logsDir = path.join(__dirname, '..', 'logs');

if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

const logFile = path.join(logsDir, 'wecom.log');

const logEvent = (direction, event, data) => {
    const entry = {
        timestamp: new Date().toISOString(),
        direction,
        event,
        data,
    };

    fs.appendFile(logFile, `${JSON.stringify(entry)}\n`, (err) => {
        if (err) {
            console.error('Failed to write wecom log:', err);
        }
    });

    console.log(`[wecom:${direction}] ${event}`, data);

    return entry;
};

const readRecentLogs = (limit = 200) => {
    if (!fs.existsSync(logFile)) {
        return [];
    }

    const lines = fs.readFileSync(logFile, 'utf8').split('\n').filter(Boolean);
    const recent = lines.slice(-limit);

    return recent
        .map((line) => {
            try {
                return JSON.parse(line);
            } catch (error) {
                return { timestamp: null, direction: 'unknown', event: 'parse_error', data: line };
            }
        })
        .reverse();
};

module.exports = {
    logEvent,
    readRecentLogs,
};
