const fs = require('fs');

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

const BILL_EXTRACTION_PROMPT = `You are a document data extraction assistant. Extract bill/invoice information from this PDF document.

Return ONLY valid JSON with this exact structure (no markdown, no code fences):
{
  "customer": {
    "name": "",
    "email": "",
    "phone": "",
    "address": ""
  },
  "invoiceNumber": "",
  "orderId": "",
  "date": "",
  "products": [
    {
      "name": "",
      "price": 0,
      "quantity": 0,
      "total": 0
    }
  ],
  "subtotal": 0,
  "tax": 0,
  "total": 0,
  "currency": ""
}

Rules:
- Use empty string for missing text fields, 0 for missing numbers
- Prices must be numbers without currency symbols
- Include all line items found in the document
- Extract the customer/buyer information from shipping or billing address sections`;

const CATALOG_EXTRACTION_PROMPT = `You are a document data extraction assistant. Extract product catalog information from this PDF document.

Return ONLY valid JSON with this exact structure (no markdown, no code fences):
{
  "company": {
    "name": "",
    "address": "",
    "website": "",
    "email": "",
    "phone": ""
  },
  "contacts": [
    {
      "name": "",
      "role": "",
      "email": "",
      "phone": "",
      "website": ""
    }
  ],
  "products": [
    {
      "name": "",
      "sku": "",
      "description": "",
      "category": "",
      "tags": ["light"],
      "price": 0,
      "currency": "",
      "imageUrls": [""]
    }
  ],
  "extractedImageUrls": [""]
}

Rules:
- Use empty string for missing text fields, 0 for missing numbers
- If price is shown as a range or depends on variants, set price to 0 and put details into description
- "tags" should classify the product type (e.g. light, laptop, mobile, tablet, monitor, cable, sensor, accessory). Use lowercase. Add multiple tags when relevant.
- "imageUrls" should contain any explicit image URLs/links near the product (if present)
- "extractedImageUrls" should include any general image URLs found anywhere in the PDF (if present)`;

const VISITING_CARD_PROMPT = `You are a document data extraction assistant. Extract business card / visiting card information from this image.

Return ONLY valid JSON with this exact structure (no markdown, no code fences):
{
  "company": {
    "name": "",
    "address": "",
    "website": "",
    "email": "",
    "phone": ""
  },
  "contacts": [
    {
      "name": "",
      "role": "",
      "email": "",
      "phone": "",
      "website": ""
    }
  ],
  "products": [],
  "extractedImageUrls": []
}

Rules:
- Extract company name from the card header/logo area
- Put the person's name in contacts[0].name and their title in contacts[0].role
- Use empty products array for visiting cards
- Use empty string for missing fields`;

function parseJsonResponse(text) {
    const trimmed = text.trim();
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const jsonText = fenced ? fenced[1].trim() : trimmed;
    return JSON.parse(jsonText);
}

function normalizeExtractedData(data) {
    const customer = data.customer ?? {};
    const products = Array.isArray(data.products) ? data.products : [];

    return {
        customer: {
            name: String(customer.name ?? ''),
            email: String(customer.email ?? ''),
            phone: String(customer.phone ?? ''),
            address: String(customer.address ?? ''),
        },
        invoiceNumber: String(data.invoiceNumber ?? ''),
        orderId: String(data.orderId ?? ''),
        date: String(data.date ?? ''),
        products: products.map((item) => ({
            name: String(item.name ?? ''),
            price: Number(item.price) || 0,
            quantity: Number(item.quantity) || 0,
            total: Number(item.total) || 0,
        })),
        subtotal: Number(data.subtotal) || 0,
        tax: Number(data.tax) || 0,
        total: Number(data.total) || 0,
        currency: String(data.currency ?? ''),
    };
}

function extractUrlsFromPdfBytes(pdfBuffer) {
    const text = pdfBuffer.toString('latin1');
    const matches = text.match(/https?:\/\/[^\s<>"'()\\\]\}]+/gi) || [];
    const unique = Array.from(new Set(matches));
    return unique.slice(0, 200);
}

function normalizeCatalogData(data, fallbackImageUrls) {
    const company = data.company ?? {};
    const contacts = Array.isArray(data.contacts) ? data.contacts : [];
    const products = Array.isArray(data.products) ? data.products : [];
    const extractedImageUrls = Array.isArray(data.extractedImageUrls) ? data.extractedImageUrls : [];

    return {
        company: {
            name: String(company.name ?? ''),
            address: String(company.address ?? ''),
            website: String(company.website ?? ''),
            email: String(company.email ?? ''),
            phone: String(company.phone ?? ''),
        },
        contacts: contacts.map((item) => ({
            name: String(item.name ?? ''),
            role: String(item.role ?? ''),
            email: String(item.email ?? ''),
            phone: String(item.phone ?? ''),
            website: String(item.website ?? ''),
        })),
        products: products.map((item) => ({
            name: String(item.name ?? ''),
            sku: String(item.sku ?? ''),
            description: String(item.description ?? ''),
            category: String(item.category ?? ''),
            tags: Array.isArray(item.tags)
                ? item.tags.map((tag) => String(tag).trim().toLowerCase()).filter(Boolean).slice(0, 10)
                : [],
            price: Number(item.price) || 0,
            currency: String(item.currency ?? ''),
            imageUrls: Array.isArray(item.imageUrls)
                ? item.imageUrls.map((url) => String(url)).filter(Boolean).slice(0, 20)
                : [],
        })),
        extractedImageUrls: Array.from(new Set([
            ...extractedImageUrls.map((url) => String(url)).filter(Boolean),
            ...fallbackImageUrls,
        ])).slice(0, 200),
    };
}

async function generateFromFile({ apiKey, model, fileBase64, mimeType, promptText }) {
    const url = `${GEMINI_API_BASE}/${model}:generateContent`;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-goog-api-key': apiKey,
        },
        body: JSON.stringify({
            contents: [
                {
                    parts: [
                        {
                            inline_data: {
                                mime_type: mimeType,
                                data: fileBase64,
                            },
                        },
                        { text: promptText },
                    ],
                },
            ],
        }),
    });

    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Gemini API error (${response.status}): ${errorBody}`);
    }

    const payload = await response.json();
    const responseText = payload.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!responseText) {
        throw new Error('Gemini returned an empty response');
    }

    return parseJsonResponse(responseText);
}

async function scanBillPdf(filePath) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY is not configured in backend .env');
    }

    const model = process.env.GEMINI_MODEL || 'gemini-flash-latest';
    const pdfBuffer = fs.readFileSync(filePath);
    const base64Data = pdfBuffer.toString('base64');
    const parsed = await generateFromFile({
        apiKey,
        model,
        fileBase64: base64Data,
        mimeType: 'application/pdf',
        promptText: BILL_EXTRACTION_PROMPT,
    });

    return {
        extracted: normalizeExtractedData(parsed),
        rawAiResponse: parsed,
    };
}

async function scanCatalogPdf(filePath) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY is not configured in backend .env');
    }

    const model = process.env.GEMINI_MODEL || 'gemini-flash-latest';
    const pdfBuffer = fs.readFileSync(filePath);
    const base64Data = pdfBuffer.toString('base64');
    const fallbackUrls = extractUrlsFromPdfBytes(pdfBuffer);

    const parsed = await generateFromFile({
        apiKey,
        model,
        fileBase64: base64Data,
        mimeType: 'application/pdf',
        promptText: CATALOG_EXTRACTION_PROMPT,
    });

    return {
        extracted: normalizeCatalogData(parsed, fallbackUrls),
        rawAiResponse: parsed,
    };
}

async function scanCatalogImage(filePath, mimeType) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY is not configured in backend .env');
    }

    const model = process.env.GEMINI_MODEL || 'gemini-flash-latest';
    const imageBuffer = fs.readFileSync(filePath);
    const base64Data = imageBuffer.toString('base64');

    const parsed = await generateFromFile({
        apiKey,
        model,
        fileBase64: base64Data,
        mimeType,
        promptText: VISITING_CARD_PROMPT,
    });

    return {
        extracted: normalizeCatalogData(parsed, []),
        rawAiResponse: parsed,
    };
}

module.exports = {
    scanBillPdf,
    scanCatalogPdf,
    scanCatalogImage,
};
