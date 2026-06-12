const xml2js = require('xml2js');

const parser = new xml2js.Parser();

const parseXML = async (xmlString) => {
    try {
        const result = await parser.parseStringPromise(xmlString);
        return result;
    } catch (error) {
        console.error('Error parsing XML:', error);
        throw error;
    }
};

module.exports = {
    parseXML
};
