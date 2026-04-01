/**
 * Test script for the AdventureWorks GraphQL API
 * Runs a suite of example queries to verify the server is working correctly
 */

'use strict';

const http = require('http');

const PORT = process.env.PORT || 4000;
const BASE_URL = `http://localhost:${PORT}`;

let passed = 0;
let failed = 0;

async function query(name, gql, variables = {}) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify({ query: gql, variables });
        const options = {
            hostname: 'localhost',
            port: PORT,
            path: '/',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body)
            }
        };
        
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    if (result.errors) {
                        console.error(`❌ FAIL: ${name}`);
                        console.error('   Errors:', result.errors.map(e => e.message).join(', '));
                        failed++;
                        resolve(null);
                    } else {
                        console.log(`✅ PASS: ${name}`);
                        passed++;
                        resolve(result.data);
                    }
                } catch (e) {
                    console.error(`❌ FAIL: ${name} (parse error: ${e.message})`);
                    failed++;
                    resolve(null);
                }
            });
        });
        
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

async function runTests() {
    console.log('🚀 AdventureWorks GraphQL API Test Suite\n');
    
    // Test 1: Health check
    await query('Health check', `{ health { status databaseConnected tableCount } }`);
    
    // Test 2: Product categories with subcategories
    await query('Product categories with subcategories', `{
        productCategories {
            name
            subcategories { name }
        }
    }`);
    
    // Test 3: Products with filter and cursor pagination
    await query('Products filter: bikes over $1000', `{
        products(filter: { productCategoryId: 1, listPrice: { gte: 1000 } }, first: 5, orderBy: [{ field: "ListPrice", direction: DESC }]) {
            totalCount
            edges {
                cursor
                node { productId name listPrice color }
            }
            pageInfo { hasNextPage endCursor }
        }
    }`);
    
    // Test 4: Deep nested query - sales order
    await query('Sales order with nested customer + items', `{
        salesOrder(id: 43659) {
            salesOrderNumber orderDate totalDue statusLabel
            customer {
                accountNumber
                person { firstName lastName }
            }
            details {
                orderQty unitPrice lineTotal
                product { name productNumber }
            }
            shipToAddress {
                city
                stateProvince { name countryRegion { name } }
            }
        }
    }`);
    
    // Test 5: Sales analytics
    await query('Sales by category aggregation', `{
        salesByCategory {
            category { name }
            totalRevenue orderCount productCount
        }
    }`);
    
    // Test 6: Top products
    await query('Top 5 products by revenue', `{
        topProducts(limit: 5) {
            product { name listPrice color }
            totalRevenue totalQuantity orderCount
        }
    }`);
    
    // Test 7: Employee query with department
    await query('Employees filtered by job title', `{
        employees(filter: { jobTitle: { contains: "Manager" } }, first: 5) {
            totalCount
            edges {
                node {
                    jobTitle
                    person { firstName lastName }
                    department { name groupName }
                }
            }
        }
    }`);
    
    // Test 8: Sales by territory
    await query('Sales by territory', `{
        salesByTerritory {
            territory { name group }
            totalRevenue orderCount customerCount
        }
    }`);
    
    // Test 9: Sales person performance
    await query('Sales person performance', `{
        salesPersonPerformance {
            salesPerson {
                salesYtd
                person { firstName lastName }
                territory { name }
            }
            totalSales orderCount avgOrderValue
        }
    }`);
    
    // Test 10: Product with vendors and inventory
    await query('Product details with vendors and inventory', `{
        product(id: 707) {
            name productNumber color listPrice standardCost
            subcategory { name category { name } }
            inventory { location { name } quantity shelf bin }
            vendors { vendor { name } standardPrice averageLeadTime }
            priceHistory { listPrice startDate endDate }
        }
    }`);
    
    // Test 11: Search
    await query('Search persons', `{
        searchPersons(query: "Michael", limit: 3) {
            firstName lastName
            emailAddresses { emailAddress }
        }
    }`);
    
    // Test 12: Monthly sales trend
    await query('Monthly sales trend', `{
        salesByMonth(year: 2023, limit: 12) {
            year month totalRevenue orderCount
        }
    }`);
    
    // Test 13: Top customers
    await query('Top 5 customers by spend', `{
        topCustomers(limit: 5) {
            customer { accountNumber }
            totalSpent orderCount lastOrderDate
        }
    }`);
    
    // Test 14: Vendor list with products
    await query('Active preferred vendors', `{
        vendors(filter: { preferredVendorStatus: true, activeFlag: true }, first: 3) {
            totalCount
            edges {
                node {
                    name creditRating
                    products {
                        product { name }
                        standardPrice averageLeadTime
                    }
                }
            }
        }
    }`);
    
    // Test 15: Aggregation query
    await query('Sales order aggregation (total/avg/max)', `{
        salesOrderAggregate(filter: { status: { eq: 5 } }, field: "TotalDue") {
            count sum avg min max
        }
    }`);
    
    // Test 16: Full-text search
    await query('Full-text search', `{
        search(query: "mountain", limit: 5) {
            totalPersons totalProducts
            products { name productNumber }
        }
    }`);
    
    // Test 17: Customers with pagination
    await query('Customers cursor pagination', `{
        customers(first: 5, orderBy: [{ field: "CustomerID", direction: ASC }]) {
            totalCount
            pageInfo { hasNextPage endCursor }
            edges { node { customerId accountNumber } }
        }
    }`);
    
    // Test 18: Inventory status
    await query('Inventory status (below safety stock)', `{
        inventoryStatus(belowSafetyStock: true, limit: 5) {
            product { name safetyStockLevel }
            totalQuantity belowSafetyStock
        }
    }`);
    
    console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);
    
    if (failed > 0) {
        process.exit(1);
    }
}

runTests().catch(err => {
    console.error('Test runner error:', err.message);
    process.exit(1);
});
