const Catalog = require('../models/Catalog');

function normalizeText(value) {
    return String(value ?? '')
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/[.,]/g, '');
}

function normalizeCompanyName(value) {
    return normalizeText(value)
        .replace(/\b(pvt|ltd|limited|inc|llc|corp|corporation|co)\b/g, '')
        .trim();
}

function normalizePhone(value) {
    const digits = String(value ?? '').replace(/\D/g, '');
    return digits.length >= 7 ? digits.slice(-10) : digits;
}

function normalizeWebsite(value) {
    return normalizeText(value)
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .replace(/\/$/, '');
}

function namesMatch(a, b) {
    if (!a || !b) {
        return false;
    }
    return a === b || a.includes(b) || b.includes(a);
}

function scoreMatch(extracted, existing) {
    let score = 0;

    const nameA = normalizeCompanyName(extracted.name);
    const nameB = normalizeCompanyName(existing.name);
    const emailA = normalizeText(extracted.email);
    const emailB = normalizeText(existing.email);
    const phoneA = normalizePhone(extracted.phone);
    const phoneB = normalizePhone(existing.phone);
    const websiteA = normalizeWebsite(extracted.website);
    const websiteB = normalizeWebsite(existing.website);

    if (emailA && emailB && emailA === emailB) {
        score += 5;
    }
    if (websiteA && websiteB && websiteA === websiteB) {
        score += 4;
    }
    if (phoneA && phoneB && phoneA === phoneB) {
        score += 3;
    }
    if (namesMatch(nameA, nameB)) {
        score += 3;
    }

    return score;
}

async function findMatchingCatalog(company) {
    if (!company || !Object.values(company).some(Boolean)) {
        return null;
    }

    const catalogs = await Catalog.find({ status: 'scanned' }).lean();

    let bestMatch = null;
    let bestScore = 0;

    for (const catalog of catalogs) {
        const score = scoreMatch(company, catalog.company ?? {});
        if (score >= 3 && score > bestScore) {
            bestScore = score;
            bestMatch = catalog;
        }
    }

    return bestMatch;
}

function mergeContacts(existing, incoming) {
    const merged = [...(existing ?? [])];

    for (const contact of incoming ?? []) {
        const email = normalizeText(contact.email);
        const phone = normalizePhone(contact.phone);
        const isDuplicate = merged.some((item) => {
            const itemEmail = normalizeText(item.email);
            const itemPhone = normalizePhone(item.phone);
            if (email && itemEmail && email === itemEmail) {
                return true;
            }
            if (phone && itemPhone && phone === itemPhone) {
                return true;
            }
            return normalizeText(item.name) === normalizeText(contact.name)
                && normalizeText(contact.name) !== '';
        });

        if (!isDuplicate) {
            merged.push(contact);
        }
    }

    return merged;
}

function mergeProducts(existing, incoming) {
    const merged = [...(existing ?? [])];

    for (const product of incoming ?? []) {
        const sku = normalizeText(product.sku);
        const name = normalizeText(product.name);
        const isDuplicate = merged.some((item) => {
            const itemSku = normalizeText(item.sku);
            const itemName = normalizeText(item.name);
            if (sku && itemSku && sku === itemSku) {
                return true;
            }
            return name && itemName && name === itemName;
        });

        if (!isDuplicate) {
            merged.push(product);
        }
    }

    return merged;
}

function mergeCompany(existing, incoming) {
    const result = { ...(existing ?? {}) };

    for (const [key, value] of Object.entries(incoming ?? {})) {
        if (value && !result[key]) {
            result[key] = value;
        }
    }

    if (incoming?.name && (!existing?.name || existing.name.length < incoming.name.length)) {
        result.name = incoming.name;
    }

    return result;
}

function buildMergedDraft(existingCatalog, extracted) {
    return {
        company: mergeCompany(existingCatalog.company, extracted.company),
        contacts: mergeContacts(existingCatalog.contacts, extracted.contacts),
        products: mergeProducts(existingCatalog.products, extracted.products),
        extractedImageUrls: Array.from(new Set([
            ...(existingCatalog.extractedImageUrls ?? []),
            ...(extracted.extractedImageUrls ?? []),
        ])),
    };
}

module.exports = {
    findMatchingCatalog,
    mergeContacts,
    mergeProducts,
    mergeCompany,
    buildMergedDraft,
};
