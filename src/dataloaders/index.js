/**
 * DataLoader Factory
 * 
 * Creates per-request DataLoader instances to batch and cache database lookups,
 * preventing the N+1 query problem in GraphQL resolvers.
 * 
 * Each DataLoader batches individual lookups into a single SQL query
 * using WHERE id IN (...) syntax.
 */

const DataLoader = require('dataloader');
const { getDb } = require('../db');

/**
 * Create a generic DataLoader for a single-column primary key lookup
 * @param {string} table - table name
 * @param {string} idColumn - primary key column name
 * @param {Function} [transform] - optional transform fn for each row
 */
function createByIdLoader(table, idColumn, transform = null) {
    return new DataLoader(async (ids) => {
        const db = getDb();
        const placeholders = ids.map(() => '?').join(',');
        const rows = db.prepare(
            `SELECT * FROM ${table} WHERE ${idColumn} IN (${placeholders})`
        ).all(ids);
        
        // Map results back to the original ID order
        const rowMap = new Map(rows.map(r => [r[idColumn], transform ? transform(r) : r]));
        return ids.map(id => rowMap.get(id) || null);
    }, {
        maxBatchSize: 500,
        cache: true
    });
}

/**
 * Create a DataLoader for one-to-many relationships
 * Returns arrays of rows per parent ID
 */
function createHasManyLoader(table, foreignKeyColumn, transform = null) {
    return new DataLoader(async (ids) => {
        const db = getDb();
        const placeholders = ids.map(() => '?').join(',');
        const rows = db.prepare(
            `SELECT * FROM ${table} WHERE ${foreignKeyColumn} IN (${placeholders})`
        ).all(ids);
        
        // Group by foreign key
        const groups = new Map(ids.map(id => [id, []]));
        for (const row of rows) {
            const key = row[foreignKeyColumn];
            if (groups.has(key)) {
                groups.get(key).push(transform ? transform(row) : row);
            }
        }
        return ids.map(id => groups.get(id) || []);
    }, {
        maxBatchSize: 200,
        cache: true
    });
}

/**
 * Create all DataLoaders for a single request context
 */
function createDataLoaders() {
    const db = getDb();
    
    return {
        // ---- Person schema ----
        personById: createByIdLoader('Person_Person', 'BusinessEntityID'),
        
        addressById: createByIdLoader('Person_Address', 'AddressID'),
        
        stateProvinceById: createByIdLoader('Person_StateProvince', 'StateProvinceID'),
        
        countryRegionByCode: new DataLoader(async (codes) => {
            const placeholders = codes.map(() => '?').join(',');
            const rows = db.prepare(
                `SELECT * FROM Person_CountryRegion WHERE CountryRegionCode IN (${placeholders})`
            ).all(codes);
            const map = new Map(rows.map(r => [r.CountryRegionCode, r]));
            return codes.map(c => map.get(c) || null);
        }),
        
        addressTypeById: createByIdLoader('Person_AddressType', 'AddressTypeID'),
        
        phoneNumberTypeById: createByIdLoader('Person_PhoneNumberType', 'PhoneNumberTypeID'),
        
        emailAddressesByPersonId: new DataLoader(async (ids) => {
            const placeholders = ids.map(() => '?').join(',');
            const rows = db.prepare(
                `SELECT * FROM Person_EmailAddress WHERE BusinessEntityID IN (${placeholders})`
            ).all(ids);
            const groups = new Map(ids.map(id => [id, []]));
            for (const row of rows) {
                if (groups.has(row.BusinessEntityID)) groups.get(row.BusinessEntityID).push(row);
            }
            return ids.map(id => groups.get(id) || []);
        }),
        
        phoneNumbersByPersonId: new DataLoader(async (ids) => {
            const placeholders = ids.map(() => '?').join(',');
            const rows = db.prepare(
                `SELECT pp.*, pnt.Name as PhoneTypeName 
                 FROM Person_PersonPhone pp
                 JOIN Person_PhoneNumberType pnt ON pp.PhoneNumberTypeID = pnt.PhoneNumberTypeID
                 WHERE pp.BusinessEntityID IN (${placeholders})`
            ).all(ids);
            const groups = new Map(ids.map(id => [id, []]));
            for (const row of rows) {
                if (groups.has(row.BusinessEntityID)) groups.get(row.BusinessEntityID).push(row);
            }
            return ids.map(id => groups.get(id) || []);
        }),
        
        addressesWithTypeByEntityId: new DataLoader(async (ids) => {
            const placeholders = ids.map(() => '?').join(',');
            const rows = db.prepare(
                `SELECT bea.BusinessEntityID, bea.AddressID, bea.AddressTypeID,
                        a.AddressLine1, a.AddressLine2, a.City, a.PostalCode,
                        a.StateProvinceID, a.ModifiedDate as AddrModifiedDate,
                        at.Name as AddressTypeName
                 FROM Person_BusinessEntityAddress bea
                 JOIN Person_Address a ON bea.AddressID = a.AddressID
                 JOIN Person_AddressType at ON bea.AddressTypeID = at.AddressTypeID
                 WHERE bea.BusinessEntityID IN (${placeholders})`
            ).all(ids);
            const groups = new Map(ids.map(id => [id, []]));
            for (const row of rows) {
                if (groups.has(row.BusinessEntityID)) groups.get(row.BusinessEntityID).push(row);
            }
            return ids.map(id => groups.get(id) || []);
        }),
        
        creditCardsByPersonId: new DataLoader(async (ids) => {
            const placeholders = ids.map(() => '?').join(',');
            const rows = db.prepare(
                `SELECT pcc.BusinessEntityID, cc.*
                 FROM Sales_PersonCreditCard pcc
                 JOIN Sales_CreditCard cc ON pcc.CreditCardID = cc.CreditCardID
                 WHERE pcc.BusinessEntityID IN (${placeholders})`
            ).all(ids);
            const groups = new Map(ids.map(id => [id, []]));
            for (const row of rows) {
                if (groups.has(row.BusinessEntityID)) groups.get(row.BusinessEntityID).push(row);
            }
            return ids.map(id => groups.get(id) || []);
        }),
        
        creditCardById: createByIdLoader('Sales_CreditCard', 'CreditCardID'),
        
        // ---- HumanResources schema ----
        employeeById: createByIdLoader('HumanResources_Employee', 'BusinessEntityID'),
        
        departmentById: createByIdLoader('HumanResources_Department', 'DepartmentID'),
        
        shiftById: createByIdLoader('HumanResources_Shift', 'ShiftID'),
        
        currentDepartmentByEmployeeId: new DataLoader(async (ids) => {
            const placeholders = ids.map(() => '?').join(',');
            const rows = db.prepare(
                `SELECT edh.BusinessEntityID, d.*
                 FROM HumanResources_EmployeeDepartmentHistory edh
                 JOIN HumanResources_Department d ON edh.DepartmentID = d.DepartmentID
                 WHERE edh.BusinessEntityID IN (${placeholders}) AND edh.EndDate IS NULL`
            ).all(ids);
            const map = new Map(rows.map(r => [r.BusinessEntityID, r]));
            return ids.map(id => map.get(id) || null);
        }),
        
        deptHistoryByEmployeeId: createHasManyLoader('HumanResources_EmployeeDepartmentHistory', 'BusinessEntityID'),
        
        payHistoryByEmployeeId: new DataLoader(async (ids) => {
            const placeholders = ids.map(() => '?').join(',');
            const rows = db.prepare(
                `SELECT * FROM HumanResources_EmployeePayHistory 
                 WHERE BusinessEntityID IN (${placeholders})
                 ORDER BY RateChangeDate DESC`
            ).all(ids);
            const groups = new Map(ids.map(id => [id, []]));
            for (const row of rows) {
                if (groups.has(row.BusinessEntityID)) groups.get(row.BusinessEntityID).push(row);
            }
            return ids.map(id => groups.get(id) || []);
        }),
        
        // ---- Production schema ----
        productById: createByIdLoader('Production_Product', 'ProductID'),
        
        productCategoryById: createByIdLoader('Production_ProductCategory', 'ProductCategoryID'),
        
        productSubcategoryById: createByIdLoader('Production_ProductSubcategory', 'ProductSubcategoryID'),
        
        productModelById: createByIdLoader('Production_ProductModel', 'ProductModelID'),
        
        locationById: createByIdLoader('Production_Location', 'LocationID'),
        
        unitMeasureByCode: new DataLoader(async (codes) => {
            const placeholders = codes.map(() => '?').join(',');
            const rows = db.prepare(
                `SELECT * FROM Production_UnitMeasure WHERE UnitMeasureCode IN (${placeholders})`
            ).all(codes);
            const map = new Map(rows.map(r => [r.UnitMeasureCode, r]));
            return codes.map(c => map.get(c) || null);
        }),
        
        inventoryByProductId: createHasManyLoader('Production_ProductInventory', 'ProductID'),
        
        reviewsByProductId: createHasManyLoader('Production_ProductReview', 'ProductID'),
        
        priceHistoryByProductId: new DataLoader(async (ids) => {
            const placeholders = ids.map(() => '?').join(',');
            const rows = db.prepare(
                `SELECT * FROM Production_ProductListPriceHistory 
                 WHERE ProductID IN (${placeholders}) ORDER BY StartDate DESC`
            ).all(ids);
            const groups = new Map(ids.map(id => [id, []]));
            for (const row of rows) {
                if (groups.has(row.ProductID)) groups.get(row.ProductID).push(row);
            }
            return ids.map(id => groups.get(id) || []);
        }),
        
        costHistoryByProductId: new DataLoader(async (ids) => {
            const placeholders = ids.map(() => '?').join(',');
            const rows = db.prepare(
                `SELECT * FROM Production_ProductCostHistory
                 WHERE ProductID IN (${placeholders}) ORDER BY StartDate DESC`
            ).all(ids);
            const groups = new Map(ids.map(id => [id, []]));
            for (const row of rows) {
                if (groups.has(row.ProductID)) groups.get(row.ProductID).push(row);
            }
            return ids.map(id => groups.get(id) || []);
        }),
        
        productsBySubcategoryId: createHasManyLoader('Production_Product', 'ProductSubcategoryID'),
        
        subcategoriesByCategoryId: createHasManyLoader('Production_ProductSubcategory', 'ProductCategoryID'),
        
        scrapReasonById: createByIdLoader('Production_ScrapReason', 'ScrapReasonID'),
        
        productModelDescriptionsByModelId: new DataLoader(async (ids) => {
            const placeholders = ids.map(() => '?').join(',');
            const rows = db.prepare(
                `SELECT pmdc.ProductModelID, pmdc.CultureID, pd.Description
                 FROM Production_ProductModelProductDescriptionCulture pmdc
                 JOIN Production_ProductDescription pd ON pmdc.ProductDescriptionID = pd.ProductDescriptionID
                 WHERE pmdc.ProductModelID IN (${placeholders})`
            ).all(ids);
            const groups = new Map(ids.map(id => [id, []]));
            for (const row of rows) {
                if (groups.has(row.ProductModelID)) groups.get(row.ProductModelID).push(row);
            }
            return ids.map(id => groups.get(id) || []);
        }),
        
        productsByModelId: createHasManyLoader('Production_Product', 'ProductModelID'),
        
        // ---- Purchasing schema ----
        vendorById: createByIdLoader('Purchasing_Vendor', 'BusinessEntityID'),
        
        shipMethodById: createByIdLoader('Purchasing_ShipMethod', 'ShipMethodID'),
        
        purchaseOrderById: createByIdLoader('Purchasing_PurchaseOrderHeader', 'PurchaseOrderID'),
        
        purchaseOrderDetailsByOrderId: createHasManyLoader('Purchasing_PurchaseOrderDetail', 'PurchaseOrderID'),
        
        productVendorsByProductId: new DataLoader(async (ids) => {
            const placeholders = ids.map(() => '?').join(',');
            const rows = db.prepare(
                `SELECT pv.*, v.Name as VendorName 
                 FROM Purchasing_ProductVendor pv
                 JOIN Purchasing_Vendor v ON pv.BusinessEntityID = v.BusinessEntityID
                 WHERE pv.ProductID IN (${placeholders})`
            ).all(ids);
            const groups = new Map(ids.map(id => [id, []]));
            for (const row of rows) {
                if (groups.has(row.ProductID)) groups.get(row.ProductID).push(row);
            }
            return ids.map(id => groups.get(id) || []);
        }),
        
        vendorContactsByVendorId: new DataLoader(async (ids) => {
            const placeholders = ids.map(() => '?').join(',');
            const rows = db.prepare(
                `SELECT bec.BusinessEntityID as VendorID, p.*
                 FROM Person_BusinessEntityContact bec
                 JOIN Person_Person p ON bec.PersonID = p.BusinessEntityID
                 WHERE bec.BusinessEntityID IN (${placeholders})`
            ).all(ids);
            const groups = new Map(ids.map(id => [id, []]));
            for (const row of rows) {
                const vid = row.VendorID;
                if (groups.has(vid)) groups.get(vid).push(row);
            }
            return ids.map(id => groups.get(id) || []);
        }),
        
        // ---- Sales schema ----
        customerById: createByIdLoader('Sales_Customer', 'CustomerID'),
        
        salesOrderById: createByIdLoader('Sales_SalesOrderHeader', 'SalesOrderID'),
        
        salesOrderDetailsByOrderId: createHasManyLoader('Sales_SalesOrderDetail', 'SalesOrderID'),
        
        salesReasonsByOrderId: new DataLoader(async (ids) => {
            const placeholders = ids.map(() => '?').join(',');
            const rows = db.prepare(
                `SELECT sohr.SalesOrderID, sr.*
                 FROM Sales_SalesOrderHeaderSalesReason sohr
                 JOIN Sales_SalesReason sr ON sohr.SalesReasonID = sr.SalesReasonID
                 WHERE sohr.SalesOrderID IN (${placeholders})`
            ).all(ids);
            const groups = new Map(ids.map(id => [id, []]));
            for (const row of rows) {
                if (groups.has(row.SalesOrderID)) groups.get(row.SalesOrderID).push(row);
            }
            return ids.map(id => groups.get(id) || []);
        }),
        
        salesTerritoryById: createByIdLoader('Sales_SalesTerritory', 'TerritoryID'),
        
        salesPersonById: createByIdLoader('Sales_SalesPerson', 'BusinessEntityID'),
        
        storeById: createByIdLoader('Sales_Store', 'BusinessEntityID'),
        
        specialOfferById: createByIdLoader('Sales_SpecialOffer', 'SpecialOfferID'),
        
        specialOfferProductsByOfferId: createHasManyLoader('Sales_SpecialOfferProduct', 'SpecialOfferID'),
        
        currencyRateById: createByIdLoader('Sales_CurrencyRate', 'CurrencyRateID'),
        
        customersBySalesPersonId: new DataLoader(async (ids) => {
            const placeholders = ids.map(() => '?').join(',');
            // Sales persons are linked to customers through stores
            const rows = db.prepare(
                `SELECT s.SalesPersonID, c.*
                 FROM Sales_Store s
                 JOIN Sales_Customer c ON c.StoreID = s.BusinessEntityID
                 WHERE s.SalesPersonID IN (${placeholders})`
            ).all(ids);
            const groups = new Map(ids.map(id => [id, []]));
            for (const row of rows) {
                if (groups.has(row.SalesPersonID)) groups.get(row.SalesPersonID).push(row);
            }
            return ids.map(id => groups.get(id) || []);
        }),
        
        storesBySalesPersonId: createHasManyLoader('Sales_Store', 'SalesPersonID'),
        
        customersByStoreId: createHasManyLoader('Sales_Customer', 'StoreID'),
        
        quotaHistoryBySalesPersonId: createHasManyLoader('Sales_SalesPersonQuotaHistory', 'BusinessEntityID'),
        
        salesPersonsByTerritoryId: createHasManyLoader('Sales_SalesPerson', 'TerritoryID'),
        
        currencyByCode: new DataLoader(async (codes) => {
            const placeholders = codes.map(() => '?').join(',');
            const rows = db.prepare(
                `SELECT * FROM Sales_Currency WHERE CurrencyCode IN (${placeholders})`
            ).all(codes);
            const map = new Map(rows.map(r => [r.CurrencyCode, r]));
            return codes.map(c => map.get(c) || null);
        }),
    };
}

module.exports = { createDataLoaders };
