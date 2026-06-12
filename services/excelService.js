const XLSX = require('xlsx');

const PRODUCT_HEADERS = ['name', 'product', 'item', 'title', 'description'];
const SKU_HEADERS = ['sku', 'code', 'model', 'part'];
const PRICE_HEADERS = ['price', 'rate', 'amount', 'mrp'];
const CATEGORY_HEADERS = ['category', 'type', 'group'];
const TAG_HEADERS = ['tag', 'tags'];

function normalizeHeader(value) {
    return String(value ?? '').toLowerCase().trim();
}

function findColumnIndex(headers, candidates) {
    return headers.findIndex((header) => candidates.includes(header));
}

function parseSheetRows(sheet) {
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    return rows;
}

function mapRowToProduct(row, headers) {
    const normalized = {};
    for (const [key, value] of Object.entries(row)) {
        normalized[normalizeHeader(key)] = value;
    }

    const nameKey = Object.keys(normalized).find((key) => PRODUCT_HEADERS.includes(key));
    const skuKey = Object.keys(normalized).find((key) => SKU_HEADERS.includes(key));
    const priceKey = Object.keys(normalized).find((key) => PRICE_HEADERS.includes(key));
    const categoryKey = Object.keys(normalized).find((key) => CATEGORY_HEADERS.includes(key));
    const tagKey = Object.keys(normalized).find((key) => TAG_HEADERS.includes(key));

    const name = nameKey ? String(normalized[nameKey]).trim() : '';
    if (!name) {
        return null;
    }

    const priceRaw = priceKey ? normalized[priceKey] : 0;
    const price = Number(String(priceRaw).replace(/[^0-9.]/g, '')) || 0;
    const tags = tagKey
        ? String(normalized[tagKey]).split(',').map((tag) => tag.trim().toLowerCase()).filter(Boolean)
        : [];

    return {
        name,
        sku: skuKey ? String(normalized[skuKey]).trim() : '',
        description: nameKey === 'description' ? name : '',
        category: categoryKey ? String(normalized[categoryKey]).trim() : '',
        tags,
        price,
        currency: '',
        imageUrls: [],
    };
}

function parseExcelCatalog(filePath) {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = parseSheetRows(sheet);

    const products = rows
        .map((row) => mapRowToProduct(row))
        .filter(Boolean);

    const companyName = sheetName && sheetName !== 'Sheet1' ? sheetName : '';

    return {
        company: {
            name: companyName,
            address: '',
            website: '',
            email: '',
            phone: '',
        },
        contacts: [],
        products,
        extractedImageUrls: [],
    };
}

module.exports = {
    parseExcelCatalog,
};
