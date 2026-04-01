/**
 * Row normalization utilities
 * 
 * Converts PascalCase + ID suffix SQLite column names
 * to camelCase GraphQL-friendly property names.
 * 
 * Examples:
 *   ProductCategoryID  → productCategoryId
 *   FirstName          → firstName
 *   SalesYTD           → salesYtd
 *   TerritoryGroup     → territoryGroup
 */

/**
 * Convert a PascalCase/UpperCamelCase database column name to camelCase.
 * Special handling for common AdventureWorks patterns.
 */
function columnToCamel(col) {
    return col
        // First char lowercase
        .replace(/^[A-Z]/, c => c.toLowerCase())
        // ID suffix → Id
        .replace(/ID$/, 'Id')
        .replace(/IDs$/, 'Ids')
        // YTD → Ytd
        .replace(/YTD/, 'Ytd')
        // URL → Url
        .replace(/URL/, 'Url')
        // Handle consecutive uppercase (e.g., keep them as-is after first transform)
        ;
}

/**
 * Normalize a database row object - converts all PascalCase keys to camelCase.
 * Returns a new object with camelCase keys while keeping original values.
 */
function normalizeRow(row) {
    if (!row || typeof row !== 'object') return row;
    const result = {};
    for (const key of Object.keys(row)) {
        result[columnToCamel(key)] = row[key];
    }
    return result;
}

/**
 * Normalize an array of rows
 */
function normalizeRows(rows) {
    if (!Array.isArray(rows)) return rows;
    return rows.map(normalizeRow);
}

/**
 * Wrap a DataLoader batch function to normalize each result
 */
function withNormalize(batchFn) {
    return async (ids) => {
        const results = await batchFn(ids);
        return results.map(r => Array.isArray(r) ? normalizeRows(r) : normalizeRow(r));
    };
}

module.exports = { normalizeRow, normalizeRows, columnToCamel, withNormalize };
