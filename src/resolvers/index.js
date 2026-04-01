/**
 * GraphQL Resolvers
 * All resolvers for the AdventureWorks GraphQL API
 */

const { GraphQLScalarType, Kind } = require('graphql');
const { getDb } = require('../db');
const { buildWhereClause, buildOrderByClause } = require('../utils/queryBuilder');
const { cachedQuery, queryCache } = require('../utils/cache');
const { analytics } = require('../utils/analytics');
const { fieldResolvers } = require('./fieldResolvers');
const { validateCreateProduct, validateCreateSalesOrder, validateCreatePerson } = require('../middleware/validation');

// ============================================================
// Scalar types
// ============================================================

const DateTimeScalar = new GraphQLScalarType({
    name: 'DateTime',
    description: 'ISO 8601 date-time string',
    serialize(value) {
        if (value instanceof Date) return value.toISOString();
        return value;
    },
    parseValue(value) {
        return new Date(value);
    },
    parseLiteral(ast) {
        if (ast.kind === Kind.STRING) return new Date(ast.value);
        return null;
    }
});

const JSONScalar = new GraphQLScalarType({
    name: 'JSON',
    description: 'Arbitrary JSON object',
    serialize(value) { return value; },
    parseValue(value) { return value; },
    parseLiteral(ast) { return ast.value; }
});

// ============================================================
// Status label helpers
// ============================================================

const SALES_ORDER_STATUS = {
    1: 'In Process', 2: 'Approved', 3: 'Backordered',
    4: 'Rejected', 5: 'Shipped', 6: 'Cancelled'
};

const PURCHASE_ORDER_STATUS = {
    1: 'Pending', 2: 'Approved', 3: 'Rejected', 4: 'Complete'
};

// ============================================================
// Cursor pagination helper
// ============================================================

function buildConnection(rows, { first = 20, after } = {}, primaryKey, hasMore) {
    const edges = rows.map(row => ({
        cursor: Buffer.from(JSON.stringify({ id: row[primaryKey] })).toString('base64'),
        node: row
    }));
    
    return {
        edges,
        pageInfo: {
            hasNextPage: hasMore,
            hasPreviousPage: !!after,
            startCursor: edges.length > 0 ? edges[0].cursor : null,
            endCursor: edges.length > 0 ? edges[edges.length - 1].cursor : null
        },
        totalCount: null // Lazy-loaded if needed
    };
}

function decodeCursor(cursor) {
    if (!cursor) return null;
    try {
        return JSON.parse(Buffer.from(cursor, 'base64').toString('utf8')).id;
    } catch { return null; }
}

function encodeCursor(id) {
    return Buffer.from(JSON.stringify({ id })).toString('base64');
}

// ============================================================
// Query helpers
// ============================================================

/**
 * Generic list query with filter/sort/cursor pagination
 */
function listWithPagination(db, {
    table, primaryKey, filter, filterColumns,
    orderBy, first = 20, after, extraWhere = '', extraParams = []
}) {
    const params = [...extraParams];
    const conditions = [];
    
    if (extraWhere) conditions.push(extraWhere);
    
    if (filter && filterColumns) {
        const filterParams = [];
        const clause = buildWhereClause(filter, filterParams);
        if (clause) {
            conditions.push(clause);
            params.push(...filterParams);
        }
    }
    
    const afterId = decodeCursor(after);
    if (afterId !== null) {
        conditions.push(`"${primaryKey}" > ?`);
        params.push(afterId);
    }
    
    const whereStr = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    
    // Count total
    const countResult = db.prepare(
        `SELECT COUNT(*) as total FROM ${table} ${whereStr}`
    ).get(params);
    const totalCount = countResult ? countResult.total : 0;
    
    const orderClause = buildOrderByClause(orderBy || [{ field: primaryKey, direction: 'ASC' }]);
    const limit = Math.min(first, 100); // cap at 100
    
    const rows = db.prepare(
        `SELECT * FROM ${table} ${whereStr} ${orderClause} LIMIT ?`
    ).all([...params, limit + 1]);
    
    const hasNextPage = rows.length > limit;
    if (hasNextPage) rows.pop();
    
    const edges = rows.map(row => ({
        cursor: encodeCursor(row[primaryKey]),
        node: row
    }));
    
    return {
        edges,
        pageInfo: {
            hasNextPage,
            hasPreviousPage: !!after,
            startCursor: edges.length > 0 ? edges[0].cursor : null,
            endCursor: edges.length > 0 ? edges[edges.length - 1].cursor : null
        },
        totalCount
    };
}

// Map GraphQL filter to SQL WHERE conditions for products
function buildProductWhere(filter, params) {
    if (!filter) return '';
    const conditions = [];
    
    const addStringFilter = (col, f) => {
        if (!f) return;
        if (f.eq !== undefined) { conditions.push(`${col} = ?`); params.push(f.eq); }
        if (f.contains !== undefined) { conditions.push(`${col} LIKE ?`); params.push(`%${f.contains}%`); }
        if (f.startsWith !== undefined) { conditions.push(`${col} LIKE ?`); params.push(`${f.startsWith}%`); }
    };
    
    const addFloatFilter = (col, f) => {
        if (!f) return;
        if (f.eq !== undefined) { conditions.push(`${col} = ?`); params.push(f.eq); }
        if (f.gt !== undefined) { conditions.push(`${col} > ?`); params.push(f.gt); }
        if (f.gte !== undefined) { conditions.push(`${col} >= ?`); params.push(f.gte); }
        if (f.lt !== undefined) { conditions.push(`${col} < ?`); params.push(f.lt); }
        if (f.lte !== undefined) { conditions.push(`${col} <= ?`); params.push(f.lte); }
        if (f.between) { conditions.push(`${col} BETWEEN ? AND ?`); params.push(f.between.min, f.between.max); }
    };
    
    const addIntFilter = (col, f) => {
        if (!f) return;
        if (f.eq !== undefined) { conditions.push(`${col} = ?`); params.push(f.eq); }
        if (f.in !== undefined) { conditions.push(`${col} IN (${f.in.map(() => '?').join(',')})`); params.push(...f.in); }
    };
    
    addStringFilter('p.Name', filter.name);
    addStringFilter('p.ProductNumber', filter.productNumber);
    addStringFilter('p.Color', filter.color);
    addStringFilter('p.ProductLine', filter.productLine);
    addStringFilter('p.Class', filter.class);
    addStringFilter('p.Style', filter.style);
    addStringFilter('p.SellStartDate', filter.sellStartDate);
    addFloatFilter('p.ListPrice', filter.listPrice);
    addFloatFilter('p.StandardCost', filter.standardCost);
    addIntFilter('p.ProductSubcategoryID', filter.productSubcategoryId);
    addIntFilter('p.ProductModelID', filter.productModelId);
    
    if (filter.makeFlag !== undefined) { conditions.push('p.MakeFlag = ?'); params.push(filter.makeFlag ? 1 : 0); }
    if (filter.finishedGoodsFlag !== undefined) { conditions.push('p.FinishedGoodsFlag = ?'); params.push(filter.finishedGoodsFlag ? 1 : 0); }
    
    if (filter.productCategoryId !== undefined) {
        conditions.push('ps.ProductCategoryID = ?');
        params.push(filter.productCategoryId);
    }
    
    return conditions.join(' AND ');
}

// Build sales order WHERE
function buildSalesOrderWhere(filter, params) {
    if (!filter) return '';
    const conditions = [];
    
    const addDateFilter = (col, f) => {
        if (!f) return;
        if (f.gte !== undefined) { conditions.push(`${col} >= ?`); params.push(f.gte); }
        if (f.lte !== undefined) { conditions.push(`${col} <= ?`); params.push(f.lte); }
        if (f.eq !== undefined) { conditions.push(`${col} = ?`); params.push(f.eq); }
        if (f.gt !== undefined) { conditions.push(`${col} > ?`); params.push(f.gt); }
        if (f.lt !== undefined) { conditions.push(`${col} < ?`); params.push(f.lt); }
    };
    
    addDateFilter('soh.OrderDate', filter.orderDate);
    
    if (filter.status) {
        if (filter.status.eq !== undefined) { conditions.push('soh.Status = ?'); params.push(filter.status.eq); }
        if (filter.status.in) { conditions.push(`soh.Status IN (${filter.status.in.map(() => '?').join(',')})`); params.push(...filter.status.in); }
    }
    if (filter.onlineOrderFlag !== undefined) { conditions.push('soh.OnlineOrderFlag = ?'); params.push(filter.onlineOrderFlag ? 1 : 0); }
    if (filter.customerId?.eq !== undefined) { conditions.push('soh.CustomerID = ?'); params.push(filter.customerId.eq); }
    if (filter.salesPersonId?.eq !== undefined) { conditions.push('soh.SalesPersonID = ?'); params.push(filter.salesPersonId.eq); }
    if (filter.territoryId?.eq !== undefined) { conditions.push('soh.TerritoryID = ?'); params.push(filter.territoryId.eq); }
    if (filter.totalDue?.gte !== undefined) { conditions.push('soh.TotalDue >= ?'); params.push(filter.totalDue.gte); }
    if (filter.totalDue?.lte !== undefined) { conditions.push('soh.TotalDue <= ?'); params.push(filter.totalDue.lte); }
    
    return conditions.join(' AND ');
}

// ============================================================
// Resolvers
// ============================================================

const resolvers = {
    DateTime: DateTimeScalar,
    JSON: JSONScalar,
    
    // ---- Type resolvers ----
    
    Person: {
        emailAddresses: (p, _, { loaders }) => loaders.emailAddressesByPersonId.load(p.BusinessEntityID),
        phoneNumbers: (p, _, { loaders }) => loaders.phoneNumbersByPersonId.load(p.BusinessEntityID),
        addresses: (p, _, { loaders }) => loaders.addressesWithTypeByEntityId.load(p.BusinessEntityID),
        employee: (p, _, { loaders }) => loaders.employeeById.load(p.BusinessEntityID),
        customer: async (p, _, { loaders }) => {
            const db = getDb();
            const c = db.prepare('SELECT * FROM Sales_Customer WHERE PersonID = ?').get(p.BusinessEntityID);
            return c || null;
        },
        creditCards: (p, _, { loaders }) => loaders.creditCardsByPersonId.load(p.BusinessEntityID),
    },
    
    PhoneNumber: {
        phoneNumberType: (p, _, { loaders }) => loaders.phoneNumberTypeById.load(p.PhoneNumberTypeID),
    },
    
    AddressWithType: {
        address: (r, _, { loaders }) => loaders.addressById.load(r.AddressID),
        addressType: (r, _, { loaders }) => loaders.addressTypeById.load(r.AddressTypeID),
    },
    
    Address: {
        stateProvince: (a, _, { loaders }) => loaders.stateProvinceById.load(a.StateProvinceID),
    },
    
    StateProvince: {
        countryRegion: (sp, _, { loaders }) => loaders.countryRegionByCode.load(sp.CountryRegionCode),
        territory: (sp, _, { loaders }) => sp.TerritoryID ? loaders.salesTerritoryById.load(sp.TerritoryID) : null,
        addresses: (sp, { limit = 10, offset = 0 }) => {
            const db = getDb();
            return db.prepare('SELECT * FROM Person_Address WHERE StateProvinceID = ? LIMIT ? OFFSET ?')
                .all(sp.StateProvinceID, limit, offset);
        },
        salesTaxRates: (sp) => {
            const db = getDb();
            return db.prepare('SELECT * FROM Sales_SalesTaxRate WHERE StateProvinceID = ?').all(sp.StateProvinceID);
        },
    },
    
    CountryRegion: {
        stateProvinces: (cr) => {
            const db = getDb();
            return db.prepare('SELECT * FROM Person_StateProvince WHERE CountryRegionCode = ?').all(cr.CountryRegionCode);
        },
        currencies: (cr) => {
            const db = getDb();
            return db.prepare(
                `SELECT c.* FROM Sales_Currency c
                 JOIN Sales_CountryRegionCurrency crc ON c.CurrencyCode = crc.CurrencyCode
                 WHERE crc.CountryRegionCode = ?`
            ).all(cr.CountryRegionCode);
        },
    },
    
    Employee: {
        person: (e, _, { loaders }) => loaders.personById.load(e.BusinessEntityID),
        department: (e, _, { loaders }) => loaders.currentDepartmentByEmployeeId.load(e.BusinessEntityID),
        departmentHistory: (e, _, { loaders }) => loaders.deptHistoryByEmployeeId.load(e.BusinessEntityID),
        payHistory: (e, _, { loaders }) => loaders.payHistoryByEmployeeId.load(e.BusinessEntityID),
        purchaseOrders: (e, { limit = 10, offset = 0 }) => {
            const db = getDb();
            return db.prepare(
                'SELECT * FROM Purchasing_PurchaseOrderHeader WHERE EmployeeID = ? LIMIT ? OFFSET ?'
            ).all(e.BusinessEntityID, limit, offset);
        },
    },
    
    EmployeeDepartmentHistory: {
        department: (h, _, { loaders }) => loaders.departmentById.load(h.DepartmentID),
        shift: (h, _, { loaders }) => loaders.shiftById.load(h.ShiftID),
    },
    
    Department: {
        employees: (d) => {
            const db = getDb();
            return db.prepare(
                `SELECT e.* FROM HumanResources_Employee e
                 JOIN HumanResources_EmployeeDepartmentHistory edh ON e.BusinessEntityID = edh.BusinessEntityID
                 WHERE edh.DepartmentID = ? AND edh.EndDate IS NULL`
            ).all(d.DepartmentID);
        },
    },
    
    Product: {
        subcategory: (p, _, { loaders }) => p.ProductSubcategoryID ? loaders.productSubcategoryById.load(p.ProductSubcategoryID) : null,
        model: (p, _, { loaders }) => p.ProductModelID ? loaders.productModelById.load(p.ProductModelID) : null,
        sizeUnitMeasure: (p, _, { loaders }) => p.SizeUnitMeasureCode ? loaders.unitMeasureByCode.load(p.SizeUnitMeasureCode) : null,
        weightUnitMeasure: (p, _, { loaders }) => p.WeightUnitMeasureCode ? loaders.unitMeasureByCode.load(p.WeightUnitMeasureCode) : null,
        inventory: (p, _, { loaders }) => loaders.inventoryByProductId.load(p.ProductID),
        reviews: (p, _, { loaders }) => loaders.reviewsByProductId.load(p.ProductID),
        vendors: (p, _, { loaders }) => loaders.productVendorsByProductId.load(p.ProductID),
        priceHistory: (p, _, { loaders }) => loaders.priceHistoryByProductId.load(p.ProductID),
        costHistory: (p, _, { loaders }) => loaders.costHistoryByProductId.load(p.ProductID),
        workOrders: (p, { limit = 10, offset = 0 }) => {
            const db = getDb();
            return db.prepare(
                'SELECT * FROM Production_WorkOrder WHERE ProductID = ? ORDER BY StartDate DESC LIMIT ? OFFSET ?'
            ).all(p.ProductID, limit, offset);
        },
        salesOrderDetails: (p, { limit = 10, offset = 0 }) => {
            const db = getDb();
            return db.prepare(
                'SELECT * FROM Sales_SalesOrderDetail WHERE ProductID = ? LIMIT ? OFFSET ?'
            ).all(p.ProductID, limit, offset);
        },
    },
    
    ProductInventory: {
        location: (pi, _, { loaders }) => loaders.locationById.load(pi.LocationID),
    },
    
    ProductReview: {
        product: (r, _, { loaders }) => loaders.productById.load(r.ProductID),
    },
    
    ProductCategory: {
        subcategories: (c, _, { loaders }) => loaders.subcategoriesByCategoryId.load(c.ProductCategoryID),
        products: (c, { limit = 20, offset = 0 }) => {
            const db = getDb();
            return db.prepare(
                `SELECT p.* FROM Production_Product p
                 JOIN Production_ProductSubcategory ps ON p.ProductSubcategoryID = ps.ProductSubcategoryID
                 WHERE ps.ProductCategoryID = ? LIMIT ? OFFSET ?`
            ).all(c.ProductCategoryID, limit, offset);
        },
    },
    
    ProductSubcategory: {
        category: (s, _, { loaders }) => loaders.productCategoryById.load(s.ProductCategoryID),
        products: (s, { limit = 20, offset = 0 }) => {
            const db = getDb();
            return db.prepare(
                'SELECT * FROM Production_Product WHERE ProductSubcategoryID = ? LIMIT ? OFFSET ?'
            ).all(s.ProductSubcategoryID, limit, offset);
        },
    },
    
    ProductModel: {
        products: (m, _, { loaders }) => loaders.productsByModelId.load(m.ProductModelID),
        descriptions: (m, _, { loaders }) => loaders.productModelDescriptionsByModelId.load(m.ProductModelID),
    },
    
    ProductModelDescription: {
        // Already has description and cultureId fields from the DataLoader query
    },
    
    WorkOrder: {
        product: (wo, _, { loaders }) => loaders.productById.load(wo.ProductID),
        scrapReason: (wo, _, { loaders }) => wo.ScrapReasonID ? loaders.scrapReasonById.load(wo.ScrapReasonID) : null,
    },
    
    Vendor: {
        contacts: (v, _, { loaders }) => loaders.vendorContactsByVendorId.load(v.BusinessEntityID),
        products: (v, _, { loaders }) => loaders.productVendorsByProductId.load(v.BusinessEntityID),
        purchaseOrders: (v, { limit = 10, offset = 0 }) => {
            const db = getDb();
            return db.prepare(
                'SELECT * FROM Purchasing_PurchaseOrderHeader WHERE VendorID = ? ORDER BY OrderDate DESC LIMIT ? OFFSET ?'
            ).all(v.BusinessEntityID, limit, offset);
        },
    },
    
    ProductVendor: {
        product: (pv, _, { loaders }) => loaders.productById.load(pv.ProductID),
        vendor: (pv, _, { loaders }) => loaders.vendorById.load(pv.BusinessEntityID),
        unitMeasure: (pv, _, { loaders }) => loaders.unitMeasureByCode.load(pv.UnitMeasureCode),
    },
    
    PurchaseOrderHeader: {
        employee: (po, _, { loaders }) => po.EmployeeID ? loaders.employeeById.load(po.EmployeeID) : null,
        vendor: (po, _, { loaders }) => loaders.vendorById.load(po.VendorID),
        shipMethod: (po, _, { loaders }) => loaders.shipMethodById.load(po.ShipMethodID),
        details: (po, _, { loaders }) => loaders.purchaseOrderDetailsByOrderId.load(po.PurchaseOrderID),
        statusLabel: (po) => PURCHASE_ORDER_STATUS[po.Status] || 'Unknown',
    },
    
    PurchaseOrderDetail: {
        product: (d, _, { loaders }) => loaders.productById.load(d.ProductID),
    },
    
    Customer: {
        person: (c, _, { loaders }) => c.PersonID ? loaders.personById.load(c.PersonID) : null,
        store: (c, _, { loaders }) => c.StoreID ? loaders.storeById.load(c.StoreID) : null,
        territory: (c, _, { loaders }) => c.TerritoryID ? loaders.salesTerritoryById.load(c.TerritoryID) : null,
        orders: (c, { limit = 10, offset = 0 }) => {
            const db = getDb();
            return db.prepare(
                'SELECT * FROM Sales_SalesOrderHeader WHERE CustomerID = ? ORDER BY OrderDate DESC LIMIT ? OFFSET ?'
            ).all(c.CustomerID, limit, offset);
        },
        totalOrderValue: (c) => {
            const db = getDb();
            const result = db.prepare(
                'SELECT SUM(TotalDue) as total FROM Sales_SalesOrderHeader WHERE CustomerID = ?'
            ).get(c.CustomerID);
            return result ? result.total : 0;
        },
    },
    
    Store: {
        salesPerson: (s, _, { loaders }) => s.SalesPersonID ? loaders.salesPersonById.load(s.SalesPersonID) : null,
        customers: (s, _, { loaders }) => loaders.customersByStoreId.load(s.BusinessEntityID),
    },
    
    SalesPerson: {
        person: (sp, _, { loaders }) => loaders.personById.load(sp.BusinessEntityID),
        territory: (sp, _, { loaders }) => sp.TerritoryID ? loaders.salesTerritoryById.load(sp.TerritoryID) : null,
        quotaHistory: (sp, _, { loaders }) => loaders.quotaHistoryBySalesPersonId.load(sp.BusinessEntityID),
        orders: (sp, { limit = 10, offset = 0 }) => {
            const db = getDb();
            return db.prepare(
                'SELECT * FROM Sales_SalesOrderHeader WHERE SalesPersonID = ? ORDER BY OrderDate DESC LIMIT ? OFFSET ?'
            ).all(sp.BusinessEntityID, limit, offset);
        },
    },
    
    SalesTerritory: {
        salesPersons: (t, _, { loaders }) => loaders.salesPersonsByTerritoryId.load(t.TerritoryID),
        customers: (t, { limit = 20, offset = 0 }) => {
            const db = getDb();
            return db.prepare(
                'SELECT * FROM Sales_Customer WHERE TerritoryID = ? LIMIT ? OFFSET ?'
            ).all(t.TerritoryID, limit, offset);
        },
        orders: (t, { limit = 20, offset = 0 }) => {
            const db = getDb();
            return db.prepare(
                'SELECT * FROM Sales_SalesOrderHeader WHERE TerritoryID = ? ORDER BY OrderDate DESC LIMIT ? OFFSET ?'
            ).all(t.TerritoryID, limit, offset);
        },
        group: (t) => t.TerritoryGroup,
    },
    
    SalesOrderHeader: {
        customer: (o, _, { loaders }) => loaders.customerById.load(o.CustomerID),
        salesPerson: (o, _, { loaders }) => o.SalesPersonID ? loaders.salesPersonById.load(o.SalesPersonID) : null,
        territory: (o, _, { loaders }) => o.TerritoryID ? loaders.salesTerritoryById.load(o.TerritoryID) : null,
        billToAddress: (o, _, { loaders }) => loaders.addressById.load(o.BillToAddressID),
        shipToAddress: (o, _, { loaders }) => loaders.addressById.load(o.ShipToAddressID),
        shipMethod: (o, _, { loaders }) => loaders.shipMethodById.load(o.ShipMethodID),
        creditCard: (o, _, { loaders }) => o.CreditCardID ? loaders.creditCardById.load(o.CreditCardID) : null,
        currencyRate: (o, _, { loaders }) => o.CurrencyRateID ? loaders.currencyRateById.load(o.CurrencyRateID) : null,
        details: (o, _, { loaders }) => loaders.salesOrderDetailsByOrderId.load(o.SalesOrderID),
        salesReasons: (o, _, { loaders }) => loaders.salesReasonsByOrderId.load(o.SalesOrderID),
        statusLabel: (o) => SALES_ORDER_STATUS[o.Status] || 'Unknown',
    },
    
    SalesOrderDetail: {
        product: (d, _, { loaders }) => loaders.productById.load(d.ProductID),
        specialOffer: (d, _, { loaders }) => d.SpecialOfferID && d.SpecialOfferID !== 1
            ? loaders.specialOfferById.load(d.SpecialOfferID) : null,
        order: (d, _, { loaders }) => loaders.salesOrderById.load(d.SalesOrderID),
    },
    
    SpecialOffer: {
        products: (so) => {
            const db = getDb();
            return db.prepare(
                `SELECT p.* FROM Production_Product p
                 JOIN Sales_SpecialOfferProduct sop ON p.ProductID = sop.ProductID
                 WHERE sop.SpecialOfferID = ?`
            ).all(so.SpecialOfferID);
        },
    },
    
    SalesTaxRate: {
        stateProvince: (r, _, { loaders }) => loaders.stateProvinceById.load(r.StateProvinceID),
    },
    
    // ---- Connection total count resolvers ----
    
    PersonConnection: {
        totalCount: (conn) => conn.totalCount,
    },
    
    ProductConnection: {
        totalCount: (conn) => conn.totalCount,
    },
    
    SalesOrderConnection: {
        totalCount: (conn) => conn.totalCount,
    },
    
    CustomerConnection: {
        totalCount: (conn) => conn.totalCount,
    },
    
    EmployeeConnection: {
        totalCount: (conn) => conn.totalCount,
    },
    
    VendorConnection: {
        totalCount: (conn) => conn.totalCount,
    },
    
    // ---- Query resolvers ----
    
    Query: {
        // Health
        health: () => {
            const db = getDb();
            const tables = db.prepare("SELECT COUNT(*) as c FROM sqlite_master WHERE type='table'").get();
            const totalRecords = db.prepare(
                "SELECT SUM(total) as t FROM (SELECT COUNT(*) as total FROM Sales_SalesOrderHeader UNION ALL SELECT COUNT(*) FROM Production_Product UNION ALL SELECT COUNT(*) FROM Person_Person)"
            ).get();
            return {
                status: 'ok',
                databaseConnected: true,
                tableCount: tables.c,
                totalRecords: totalRecords ? totalRecords.t : 0,
                uptime: process.uptime().toFixed(0) + 's',
                version: '3.0.0'
            };
        },
        
        cacheStats: () => queryCache.getStats(),
        
        queryAnalytics: () => analytics.getSummary(),
        
        // Persons
        person: (_, { id }, { loaders }) => loaders.personById.load(id),
        
        persons: (_, args) => {
            const db = getDb();
            const { filter, orderBy, first = 20, after } = args;
            
            // Build filter
            const params = [];
            const conditions = [];
            
            if (filter) {
                const addStringFilter = (col, f) => {
                    if (!f) return;
                    if (f.eq !== undefined) { conditions.push(`${col} = ?`); params.push(f.eq); }
                    if (f.contains !== undefined) { conditions.push(`${col} LIKE ?`); params.push(`%${f.contains}%`); }
                    if (f.startsWith !== undefined) { conditions.push(`${col} LIKE ?`); params.push(`${f.startsWith}%`); }
                };
                
                addStringFilter('FirstName', filter.firstName);
                addStringFilter('LastName', filter.lastName);
                addStringFilter('PersonType', filter.personType);
                if (filter.emailPromotion?.eq !== undefined) { conditions.push('EmailPromotion = ?'); params.push(filter.emailPromotion.eq); }
            }
            
            const afterId = decodeCursor(after);
            if (afterId !== null) { conditions.push('BusinessEntityID > ?'); params.push(afterId); }
            
            const whereStr = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
            const orderClause = buildOrderByClause(orderBy || [{ field: 'BusinessEntityID', direction: 'ASC' }]);
            
            const total = db.prepare(`SELECT COUNT(*) as c FROM Person_Person ${whereStr}`).get(params).c;
            const limit = Math.min(first || 20, 100);
            const rows = db.prepare(`SELECT * FROM Person_Person ${whereStr} ${orderClause} LIMIT ?`).all([...params, limit + 1]);
            const hasNextPage = rows.length > limit;
            if (hasNextPage) rows.pop();
            
            const edges = rows.map(r => ({ cursor: encodeCursor(r.BusinessEntityID), node: r }));
            return { edges, pageInfo: { hasNextPage, hasPreviousPage: !!after, startCursor: edges[0]?.cursor, endCursor: edges[edges.length-1]?.cursor }, totalCount: total };
        },
        
        searchPersons: (_, { query, limit = 10 }) => {
            const db = getDb();
            return cachedQuery(`search:persons:${query}:${limit}`, () => {
                try {
                    const ids = db.prepare(
                        `SELECT BusinessEntityID FROM fts_person WHERE fts_person MATCH ? LIMIT ?`
                    ).all(query, limit).map(r => r.BusinessEntityID);
                    
                    if (ids.length === 0) return [];
                    return db.prepare(
                        `SELECT * FROM Person_Person WHERE BusinessEntityID IN (${ids.map(() => '?').join(',')})`
                    ).all(ids);
                } catch (e) {
                    // Fallback to LIKE search
                    return db.prepare(
                        `SELECT * FROM Person_Person WHERE FirstName LIKE ? OR LastName LIKE ? LIMIT ?`
                    ).all(`%${query}%`, `%${query}%`, limit);
                }
            });
        },
        
        address: (_, { id }, { loaders }) => loaders.addressById.load(id),
        
        addresses: (_, { city, postalCode, stateProvinceId, limit = 20, offset = 0 }) => {
            const db = getDb();
            const conditions = [];
            const params = [];
            if (city) { conditions.push('City LIKE ?'); params.push(`%${city}%`); }
            if (postalCode) { conditions.push('PostalCode = ?'); params.push(postalCode); }
            if (stateProvinceId) { conditions.push('StateProvinceID = ?'); params.push(stateProvinceId); }
            const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
            return db.prepare(`SELECT * FROM Person_Address ${where} LIMIT ? OFFSET ?`).all([...params, limit, offset]);
        },
        
        // Employees
        employee: (_, { id }, { loaders }) => loaders.employeeById.load(id),
        
        employees: (_, args) => {
            const db = getDb();
            const { filter, orderBy, first = 20, after } = args;
            const params = [];
            const conditions = [];
            
            if (filter) {
                if (filter.jobTitle?.contains) { conditions.push('e.JobTitle LIKE ?'); params.push(`%${filter.jobTitle.contains}%`); }
                if (filter.jobTitle?.eq) { conditions.push('e.JobTitle = ?'); params.push(filter.jobTitle.eq); }
                if (filter.gender) { conditions.push('e.Gender = ?'); params.push(filter.gender); }
                if (filter.maritalStatus) { conditions.push('e.MaritalStatus = ?'); params.push(filter.maritalStatus); }
                if (filter.salariedFlag !== undefined) { conditions.push('e.SalariedFlag = ?'); params.push(filter.salariedFlag ? 1 : 0); }
                if (filter.currentFlag !== undefined) { conditions.push('e.CurrentFlag = ?'); params.push(filter.currentFlag ? 1 : 0); }
                if (filter.department?.contains || filter.department?.eq) {
                    conditions.push(`EXISTS (
                        SELECT 1 FROM HumanResources_EmployeeDepartmentHistory edh
                        JOIN HumanResources_Department d ON edh.DepartmentID = d.DepartmentID
                        WHERE edh.BusinessEntityID = e.BusinessEntityID AND edh.EndDate IS NULL
                        AND d.Name ${filter.department.eq ? '= ?' : 'LIKE ?'}
                    )`);
                    params.push(filter.department.eq || `%${filter.department.contains}%`);
                }
            }
            
            const afterId = decodeCursor(after);
            if (afterId !== null) { conditions.push('e.BusinessEntityID > ?'); params.push(afterId); }
            
            const whereStr = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
            const orderClause = orderBy?.length
                ? `ORDER BY ${orderBy.map(o => `e."${o.field}" ${o.direction || 'ASC'}`).join(', ')}`
                : 'ORDER BY e.BusinessEntityID ASC';
            
            const total = db.prepare(`SELECT COUNT(*) as c FROM HumanResources_Employee e ${whereStr}`).get(params).c;
            const limit = Math.min(first || 20, 100);
            const rows = db.prepare(`SELECT e.* FROM HumanResources_Employee e ${whereStr} ${orderClause} LIMIT ?`).all([...params, limit + 1]);
            const hasNextPage = rows.length > limit;
            if (hasNextPage) rows.pop();
            
            const edges = rows.map(r => ({ cursor: encodeCursor(r.BusinessEntityID), node: r }));
            return { edges, pageInfo: { hasNextPage, hasPreviousPage: !!after, startCursor: edges[0]?.cursor, endCursor: edges[edges.length-1]?.cursor }, totalCount: total };
        },
        
        department: (_, { id }, { loaders }) => loaders.departmentById.load(id),
        departments: () => getDb().prepare('SELECT * FROM HumanResources_Department ORDER BY GroupName, Name').all(),
        
        // Products
        product: (_, { id }, { loaders }) => loaders.productById.load(id),
        
        productByNumber: (_, { productNumber }) => {
            return getDb().prepare('SELECT * FROM Production_Product WHERE ProductNumber = ?').get(productNumber) || null;
        },
        
        products: (_, args) => {
            const db = getDb();
            const { filter, orderBy, first = 20, after } = args;
            
            const params = [];
            const whereConditions = [];
            
            const productWhere = buildProductWhere(filter, params);
            if (productWhere) whereConditions.push(productWhere);
            
            const afterId = decodeCursor(after);
            if (afterId !== null) { whereConditions.push('p.ProductID > ?'); params.push(afterId); }
            
            const joinClause = filter?.productCategoryId !== undefined
                ? 'LEFT JOIN Production_ProductSubcategory ps ON p.ProductSubcategoryID = ps.ProductSubcategoryID'
                : '';
            
            const whereStr = whereConditions.length ? `WHERE ${whereConditions.join(' AND ')}` : '';
            const orderClause = orderBy?.length
                ? `ORDER BY ${orderBy.map(o => `p."${o.field}" ${o.direction || 'ASC'}`).join(', ')}`
                : 'ORDER BY p.ProductID ASC';
            
            const total = db.prepare(`SELECT COUNT(*) as c FROM Production_Product p ${joinClause} ${whereStr}`).get(params).c;
            const limit = Math.min(first || 20, 100);
            const rows = db.prepare(`SELECT p.* FROM Production_Product p ${joinClause} ${whereStr} ${orderClause} LIMIT ?`).all([...params, limit + 1]);
            const hasNextPage = rows.length > limit;
            if (hasNextPage) rows.pop();
            
            const edges = rows.map(r => ({ cursor: encodeCursor(r.ProductID), node: r }));
            return { edges, pageInfo: { hasNextPage, hasPreviousPage: !!after, startCursor: edges[0]?.cursor, endCursor: edges[edges.length-1]?.cursor }, totalCount: total };
        },
        
        searchProducts: (_, { query, limit = 10 }) => {
            const db = getDb();
            return cachedQuery(`search:products:${query}:${limit}`, () => {
                try {
                    const ids = db.prepare(
                        `SELECT ProductID FROM fts_product WHERE fts_product MATCH ? LIMIT ?`
                    ).all(query, limit).map(r => r.ProductID);
                    if (ids.length === 0) return [];
                    return db.prepare(
                        `SELECT * FROM Production_Product WHERE ProductID IN (${ids.map(() => '?').join(',')})`
                    ).all(ids);
                } catch (e) {
                    return db.prepare(
                        'SELECT * FROM Production_Product WHERE Name LIKE ? OR ProductNumber LIKE ? LIMIT ?'
                    ).all(`%${query}%`, `%${query}%`, limit);
                }
            });
        },
        
        productCategory: (_, { id }, { loaders }) => loaders.productCategoryById.load(id),
        productCategories: () => getDb().prepare('SELECT * FROM Production_ProductCategory ORDER BY Name').all(),
        productSubcategory: (_, { id }, { loaders }) => loaders.productSubcategoryById.load(id),
        productSubcategories: (_, { categoryId }) => {
            const db = getDb();
            if (categoryId) return db.prepare('SELECT * FROM Production_ProductSubcategory WHERE ProductCategoryID = ? ORDER BY Name').all(categoryId);
            return db.prepare('SELECT * FROM Production_ProductSubcategory ORDER BY Name').all();
        },
        productModel: (_, { id }, { loaders }) => loaders.productModelById.load(id),
        productModels: (_, { limit = 50, offset = 0 }) => {
            return getDb().prepare('SELECT * FROM Production_ProductModel ORDER BY Name LIMIT ? OFFSET ?').all(limit, offset);
        },
        
        inventoryStatus: (_, { belowSafetyStock, locationId, limit = 50, offset = 0 }) => {
            const db = getDb();
            const conditions = [];
            const params = [];
            if (locationId) { conditions.push('pi.LocationID = ?'); params.push(locationId); }
            const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
            
            let rows = db.prepare(
                `SELECT p.*, SUM(pi.Quantity) as TotalQty, COUNT(DISTINCT pi.LocationID) as LocCount
                 FROM Production_Product p
                 LEFT JOIN Production_ProductInventory pi ON p.ProductID = pi.ProductID
                 ${where}
                 GROUP BY p.ProductID
                 ORDER BY p.Name LIMIT ? OFFSET ?`
            ).all([...params, limit, offset]);
            
            if (belowSafetyStock) {
                rows = rows.filter(r => (r.TotalQty || 0) < r.SafetyStockLevel);
            }
            
            return rows.map(r => ({
                product: r,
                totalQuantity: r.TotalQty || 0,
                locationCount: r.LocCount || 0,
                belowSafetyStock: (r.TotalQty || 0) < r.SafetyStockLevel
            }));
        },
        
        // Vendors
        vendor: (_, { id }, { loaders }) => loaders.vendorById.load(id),
        
        vendors: (_, args) => {
            const db = getDb();
            const { filter, orderBy, first = 20, after } = args;
            const params = [];
            const conditions = [];
            
            if (filter) {
                if (filter.name?.contains) { conditions.push('Name LIKE ?'); params.push(`%${filter.name.contains}%`); }
                if (filter.name?.eq) { conditions.push('Name = ?'); params.push(filter.name.eq); }
                if (filter.creditRating?.eq !== undefined) { conditions.push('CreditRating = ?'); params.push(filter.creditRating.eq); }
                if (filter.creditRating?.lte !== undefined) { conditions.push('CreditRating <= ?'); params.push(filter.creditRating.lte); }
                if (filter.preferredVendorStatus !== undefined) { conditions.push('PreferredVendorStatus = ?'); params.push(filter.preferredVendorStatus ? 1 : 0); }
                if (filter.activeFlag !== undefined) { conditions.push('ActiveFlag = ?'); params.push(filter.activeFlag ? 1 : 0); }
            }
            
            const afterId = decodeCursor(after);
            if (afterId !== null) { conditions.push('BusinessEntityID > ?'); params.push(afterId); }
            
            const whereStr = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
            const orderClause = buildOrderByClause(orderBy || [{ field: 'BusinessEntityID', direction: 'ASC' }]);
            
            const total = db.prepare(`SELECT COUNT(*) as c FROM Purchasing_Vendor ${whereStr}`).get(params).c;
            const limit = Math.min(first || 20, 100);
            const rows = db.prepare(`SELECT * FROM Purchasing_Vendor ${whereStr} ${orderClause} LIMIT ?`).all([...params, limit + 1]);
            const hasNextPage = rows.length > limit;
            if (hasNextPage) rows.pop();
            
            const edges = rows.map(r => ({ cursor: encodeCursor(r.BusinessEntityID), node: r }));
            return { edges, pageInfo: { hasNextPage, hasPreviousPage: !!after, startCursor: edges[0]?.cursor, endCursor: edges[edges.length-1]?.cursor }, totalCount: total };
        },
        
        purchaseOrder: (_, { id }, { loaders }) => loaders.purchaseOrderById.load(id),
        
        purchaseOrders: (_, { vendorId, employeeId, status, orderDateFrom, orderDateTo, limit = 20, offset = 0 }) => {
            const db = getDb();
            const conditions = [];
            const params = [];
            if (vendorId) { conditions.push('VendorID = ?'); params.push(vendorId); }
            if (employeeId) { conditions.push('EmployeeID = ?'); params.push(employeeId); }
            if (status !== undefined) { conditions.push('Status = ?'); params.push(status); }
            if (orderDateFrom) { conditions.push('OrderDate >= ?'); params.push(orderDateFrom); }
            if (orderDateTo) { conditions.push('OrderDate <= ?'); params.push(orderDateTo); }
            const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
            return db.prepare(
                `SELECT * FROM Purchasing_PurchaseOrderHeader ${where} ORDER BY OrderDate DESC LIMIT ? OFFSET ?`
            ).all([...params, limit, offset]);
        },
        
        // Customers
        customer: (_, { id }, { loaders }) => loaders.customerById.load(id),
        
        customers: (_, args) => {
            const db = getDb();
            const { filter, orderBy, first = 20, after } = args;
            const params = [];
            const conditions = [];
            
            if (filter) {
                if (filter.accountNumber?.contains) { conditions.push('AccountNumber LIKE ?'); params.push(`%${filter.accountNumber.contains}%`); }
                if (filter.territoryId?.eq !== undefined) { conditions.push('TerritoryID = ?'); params.push(filter.territoryId.eq); }
                if (filter.storeId?.eq !== undefined) { conditions.push('StoreID = ?'); params.push(filter.storeId.eq); }
            }
            
            const afterId = decodeCursor(after);
            if (afterId !== null) { conditions.push('CustomerID > ?'); params.push(afterId); }
            
            const whereStr = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
            const orderClause = buildOrderByClause(orderBy || [{ field: 'CustomerID', direction: 'ASC' }]);
            
            const total = db.prepare(`SELECT COUNT(*) as c FROM Sales_Customer ${whereStr}`).get(params).c;
            const limit = Math.min(first || 20, 100);
            const rows = db.prepare(`SELECT * FROM Sales_Customer ${whereStr} ${orderClause} LIMIT ?`).all([...params, limit + 1]);
            const hasNextPage = rows.length > limit;
            if (hasNextPage) rows.pop();
            
            const edges = rows.map(r => ({ cursor: encodeCursor(r.CustomerID), node: r }));
            return { edges, pageInfo: { hasNextPage, hasPreviousPage: !!after, startCursor: edges[0]?.cursor, endCursor: edges[edges.length-1]?.cursor }, totalCount: total };
        },
        
        // Sales orders
        salesOrder: (_, { id }, { loaders }) => loaders.salesOrderById.load(id),
        
        salesOrderByNumber: (_, { orderNumber }) => {
            return getDb().prepare('SELECT * FROM Sales_SalesOrderHeader WHERE SalesOrderNumber = ?').get(orderNumber) || null;
        },
        
        salesOrders: (_, args) => {
            const db = getDb();
            const { filter, orderBy, first = 20, after } = args;
            const params = [];
            const conditions = [];
            
            const filterWhere = buildSalesOrderWhere(filter, params);
            if (filterWhere) conditions.push(filterWhere);
            
            const afterId = decodeCursor(after);
            if (afterId !== null) { conditions.push('soh.SalesOrderID > ?'); params.push(afterId); }
            
            const whereStr = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
            const orderClause = orderBy?.length
                ? `ORDER BY ${orderBy.map(o => `soh."${o.field}" ${o.direction || 'ASC'}`).join(', ')}`
                : 'ORDER BY soh.SalesOrderID ASC';
            
            const total = db.prepare(`SELECT COUNT(*) as c FROM Sales_SalesOrderHeader soh ${whereStr}`).get(params).c;
            const limit = Math.min(first || 20, 100);
            const rows = db.prepare(`SELECT soh.* FROM Sales_SalesOrderHeader soh ${whereStr} ${orderClause} LIMIT ?`).all([...params, limit + 1]);
            const hasNextPage = rows.length > limit;
            if (hasNextPage) rows.pop();
            
            const edges = rows.map(r => ({ cursor: encodeCursor(r.SalesOrderID), node: r }));
            return { edges, pageInfo: { hasNextPage, hasPreviousPage: !!after, startCursor: edges[0]?.cursor, endCursor: edges[edges.length-1]?.cursor }, totalCount: total };
        },
        
        salesTerritory: (_, { id }, { loaders }) => loaders.salesTerritoryById.load(id),
        salesTerritories: () => getDb().prepare('SELECT * FROM Sales_SalesTerritory ORDER BY Name').all(),
        salesPerson: (_, { id }, { loaders }) => loaders.salesPersonById.load(id),
        salesPersons: () => getDb().prepare('SELECT * FROM Sales_SalesPerson ORDER BY BusinessEntityID').all(),
        store: (_, { id }, { loaders }) => loaders.storeById.load(id),
        
        stores: (_, { salesPersonId, limit = 20, offset = 0 }) => {
            const db = getDb();
            if (salesPersonId) {
                return db.prepare('SELECT * FROM Sales_Store WHERE SalesPersonID = ? LIMIT ? OFFSET ?').all(salesPersonId, limit, offset);
            }
            return db.prepare('SELECT * FROM Sales_Store ORDER BY Name LIMIT ? OFFSET ?').all(limit, offset);
        },
        
        specialOffers: (_, { activeOnly }) => {
            const db = getDb();
            if (activeOnly) {
                return db.prepare("SELECT * FROM Sales_SpecialOffer WHERE EndDate >= date('now') ORDER BY StartDate").all();
            }
            return db.prepare('SELECT * FROM Sales_SpecialOffer ORDER BY StartDate DESC').all();
        },
        
        currencies: () => getDb().prepare('SELECT * FROM Sales_Currency ORDER BY Name').all(),
        
        currencyRates: (_, { fromCode, toCode, dateFrom, dateTo, limit = 50 }) => {
            const db = getDb();
            const conditions = [];
            const params = [];
            if (fromCode) { conditions.push('FromCurrencyCode = ?'); params.push(fromCode); }
            if (toCode) { conditions.push('ToCurrencyCode = ?'); params.push(toCode); }
            if (dateFrom) { conditions.push('CurrencyRateDate >= ?'); params.push(dateFrom); }
            if (dateTo) { conditions.push('CurrencyRateDate <= ?'); params.push(dateTo); }
            const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
            return db.prepare(`SELECT * FROM Sales_CurrencyRate ${where} ORDER BY CurrencyRateDate DESC LIMIT ?`).all([...params, limit]);
        },
        
        // Analytics
        salesByCategory: (_, { dateFrom, dateTo, limit = 10 }) => {
            const db = getDb();
            const conditions = [];
            const params = [];
            if (dateFrom) { conditions.push('soh.OrderDate >= ?'); params.push(dateFrom); }
            if (dateTo) { conditions.push('soh.OrderDate <= ?'); params.push(dateTo); }
            const where = conditions.length ? `AND ${conditions.join(' AND ')}` : '';
            
            const rows = db.prepare(`
                SELECT 
                    pc.ProductCategoryID,
                    pc.Name as CategoryName,
                    SUM(sod.LineTotal) as TotalRevenue,
                    COUNT(DISTINCT soh.SalesOrderID) as OrderCount,
                    COUNT(DISTINCT sod.ProductID) as ProductCount,
                    AVG(sod.LineTotal) as AvgLineValue
                FROM Production_ProductCategory pc
                JOIN Production_ProductSubcategory ps ON pc.ProductCategoryID = ps.ProductCategoryID
                JOIN Production_Product p ON ps.ProductSubcategoryID = p.ProductSubcategoryID
                JOIN Sales_SalesOrderDetail sod ON p.ProductID = sod.ProductID
                JOIN Sales_SalesOrderHeader soh ON sod.SalesOrderID = soh.SalesOrderID
                WHERE 1=1 ${where}
                GROUP BY pc.ProductCategoryID
                ORDER BY TotalRevenue DESC
                LIMIT ?
            `).all([...params, limit]);
            
            return rows.map(r => ({
                category: { ProductCategoryID: r.ProductCategoryID, Name: r.CategoryName, ModifiedDate: null },
                totalRevenue: r.TotalRevenue,
                orderCount: r.OrderCount,
                productCount: r.ProductCount,
                avgOrderValue: r.AvgLineValue
            }));
        },
        
        salesByTerritory: (_, { dateFrom, dateTo }) => {
            const db = getDb();
            const conditions = [];
            const params = [];
            if (dateFrom) { conditions.push('soh.OrderDate >= ?'); params.push(dateFrom); }
            if (dateTo) { conditions.push('soh.OrderDate <= ?'); params.push(dateTo); }
            const where = conditions.length ? `AND ${conditions.join(' AND ')}` : '';
            
            const rows = db.prepare(`
                SELECT 
                    st.TerritoryID,
                    st.Name, st.CountryRegionCode, st.TerritoryGroup,
                    st.SalesYTD, st.SalesLastYear, st.CostYTD, st.CostLastYear,
                    st.rowguid, st.ModifiedDate,
                    SUM(soh.TotalDue) as TotalRevenue,
                    COUNT(DISTINCT soh.SalesOrderID) as OrderCount,
                    COUNT(DISTINCT soh.CustomerID) as CustomerCount
                FROM Sales_SalesTerritory st
                LEFT JOIN Sales_SalesOrderHeader soh ON st.TerritoryID = soh.TerritoryID
                WHERE 1=1 ${where}
                GROUP BY st.TerritoryID
                ORDER BY TotalRevenue DESC NULLS LAST
            `).all(params);
            
            return rows.map(r => ({
                territory: r,
                totalRevenue: r.TotalRevenue || 0,
                orderCount: r.OrderCount || 0,
                customerCount: r.CustomerCount || 0
            }));
        },
        
        salesByMonth: (_, { year, limit = 24 }) => {
            const db = getDb();
            const conditions = [];
            const params = [];
            if (year) { conditions.push("strftime('%Y', OrderDate) = ?"); params.push(String(year)); }
            const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
            
            return db.prepare(`
                SELECT 
                    CAST(strftime('%Y', OrderDate) AS INTEGER) as year,
                    CAST(strftime('%m', OrderDate) AS INTEGER) as month,
                    SUM(TotalDue) as totalRevenue,
                    COUNT(*) as orderCount
                FROM Sales_SalesOrderHeader
                ${where}
                GROUP BY year, month
                ORDER BY year DESC, month DESC
                LIMIT ?
            `).all([...params, limit]);
        },
        
        topProducts: (_, { dateFrom, dateTo, categoryId, limit = 10 }) => {
            const db = getDb();
            const conditions = [];
            const params = [];
            if (dateFrom) { conditions.push('soh.OrderDate >= ?'); params.push(dateFrom); }
            if (dateTo) { conditions.push('soh.OrderDate <= ?'); params.push(dateTo); }
            if (categoryId) { conditions.push('ps.ProductCategoryID = ?'); params.push(categoryId); }
            const where = conditions.length ? `AND ${conditions.join(' AND ')}` : '';
            const join = categoryId ? 'LEFT JOIN Production_ProductSubcategory ps ON p.ProductSubcategoryID = ps.ProductSubcategoryID' : '';
            
            const rows = db.prepare(`
                SELECT 
                    p.*,
                    SUM(sod.LineTotal) as TotalRevenue,
                    SUM(sod.OrderQty) as TotalQuantity,
                    COUNT(DISTINCT sod.SalesOrderID) as OrderCount
                FROM Production_Product p
                JOIN Sales_SalesOrderDetail sod ON p.ProductID = sod.ProductID
                JOIN Sales_SalesOrderHeader soh ON sod.SalesOrderID = soh.SalesOrderID
                ${join}
                WHERE 1=1 ${where}
                GROUP BY p.ProductID
                ORDER BY TotalRevenue DESC
                LIMIT ?
            `).all([...params, limit]);
            
            return rows.map(r => ({
                product: r,
                totalRevenue: r.TotalRevenue,
                totalQuantity: r.TotalQuantity,
                orderCount: r.OrderCount
            }));
        },
        
        topCustomers: (_, { dateFrom, dateTo, limit = 10 }) => {
            const db = getDb();
            const conditions = [];
            const params = [];
            if (dateFrom) { conditions.push('OrderDate >= ?'); params.push(dateFrom); }
            if (dateTo) { conditions.push('OrderDate <= ?'); params.push(dateTo); }
            const where = conditions.length ? `AND ${conditions.join(' AND ')}` : '';
            
            const rows = db.prepare(`
                SELECT 
                    c.*,
                    SUM(soh.TotalDue) as TotalSpent,
                    COUNT(*) as OrderCount,
                    MAX(soh.OrderDate) as LastOrderDate
                FROM Sales_Customer c
                JOIN Sales_SalesOrderHeader soh ON c.CustomerID = soh.CustomerID
                WHERE 1=1 ${where}
                GROUP BY c.CustomerID
                ORDER BY TotalSpent DESC
                LIMIT ?
            `).all([...params, limit]);
            
            return rows.map(r => ({
                customer: r,
                totalSpent: r.TotalSpent,
                orderCount: r.OrderCount,
                lastOrderDate: r.LastOrderDate
            }));
        },
        
        salesPersonPerformance: (_, { territoryId }) => {
            const db = getDb();
            const where = territoryId ? 'WHERE sp.TerritoryID = ?' : '';
            const params = territoryId ? [territoryId] : [];
            
            const rows = db.prepare(`
                SELECT 
                    sp.*,
                    SUM(soh.TotalDue) as TotalSales,
                    COUNT(soh.SalesOrderID) as OrderCount,
                    AVG(soh.TotalDue) as AvgOrderValue
                FROM Sales_SalesPerson sp
                LEFT JOIN Sales_SalesOrderHeader soh ON sp.BusinessEntityID = soh.SalesPersonID
                ${where}
                GROUP BY sp.BusinessEntityID
                ORDER BY TotalSales DESC NULLS LAST
            `).all(params);
            
            return rows.map(r => ({
                salesPerson: r,
                totalSales: r.TotalSales || 0,
                orderCount: r.OrderCount || 0,
                avgOrderValue: r.AvgOrderValue || 0,
                ytdQuota: r.SalesQuota
            }));
        },
        
        salesOrderAggregate: (_, { filter, field }) => {
            const db = getDb();
            const params = [];
            const filterWhere = buildSalesOrderWhere(filter, params);
            const where = filterWhere ? `WHERE ${filterWhere}` : '';
            
            const result = db.prepare(`
                SELECT 
                    COUNT(*) as count,
                    SUM("${field}") as sum,
                    AVG("${field}") as avg,
                    MIN("${field}") as min,
                    MAX("${field}") as max
                FROM Sales_SalesOrderHeader soh
                ${where}
            `).get(params);
            
            return {
                count: result.count,
                sum: result.sum,
                avg: result.avg,
                min: result.min,
                max: result.max
            };
        },
        
        productAggregate: (_, { filter, field }) => {
            const db = getDb();
            const params = [];
            const productWhere = buildProductWhere(filter, params);
            const where = productWhere ? `WHERE ${productWhere}` : '';
            
            const result = db.prepare(`
                SELECT 
                    COUNT(*) as count,
                    SUM("${field}") as sum,
                    AVG("${field}") as avg,
                    MIN("${field}") as min,
                    MAX("${field}") as max
                FROM Production_Product p
                ${where}
            `).get(params);
            
            return { count: result.count, sum: result.sum, avg: result.avg, min: result.min, max: result.max };
        },
        
        search: (_, { query, limit = 10 }) => {
            const db = getDb();
            const q = `%${query}%`;
            
            let persons = [];
            let products = [];
            try {
                const personIds = db.prepare(`SELECT BusinessEntityID FROM fts_person WHERE fts_person MATCH ? LIMIT ?`).all(query, limit).map(r => r.BusinessEntityID);
                if (personIds.length) {
                    persons = db.prepare(`SELECT * FROM Person_Person WHERE BusinessEntityID IN (${personIds.map(() => '?').join(',')})`).all(personIds);
                }
            } catch (e) {
                persons = db.prepare('SELECT * FROM Person_Person WHERE FirstName LIKE ? OR LastName LIKE ? LIMIT ?').all(q, q, limit);
            }
            
            try {
                const productIds = db.prepare(`SELECT ProductID FROM fts_product WHERE fts_product MATCH ? LIMIT ?`).all(query, limit).map(r => r.ProductID);
                if (productIds.length) {
                    products = db.prepare(`SELECT * FROM Production_Product WHERE ProductID IN (${productIds.map(() => '?').join(',')})`).all(productIds);
                }
            } catch (e) {
                products = db.prepare('SELECT * FROM Production_Product WHERE Name LIKE ? OR ProductNumber LIKE ? LIMIT ?').all(q, q, limit);
            }
            
            return { persons, products, totalPersons: persons.length, totalProducts: products.length };
        },
    },
    
    // ---- Mutation resolvers ----
    
    Mutation: {
        createProduct: (_, { input }) => {
            validateCreateProduct(input);
            const db = getDb();
            // Check for duplicate product number
            const existing = db.prepare('SELECT ProductID FROM Production_Product WHERE ProductNumber = ?').get(input.productNumber);
            if (existing) throw new Error(`Product number '${input.productNumber}' already exists`);
            const now = new Date().toISOString();
            const rowguid = require('crypto').randomUUID();
            
            const stmt = db.prepare(`
                INSERT INTO Production_Product (
                    Name, ProductNumber, MakeFlag, FinishedGoodsFlag, Color,
                    SafetyStockLevel, ReorderPoint, StandardCost, ListPrice,
                    Size, Weight, DaysToManufacture, ProductLine, Class, Style,
                    ProductSubcategoryID, ProductModelID, SellStartDate, SellEndDate,
                    rowguid, ModifiedDate
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            
            const result = stmt.run(
                input.name, input.productNumber,
                input.makeFlag !== false ? 1 : 0,
                input.finishedGoodsFlag !== false ? 1 : 0,
                input.color || null,
                input.safetyStockLevel, input.reorderPoint,
                input.standardCost, input.listPrice,
                input.size || null, input.weight || null,
                input.daysToManufacture,
                input.productLine || null, input.class || null, input.style || null,
                input.productSubcategoryId || null, input.productModelId || null,
                input.sellStartDate, input.sellEndDate || null,
                rowguid, now
            );
            
            queryCache.invalidatePattern('products:');
            return db.prepare('SELECT * FROM Production_Product WHERE ProductID = ?').get(result.lastInsertRowid);
        },
        
        updateProduct: (_, { id, input }) => {
            const db = getDb();
            const fields = [];
            const params = [];
            
            const addField = (col, val) => {
                if (val !== undefined) { fields.push(`${col} = ?`); params.push(val); }
            };
            
            addField('Name', input.name);
            addField('Color', input.color);
            addField('SafetyStockLevel', input.safetyStockLevel);
            addField('ReorderPoint', input.reorderPoint);
            addField('StandardCost', input.standardCost);
            addField('ListPrice', input.listPrice);
            addField('Size', input.size);
            addField('Weight', input.weight);
            addField('ProductLine', input.productLine);
            addField('Class', input.class);
            addField('Style', input.style);
            addField('ProductSubcategoryID', input.productSubcategoryId);
            addField('SellEndDate', input.sellEndDate);
            addField('DiscontinuedDate', input.discontinuedDate);
            fields.push('ModifiedDate = ?'); params.push(new Date().toISOString());
            
            if (fields.length > 0) {
                db.prepare(`UPDATE Production_Product SET ${fields.join(', ')} WHERE ProductID = ?`).run([...params, id]);
            }
            
            queryCache.invalidatePattern(`product:${id}`);
            return db.prepare('SELECT * FROM Production_Product WHERE ProductID = ?').get(id);
        },
        
        deleteProduct: (_, { id }) => {
            const db = getDb();
            const result = db.prepare(
                "UPDATE Production_Product SET DiscontinuedDate = ?, ModifiedDate = ? WHERE ProductID = ?"
            ).run(new Date().toISOString(), new Date().toISOString(), id);
            queryCache.invalidatePattern(`product:${id}`);
            return result.changes > 0;
        },
        
        createCustomer: (_, { input }) => {
            const db = getDb();
            const now = new Date().toISOString();
            const rowguid = require('crypto').randomUUID();
            
            const result = db.prepare(`
                INSERT INTO Sales_Customer (PersonID, StoreID, TerritoryID, AccountNumber, rowguid, ModifiedDate)
                VALUES (?, ?, ?, ?, ?, ?)
            `).run(input.personId || null, input.storeId || null, input.territoryId || null, input.accountNumber, rowguid, now);
            
            return db.prepare('SELECT * FROM Sales_Customer WHERE CustomerID = ?').get(result.lastInsertRowid);
        },
        
        updateCustomer: (_, { id, input }) => {
            const db = getDb();
            const fields = [];
            const params = [];
            if (input.territoryId !== undefined) { fields.push('TerritoryID = ?'); params.push(input.territoryId); }
            if (input.storeId !== undefined) { fields.push('StoreID = ?'); params.push(input.storeId); }
            fields.push('ModifiedDate = ?'); params.push(new Date().toISOString());
            
            db.prepare(`UPDATE Sales_Customer SET ${fields.join(', ')} WHERE CustomerID = ?`).run([...params, id]);
            return db.prepare('SELECT * FROM Sales_Customer WHERE CustomerID = ?').get(id);
        },
        
        createSalesOrder: (_, { input }, { pubsub }) => {
            const db = getDb();
            validateCreateSalesOrder(input, db);
            const now = new Date().toISOString();
            const rowguid = require('crypto').randomUUID();
            
            // Calculate totals
            const subTotal = input.details.reduce((s, d) => s + (d.unitPrice * d.orderQty * (1 - (d.unitPriceDiscount || 0))), 0);
            const taxAmt = subTotal * 0.08; // 8% tax
            const freight = 5 + (subTotal * 0.01); // base + 1%
            const totalDue = subTotal + taxAmt + freight;
            
            const orderResult = db.prepare(`
                INSERT INTO Sales_SalesOrderHeader (
                    RevisionNumber, OrderDate, DueDate, Status, OnlineOrderFlag,
                    SalesOrderNumber, PurchaseOrderNumber, AccountNumber, CustomerID,
                    SalesPersonID, TerritoryID, BillToAddressID, ShipToAddressID, ShipMethodID,
                    CreditCardID, SubTotal, TaxAmt, Freight, TotalDue, Comment, rowguid, ModifiedDate
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                1, now,
                new Date(Date.now() + 7 * 86400000).toISOString(), // due in 7 days
                1, 0, // status=1 (in process), offline order
                'SO' + Date.now(), // temporary order number
                input.purchaseOrderNumber || null,
                null, // account number
                input.customerId,
                input.salesPersonId || null,
                input.territoryId || null,
                input.billToAddressId, input.shipToAddressId, input.shipMethodId,
                input.creditCardId || null,
                subTotal, taxAmt, freight, totalDue,
                input.comment || null,
                rowguid, now
            );
            
            const orderId = orderResult.lastInsertRowid;
            
            // Insert details
            for (let i = 0; i < input.details.length; i++) {
                const d = input.details[i];
                const lineTotal = d.unitPrice * d.orderQty * (1 - (d.unitPriceDiscount || 0));
                db.prepare(`
                    INSERT INTO Sales_SalesOrderDetail (
                        SalesOrderID, SalesOrderDetailID, OrderQty, ProductID, SpecialOfferID,
                        UnitPrice, UnitPriceDiscount, LineTotal, rowguid, ModifiedDate
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `).run(
                    orderId, i + 1, d.orderQty, d.productId, d.specialOfferId || 1,
                    d.unitPrice, d.unitPriceDiscount || 0, lineTotal,
                    require('crypto').randomUUID(), now
                );
            }
            
            const order = db.prepare('SELECT * FROM Sales_SalesOrderHeader WHERE SalesOrderID = ?').get(orderId);
            
            // Publish subscription event
            if (pubsub) {
                pubsub.publish('ORDER_CREATED', { orderCreated: { order } });
            }
            
            return order;
        },
        
        updateSalesOrder: (_, { id, input }) => {
            const db = getDb();
            const fields = [];
            const params = [];
            if (input.status !== undefined) { fields.push('Status = ?'); params.push(input.status); }
            if (input.comment !== undefined) { fields.push('Comment = ?'); params.push(input.comment); }
            if (input.shipDate !== undefined) { fields.push('ShipDate = ?'); params.push(input.shipDate); }
            fields.push('ModifiedDate = ?'); params.push(new Date().toISOString());
            
            db.prepare(`UPDATE Sales_SalesOrderHeader SET ${fields.join(', ')} WHERE SalesOrderID = ?`).run([...params, id]);
            return db.prepare('SELECT * FROM Sales_SalesOrderHeader WHERE SalesOrderID = ?').get(id);
        },
        
        cancelSalesOrder: (_, { id }) => {
            const db = getDb();
            db.prepare("UPDATE Sales_SalesOrderHeader SET Status = 6, ModifiedDate = ? WHERE SalesOrderID = ?")
                .run(new Date().toISOString(), id);
            return db.prepare('SELECT * FROM Sales_SalesOrderHeader WHERE SalesOrderID = ?').get(id);
        },
        
        createPerson: (_, { input }) => {
            validateCreatePerson(input);
            const db = getDb();
            const now = new Date().toISOString();
            
            // Create BusinessEntity first
            const beResult = db.prepare(
                'INSERT INTO Person_BusinessEntity (rowguid, ModifiedDate) VALUES (?, ?)'
            ).run(require('crypto').randomUUID(), now);
            const entityId = beResult.lastInsertRowid;
            
            // Create Person
            db.prepare(`
                INSERT INTO Person_Person (
                    BusinessEntityID, PersonType, NameStyle, Title, FirstName, MiddleName,
                    LastName, Suffix, EmailPromotion, rowguid, ModifiedDate
                ) VALUES (?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                entityId, input.personType, input.title || null,
                input.firstName, input.middleName || null, input.lastName,
                input.suffix || null, input.emailPromotion || 0,
                require('crypto').randomUUID(), now
            );
            
            // Create email if provided
            if (input.emailAddress) {
                db.prepare(
                    'INSERT INTO Person_EmailAddress (BusinessEntityID, EmailAddressID, EmailAddress, rowguid, ModifiedDate) VALUES (?, 1, ?, ?, ?)'
                ).run(entityId, input.emailAddress, require('crypto').randomUUID(), now);
            }
            
            // Create phone if provided
            if (input.phoneNumber && input.phoneNumberTypeId) {
                db.prepare(
                    'INSERT INTO Person_PersonPhone (BusinessEntityID, PhoneNumber, PhoneNumberTypeID, ModifiedDate) VALUES (?, ?, ?, ?)'
                ).run(entityId, input.phoneNumber, input.phoneNumberTypeId, now);
            }
            
            return db.prepare('SELECT * FROM Person_Person WHERE BusinessEntityID = ?').get(entityId);
        },
    },
    
    // ---- Subscription resolvers ----
    
    Subscription: {
        orderCreated: {
            subscribe: (_, __, { pubsub }) => pubsub.asyncIterator(['ORDER_CREATED']),
        },
        inventoryUpdated: {
            subscribe: (_, { productId }, { pubsub }) => {
                return pubsub.asyncIterator(['INVENTORY_UPDATED']);
            },
            resolve: (payload, { productId }) => {
                if (productId && payload.inventoryUpdated.product.ProductID !== productId) return null;
                return payload.inventoryUpdated;
            }
        }
    }
};

// Merge field resolvers into the main resolvers object
// Field resolvers handle PascalCase → camelCase column name mapping
for (const [typeName, fields] of Object.entries(fieldResolvers)) {
    if (!resolvers[typeName]) {
        resolvers[typeName] = {};
    }
    for (const [fieldName, resolver] of Object.entries(fields)) {
        // Only add if not already explicitly defined by a relationship resolver
        if (resolvers[typeName][fieldName] === undefined) {
            resolvers[typeName][fieldName] = resolver;
        }
    }
}

module.exports = { resolvers };
