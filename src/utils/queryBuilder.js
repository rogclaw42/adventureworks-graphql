/**
 * Query Builder Utilities
 * Helpers for building dynamic SQL queries with filtering, sorting, and pagination
 */

/**
 * Build WHERE clause from a filter object
 * Supports: eq, ne, gt, gte, lt, lte, contains, startsWith, endsWith, in, between, isNull
 * 
 * @param {Object} where - filter object
 * @param {Array} params - array to push bound parameters into
 * @param {string} [tableAlias] - optional table alias prefix
 * @returns {string} SQL WHERE clause (without the WHERE keyword)
 */
function buildWhereClause(where, params, tableAlias = '') {
    if (!where) return '';
    
    const prefix = tableAlias ? `${tableAlias}.` : '';
    const conditions = [];
    
    for (const [field, filter] of Object.entries(where)) {
        if (field === 'AND') {
            const subconditions = filter.map(f => {
                const subParams = [];
                const clause = buildWhereClause(f, subParams, tableAlias);
                params.push(...subParams);
                return `(${clause})`;
            });
            conditions.push(`(${subconditions.join(' AND ')})`);
            continue;
        }
        
        if (field === 'OR') {
            const subconditions = filter.map(f => {
                const subParams = [];
                const clause = buildWhereClause(f, subParams, tableAlias);
                params.push(...subParams);
                return `(${clause})`;
            });
            conditions.push(`(${subconditions.join(' OR ')})`);
            continue;
        }
        
        if (field === 'NOT') {
            const subParams = [];
            const clause = buildWhereClause(filter, subParams, tableAlias);
            params.push(...subParams);
            conditions.push(`NOT (${clause})`);
            continue;
        }
        
        const col = `${prefix}"${field}"`;
        
        if (typeof filter !== 'object' || filter === null) {
            // Direct equality
            params.push(filter);
            conditions.push(`${col} = ?`);
            continue;
        }
        
        for (const [op, value] of Object.entries(filter)) {
            switch (op) {
                case 'eq':
                    params.push(value);
                    conditions.push(`${col} = ?`);
                    break;
                case 'ne':
                    params.push(value);
                    conditions.push(`${col} != ?`);
                    break;
                case 'gt':
                    params.push(value);
                    conditions.push(`${col} > ?`);
                    break;
                case 'gte':
                    params.push(value);
                    conditions.push(`${col} >= ?`);
                    break;
                case 'lt':
                    params.push(value);
                    conditions.push(`${col} < ?`);
                    break;
                case 'lte':
                    params.push(value);
                    conditions.push(`${col} <= ?`);
                    break;
                case 'contains':
                    params.push(`%${value}%`);
                    conditions.push(`${col} LIKE ?`);
                    break;
                case 'startsWith':
                    params.push(`${value}%`);
                    conditions.push(`${col} LIKE ?`);
                    break;
                case 'endsWith':
                    params.push(`%${value}`);
                    conditions.push(`${col} LIKE ?`);
                    break;
                case 'in':
                    if (value && value.length > 0) {
                        params.push(...value);
                        conditions.push(`${col} IN (${value.map(() => '?').join(',')})`);
                    } else {
                        conditions.push('0 = 1'); // empty IN = false
                    }
                    break;
                case 'notIn':
                    if (value && value.length > 0) {
                        params.push(...value);
                        conditions.push(`${col} NOT IN (${value.map(() => '?').join(',')})`);
                    }
                    break;
                case 'between':
                    params.push(value.min, value.max);
                    conditions.push(`${col} BETWEEN ? AND ?`);
                    break;
                case 'isNull':
                    conditions.push(value ? `${col} IS NULL` : `${col} IS NOT NULL`);
                    break;
            }
        }
    }
    
    return conditions.join(' AND ');
}

/**
 * Build ORDER BY clause
 * @param {Array} orderBy - [{field, direction}]
 * @param {string} [tableAlias]
 */
function buildOrderByClause(orderBy, tableAlias = '') {
    if (!orderBy || orderBy.length === 0) return '';
    const prefix = tableAlias ? `${tableAlias}.` : '';
    return 'ORDER BY ' + orderBy.map(({ field, direction }) =>
        `${prefix}"${field}" ${direction === 'DESC' ? 'DESC' : 'ASC'}`
    ).join(', ');
}

/**
 * Apply cursor-based pagination to a query
 * Returns { nodes, pageInfo, totalCount }
 */
function paginateQuery(db, baseQuery, params, { first, after, last, before }, primaryKey, orderByClause = '') {
    // Count total
    const countQuery = `SELECT COUNT(*) as total FROM (${baseQuery})`;
    const totalCount = db.prepare(countQuery).get(params).total;
    
    let query = baseQuery;
    const queryParams = [...params];
    
    // Cursor-based: decode cursor (base64 encoded primary key value)
    let afterId = null, beforeId = null;
    if (after) {
        try { afterId = JSON.parse(Buffer.from(after, 'base64').toString('utf8')).id; } catch(e) {}
    }
    if (before) {
        try { beforeId = JSON.parse(Buffer.from(before, 'base64').toString('utf8')).id; } catch(e) {}
    }
    
    const limit = first || last || 20;
    const offset = 0;
    
    // Add cursor conditions to WHERE
    const whereConditions = [];
    if (afterId !== null) {
        whereConditions.push(`"${primaryKey}" > ?`);
        queryParams.push(afterId);
    }
    if (beforeId !== null) {
        whereConditions.push(`"${primaryKey}" < ?`);
        queryParams.push(beforeId);
    }
    
    if (whereConditions.length > 0) {
        query = `SELECT * FROM (${baseQuery}) WHERE ${whereConditions.join(' AND ')}`;
    }
    
    query = `${query} ${orderByClause} LIMIT ? OFFSET ?`;
    queryParams.push(limit + 1, offset); // fetch one extra to detect hasNextPage
    
    const rows = db.prepare(query).all(queryParams);
    const hasNextPage = rows.length > limit;
    if (hasNextPage) rows.pop();
    
    const edges = rows.map(row => ({
        cursor: Buffer.from(JSON.stringify({ id: row[primaryKey] })).toString('base64'),
        node: row
    }));
    
    return {
        edges,
        pageInfo: {
            hasNextPage,
            hasPreviousPage: afterId !== null,
            startCursor: edges.length > 0 ? edges[0].cursor : null,
            endCursor: edges.length > 0 ? edges[edges.length - 1].cursor : null
        },
        totalCount
    };
}

/**
 * Simple offset pagination helper
 */
function offsetPaginate(db, baseQuery, params, { limit = 20, offset = 0 } = {}) {
    const countQuery = `SELECT COUNT(*) as total FROM (${baseQuery})`;
    const total = db.prepare(countQuery).get(params).total;
    
    const rows = db.prepare(`${baseQuery} LIMIT ? OFFSET ?`).all([...params, limit, offset]);
    
    return {
        rows,
        total,
        hasMore: offset + rows.length < total
    };
}

module.exports = { buildWhereClause, buildOrderByClause, paginateQuery, offsetPaginate };
