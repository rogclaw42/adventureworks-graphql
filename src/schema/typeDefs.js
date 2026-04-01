/**
 * AdventureWorks GraphQL Schema
 * 
 * Covers all major entities across 5 schemas:
 * - Person (addresses, contacts, business entities)
 * - HumanResources (employees, departments)
 * - Production (products, categories, inventory)
 * - Purchasing (vendors, purchase orders)
 * - Sales (customers, orders, territories)
 */

const { gql } = require('graphql-tag');

const typeDefs = gql`
  # ============================================================
  # Scalar types
  # ============================================================

  """ISO 8601 date-time string"""
  scalar DateTime

  """Arbitrary JSON object"""
  scalar JSON

  # ============================================================
  # Common types for pagination
  # ============================================================

  """Page info for Relay-style cursor pagination"""
  type PageInfo {
    """Whether there are more results after the current page"""
    hasNextPage: Boolean!
    """Whether there are results before the current page"""
    hasPreviousPage: Boolean!
    """Cursor for the first result in this page"""
    startCursor: String
    """Cursor for the last result in this page"""
    endCursor: String
  }

  """Aggregation results"""
  type AggregateResult {
    """Number of matching records"""
    count: Int!
    """Sum of a numeric field"""
    sum: Float
    """Average of a numeric field"""
    avg: Float
    """Minimum value"""
    min: Float
    """Maximum value"""
    max: Float
  }

  # ============================================================
  # Filter input types
  # ============================================================

  """Filter by string field"""
  input StringFilter {
    eq: String
    ne: String
    contains: String
    startsWith: String
    endsWith: String
    in: [String!]
    notIn: [String!]
    isNull: Boolean
  }

  """Filter by integer field"""
  input IntFilter {
    eq: Int
    ne: Int
    gt: Int
    gte: Int
    lt: Int
    lte: Int
    in: [Int!]
    notIn: [Int!]
    between: IntRange
    isNull: Boolean
  }

  """Filter by float field"""
  input FloatFilter {
    eq: Float
    ne: Float
    gt: Float
    gte: Float
    lt: Float
    lte: Float
    between: FloatRange
    isNull: Boolean
  }

  """Integer range for between filters"""
  input IntRange {
    min: Int!
    max: Int!
  }

  """Float range for between filters"""
  input FloatRange {
    min: Float!
    max: Float!
  }

  """Sort direction"""
  enum SortDirection {
    ASC
    DESC
  }

  # ============================================================
  # Person Schema Types
  # ============================================================

  """Physical address"""
  type Address {
    addressId: Int!
    addressLine1: String!
    addressLine2: String
    city: String!
    postalCode: String!
    stateProvince: StateProvince
    modifiedDate: DateTime
  }

  """US State or international province"""
  type StateProvince {
    stateProvinceId: Int!
    stateProvinceCode: String!
    name: String!
    isOnlyStateProvinceFlag: Boolean!
    countryRegion: CountryRegion
    territory: SalesTerritory
    addresses(limit: Int, offset: Int): [Address!]!
    salesTaxRates: [SalesTaxRate!]!
  }

  """Country or region"""
  type CountryRegion {
    countryRegionCode: String!
    name: String!
    stateProvinces: [StateProvince!]!
    currencies: [Currency!]!
  }

  """Individual person (employee, customer, contact, etc.)"""
  type Person {
    businessEntityId: Int!
    personType: String!
    "SC=Store contact, IN=Individual customer, SP=Sales person, EM=Employee, VC=Vendor contact, GC=General contact"
    title: String
    firstName: String!
    middleName: String
    lastName: String!
    suffix: String
    emailPromotion: Int!
    emailAddresses: [EmailAddress!]!
    phoneNumbers: [PhoneNumber!]!
    addresses: [AddressWithType!]!
    employee: Employee
    customer: Customer
    creditCards: [CreditCard!]!
    modifiedDate: DateTime
  }

  """Email address for a person"""
  type EmailAddress {
    emailAddressId: Int!
    emailAddress: String
    businessEntityId: Int!
  }

  """Phone number with type"""
  type PhoneNumber {
    phoneNumber: String!
    phoneNumberType: PhoneNumberType!
  }

  """Phone number type (cell, home, work)"""
  type PhoneNumberType {
    phoneNumberTypeId: Int!
    name: String!
  }

  """Address associated with an entity, including its type"""
  type AddressWithType {
    address: Address!
    addressType: AddressType!
  }

  """Type of address (billing, shipping, home, etc.)"""
  type AddressType {
    addressTypeId: Int!
    name: String!
  }

  # ============================================================
  # HumanResources Schema Types
  # ============================================================

  """Employee record"""
  type Employee {
    businessEntityId: Int!
    nationalIdNumber: String!
    loginId: String!
    organizationLevel: Int
    jobTitle: String!
    birthDate: DateTime
    maritalStatus: String!
    gender: String!
    hireDate: DateTime
    salariedFlag: Boolean!
    vacationHours: Int!
    sickLeaveHours: Int!
    currentFlag: Boolean!
    person: Person
    department: Department
    departmentHistory: [EmployeeDepartmentHistory!]!
    payHistory: [EmployeePayHistory!]!
    purchaseOrders(limit: Int, offset: Int): [PurchaseOrderHeader!]!
    modifiedDate: DateTime
  }

  """Company department"""
  type Department {
    departmentId: Int!
    name: String!
    groupName: String!
    employees: [Employee!]!
    modifiedDate: DateTime
  }

  """Record of employee in a department over time"""
  type EmployeeDepartmentHistory {
    department: Department!
    shift: Shift!
    startDate: DateTime!
    endDate: DateTime
    modifiedDate: DateTime
  }

  """Employee pay rate history"""
  type EmployeePayHistory {
    rateChangeDate: DateTime!
    rate: Float!
    payFrequency: Int!
    modifiedDate: DateTime
  }

  """Work shift"""
  type Shift {
    shiftId: Int!
    name: String!
    startTime: String!
    endTime: String!
  }

  # ============================================================
  # Production Schema Types
  # ============================================================

  """Product category (top-level, e.g. Bikes, Clothing)"""
  type ProductCategory {
    productCategoryId: Int!
    name: String!
    subcategories: [ProductSubcategory!]!
    products(limit: Int, offset: Int): [Product!]!
    modifiedDate: DateTime
  }

  """Product subcategory (e.g. Mountain Bikes, Road Bikes)"""
  type ProductSubcategory {
    productSubcategoryId: Int!
    name: String!
    category: ProductCategory!
    products(limit: Int, offset: Int): [Product!]!
    modifiedDate: DateTime
  }

  """Product model (groups product variants)"""
  type ProductModel {
    productModelId: Int!
    name: String!
    catalogDescription: String
    products: [Product!]!
    descriptions: [ProductModelDescription!]!
    modifiedDate: DateTime
  }

  """Localized product description"""
  type ProductModelDescription {
    description: String!
    cultureId: String!
  }

  """An AdventureWorks product"""
  type Product {
    productId: Int!
    name: String!
    productNumber: String!
    makeFlag: Boolean!
    finishedGoodsFlag: Boolean!
    color: String
    safetyStockLevel: Int!
    reorderPoint: Int!
    standardCost: Float!
    listPrice: Float!
    size: String
    sizeUnitMeasure: UnitMeasure
    weightUnitMeasure: UnitMeasure
    weight: Float
    daysToManufacture: Int!
    productLine: String
    "R=Road, M=Mountain, T=Touring, S=Standard"
    class: String
    style: String
    subcategory: ProductSubcategory
    model: ProductModel
    sellStartDate: DateTime!
    sellEndDate: DateTime
    discontinuedDate: DateTime
    inventory: [ProductInventory!]!
    reviews: [ProductReview!]!
    vendors: [ProductVendor!]!
    priceHistory: [ProductListPriceHistory!]!
    costHistory: [ProductCostHistory!]!
    workOrders(limit: Int, offset: Int): [WorkOrder!]!
    salesOrderDetails(limit: Int, offset: Int): [SalesOrderDetail!]!
    modifiedDate: DateTime
  }

  """Product inventory at a warehouse location"""
  type ProductInventory {
    location: Location!
    shelf: String!
    bin: Int!
    quantity: Int!
  }

  """Warehouse location"""
  type Location {
    locationId: Int!
    name: String!
    costRate: Float!
    availability: Float!
  }

  """Unit of measure"""
  type UnitMeasure {
    unitMeasureCode: String!
    name: String!
  }

  """Product price history"""
  type ProductListPriceHistory {
    productId: Int!
    startDate: DateTime!
    endDate: DateTime
    listPrice: Float!
  }

  """Product cost history"""
  type ProductCostHistory {
    productId: Int!
    startDate: DateTime!
    endDate: DateTime
    standardCost: Float!
  }

  """Customer product review"""
  type ProductReview {
    productReviewId: Int!
    product: Product!
    reviewerName: String!
    reviewDate: DateTime!
    emailAddress: String!
    rating: Int!
    comments: String
    modifiedDate: DateTime
  }

  """Reason for scrapping material"""
  type ScrapReason {
    scrapReasonId: Int!
    name: String!
  }

  """Manufacturing work order"""
  type WorkOrder {
    workOrderId: Int!
    product: Product!
    orderQty: Int!
    stockedQty: Int!
    scrappedQty: Int!
    startDate: DateTime!
    endDate: DateTime
    dueDate: DateTime!
    scrapReason: ScrapReason
    modifiedDate: DateTime
  }

  # ============================================================
  # Purchasing Schema Types
  # ============================================================

  """Supplier/vendor"""
  type Vendor {
    businessEntityId: Int!
    accountNumber: String!
    name: String!
    creditRating: Int!
    preferredVendorStatus: Boolean!
    activeFlag: Boolean!
    purchasingWebServiceUrl: String
    contacts: [Person!]!
    products: [ProductVendor!]!
    purchaseOrders(limit: Int, offset: Int): [PurchaseOrderHeader!]!
    modifiedDate: DateTime
  }

  """Product-Vendor relationship with supply terms"""
  type ProductVendor {
    product: Product!
    vendor: Vendor!
    averageLeadTime: Int!
    standardPrice: Float!
    lastReceiptCost: Float
    lastReceiptDate: DateTime
    minOrderQty: Int!
    maxOrderQty: Int!
    onOrderQty: Int
    unitMeasure: UnitMeasure!
  }

  """Purchase order"""
  type PurchaseOrderHeader {
    purchaseOrderId: Int!
    revisionNumber: Int!
    status: Int!
    statusLabel: String!
    employee: Employee
    vendor: Vendor!
    shipMethod: ShipMethod!
    orderDate: DateTime!
    shipDate: DateTime
    subTotal: Float!
    taxAmt: Float!
    freight: Float!
    totalDue: Float!
    details: [PurchaseOrderDetail!]!
    modifiedDate: DateTime
  }

  """Purchase order line item"""
  type PurchaseOrderDetail {
    purchaseOrderDetailId: Int!
    dueDate: DateTime!
    orderQty: Int!
    product: Product!
    unitPrice: Float!
    lineTotal: Float!
    receivedQty: Float!
    rejectedQty: Float!
    stockedQty: Float!
    modifiedDate: DateTime
  }

  """Shipping method"""
  type ShipMethod {
    shipMethodId: Int!
    name: String!
    shipBase: Float!
    shipRate: Float!
  }

  # ============================================================
  # Sales Schema Types
  # ============================================================

  """Sales territory"""
  type SalesTerritory {
    territoryId: Int!
    name: String!
    countryRegionCode: String!
    group: String!
    salesYtd: Float!
    salesLastYear: Float!
    costYtd: Float!
    costLastYear: Float!
    salesPersons: [SalesPerson!]!
    customers(limit: Int, offset: Int): [Customer!]!
    orders(limit: Int, offset: Int): [SalesOrderHeader!]!
    modifiedDate: DateTime
  }

  """Sales person"""
  type SalesPerson {
    businessEntityId: Int!
    person: Person
    territory: SalesTerritory
    salesQuota: Float
    bonus: Float!
    commissionPct: Float!
    salesYtd: Float!
    salesLastYear: Float!
    quotaHistory: [SalesPersonQuotaHistory!]!
    orders(limit: Int, offset: Int): [SalesOrderHeader!]!
    modifiedDate: DateTime
  }

  """Sales person quota record"""
  type SalesPersonQuotaHistory {
    quotaDate: DateTime!
    salesQuota: Float!
  }

  """Retail store (a type of customer)"""
  type Store {
    businessEntityId: Int!
    name: String!
    salesPerson: SalesPerson
    customers: [Customer!]!
    modifiedDate: DateTime
  }

  """Customer (person or store)"""
  type Customer {
    customerId: Int!
    accountNumber: String!
    person: Person
    store: Store
    territory: SalesTerritory
    orders(limit: Int, offset: Int): [SalesOrderHeader!]!
    totalOrderValue: Float
    modifiedDate: DateTime
  }

  """Credit card"""
  type CreditCard {
    creditCardId: Int!
    cardType: String!
    cardNumber: String!
    expMonth: Int!
    expYear: Int!
    modifiedDate: DateTime
  }

  """Currency"""
  type Currency {
    currencyCode: String!
    name: String!
  }

  """Currency exchange rate"""
  type CurrencyRate {
    currencyRateId: Int!
    currencyRateDate: DateTime!
    fromCurrencyCode: String!
    toCurrencyCode: String!
    averageRate: Float!
    endOfDayRate: Float!
    modifiedDate: DateTime
  }

  """Special discount offer"""
  type SpecialOffer {
    specialOfferId: Int!
    description: String!
    discountPct: Float!
    type: String!
    category: String!
    startDate: DateTime!
    endDate: DateTime!
    minQty: Int!
    maxQty: Int
    products: [Product!]!
    modifiedDate: DateTime
  }

  """Sales tax rate"""
  type SalesTaxRate {
    salesTaxRateId: Int!
    stateProvince: StateProvince!
    taxType: Int!
    taxRate: Float!
    name: String!
  }

  """Reason for a sale"""
  type SalesReason {
    salesReasonId: Int!
    name: String!
    reasonType: String!
  }

  """Sales order (header)"""
  type SalesOrderHeader {
    salesOrderId: Int!
    revisionNumber: Int!
    orderDate: DateTime!
    dueDate: DateTime!
    shipDate: DateTime
    status: Int!
    statusLabel: String!
    onlineOrderFlag: Boolean!
    salesOrderNumber: String!
    purchaseOrderNumber: String
    accountNumber: String
    customer: Customer!
    salesPerson: SalesPerson
    territory: SalesTerritory
    billToAddress: Address
    shipToAddress: Address
    shipMethod: ShipMethod
    creditCard: CreditCard
    currencyRate: CurrencyRate
    subTotal: Float!
    taxAmt: Float!
    freight: Float!
    totalDue: Float!
    comment: String
    details: [SalesOrderDetail!]!
    salesReasons: [SalesReason!]!
    modifiedDate: DateTime
  }

  """Sales order line item"""
  type SalesOrderDetail {
    salesOrderDetailId: Int!
    salesOrderId: Int!
    carrierTrackingNumber: String
    orderQty: Int!
    product: Product!
    specialOffer: SpecialOffer
    unitPrice: Float!
    unitPriceDiscount: Float!
    lineTotal: Float!
    order: SalesOrderHeader!
    modifiedDate: DateTime
  }

  # ============================================================
  # Connection types (Relay-style pagination)
  # ============================================================

  type PersonEdge {
    cursor: String!
    node: Person!
  }

  type PersonConnection {
    edges: [PersonEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type ProductEdge {
    cursor: String!
    node: Product!
  }

  type ProductConnection {
    edges: [ProductEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type SalesOrderEdge {
    cursor: String!
    node: SalesOrderHeader!
  }

  type SalesOrderConnection {
    edges: [SalesOrderEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type CustomerEdge {
    cursor: String!
    node: Customer!
  }

  type CustomerConnection {
    edges: [CustomerEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type EmployeeEdge {
    cursor: String!
    node: Employee!
  }

  type EmployeeConnection {
    edges: [EmployeeEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type VendorEdge {
    cursor: String!
    node: Vendor!
  }

  type VendorConnection {
    edges: [VendorEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  # ============================================================
  # Filter input types for major entities
  # ============================================================

  input PersonFilter {
    personType: StringFilter
    firstName: StringFilter
    lastName: StringFilter
    emailPromotion: IntFilter
  }

  input ProductFilter {
    name: StringFilter
    productNumber: StringFilter
    color: StringFilter
    listPrice: FloatFilter
    standardCost: FloatFilter
    productLine: StringFilter
    class: StringFilter
    style: StringFilter
    makeFlag: Boolean
    finishedGoodsFlag: Boolean
    productSubcategoryId: IntFilter
    productCategoryId: Int
    productModelId: IntFilter
    sellStartDate: StringFilter
  }

  input SalesOrderFilter {
    orderDate: StringFilter
    status: IntFilter
    onlineOrderFlag: Boolean
    customerId: IntFilter
    salesPersonId: IntFilter
    territoryId: IntFilter
    totalDue: FloatFilter
    subTotal: FloatFilter
  }

  input CustomerFilter {
    accountNumber: StringFilter
    territoryId: IntFilter
    storeId: IntFilter
  }

  input EmployeeFilter {
    jobTitle: StringFilter
    department: StringFilter
    gender: StringFilter
    maritalStatus: StringFilter
    salariedFlag: Boolean
    currentFlag: Boolean
  }

  input VendorFilter {
    name: StringFilter
    creditRating: IntFilter
    preferredVendorStatus: Boolean
    activeFlag: Boolean
  }

  input OrderByInput {
    field: String!
    direction: SortDirection
  }

  # ============================================================
  # Aggregation types
  # ============================================================

  type SalesByCategory {
    category: ProductCategory!
    totalRevenue: Float!
    orderCount: Int!
    productCount: Int!
    avgOrderValue: Float!
  }

  type SalesByTerritory {
    territory: SalesTerritory!
    totalRevenue: Float!
    orderCount: Int!
    customerCount: Int!
  }

  type SalesByMonth {
    year: Int!
    month: Int!
    totalRevenue: Float!
    orderCount: Int!
  }

  type TopProduct {
    product: Product!
    totalRevenue: Float!
    totalQuantity: Int!
    orderCount: Int!
  }

  type TopCustomer {
    customer: Customer!
    totalSpent: Float!
    orderCount: Int!
    lastOrderDate: DateTime
  }

  type SalesPersonPerformance {
    salesPerson: SalesPerson!
    totalSales: Float!
    orderCount: Int!
    avgOrderValue: Float!
    ytdQuota: Float
  }

  type InventoryStatus {
    product: Product!
    totalQuantity: Int!
    locationCount: Int!
    belowSafetyStock: Boolean!
  }

  # ============================================================
  # Mutation input types
  # ============================================================

  input CreateProductInput {
    name: String!
    productNumber: String!
    makeFlag: Boolean
    finishedGoodsFlag: Boolean
    color: String
    safetyStockLevel: Int!
    reorderPoint: Int!
    standardCost: Float!
    listPrice: Float!
    size: String
    weight: Float
    daysToManufacture: Int!
    productLine: String
    class: String
    style: String
    productSubcategoryId: Int
    productModelId: Int
    sellStartDate: String!
    sellEndDate: String
  }

  input UpdateProductInput {
    name: String
    color: String
    safetyStockLevel: Int
    reorderPoint: Int
    standardCost: Float
    listPrice: Float
    size: String
    weight: Float
    productLine: String
    class: String
    style: String
    productSubcategoryId: Int
    sellEndDate: String
    discontinuedDate: String
  }

  input CreateCustomerInput {
    personId: Int
    storeId: Int
    territoryId: Int
    accountNumber: String!
  }

  input UpdateCustomerInput {
    territoryId: Int
    storeId: Int
  }

  input CreateSalesOrderInput {
    customerId: Int!
    salesPersonId: Int
    territoryId: Int
    billToAddressId: Int!
    shipToAddressId: Int!
    shipMethodId: Int!
    creditCardId: Int
    purchaseOrderNumber: String
    comment: String
    details: [SalesOrderDetailInput!]!
  }

  input SalesOrderDetailInput {
    productId: Int!
    orderQty: Int!
    specialOfferId: Int
    unitPrice: Float!
    unitPriceDiscount: Float
  }

  input UpdateSalesOrderInput {
    status: Int
    comment: String
    shipDate: String
  }

  input CreatePersonInput {
    personType: String!
    firstName: String!
    middleName: String
    lastName: String!
    title: String
    suffix: String
    emailPromotion: Int
    emailAddress: String
    phoneNumber: String
    phoneNumberTypeId: Int
  }

  # ============================================================
  # Search types
  # ============================================================

  type SearchResult {
    persons: [Person!]!
    products: [Product!]!
    totalPersons: Int!
    totalProducts: Int!
  }

  # ============================================================
  # Server health
  # ============================================================

  type HealthCheck {
    status: String!
    databaseConnected: Boolean!
    tableCount: Int!
    totalRecords: Int!
    uptime: String!
    version: String!
  }

  type CacheStats {
    hits: Int!
    misses: Int!
    sets: Int!
    evictions: Int!
    size: Int!
    hitRate: String!
  }

  type QueryAnalyticsSummary {
    totalQueries: Int!
    last1hCount: Int!
    last24hCount: Int!
    avgDurationMs: Int!
    errorCount: Int!
    topOperations: [OperationCount!]!
    slowestQueries: [SlowQuery!]!
    uptime: String!
  }

  type OperationCount {
    name: String!
    count: Int!
  }

  type SlowQuery {
    operationName: String
    duration: Int
    timestamp: String
  }

  # ============================================================
  # Subscription types (live queries)
  # ============================================================

  type OrderCreatedPayload {
    order: SalesOrderHeader!
  }

  type InventoryUpdatedPayload {
    product: Product!
    location: Location!
    newQuantity: Int!
  }

  # ============================================================
  # Root types
  # ============================================================

  type Query {
    # ----- Health -----
    
    """Server health check"""
    health: HealthCheck!
    
    """Cache statistics"""
    cacheStats: CacheStats!
    
    """Query analytics"""
    queryAnalytics: QueryAnalyticsSummary!

    # ----- Person queries -----

    """Get a person by ID"""
    person(id: Int!): Person

    """List persons with filtering, sorting and pagination"""
    persons(
      filter: PersonFilter
      orderBy: [OrderByInput!]
      first: Int
      after: String
      last: Int
      before: String
    ): PersonConnection!

    """Search persons by name or email"""
    searchPersons(query: String!, limit: Int): [Person!]!

    """Get an address by ID"""
    address(id: Int!): Address

    """List addresses"""
    addresses(
      city: String
      postalCode: String
      stateProvinceId: Int
      limit: Int
      offset: Int
    ): [Address!]!

    # ----- Employee queries -----

    """Get an employee by ID"""
    employee(id: Int!): Employee

    """List employees with filtering and pagination"""
    employees(
      filter: EmployeeFilter
      orderBy: [OrderByInput!]
      first: Int
      after: String
    ): EmployeeConnection!

    """Get a department by ID"""
    department(id: Int!): Department

    """List all departments"""
    departments: [Department!]!

    # ----- Product queries -----

    """Get a product by ID"""
    product(id: Int!): Product

    """Get a product by product number"""
    productByNumber(productNumber: String!): Product

    """List products with filtering, sorting and cursor pagination"""
    products(
      filter: ProductFilter
      orderBy: [OrderByInput!]
      first: Int
      after: String
      last: Int
      before: String
    ): ProductConnection!

    """Full-text search across products"""
    searchProducts(query: String!, limit: Int): [Product!]!

    """Get a product category by ID"""
    productCategory(id: Int!): ProductCategory

    """List all product categories"""
    productCategories: [ProductCategory!]!

    """Get a product subcategory by ID"""
    productSubcategory(id: Int!): ProductSubcategory

    """List product subcategories"""
    productSubcategories(categoryId: Int): [ProductSubcategory!]!

    """Get a product model by ID"""
    productModel(id: Int!): ProductModel

    """List product models"""
    productModels(limit: Int, offset: Int): [ProductModel!]!

    """Get inventory status for all products"""
    inventoryStatus(
      belowSafetyStock: Boolean
      locationId: Int
      limit: Int
      offset: Int
    ): [InventoryStatus!]!

    # ----- Vendor / Purchasing queries -----

    """Get a vendor by ID"""
    vendor(id: Int!): Vendor

    """List vendors"""
    vendors(
      filter: VendorFilter
      orderBy: [OrderByInput!]
      first: Int
      after: String
    ): VendorConnection!

    """Get a purchase order by ID"""
    purchaseOrder(id: Int!): PurchaseOrderHeader

    """List purchase orders"""
    purchaseOrders(
      vendorId: Int
      employeeId: Int
      status: Int
      orderDateFrom: String
      orderDateTo: String
      limit: Int
      offset: Int
    ): [PurchaseOrderHeader!]!

    # ----- Sales queries -----

    """Get a customer by ID"""
    customer(id: Int!): Customer

    """List customers with pagination"""
    customers(
      filter: CustomerFilter
      orderBy: [OrderByInput!]
      first: Int
      after: String
    ): CustomerConnection!

    """Get a sales order by ID"""
    salesOrder(id: Int!): SalesOrderHeader

    """Get a sales order by order number"""
    salesOrderByNumber(orderNumber: String!): SalesOrderHeader

    """List sales orders with filtering and pagination"""
    salesOrders(
      filter: SalesOrderFilter
      orderBy: [OrderByInput!]
      first: Int
      after: String
    ): SalesOrderConnection!

    """Get a sales territory by ID"""
    salesTerritory(id: Int!): SalesTerritory

    """List sales territories"""
    salesTerritories: [SalesTerritory!]!

    """Get a sales person by ID"""
    salesPerson(id: Int!): SalesPerson

    """List all sales persons"""
    salesPersons: [SalesPerson!]!

    """Get a store by ID"""
    store(id: Int!): Store

    """List stores"""
    stores(
      salesPersonId: Int
      limit: Int
      offset: Int
    ): [Store!]!

    """Get special offers"""
    specialOffers(activeOnly: Boolean): [SpecialOffer!]!

    """Get currencies"""
    currencies: [Currency!]!

    """Get currency rates"""
    currencyRates(
      fromCode: String
      toCode: String
      dateFrom: String
      dateTo: String
      limit: Int
    ): [CurrencyRate!]!

    # ----- Analytics / Aggregations -----

    """Sales aggregated by product category"""
    salesByCategory(
      dateFrom: String
      dateTo: String
      limit: Int
    ): [SalesByCategory!]!

    """Sales aggregated by territory"""
    salesByTerritory(
      dateFrom: String
      dateTo: String
    ): [SalesByTerritory!]!

    """Monthly sales trend"""
    salesByMonth(
      year: Int
      limit: Int
    ): [SalesByMonth!]!

    """Top selling products"""
    topProducts(
      dateFrom: String
      dateTo: String
      categoryId: Int
      limit: Int
    ): [TopProduct!]!

    """Top customers by spend"""
    topCustomers(
      dateFrom: String
      dateTo: String
      limit: Int
    ): [TopCustomer!]!

    """Sales person performance report"""
    salesPersonPerformance(
      territoryId: Int
    ): [SalesPersonPerformance!]!

    """Aggregate query on sales orders"""
    salesOrderAggregate(
      filter: SalesOrderFilter
      field: String!
    ): AggregateResult!

    """Aggregate query on products"""
    productAggregate(
      filter: ProductFilter
      field: String!
    ): AggregateResult!

    """Full-text search across persons and products"""
    search(query: String!, limit: Int): SearchResult!
  }

  type Mutation {
    # ----- Product mutations -----

    """Create a new product"""
    createProduct(input: CreateProductInput!): Product!

    """Update an existing product"""
    updateProduct(id: Int!, input: UpdateProductInput!): Product!

    """Delete a product (sets discontinuedDate)"""
    deleteProduct(id: Int!): Boolean!

    # ----- Customer mutations -----

    """Create a new customer record"""
    createCustomer(input: CreateCustomerInput!): Customer!

    """Update a customer"""
    updateCustomer(id: Int!, input: UpdateCustomerInput!): Customer!

    # ----- Sales order mutations -----

    """Create a new sales order"""
    createSalesOrder(input: CreateSalesOrderInput!): SalesOrderHeader!

    """Update a sales order (status, ship date, comment)"""
    updateSalesOrder(id: Int!, input: UpdateSalesOrderInput!): SalesOrderHeader!

    """Cancel a sales order (sets status to 6)"""
    cancelSalesOrder(id: Int!): SalesOrderHeader!

    # ----- Person mutations -----

    """Create a new person"""
    createPerson(input: CreatePersonInput!): Person!
  }

  type Subscription {
    """Subscribe to newly created sales orders"""
    orderCreated: OrderCreatedPayload!

    """Subscribe to inventory changes"""
    inventoryUpdated(productId: Int): InventoryUpdatedPayload!
  }
`;

module.exports = { typeDefs };
