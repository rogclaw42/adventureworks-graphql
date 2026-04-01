/**
 * Field mapping utilities
 * 
 * Maps GraphQL camelCase field names to SQLite PascalCase column names.
 * Used to create field resolvers that read from raw DB rows.
 */

/**
 * Create a field resolver that reads from a PascalCase property on the parent row.
 * 
 * @param {string} dbColumn - The SQLite column name (PascalCase)
 * @param {Function} [transform] - Optional transform function
 */
function field(dbColumn, transform) {
    return (parent) => {
        const val = parent[dbColumn];
        return transform ? transform(val) : val;
    };
}

/**
 * Boolean field (SQLite stores 0/1)
 */
function boolField(dbColumn) {
    return (parent) => parent[dbColumn] === 1 || parent[dbColumn] === true;
}

/**
 * Create a complete set of field resolvers for a type
 * Maps { graphqlField: 'DB_COLUMN' }
 */
function fieldMap(mappings, boolFields = []) {
    const resolvers = {};
    for (const [gqlField, dbCol] of Object.entries(mappings)) {
        resolvers[gqlField] = (parent) => parent[dbCol] ?? null;
    }
    for (const [gqlField, dbCol] of Object.entries(boolFields)) {
        resolvers[gqlField] = (parent) => !!(parent[dbCol]);
    }
    return resolvers;
}

module.exports = { field, boolField, fieldMap };
