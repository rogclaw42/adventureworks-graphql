/**
 * Field Resolvers
 * 
 * Maps GraphQL camelCase field names to SQLite PascalCase column names.
 * Each type's field resolver handles the property name translation
 * from raw database rows to GraphQL schema fields.
 */

const f = (col) => (parent) => parent[col] ?? null;
const bool = (col) => (parent) => !!(parent[col]);
const num = (col) => (parent) => parent[col] !== null && parent[col] !== undefined ? Number(parent[col]) : null;

const fieldResolvers = {
    // ---- Address ----
    Address: {
        addressId: f('AddressID'),
        addressLine1: f('AddressLine1'),
        addressLine2: f('AddressLine2'),
        city: f('City'),
        postalCode: f('PostalCode'),
        modifiedDate: f('ModifiedDate'),
    },

    // ---- AddressType ----
    AddressType: {
        addressTypeId: f('AddressTypeID'),
        name: f('Name'),
    },

    // ---- StateProvince ----
    StateProvince: {
        stateProvinceId: f('StateProvinceID'),
        stateProvinceCode: f('StateProvinceCode'),
        name: f('Name'),
        isOnlyStateProvinceFlag: bool('IsOnlyStateProvinceFlag'),
    },

    // ---- CountryRegion ----
    CountryRegion: {
        countryRegionCode: f('CountryRegionCode'),
        name: f('Name'),
    },

    // ---- Person ----
    Person: {
        businessEntityId: f('BusinessEntityID'),
        personType: f('PersonType'),
        title: f('Title'),
        firstName: f('FirstName'),
        middleName: f('MiddleName'),
        lastName: f('LastName'),
        suffix: f('Suffix'),
        emailPromotion: num('EmailPromotion'),
        modifiedDate: f('ModifiedDate'),
    },

    // ---- EmailAddress ----
    EmailAddress: {
        emailAddressId: num('EmailAddressID'),
        emailAddress: f('EmailAddress'),
        businessEntityId: num('BusinessEntityID'),
    },

    // ---- PhoneNumberType ----
    PhoneNumberType: {
        phoneNumberTypeId: num('PhoneNumberTypeID'),
        name: (p) => p.Name || p.PhoneTypeName,
    },

    // ---- PhoneNumber ----
    PhoneNumber: {
        phoneNumber: f('PhoneNumber'),
    },

    // ---- AddressWithType ----
    AddressWithType: {
        // resolved via the parent row's AddressID and AddressTypeID
    },

    // ---- Employee ----
    Employee: {
        businessEntityId: f('BusinessEntityID'),
        nationalIdNumber: f('NationalIDNumber'),
        loginId: f('LoginID'),
        organizationLevel: f('OrganizationLevel'),
        jobTitle: f('JobTitle'),
        birthDate: f('BirthDate'),
        maritalStatus: f('MaritalStatus'),
        gender: f('Gender'),
        hireDate: f('HireDate'),
        salariedFlag: bool('SalariedFlag'),
        vacationHours: num('VacationHours'),
        sickLeaveHours: num('SickLeaveHours'),
        currentFlag: bool('CurrentFlag'),
        modifiedDate: f('ModifiedDate'),
    },

    // ---- Department ----
    Department: {
        departmentId: num('DepartmentID'),
        name: f('Name'),
        groupName: f('GroupName'),
        modifiedDate: f('ModifiedDate'),
    },

    // ---- Shift ----
    Shift: {
        shiftId: num('ShiftID'),
        name: f('Name'),
        startTime: f('StartTime'),
        endTime: f('EndTime'),
    },

    // ---- EmployeeDepartmentHistory ----
    EmployeeDepartmentHistory: {
        startDate: f('StartDate'),
        endDate: f('EndDate'),
        modifiedDate: f('ModifiedDate'),
    },

    // ---- EmployeePayHistory ----
    EmployeePayHistory: {
        rateChangeDate: f('RateChangeDate'),
        rate: num('Rate'),
        payFrequency: num('PayFrequency'),
        modifiedDate: f('ModifiedDate'),
    },

    // ---- ProductCategory ----
    ProductCategory: {
        productCategoryId: num('ProductCategoryID'),
        name: f('Name'),
        modifiedDate: f('ModifiedDate'),
    },

    // ---- ProductSubcategory ----
    ProductSubcategory: {
        productSubcategoryId: num('ProductSubcategoryID'),
        name: f('Name'),
        modifiedDate: f('ModifiedDate'),
    },

    // ---- ProductModel ----
    ProductModel: {
        productModelId: num('ProductModelID'),
        name: f('Name'),
        catalogDescription: f('CatalogDescription'),
        modifiedDate: f('ModifiedDate'),
    },

    // ---- ProductModelDescription ----
    ProductModelDescription: {
        description: f('Description'),
        cultureId: (p) => p.CultureID?.trim() || p.cultureId,
    },

    // ---- Product ----
    Product: {
        productId: num('ProductID'),
        name: f('Name'),
        productNumber: f('ProductNumber'),
        makeFlag: bool('MakeFlag'),
        finishedGoodsFlag: bool('FinishedGoodsFlag'),
        color: f('Color'),
        safetyStockLevel: num('SafetyStockLevel'),
        reorderPoint: num('ReorderPoint'),
        standardCost: num('StandardCost'),
        listPrice: num('ListPrice'),
        size: f('Size'),
        weight: num('Weight'),
        daysToManufacture: num('DaysToManufacture'),
        productLine: f('ProductLine'),
        class: f('Class'),
        style: f('Style'),
        sellStartDate: f('SellStartDate'),
        sellEndDate: f('SellEndDate'),
        discontinuedDate: f('DiscontinuedDate'),
        modifiedDate: f('ModifiedDate'),
    },

    // ---- ProductInventory ----
    ProductInventory: {
        shelf: f('Shelf'),
        bin: num('Bin'),
        quantity: num('Quantity'),
    },

    // ---- Location ----
    Location: {
        locationId: num('LocationID'),
        name: f('Name'),
        costRate: num('CostRate'),
        availability: num('Availability'),
    },

    // ---- UnitMeasure ----
    UnitMeasure: {
        unitMeasureCode: f('UnitMeasureCode'),
        name: f('Name'),
    },

    // ---- ProductListPriceHistory ----
    ProductListPriceHistory: {
        productId: num('ProductID'),
        startDate: f('StartDate'),
        endDate: f('EndDate'),
        listPrice: num('ListPrice'),
    },

    // ---- ProductCostHistory ----
    ProductCostHistory: {
        productId: num('ProductID'),
        startDate: f('StartDate'),
        endDate: f('EndDate'),
        standardCost: num('StandardCost'),
    },

    // ---- ProductReview ----
    ProductReview: {
        productReviewId: num('ProductReviewID'),
        reviewerName: f('ReviewerName'),
        reviewDate: f('ReviewDate'),
        emailAddress: f('EmailAddress'),
        rating: num('Rating'),
        comments: f('Comments'),
        modifiedDate: f('ModifiedDate'),
    },

    // ---- ScrapReason ----
    ScrapReason: {
        scrapReasonId: num('ScrapReasonID'),
        name: f('Name'),
    },

    // ---- WorkOrder ----
    WorkOrder: {
        workOrderId: num('WorkOrderID'),
        orderQty: num('OrderQty'),
        stockedQty: num('StockedQty'),
        scrappedQty: num('ScrappedQty'),
        startDate: f('StartDate'),
        endDate: f('EndDate'),
        dueDate: f('DueDate'),
        modifiedDate: f('ModifiedDate'),
    },

    // ---- Vendor ----
    Vendor: {
        businessEntityId: num('BusinessEntityID'),
        accountNumber: f('AccountNumber'),
        name: f('Name'),
        creditRating: num('CreditRating'),
        preferredVendorStatus: bool('PreferredVendorStatus'),
        activeFlag: bool('ActiveFlag'),
        purchasingWebServiceUrl: f('PurchasingWebServiceURL'),
        modifiedDate: f('ModifiedDate'),
    },

    // ---- ProductVendor ----
    ProductVendor: {
        averageLeadTime: num('AverageLeadTime'),
        standardPrice: num('StandardPrice'),
        lastReceiptCost: num('LastReceiptCost'),
        lastReceiptDate: f('LastReceiptDate'),
        minOrderQty: num('MinOrderQty'),
        maxOrderQty: num('MaxOrderQty'),
        onOrderQty: num('OnOrderQty'),
    },

    // ---- ShipMethod ----
    ShipMethod: {
        shipMethodId: num('ShipMethodID'),
        name: f('Name'),
        shipBase: num('ShipBase'),
        shipRate: num('ShipRate'),
    },

    // ---- PurchaseOrderHeader ----
    PurchaseOrderHeader: {
        purchaseOrderId: num('PurchaseOrderID'),
        revisionNumber: num('RevisionNumber'),
        status: num('Status'),
        orderDate: f('OrderDate'),
        shipDate: f('ShipDate'),
        subTotal: num('SubTotal'),
        taxAmt: num('TaxAmt'),
        freight: num('Freight'),
        totalDue: num('TotalDue'),
        modifiedDate: f('ModifiedDate'),
    },

    // ---- PurchaseOrderDetail ----
    PurchaseOrderDetail: {
        purchaseOrderDetailId: num('PurchaseOrderDetailID'),
        dueDate: f('DueDate'),
        orderQty: num('OrderQty'),
        unitPrice: num('UnitPrice'),
        lineTotal: num('LineTotal'),
        receivedQty: num('ReceivedQty'),
        rejectedQty: num('RejectedQty'),
        stockedQty: num('StockedQty'),
        modifiedDate: f('ModifiedDate'),
    },

    // ---- SalesTerritory ----
    SalesTerritory: {
        territoryId: num('TerritoryID'),
        name: f('Name'),
        countryRegionCode: f('CountryRegionCode'),
        salesYtd: num('SalesYTD'),
        salesLastYear: num('SalesLastYear'),
        costYtd: num('CostYTD'),
        costLastYear: num('CostLastYear'),
        modifiedDate: f('ModifiedDate'),
    },

    // ---- SalesPerson ----
    SalesPerson: {
        businessEntityId: num('BusinessEntityID'),
        salesQuota: num('SalesQuota'),
        bonus: num('Bonus'),
        commissionPct: num('CommissionPct'),
        salesYtd: num('SalesYTD'),
        salesLastYear: num('SalesLastYear'),
        modifiedDate: f('ModifiedDate'),
    },

    // ---- SalesPersonQuotaHistory ----
    SalesPersonQuotaHistory: {
        quotaDate: f('QuotaDate'),
        salesQuota: num('SalesQuota'),
    },

    // ---- Store ----
    Store: {
        businessEntityId: num('BusinessEntityID'),
        name: f('Name'),
        modifiedDate: f('ModifiedDate'),
    },

    // ---- Customer ----
    Customer: {
        customerId: num('CustomerID'),
        accountNumber: f('AccountNumber'),
        modifiedDate: f('ModifiedDate'),
    },

    // ---- CreditCard ----
    CreditCard: {
        creditCardId: num('CreditCardID'),
        cardType: f('CardType'),
        cardNumber: f('CardNumber'),
        expMonth: num('ExpMonth'),
        expYear: num('ExpYear'),
        modifiedDate: f('ModifiedDate'),
    },

    // ---- Currency ----
    Currency: {
        currencyCode: f('CurrencyCode'),
        name: f('Name'),
    },

    // ---- CurrencyRate ----
    CurrencyRate: {
        currencyRateId: num('CurrencyRateID'),
        currencyRateDate: f('CurrencyRateDate'),
        fromCurrencyCode: f('FromCurrencyCode'),
        toCurrencyCode: f('ToCurrencyCode'),
        averageRate: num('AverageRate'),
        endOfDayRate: num('EndOfDayRate'),
        modifiedDate: f('ModifiedDate'),
    },

    // ---- SpecialOffer ----
    SpecialOffer: {
        specialOfferId: num('SpecialOfferID'),
        description: f('Description'),
        discountPct: num('DiscountPct'),
        type: f('Type'),
        category: f('Category'),
        startDate: f('StartDate'),
        endDate: f('EndDate'),
        minQty: num('MinQty'),
        maxQty: num('MaxQty'),
        modifiedDate: f('ModifiedDate'),
    },

    // ---- SalesTaxRate ----
    SalesTaxRate: {
        salesTaxRateId: num('SalesTaxRateID'),
        taxType: num('TaxType'),
        taxRate: num('TaxRate'),
        name: f('Name'),
    },

    // ---- SalesReason ----
    SalesReason: {
        salesReasonId: num('SalesReasonID'),
        name: f('Name'),
        reasonType: f('ReasonType'),
    },

    // ---- SalesOrderHeader ----
    SalesOrderHeader: {
        salesOrderId: num('SalesOrderID'),
        revisionNumber: num('RevisionNumber'),
        orderDate: f('OrderDate'),
        dueDate: f('DueDate'),
        shipDate: f('ShipDate'),
        status: num('Status'),
        onlineOrderFlag: bool('OnlineOrderFlag'),
        salesOrderNumber: f('SalesOrderNumber'),
        purchaseOrderNumber: f('PurchaseOrderNumber'),
        accountNumber: f('AccountNumber'),
        subTotal: num('SubTotal'),
        taxAmt: num('TaxAmt'),
        freight: num('Freight'),
        totalDue: num('TotalDue'),
        comment: f('Comment'),
        modifiedDate: f('ModifiedDate'),
    },

    // ---- SalesOrderDetail ----
    SalesOrderDetail: {
        salesOrderDetailId: num('SalesOrderDetailID'),
        salesOrderId: num('SalesOrderID'),
        carrierTrackingNumber: f('CarrierTrackingNumber'),
        orderQty: num('OrderQty'),
        unitPrice: num('UnitPrice'),
        unitPriceDiscount: num('UnitPriceDiscount'),
        lineTotal: num('LineTotal'),
        modifiedDate: f('ModifiedDate'),
    },

};


module.exports = { fieldResolvers };
