# AdventureWorks GraphQL API

A **production-quality GraphQL server** built on top of the Microsoft AdventureWorks sample database, converted to SQLite. Demonstrates mastery of GraphQL schema design, DataLoader patterns, advanced filtering, cursor pagination, aggregations, subscriptions, and production features.

---

## 🏗 Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Apollo Server 5                       │
│         (Standalone HTTP + WebSocket server)             │
├──────────────┬──────────────┬─────────────┬─────────────┤
│ Schema       │ Resolvers    │ DataLoaders  │ Middleware  │
│ typeDefs.js  │ index.js     │ index.js    │ Rate Limit  │
│              │ fieldResolvers│             │ Depth Limit │
├──────────────┴──────────────┴─────────────┴─────────────┤
│              Query Utilities                             │
│  queryBuilder.js | cache.js | analytics.js              │
├──────────────────────────────────────────────────────────┤
│              SQLite Database (better-sqlite3)            │
│         58 tables | ~350k rows | FTS5 indexes            │
└──────────────────────────────────────────────────────────┘
```

### Technology Stack
- **Runtime**: Node.js 18+ with CommonJS modules
- **GraphQL Server**: Apollo Server 5 (standalone)
- **Database**: SQLite via `better-sqlite3` (synchronous, zero-copy)
- **Schema**: `graphql-tag` + `@graphql-tools/schema`
- **N+1 Prevention**: `dataloader` (per-request batching/caching)
- **Subscriptions**: `graphql-ws` over WebSocket
- **Caching**: In-memory LRU cache (2000 entries, 5-min TTL)
- **Rate Limiting**: `express-rate-limit`
- **Depth Limiting**: `graphql-depth-limit` (max depth: 12)
- **Analytics**: Custom request analytics tracker
- **Source Data**: Microsoft AdventureWorks OLTP CSVs → SQLite

### Database Schema
The SQLite database mirrors the AdventureWorks OLTP schema across 5 namespaces:

| Schema | Tables | Key Entities |
|--------|--------|-------------|
| **Person** | 10 | Person, Address, BusinessEntity, EmailAddress, Phone |
| **HumanResources** | 6 | Employee, Department, Shift, EmployeePayHistory |
| **Production** | 14 | Product, ProductCategory, ProductModel, WorkOrder |
| **Purchasing** | 5 | Vendor, PurchaseOrderHeader, PurchaseOrderDetail |
| **Sales** | 12 | Customer, SalesOrderHeader, SalesOrderDetail, SalesPerson |

**Row counts**: ~20k persons, ~19k customers, ~31k orders, ~121k order details, ~504 products, ~72k work orders

---

## 🚀 Setup & Running

### Prerequisites
- Node.js 18+
- SQLite3 (included via `better-sqlite3`)

### Quick Start

```bash
# Clone
git clone https://github.com/rogclaw42/adventureworks-graphql
cd adventureworks-graphql

# Install dependencies
npm install

# Build the SQLite database from CSV source data
npm run build-db

# Start the server
npm start
```

The server starts on **port 4000** by default.

| Endpoint | URL |
|----------|-----|
| GraphQL / GraphiQL | http://localhost:4000/ |
| Health check | http://localhost:4002/health |
| Analytics | http://localhost:4002/analytics |
| Subscriptions | ws://localhost:4001/graphql/subscriptions |

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `4000` | HTTP server port |
| `LOG_QUERIES` | `true` | Log query names to stdout |
| `NODE_ENV` | `development` | `production` masks internal errors |

---

## 📝 Example Queries

### 1. Product Categories with Nested Subcategories

```graphql
{
  productCategories {
    productCategoryId
    name
    subcategories {
      name
      products(limit: 3) {
        name
        listPrice
        color
      }
    }
  }
}
```

### 2. Products with Advanced Filtering + Cursor Pagination

```graphql
{
  products(
    filter: {
      productCategoryId: 1          # Bikes only
      listPrice: { gte: 1000 }       # $1000+
      color: { eq: "Black" }
    }
    orderBy: [{ field: "ListPrice", direction: DESC }]
    first: 10
  ) {
    totalCount
    pageInfo {
      hasNextPage
      endCursor
    }
    edges {
      cursor
      node {
        productId
        name
        listPrice
        color
        subcategory { name }
        model { name }
      }
    }
  }
}
```

### 3. Deep Nested Sales Order Query

```graphql
{
  salesOrder(id: 43659) {
    salesOrderNumber
    orderDate
    totalDue
    statusLabel
    
    customer {
      accountNumber
      person {
        firstName
        lastName
        emailAddresses { emailAddress }
        phoneNumbers {
          phoneNumber
          phoneNumberType { name }
        }
      }
      store { name }
      territory { name group }
    }
    
    details {
      orderQty
      unitPrice
      lineTotal
      product {
        name
        productNumber
        color
        subcategory {
          name
          category { name }
        }
      }
      specialOffer { description discountPct }
    }
    
    billToAddress {
      addressLine1
      city
      postalCode
      stateProvince {
        name
        countryRegion { name }
      }
    }
    
    salesPerson {
      salesYtd
      person { firstName lastName }
    }
    
    salesReasons { name reasonType }
  }
}
```

### 4. Sales Analytics by Category

```graphql
{
  salesByCategory(dateFrom: "2023-01-01", dateTo: "2023-12-31") {
    category { name }
    totalRevenue
    orderCount
    productCount
    avgOrderValue
  }
}
```

### 5. Top Products with Revenue

```graphql
{
  topProducts(limit: 10, categoryId: 1) {
    product {
      name
      productNumber
      listPrice
      color
    }
    totalRevenue
    totalQuantity
    orderCount
  }
}
```

### 6. Monthly Sales Trend

```graphql
{
  salesByMonth(year: 2023) {
    year
    month
    totalRevenue
    orderCount
  }
}
```

### 7. Employee Query with Department History

```graphql
{
  employees(
    filter: {
      jobTitle: { contains: "Engineer" }
      salariedFlag: true
    }
    first: 10
    orderBy: [{ field: "HireDate", direction: ASC }]
  ) {
    totalCount
    edges {
      node {
        jobTitle
        hireDate
        vacationHours
        person { firstName lastName }
        department { name groupName }
        departmentHistory {
          department { name }
          shift { name startTime endTime }
          startDate
          endDate
        }
        payHistory {
          rate
          payFrequency
          rateChangeDate
        }
      }
    }
  }
}
```

### 8. Sales Person Performance Report

```graphql
{
  salesPersonPerformance {
    salesPerson {
      salesYtd
      salesLastYear
      commissionPct
      person { firstName lastName }
      territory { name group }
    }
    totalSales
    orderCount
    avgOrderValue
    ytdQuota
  }
}
```

### 9. Aggregation Query

```graphql
{
  # Total/avg/min/max for shipped orders
  salesOrderAggregate(
    filter: {
      status: { eq: 5 }
      orderDate: { gte: "2023-01-01" }
    }
    field: "TotalDue"
  ) {
    count
    sum
    avg
    min
    max
  }
  
  # Product price statistics
  productAggregate(
    filter: { productCategoryId: 1 }
    field: "ListPrice"
  ) {
    count
    avg
    min
    max
  }
}
```

### 10. Full-Text Search

```graphql
{
  search(query: "mountain bike", limit: 10) {
    totalPersons
    totalProducts
    persons {
      firstName
      lastName
      emailAddresses { emailAddress }
    }
    products {
      name
      productNumber
      listPrice
    }
  }
}
```

### 11. Vendor Supply Chain

```graphql
{
  vendors(
    filter: {
      preferredVendorStatus: true
      creditRating: { lte: 2 }
    }
    orderBy: [{ field: "Name", direction: ASC }]
    first: 10
  ) {
    totalCount
    edges {
      node {
        name
        creditRating
        contacts { firstName lastName }
        products {
          product { name productNumber }
          standardPrice
          averageLeadTime
          minOrderQty
          maxOrderQty
        }
        purchaseOrders(limit: 3) {
          purchaseOrderId
          orderDate
          totalDue
          statusLabel
        }
      }
    }
  }
}
```

### 12. Inventory Status

```graphql
{
  inventoryStatus(belowSafetyStock: true, limit: 20) {
    product {
      name
      productNumber
      safetyStockLevel
      reorderPoint
    }
    totalQuantity
    locationCount
    belowSafetyStock
  }
}
```

### 13. CRUD: Create a Product

```graphql
mutation {
  createProduct(input: {
    name: "Mountain-500 Black, 40"
    productNumber: "BK-M68B-40"
    safetyStockLevel: 500
    reorderPoint: 375
    standardCost: 294.77
    listPrice: 539.99
    color: "Black"
    size: "40"
    daysToManufacture: 4
    productLine: "M"
    class: "L"
    style: "U"
    productSubcategoryId: 1
    sellStartDate: "2024-01-01"
  }) {
    productId
    name
    productNumber
    listPrice
    subcategory { name }
  }
}
```

### 14. Cursor-Based Pagination (Relay-style)

```graphql
# First page
{
  salesOrders(
    filter: { status: { eq: 5 } }
    orderBy: [{ field: "OrderDate", direction: DESC }]
    first: 5
  ) {
    totalCount
    pageInfo {
      hasNextPage
      endCursor
    }
    edges {
      cursor
      node {
        salesOrderId
        salesOrderNumber
        orderDate
        totalDue
        customer { accountNumber }
      }
    }
  }
}

# Next page (use endCursor from previous response as 'after')
{
  salesOrders(
    filter: { status: { eq: 5 } }
    orderBy: [{ field: "OrderDate", direction: DESC }]
    first: 5
    after: "<endCursor from previous response>"
  ) {
    pageInfo { hasNextPage endCursor hasPreviousPage }
    edges {
      node { salesOrderId salesOrderNumber }
    }
  }
}
```

### 15. Sales Territory Analysis

```graphql
{
  salesTerritories {
    name
    group
    salesYtd
    salesLastYear
    salesPersons {
      salesYtd
      person { firstName lastName }
    }
    customers(limit: 3) {
      accountNumber
      store { name }
      totalOrderValue
    }
  }
  
  salesByTerritory(dateFrom: "2023-01-01") {
    territory { name group }
    totalRevenue
    orderCount
    customerCount
  }
}
```

---

## 🎯 GraphQL Schema Highlights

### Filtering System
All list queries support rich filtering operators:

```graphql
input StringFilter {
  eq, ne, contains, startsWith, endsWith, in, notIn, isNull
}

input FloatFilter {
  eq, ne, gt, gte, lt, lte, between { min, max }, isNull
}

input IntFilter {
  eq, ne, gt, gte, lt, lte, in, notIn, between { min, max }, isNull
}
```

### Relay-Style Pagination
All collection queries support Relay cursor pagination:

```graphql
type ProductConnection {
  edges: [ProductEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

type ProductEdge {
  cursor: String!
  node: Product!
}

type PageInfo {
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
  startCursor: String
  endCursor: String
}
```

### Analytics Queries
- `salesByCategory` — Revenue/orders/products by category
- `salesByTerritory` — Territory-level metrics
- `salesByMonth` — Monthly trend analysis
- `topProducts` — Best sellers by revenue
- `topCustomers` — Top spenders
- `salesPersonPerformance` — Rep metrics vs. quota
- `salesOrderAggregate` — COUNT/SUM/AVG/MIN/MAX on orders
- `productAggregate` — Stats on products

---

## ⚙️ Production Features

| Feature | Implementation |
|---------|---------------|
| N+1 Prevention | DataLoader batching per-request |
| Depth Limiting | `graphql-depth-limit` (max 12) |
| Rate Limiting | Per-IP, 300 req/min |
| Caching | In-memory LRU (2000 entries, 5-min TTL) |
| Full-Text Search | SQLite FTS5 virtual tables |
| Subscriptions | WebSocket via `graphql-ws` |
| Analytics | Custom request tracker |
| Health Check | `/health` endpoint |
| Error Handling | Production error masking |
| CRUD Mutations | Products, Customers, Orders, Persons |

---

## 🔌 Subscriptions

Connect via WebSocket at `ws://localhost:4001/graphql/subscriptions`:

```graphql
subscription {
  orderCreated {
    order {
      salesOrderId
      salesOrderNumber
      totalDue
      customer { accountNumber }
    }
  }
}

subscription {
  inventoryUpdated(productId: 707) {
    product { name }
    location { name }
    newQuantity
  }
}
```

---

## 📁 Project Structure

```
adventureworks-graphql/
├── adventureworks.db       # SQLite database (built from CSVs)
├── build-db.js             # Database build script
├── csv/                    # Source CSV files from Microsoft
├── package.json
├── README.md
└── src/
    ├── server.js           # Apollo Server entry point
    ├── db.js               # SQLite connection singleton
    ├── test-queries.js     # Test suite (18 queries)
    ├── schema/
    │   └── typeDefs.js     # Complete GraphQL schema (~500 lines)
    ├── resolvers/
    │   ├── index.js        # Query/Mutation/Subscription resolvers
    │   └── fieldResolvers.js # PascalCase → camelCase field mapping
    ├── dataloaders/
    │   └── index.js        # 30+ DataLoader instances
    └── utils/
        ├── queryBuilder.js # Dynamic SQL builder (WHERE, ORDER BY)
        ├── cache.js        # LRU cache implementation
        └── analytics.js    # Query analytics tracker
```

---

## License

MIT
