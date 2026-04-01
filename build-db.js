#!/usr/bin/env node
/**
 * AdventureWorks SQLite Database Builder
 * Converts CSV files from Microsoft's SQL Server samples into SQLite
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const DB_PATH = path.join(__dirname, 'adventureworks.db');
const CSV_DIR = path.join(__dirname, 'csv');

// Remove existing DB
if (fs.existsSync(DB_PATH)) {
    fs.unlinkSync(DB_PATH);
    console.log('Removed existing database');
}

const db = new Database(DB_PATH);

// Enable WAL mode and foreign keys
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = OFF'); // OFF during loading, we'll verify after

console.log('Creating schema...');

// Create all tables
db.exec(`
-- ============================================================
-- Person Schema
-- ============================================================

CREATE TABLE Person_AddressType (
    AddressTypeID INTEGER PRIMARY KEY,
    Name TEXT NOT NULL,
    rowguid TEXT NOT NULL,
    ModifiedDate TEXT NOT NULL
);

CREATE TABLE Person_CountryRegion (
    CountryRegionCode TEXT PRIMARY KEY,
    Name TEXT NOT NULL,
    ModifiedDate TEXT NOT NULL
);

CREATE TABLE Person_StateProvince (
    StateProvinceID INTEGER PRIMARY KEY,
    StateProvinceCode TEXT NOT NULL,
    CountryRegionCode TEXT NOT NULL,
    IsOnlyStateProvinceFlag INTEGER NOT NULL DEFAULT 1,
    Name TEXT NOT NULL,
    TerritoryID INTEGER,
    rowguid TEXT NOT NULL,
    ModifiedDate TEXT NOT NULL
);

CREATE TABLE Person_Address (
    AddressID INTEGER PRIMARY KEY,
    AddressLine1 TEXT NOT NULL,
    AddressLine2 TEXT,
    City TEXT NOT NULL,
    StateProvinceID INTEGER NOT NULL,
    PostalCode TEXT NOT NULL,
    SpatialLocation TEXT,
    rowguid TEXT NOT NULL,
    ModifiedDate TEXT NOT NULL,
    FOREIGN KEY (StateProvinceID) REFERENCES Person_StateProvince(StateProvinceID)
);

CREATE TABLE Person_PhoneNumberType (
    PhoneNumberTypeID INTEGER PRIMARY KEY,
    Name TEXT NOT NULL,
    ModifiedDate TEXT NOT NULL
);

CREATE TABLE Person_ContactType (
    ContactTypeID INTEGER PRIMARY KEY,
    Name TEXT NOT NULL,
    ModifiedDate TEXT NOT NULL
);

CREATE TABLE Person_BusinessEntity (
    BusinessEntityID INTEGER PRIMARY KEY,
    rowguid TEXT NOT NULL,
    ModifiedDate TEXT NOT NULL
);

CREATE TABLE Person_Person (
    BusinessEntityID INTEGER PRIMARY KEY,
    PersonType TEXT NOT NULL,
    NameStyle INTEGER NOT NULL DEFAULT 0,
    Title TEXT,
    FirstName TEXT NOT NULL,
    MiddleName TEXT,
    LastName TEXT NOT NULL,
    Suffix TEXT,
    EmailPromotion INTEGER NOT NULL DEFAULT 0,
    AdditionalContactInfo TEXT,
    Demographics TEXT,
    rowguid TEXT NOT NULL,
    ModifiedDate TEXT NOT NULL,
    FOREIGN KEY (BusinessEntityID) REFERENCES Person_BusinessEntity(BusinessEntityID)
);

CREATE TABLE Person_BusinessEntityAddress (
    BusinessEntityID INTEGER NOT NULL,
    AddressID INTEGER NOT NULL,
    AddressTypeID INTEGER NOT NULL,
    rowguid TEXT NOT NULL,
    ModifiedDate TEXT NOT NULL,
    PRIMARY KEY (BusinessEntityID, AddressID, AddressTypeID),
    FOREIGN KEY (BusinessEntityID) REFERENCES Person_BusinessEntity(BusinessEntityID),
    FOREIGN KEY (AddressID) REFERENCES Person_Address(AddressID),
    FOREIGN KEY (AddressTypeID) REFERENCES Person_AddressType(AddressTypeID)
);

CREATE TABLE Person_BusinessEntityContact (
    BusinessEntityID INTEGER NOT NULL,
    PersonID INTEGER NOT NULL,
    ContactTypeID INTEGER NOT NULL,
    rowguid TEXT NOT NULL,
    ModifiedDate TEXT NOT NULL,
    PRIMARY KEY (BusinessEntityID, PersonID, ContactTypeID),
    FOREIGN KEY (ContactTypeID) REFERENCES Person_ContactType(ContactTypeID)
);

CREATE TABLE Person_EmailAddress (
    BusinessEntityID INTEGER NOT NULL,
    EmailAddressID INTEGER NOT NULL,
    EmailAddress TEXT,
    rowguid TEXT NOT NULL,
    ModifiedDate TEXT NOT NULL,
    PRIMARY KEY (BusinessEntityID, EmailAddressID)
);

CREATE TABLE Person_PersonPhone (
    BusinessEntityID INTEGER NOT NULL,
    PhoneNumber TEXT NOT NULL,
    PhoneNumberTypeID INTEGER NOT NULL,
    ModifiedDate TEXT NOT NULL,
    PRIMARY KEY (BusinessEntityID, PhoneNumber, PhoneNumberTypeID),
    FOREIGN KEY (PhoneNumberTypeID) REFERENCES Person_PhoneNumberType(PhoneNumberTypeID)
);

CREATE TABLE Person_Password (
    BusinessEntityID INTEGER PRIMARY KEY,
    PasswordHash TEXT NOT NULL,
    PasswordSalt TEXT NOT NULL,
    rowguid TEXT NOT NULL,
    ModifiedDate TEXT NOT NULL
);

-- ============================================================
-- HumanResources Schema
-- ============================================================

CREATE TABLE HumanResources_Department (
    DepartmentID INTEGER PRIMARY KEY,
    Name TEXT NOT NULL,
    GroupName TEXT NOT NULL,
    ModifiedDate TEXT NOT NULL
);

CREATE TABLE HumanResources_Shift (
    ShiftID INTEGER PRIMARY KEY,
    Name TEXT NOT NULL,
    StartTime TEXT NOT NULL,
    EndTime TEXT NOT NULL,
    ModifiedDate TEXT NOT NULL
);

CREATE TABLE HumanResources_Employee (
    BusinessEntityID INTEGER PRIMARY KEY,
    NationalIDNumber TEXT NOT NULL,
    LoginID TEXT NOT NULL,
    OrganizationNode TEXT,
    OrganizationLevel INTEGER,
    JobTitle TEXT NOT NULL,
    BirthDate TEXT NOT NULL,
    MaritalStatus TEXT NOT NULL,
    Gender TEXT NOT NULL,
    HireDate TEXT NOT NULL,
    SalariedFlag INTEGER NOT NULL DEFAULT 1,
    VacationHours INTEGER NOT NULL DEFAULT 0,
    SickLeaveHours INTEGER NOT NULL DEFAULT 0,
    CurrentFlag INTEGER NOT NULL DEFAULT 1,
    rowguid TEXT NOT NULL,
    ModifiedDate TEXT NOT NULL,
    FOREIGN KEY (BusinessEntityID) REFERENCES Person_BusinessEntity(BusinessEntityID)
);

CREATE TABLE HumanResources_EmployeeDepartmentHistory (
    BusinessEntityID INTEGER NOT NULL,
    DepartmentID INTEGER NOT NULL,
    ShiftID INTEGER NOT NULL,
    StartDate TEXT NOT NULL,
    EndDate TEXT,
    ModifiedDate TEXT NOT NULL,
    PRIMARY KEY (BusinessEntityID, DepartmentID, ShiftID, StartDate),
    FOREIGN KEY (BusinessEntityID) REFERENCES HumanResources_Employee(BusinessEntityID),
    FOREIGN KEY (DepartmentID) REFERENCES HumanResources_Department(DepartmentID),
    FOREIGN KEY (ShiftID) REFERENCES HumanResources_Shift(ShiftID)
);

CREATE TABLE HumanResources_EmployeePayHistory (
    BusinessEntityID INTEGER NOT NULL,
    RateChangeDate TEXT NOT NULL,
    Rate REAL NOT NULL,
    PayFrequency INTEGER NOT NULL,
    ModifiedDate TEXT NOT NULL,
    PRIMARY KEY (BusinessEntityID, RateChangeDate),
    FOREIGN KEY (BusinessEntityID) REFERENCES HumanResources_Employee(BusinessEntityID)
);

CREATE TABLE HumanResources_JobCandidate (
    JobCandidateID INTEGER PRIMARY KEY,
    BusinessEntityID INTEGER,
    Resume TEXT,
    ModifiedDate TEXT NOT NULL
);

-- ============================================================
-- Production Schema
-- ============================================================

CREATE TABLE Production_UnitMeasure (
    UnitMeasureCode TEXT PRIMARY KEY,
    Name TEXT NOT NULL,
    ModifiedDate TEXT NOT NULL
);

CREATE TABLE Production_ProductCategory (
    ProductCategoryID INTEGER PRIMARY KEY,
    Name TEXT NOT NULL,
    rowguid TEXT NOT NULL,
    ModifiedDate TEXT NOT NULL
);

CREATE TABLE Production_ProductSubcategory (
    ProductSubcategoryID INTEGER PRIMARY KEY,
    ProductCategoryID INTEGER NOT NULL,
    Name TEXT NOT NULL,
    rowguid TEXT NOT NULL,
    ModifiedDate TEXT NOT NULL,
    FOREIGN KEY (ProductCategoryID) REFERENCES Production_ProductCategory(ProductCategoryID)
);

CREATE TABLE Production_ProductModel (
    ProductModelID INTEGER PRIMARY KEY,
    Name TEXT NOT NULL,
    CatalogDescription TEXT,
    Instructions TEXT,
    rowguid TEXT NOT NULL,
    ModifiedDate TEXT NOT NULL
);

CREATE TABLE Production_Product (
    ProductID INTEGER PRIMARY KEY,
    Name TEXT NOT NULL,
    ProductNumber TEXT NOT NULL,
    MakeFlag INTEGER NOT NULL DEFAULT 1,
    FinishedGoodsFlag INTEGER NOT NULL DEFAULT 1,
    Color TEXT,
    SafetyStockLevel INTEGER NOT NULL,
    ReorderPoint INTEGER NOT NULL,
    StandardCost REAL NOT NULL,
    ListPrice REAL NOT NULL,
    Size TEXT,
    SizeUnitMeasureCode TEXT,
    WeightUnitMeasureCode TEXT,
    Weight REAL,
    DaysToManufacture INTEGER NOT NULL,
    ProductLine TEXT,
    Class TEXT,
    Style TEXT,
    ProductSubcategoryID INTEGER,
    ProductModelID INTEGER,
    SellStartDate TEXT NOT NULL,
    SellEndDate TEXT,
    DiscontinuedDate TEXT,
    rowguid TEXT NOT NULL,
    ModifiedDate TEXT NOT NULL,
    FOREIGN KEY (ProductSubcategoryID) REFERENCES Production_ProductSubcategory(ProductSubcategoryID),
    FOREIGN KEY (ProductModelID) REFERENCES Production_ProductModel(ProductModelID)
);

CREATE TABLE Production_ProductDescription (
    ProductDescriptionID INTEGER PRIMARY KEY,
    Description TEXT NOT NULL,
    rowguid TEXT NOT NULL,
    ModifiedDate TEXT NOT NULL
);

CREATE TABLE Production_Culture (
    CultureID TEXT PRIMARY KEY,
    Name TEXT NOT NULL,
    ModifiedDate TEXT NOT NULL
);

CREATE TABLE Production_ProductCostHistory (
    ProductID INTEGER NOT NULL,
    StartDate TEXT NOT NULL,
    EndDate TEXT,
    StandardCost REAL NOT NULL,
    ModifiedDate TEXT NOT NULL,
    PRIMARY KEY (ProductID, StartDate)
);

CREATE TABLE Production_ProductListPriceHistory (
    ProductID INTEGER NOT NULL,
    StartDate TEXT NOT NULL,
    EndDate TEXT,
    ListPrice REAL NOT NULL,
    ModifiedDate TEXT NOT NULL,
    PRIMARY KEY (ProductID, StartDate)
);

CREATE TABLE Production_ProductInventory (
    ProductID INTEGER NOT NULL,
    LocationID INTEGER NOT NULL,
    Shelf TEXT NOT NULL,
    Bin INTEGER NOT NULL,
    Quantity INTEGER NOT NULL DEFAULT 0,
    rowguid TEXT NOT NULL,
    ModifiedDate TEXT NOT NULL,
    PRIMARY KEY (ProductID, LocationID)
);

CREATE TABLE Production_Location (
    LocationID INTEGER PRIMARY KEY,
    Name TEXT NOT NULL,
    CostRate REAL NOT NULL DEFAULT 0,
    Availability REAL NOT NULL DEFAULT 0,
    ModifiedDate TEXT NOT NULL
);

CREATE TABLE Production_ScrapReason (
    ScrapReasonID INTEGER PRIMARY KEY,
    Name TEXT NOT NULL,
    ModifiedDate TEXT NOT NULL
);

CREATE TABLE Production_WorkOrder (
    WorkOrderID INTEGER PRIMARY KEY,
    ProductID INTEGER NOT NULL,
    OrderQty INTEGER NOT NULL,
    StockedQty INTEGER NOT NULL,
    ScrappedQty INTEGER NOT NULL DEFAULT 0,
    StartDate TEXT NOT NULL,
    EndDate TEXT,
    DueDate TEXT NOT NULL,
    ScrapReasonID INTEGER,
    ModifiedDate TEXT NOT NULL,
    FOREIGN KEY (ProductID) REFERENCES Production_Product(ProductID),
    FOREIGN KEY (ScrapReasonID) REFERENCES Production_ScrapReason(ScrapReasonID)
);

CREATE TABLE Production_ProductReview (
    ProductReviewID INTEGER PRIMARY KEY,
    ProductID INTEGER NOT NULL,
    ReviewerName TEXT NOT NULL,
    ReviewDate TEXT NOT NULL,
    EmailAddress TEXT NOT NULL,
    Rating INTEGER NOT NULL,
    Comments TEXT,
    ModifiedDate TEXT NOT NULL,
    FOREIGN KEY (ProductID) REFERENCES Production_Product(ProductID)
);

-- ============================================================
-- Purchasing Schema
-- ============================================================

CREATE TABLE Purchasing_Vendor (
    BusinessEntityID INTEGER PRIMARY KEY,
    AccountNumber TEXT NOT NULL,
    Name TEXT NOT NULL,
    CreditRating INTEGER NOT NULL,
    PreferredVendorStatus INTEGER NOT NULL DEFAULT 1,
    ActiveFlag INTEGER NOT NULL DEFAULT 1,
    PurchasingWebServiceURL TEXT,
    ModifiedDate TEXT NOT NULL
);

CREATE TABLE Purchasing_ShipMethod (
    ShipMethodID INTEGER PRIMARY KEY,
    Name TEXT NOT NULL,
    ShipBase REAL NOT NULL,
    ShipRate REAL NOT NULL,
    rowguid TEXT NOT NULL,
    ModifiedDate TEXT NOT NULL
);

CREATE TABLE Purchasing_ProductVendor (
    ProductID INTEGER NOT NULL,
    BusinessEntityID INTEGER NOT NULL,
    AverageLeadTime INTEGER NOT NULL,
    StandardPrice REAL NOT NULL,
    LastReceiptCost REAL,
    LastReceiptDate TEXT,
    MinOrderQty INTEGER NOT NULL,
    MaxOrderQty INTEGER NOT NULL,
    OnOrderQty INTEGER,
    UnitMeasureCode TEXT NOT NULL,
    ModifiedDate TEXT NOT NULL,
    PRIMARY KEY (ProductID, BusinessEntityID),
    FOREIGN KEY (ProductID) REFERENCES Production_Product(ProductID),
    FOREIGN KEY (BusinessEntityID) REFERENCES Purchasing_Vendor(BusinessEntityID)
);

CREATE TABLE Purchasing_PurchaseOrderHeader (
    PurchaseOrderID INTEGER PRIMARY KEY,
    RevisionNumber INTEGER NOT NULL DEFAULT 0,
    Status INTEGER NOT NULL DEFAULT 1,
    EmployeeID INTEGER NOT NULL,
    VendorID INTEGER NOT NULL,
    ShipMethodID INTEGER NOT NULL,
    OrderDate TEXT NOT NULL,
    ShipDate TEXT,
    SubTotal REAL NOT NULL DEFAULT 0,
    TaxAmt REAL NOT NULL DEFAULT 0,
    Freight REAL NOT NULL DEFAULT 0,
    TotalDue REAL NOT NULL,
    ModifiedDate TEXT NOT NULL,
    FOREIGN KEY (EmployeeID) REFERENCES HumanResources_Employee(BusinessEntityID),
    FOREIGN KEY (VendorID) REFERENCES Purchasing_Vendor(BusinessEntityID),
    FOREIGN KEY (ShipMethodID) REFERENCES Purchasing_ShipMethod(ShipMethodID)
);

CREATE TABLE Purchasing_PurchaseOrderDetail (
    PurchaseOrderID INTEGER NOT NULL,
    PurchaseOrderDetailID INTEGER NOT NULL,
    DueDate TEXT NOT NULL,
    OrderQty INTEGER NOT NULL,
    ProductID INTEGER NOT NULL,
    UnitPrice REAL NOT NULL,
    LineTotal REAL NOT NULL,
    ReceivedQty REAL NOT NULL DEFAULT 0,
    RejectedQty REAL NOT NULL DEFAULT 0,
    StockedQty REAL NOT NULL,
    ModifiedDate TEXT NOT NULL,
    PRIMARY KEY (PurchaseOrderID, PurchaseOrderDetailID),
    FOREIGN KEY (PurchaseOrderID) REFERENCES Purchasing_PurchaseOrderHeader(PurchaseOrderID),
    FOREIGN KEY (ProductID) REFERENCES Production_Product(ProductID)
);

-- ============================================================
-- Sales Schema
-- ============================================================

CREATE TABLE Sales_SalesTerritory (
    TerritoryID INTEGER PRIMARY KEY,
    Name TEXT NOT NULL,
    CountryRegionCode TEXT NOT NULL,
    TerritoryGroup TEXT NOT NULL,
    SalesYTD REAL NOT NULL DEFAULT 0,
    SalesLastYear REAL NOT NULL DEFAULT 0,
    CostYTD REAL NOT NULL DEFAULT 0,
    CostLastYear REAL NOT NULL DEFAULT 0,
    rowguid TEXT NOT NULL,
    ModifiedDate TEXT NOT NULL
);

CREATE TABLE Sales_SalesPerson (
    BusinessEntityID INTEGER PRIMARY KEY,
    TerritoryID INTEGER,
    SalesQuota REAL,
    Bonus REAL NOT NULL DEFAULT 0,
    CommissionPct REAL NOT NULL DEFAULT 0,
    SalesYTD REAL NOT NULL DEFAULT 0,
    SalesLastYear REAL NOT NULL DEFAULT 0,
    rowguid TEXT NOT NULL,
    ModifiedDate TEXT NOT NULL,
    FOREIGN KEY (TerritoryID) REFERENCES Sales_SalesTerritory(TerritoryID)
);

CREATE TABLE Sales_Store (
    BusinessEntityID INTEGER PRIMARY KEY,
    Name TEXT NOT NULL,
    SalesPersonID INTEGER,
    Demographics TEXT,
    rowguid TEXT NOT NULL,
    ModifiedDate TEXT NOT NULL,
    FOREIGN KEY (SalesPersonID) REFERENCES Sales_SalesPerson(BusinessEntityID)
);

CREATE TABLE Sales_Customer (
    CustomerID INTEGER PRIMARY KEY,
    PersonID INTEGER,
    StoreID INTEGER,
    TerritoryID INTEGER,
    AccountNumber TEXT NOT NULL,
    rowguid TEXT NOT NULL,
    ModifiedDate TEXT NOT NULL,
    FOREIGN KEY (PersonID) REFERENCES Person_Person(BusinessEntityID),
    FOREIGN KEY (StoreID) REFERENCES Sales_Store(BusinessEntityID),
    FOREIGN KEY (TerritoryID) REFERENCES Sales_SalesTerritory(TerritoryID)
);

CREATE TABLE Sales_Currency (
    CurrencyCode TEXT PRIMARY KEY,
    Name TEXT NOT NULL,
    ModifiedDate TEXT NOT NULL
);

CREATE TABLE Sales_CurrencyRate (
    CurrencyRateID INTEGER PRIMARY KEY,
    CurrencyRateDate TEXT NOT NULL,
    FromCurrencyCode TEXT NOT NULL,
    ToCurrencyCode TEXT NOT NULL,
    AverageRate REAL NOT NULL,
    EndOfDayRate REAL NOT NULL,
    ModifiedDate TEXT NOT NULL
);

CREATE TABLE Sales_CreditCard (
    CreditCardID INTEGER PRIMARY KEY,
    CardType TEXT NOT NULL,
    CardNumber TEXT NOT NULL,
    ExpMonth INTEGER NOT NULL,
    ExpYear INTEGER NOT NULL,
    ModifiedDate TEXT NOT NULL
);

CREATE TABLE Sales_PersonCreditCard (
    BusinessEntityID INTEGER NOT NULL,
    CreditCardID INTEGER NOT NULL,
    ModifiedDate TEXT NOT NULL,
    PRIMARY KEY (BusinessEntityID, CreditCardID)
);

CREATE TABLE Sales_SpecialOffer (
    SpecialOfferID INTEGER PRIMARY KEY,
    Description TEXT NOT NULL,
    DiscountPct REAL NOT NULL DEFAULT 0,
    Type TEXT NOT NULL,
    Category TEXT NOT NULL,
    StartDate TEXT NOT NULL,
    EndDate TEXT NOT NULL,
    MinQty INTEGER NOT NULL DEFAULT 0,
    MaxQty INTEGER,
    rowguid TEXT NOT NULL,
    ModifiedDate TEXT NOT NULL
);

CREATE TABLE Sales_SpecialOfferProduct (
    SpecialOfferID INTEGER NOT NULL,
    ProductID INTEGER NOT NULL,
    rowguid TEXT NOT NULL,
    ModifiedDate TEXT NOT NULL,
    PRIMARY KEY (SpecialOfferID, ProductID),
    FOREIGN KEY (SpecialOfferID) REFERENCES Sales_SpecialOffer(SpecialOfferID),
    FOREIGN KEY (ProductID) REFERENCES Production_Product(ProductID)
);

CREATE TABLE Sales_ShipMethod (
    ShipMethodID INTEGER PRIMARY KEY,
    Name TEXT NOT NULL,
    ShipBase REAL NOT NULL,
    ShipRate REAL NOT NULL,
    rowguid TEXT NOT NULL,
    ModifiedDate TEXT NOT NULL
);

CREATE TABLE Sales_SalesReason (
    SalesReasonID INTEGER PRIMARY KEY,
    Name TEXT NOT NULL,
    ReasonType TEXT NOT NULL,
    ModifiedDate TEXT NOT NULL
);

CREATE TABLE Sales_SalesTaxRate (
    SalesTaxRateID INTEGER PRIMARY KEY,
    StateProvinceID INTEGER NOT NULL,
    TaxType INTEGER NOT NULL,
    TaxRate REAL NOT NULL DEFAULT 0,
    Name TEXT NOT NULL,
    rowguid TEXT NOT NULL,
    ModifiedDate TEXT NOT NULL,
    FOREIGN KEY (StateProvinceID) REFERENCES Person_StateProvince(StateProvinceID)
);

CREATE TABLE Sales_SalesOrderHeader (
    SalesOrderID INTEGER PRIMARY KEY,
    RevisionNumber INTEGER NOT NULL DEFAULT 0,
    OrderDate TEXT NOT NULL,
    DueDate TEXT NOT NULL,
    ShipDate TEXT,
    Status INTEGER NOT NULL DEFAULT 1,
    OnlineOrderFlag INTEGER NOT NULL DEFAULT 1,
    SalesOrderNumber TEXT NOT NULL,
    PurchaseOrderNumber TEXT,
    AccountNumber TEXT,
    CustomerID INTEGER NOT NULL,
    SalesPersonID INTEGER,
    TerritoryID INTEGER,
    BillToAddressID INTEGER NOT NULL,
    ShipToAddressID INTEGER NOT NULL,
    ShipMethodID INTEGER NOT NULL,
    CreditCardID INTEGER,
    CreditCardApprovalCode TEXT,
    CurrencyRateID INTEGER,
    SubTotal REAL NOT NULL DEFAULT 0,
    TaxAmt REAL NOT NULL DEFAULT 0,
    Freight REAL NOT NULL DEFAULT 0,
    TotalDue REAL NOT NULL,
    Comment TEXT,
    rowguid TEXT NOT NULL,
    ModifiedDate TEXT NOT NULL,
    FOREIGN KEY (CustomerID) REFERENCES Sales_Customer(CustomerID),
    FOREIGN KEY (SalesPersonID) REFERENCES Sales_SalesPerson(BusinessEntityID),
    FOREIGN KEY (TerritoryID) REFERENCES Sales_SalesTerritory(TerritoryID),
    FOREIGN KEY (BillToAddressID) REFERENCES Person_Address(AddressID),
    FOREIGN KEY (ShipToAddressID) REFERENCES Person_Address(AddressID)
);

CREATE TABLE Sales_SalesOrderDetail (
    SalesOrderID INTEGER NOT NULL,
    SalesOrderDetailID INTEGER NOT NULL,
    CarrierTrackingNumber TEXT,
    OrderQty INTEGER NOT NULL,
    ProductID INTEGER NOT NULL,
    SpecialOfferID INTEGER NOT NULL DEFAULT 1,
    UnitPrice REAL NOT NULL,
    UnitPriceDiscount REAL NOT NULL DEFAULT 0,
    LineTotal REAL NOT NULL,
    rowguid TEXT NOT NULL,
    ModifiedDate TEXT NOT NULL,
    PRIMARY KEY (SalesOrderID, SalesOrderDetailID),
    FOREIGN KEY (SalesOrderID) REFERENCES Sales_SalesOrderHeader(SalesOrderID),
    FOREIGN KEY (ProductID) REFERENCES Production_Product(ProductID)
);

CREATE TABLE Sales_SalesOrderHeaderSalesReason (
    SalesOrderID INTEGER NOT NULL,
    SalesReasonID INTEGER NOT NULL,
    ModifiedDate TEXT NOT NULL,
    PRIMARY KEY (SalesOrderID, SalesReasonID),
    FOREIGN KEY (SalesOrderID) REFERENCES Sales_SalesOrderHeader(SalesOrderID),
    FOREIGN KEY (SalesReasonID) REFERENCES Sales_SalesReason(SalesReasonID)
);

CREATE TABLE Sales_SalesPersonQuotaHistory (
    BusinessEntityID INTEGER NOT NULL,
    QuotaDate TEXT NOT NULL,
    SalesQuota REAL NOT NULL,
    rowguid TEXT NOT NULL,
    ModifiedDate TEXT NOT NULL,
    PRIMARY KEY (BusinessEntityID, QuotaDate)
);

CREATE TABLE Sales_SalesTerritoryHistory (
    BusinessEntityID INTEGER NOT NULL,
    TerritoryID INTEGER NOT NULL,
    StartDate TEXT NOT NULL,
    EndDate TEXT,
    rowguid TEXT NOT NULL,
    ModifiedDate TEXT NOT NULL,
    PRIMARY KEY (BusinessEntityID, TerritoryID, StartDate)
);

CREATE TABLE Sales_CountryRegionCurrency (
    CountryRegionCode TEXT NOT NULL,
    CurrencyCode TEXT NOT NULL,
    ModifiedDate TEXT NOT NULL,
    PRIMARY KEY (CountryRegionCode, CurrencyCode)
);

-- ============================================================
-- Indexes for performance
-- ============================================================
CREATE INDEX idx_person_lastname ON Person_Person(LastName);
CREATE INDEX idx_person_firstname ON Person_Person(FirstName);
CREATE INDEX idx_product_name ON Production_Product(Name);
CREATE INDEX idx_product_number ON Production_Product(ProductNumber);
CREATE INDEX idx_salesorder_orderdate ON Sales_SalesOrderHeader(OrderDate);
CREATE INDEX idx_salesorder_customerid ON Sales_SalesOrderHeader(CustomerID);
CREATE INDEX idx_salesorderdetail_productid ON Sales_SalesOrderDetail(ProductID);
CREATE INDEX idx_employee_jobtitle ON HumanResources_Employee(JobTitle);
CREATE INDEX idx_address_city ON Person_Address(City);
CREATE INDEX idx_address_postalcode ON Person_Address(PostalCode);

CREATE TABLE Production_ProductModelProductDescriptionCulture (
    ProductModelID INTEGER NOT NULL,
    ProductDescriptionID INTEGER NOT NULL,
    CultureID TEXT NOT NULL,
    ModifiedDate TEXT NOT NULL,
    PRIMARY KEY (ProductModelID, ProductDescriptionID, CultureID),
    FOREIGN KEY (ProductModelID) REFERENCES Production_ProductModel(ProductModelID),
    FOREIGN KEY (ProductDescriptionID) REFERENCES Production_ProductDescription(ProductDescriptionID)
);

-- Full text search virtual tables
CREATE VIRTUAL TABLE fts_person USING fts5(
    BusinessEntityID UNINDEXED,
    FirstName,
    MiddleName,
    LastName,
    EmailAddress,
    content='',
    contentless_delete=1
);

CREATE VIRTUAL TABLE fts_product USING fts5(
    ProductID UNINDEXED,
    Name,
    ProductNumber,
    Description,
    content='',
    contentless_delete=1
);
`);

console.log('Schema created successfully');

// Helper to parse tab-delimited CSV
function parseTSV(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n').filter(line => line.trim());
        return lines.map(line => line.split('\t').map(v => {
            if (v === '' || v === 'NULL') return null;
            return v;
        }));
    } catch (e) {
        console.error(`  Error reading ${filePath}: ${e.message}`);
        return [];
    }
}

// Load data for each table
function loadTable(tableName, csvFile, columns, transform = null) {
    const filePath = path.join(CSV_DIR, `${csvFile}.csv`);
    if (!fs.existsSync(filePath)) {
        console.log(`  Skipping ${tableName} - CSV not found`);
        return 0;
    }
    
    const rows = parseTSV(filePath);
    if (rows.length === 0) return 0;
    
    const placeholders = columns.map(() => '?').join(', ');
    const colNames = columns.join(', ');
    const stmt = db.prepare(`INSERT OR IGNORE INTO ${tableName} (${colNames}) VALUES (${placeholders})`);
    
    let count = 0;
    const insertMany = db.transaction((data) => {
        for (const row of data) {
            try {
                const values = transform ? transform(row) : row.slice(0, columns.length);
                if (values) {
                    stmt.run(values);
                    count++;
                }
            } catch (e) {
                // Skip bad rows
            }
        }
    });
    
    insertMany(rows);
    console.log(`  Loaded ${count} rows into ${tableName}`);
    return count;
}

console.log('\nLoading data...');

// Person schema
loadTable('Person_AddressType', 'AddressType', ['AddressTypeID','Name','rowguid','ModifiedDate']);
loadTable('Person_CountryRegion', 'CountryRegion', ['CountryRegionCode','Name','ModifiedDate']);
loadTable('Person_StateProvince', 'StateProvince', ['StateProvinceID','StateProvinceCode','CountryRegionCode','IsOnlyStateProvinceFlag','Name','TerritoryID','rowguid','ModifiedDate']);
loadTable('Person_Address', 'Address', ['AddressID','AddressLine1','AddressLine2','City','StateProvinceID','PostalCode','SpatialLocation','rowguid','ModifiedDate']);
loadTable('Person_PhoneNumberType', 'PhoneNumberType_fixed', ['PhoneNumberTypeID','Name','ModifiedDate']);
loadTable('Person_ContactType', 'ContactType', ['ContactTypeID','Name','ModifiedDate']);
loadTable('Person_BusinessEntity', 'BusinessEntity_fixed', ['BusinessEntityID','rowguid','ModifiedDate']);
loadTable('Person_Person', 'Person_fixed', ['BusinessEntityID','PersonType','NameStyle','Title','FirstName','MiddleName','LastName','Suffix','EmailPromotion','AdditionalContactInfo','Demographics','rowguid','ModifiedDate']);
loadTable('Person_BusinessEntityAddress', 'BusinessEntityAddress_fixed', ['BusinessEntityID','AddressID','AddressTypeID','rowguid','ModifiedDate']);
loadTable('Person_BusinessEntityContact', 'BusinessEntityContact_fixed', ['BusinessEntityID','PersonID','ContactTypeID','rowguid','ModifiedDate']);
loadTable('Person_EmailAddress', 'EmailAddress_fixed', ['BusinessEntityID','EmailAddressID','EmailAddress','rowguid','ModifiedDate']);
loadTable('Person_PersonPhone', 'PersonPhone_fixed', ['BusinessEntityID','PhoneNumber','PhoneNumberTypeID','ModifiedDate']);

// HumanResources schema
loadTable('HumanResources_Department', 'Department', ['DepartmentID','Name','GroupName','ModifiedDate']);
loadTable('HumanResources_Shift', 'Shift', ['ShiftID','Name','StartTime','EndTime','ModifiedDate']);
loadTable('HumanResources_Employee', 'Employee', ['BusinessEntityID','NationalIDNumber','LoginID','OrganizationNode','OrganizationLevel','JobTitle','BirthDate','MaritalStatus','Gender','HireDate','SalariedFlag','VacationHours','SickLeaveHours','CurrentFlag','rowguid','ModifiedDate']);
loadTable('HumanResources_EmployeeDepartmentHistory', 'EmployeeDepartmentHistory', ['BusinessEntityID','DepartmentID','ShiftID','StartDate','EndDate','ModifiedDate']);
loadTable('HumanResources_EmployeePayHistory', 'EmployeePayHistory', ['BusinessEntityID','RateChangeDate','Rate','PayFrequency','ModifiedDate']);
loadTable('HumanResources_JobCandidate', 'JobCandidate', ['JobCandidateID','BusinessEntityID','Resume','ModifiedDate']);

// Production schema
loadTable('Production_UnitMeasure', 'UnitMeasure', ['UnitMeasureCode','Name','ModifiedDate']);
loadTable('Production_ProductCategory', 'ProductCategory', ['ProductCategoryID','Name','rowguid','ModifiedDate']);
loadTable('Production_ProductSubcategory', 'ProductSubcategory', ['ProductSubcategoryID','ProductCategoryID','Name','rowguid','ModifiedDate']);
loadTable('Production_ProductModel', 'ProductModel_fixed', ['ProductModelID','Name','CatalogDescription','Instructions','rowguid','ModifiedDate']);
loadTable('Production_Product', 'Product', ['ProductID','Name','ProductNumber','MakeFlag','FinishedGoodsFlag','Color','SafetyStockLevel','ReorderPoint','StandardCost','ListPrice','Size','SizeUnitMeasureCode','WeightUnitMeasureCode','Weight','DaysToManufacture','ProductLine','Class','Style','ProductSubcategoryID','ProductModelID','SellStartDate','SellEndDate','DiscontinuedDate','rowguid','ModifiedDate']);
loadTable('Production_ProductDescription', 'ProductDescription', ['ProductDescriptionID','Description','rowguid','ModifiedDate']);
loadTable('Production_Culture', 'Culture', ['CultureID','Name','ModifiedDate']);
loadTable('Production_ProductCostHistory', 'ProductCostHistory', ['ProductID','StartDate','EndDate','StandardCost','ModifiedDate']);
loadTable('Production_ProductListPriceHistory', 'ProductListPriceHistory', ['ProductID','StartDate','EndDate','ListPrice','ModifiedDate']);
loadTable('Production_Location', 'Location', ['LocationID','Name','CostRate','Availability','ModifiedDate']);
loadTable('Production_ProductInventory', 'ProductInventory', ['ProductID','LocationID','Shelf','Bin','Quantity','rowguid','ModifiedDate']);
loadTable('Production_ScrapReason', 'ScrapReason', ['ScrapReasonID','Name','ModifiedDate']);
loadTable('Production_WorkOrder', 'WorkOrder', ['WorkOrderID','ProductID','OrderQty','StockedQty','ScrappedQty','StartDate','EndDate','DueDate','ScrapReasonID','ModifiedDate']);
loadTable('Production_ProductModelProductDescriptionCulture', 'ProductModelProductDescriptionCulture', ['ProductModelID','ProductDescriptionID','CultureID','ModifiedDate'], (row) => [row[0], row[1], row[2]?.trim(), row[3]]);
loadTable('Production_ProductReview', 'ProductReview_fixed', ['ProductReviewID','ProductID','ReviewerName','ReviewDate','EmailAddress','Rating','Comments','ModifiedDate']);

// Purchasing schema
loadTable('Purchasing_ShipMethod', 'ShipMethod', ['ShipMethodID','Name','ShipBase','ShipRate','rowguid','ModifiedDate']);
loadTable('Purchasing_Vendor', 'Vendor', ['BusinessEntityID','AccountNumber','Name','CreditRating','PreferredVendorStatus','ActiveFlag','PurchasingWebServiceURL','ModifiedDate']);
loadTable('Purchasing_ProductVendor', 'ProductVendor', ['ProductID','BusinessEntityID','AverageLeadTime','StandardPrice','LastReceiptCost','LastReceiptDate','MinOrderQty','MaxOrderQty','OnOrderQty','UnitMeasureCode','ModifiedDate']);
loadTable('Purchasing_PurchaseOrderHeader', 'PurchaseOrderHeader', ['PurchaseOrderID','RevisionNumber','Status','EmployeeID','VendorID','ShipMethodID','OrderDate','ShipDate','SubTotal','TaxAmt','Freight','TotalDue','ModifiedDate']);
loadTable('Purchasing_PurchaseOrderDetail', 'PurchaseOrderDetail', ['PurchaseOrderID','PurchaseOrderDetailID','DueDate','OrderQty','ProductID','UnitPrice','LineTotal','ReceivedQty','RejectedQty','StockedQty','ModifiedDate']);

// Sales schema
loadTable('Sales_Currency', 'Currency', ['CurrencyCode','Name','ModifiedDate']);
loadTable('Sales_SalesTerritory', 'SalesTerritory', ['TerritoryID','Name','CountryRegionCode','TerritoryGroup','SalesYTD','SalesLastYear','CostYTD','CostLastYear','rowguid','ModifiedDate']);
loadTable('Sales_CurrencyRate', 'CurrencyRate', ['CurrencyRateID','CurrencyRateDate','FromCurrencyCode','ToCurrencyCode','AverageRate','EndOfDayRate','ModifiedDate']);
loadTable('Sales_CreditCard', 'CreditCard', ['CreditCardID','CardType','CardNumber','ExpMonth','ExpYear','ModifiedDate']);
loadTable('Sales_PersonCreditCard', 'PersonCreditCard', ['BusinessEntityID','CreditCardID','ModifiedDate']);
loadTable('Sales_SalesPerson', 'SalesPerson', ['BusinessEntityID','TerritoryID','SalesQuota','Bonus','CommissionPct','SalesYTD','SalesLastYear','rowguid','ModifiedDate']);
loadTable('Sales_Store', 'Store_fixed', ['BusinessEntityID','Name','SalesPersonID','Demographics','rowguid','ModifiedDate']);
loadTable('Sales_Customer', 'Customer', ['CustomerID','PersonID','StoreID','TerritoryID','AccountNumber','rowguid','ModifiedDate']);
loadTable('Sales_SpecialOffer', 'SpecialOffer', ['SpecialOfferID','Description','DiscountPct','Type','Category','StartDate','EndDate','MinQty','MaxQty','rowguid','ModifiedDate']);
loadTable('Sales_SpecialOfferProduct', 'SpecialOfferProduct', ['SpecialOfferID','ProductID','rowguid','ModifiedDate']);
loadTable('Sales_SalesReason', 'SalesReason', ['SalesReasonID','Name','ReasonType','ModifiedDate']);
loadTable('Sales_SalesTaxRate', 'SalesTaxRate', ['SalesTaxRateID','StateProvinceID','TaxType','TaxRate','Name','rowguid','ModifiedDate']);
loadTable('Sales_SalesOrderHeader', 'SalesOrderHeader', ['SalesOrderID','RevisionNumber','OrderDate','DueDate','ShipDate','Status','OnlineOrderFlag','SalesOrderNumber','PurchaseOrderNumber','AccountNumber','CustomerID','SalesPersonID','TerritoryID','BillToAddressID','ShipToAddressID','ShipMethodID','CreditCardID','CreditCardApprovalCode','CurrencyRateID','SubTotal','TaxAmt','Freight','TotalDue','Comment','rowguid','ModifiedDate']);
loadTable('Sales_SalesOrderDetail', 'SalesOrderDetail', ['SalesOrderID','SalesOrderDetailID','CarrierTrackingNumber','OrderQty','ProductID','SpecialOfferID','UnitPrice','UnitPriceDiscount','LineTotal','rowguid','ModifiedDate']);
loadTable('Sales_SalesOrderHeaderSalesReason', 'SalesOrderHeaderSalesReason', ['SalesOrderID','SalesReasonID','ModifiedDate']);
loadTable('Sales_SalesPersonQuotaHistory', 'SalesPersonQuotaHistory', ['BusinessEntityID','QuotaDate','SalesQuota','rowguid','ModifiedDate']);
loadTable('Sales_SalesTerritoryHistory', 'SalesTerritoryHistory', ['BusinessEntityID','TerritoryID','StartDate','EndDate','rowguid','ModifiedDate']);
loadTable('Sales_CountryRegionCurrency', 'CountryRegionCurrency', ['CountryRegionCode','CurrencyCode','ModifiedDate']);

// Build FTS indexes
console.log('\nBuilding full-text search indexes...');
db.exec(`
INSERT INTO fts_person(BusinessEntityID, FirstName, MiddleName, LastName, EmailAddress)
SELECT p.BusinessEntityID, p.FirstName, p.MiddleName, p.LastName, e.EmailAddress
FROM Person_Person p
LEFT JOIN Person_EmailAddress e ON p.BusinessEntityID = e.BusinessEntityID AND e.EmailAddressID = 1;
`);

db.exec(`
INSERT INTO fts_product(ProductID, Name, ProductNumber, Description)
SELECT p.ProductID, p.Name, p.ProductNumber, pd.Description
FROM Production_Product p
LEFT JOIN Production_ProductModel pm ON p.ProductModelID = pm.ProductModelID
LEFT JOIN Production_ProductModelProductDescriptionCulture pmdc ON pm.ProductModelID = pmdc.ProductModelID AND pmdc.CultureID = 'en'
LEFT JOIN Production_ProductDescription pd ON pmdc.ProductDescriptionID = pd.ProductDescriptionID;
`);

console.log('\n✅ Database build complete!');
console.log(`Database saved to: ${DB_PATH}`);

// Print stats
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'fts_%' AND name NOT LIKE 'sqlite_%'").all();
console.log(`\nTotal tables: ${tables.length}`);

for (const { name } of tables.slice(0, 10)) {
    try {
        const count = db.prepare(`SELECT COUNT(*) as c FROM "${name}"`).get();
        console.log(`  ${name}: ${count.c} rows`);
    } catch(e) {}
}

db.close();
