/**
 * Input Validation Middleware
 * 
 * Validates mutation inputs before executing resolvers.
 * Throws GraphQL UserInputError for invalid inputs.
 */

const { GraphQLError } = require('graphql');

/**
 * Create a validation error
 */
function validationError(message, field) {
    return new GraphQLError(message, {
        extensions: {
            code: 'BAD_USER_INPUT',
            field,
        }
    });
}

/**
 * Validate CreateProductInput
 */
function validateCreateProduct(input) {
    const errors = [];
    
    if (!input.name || input.name.trim().length === 0) {
        errors.push(validationError('Product name is required', 'name'));
    }
    if (input.name && input.name.length > 50) {
        errors.push(validationError('Product name must be 50 characters or less', 'name'));
    }
    if (!input.productNumber || input.productNumber.trim().length === 0) {
        errors.push(validationError('Product number is required', 'productNumber'));
    }
    if (input.standardCost < 0) {
        errors.push(validationError('Standard cost cannot be negative', 'standardCost'));
    }
    if (input.listPrice < 0) {
        errors.push(validationError('List price cannot be negative', 'listPrice'));
    }
    if (input.safetyStockLevel < 0) {
        errors.push(validationError('Safety stock level cannot be negative', 'safetyStockLevel'));
    }
    if (input.daysToManufacture < 0) {
        errors.push(validationError('Days to manufacture cannot be negative', 'daysToManufacture'));
    }
    if (input.productLine && !['R', 'M', 'T', 'S'].includes(input.productLine)) {
        errors.push(validationError('Product line must be R (Road), M (Mountain), T (Touring), or S (Standard)', 'productLine'));
    }
    if (input.class && !['H', 'M', 'L'].includes(input.class)) {
        errors.push(validationError('Class must be H (High), M (Medium), or L (Low)', 'class'));
    }
    
    if (errors.length > 0) throw errors[0];
}

/**
 * Validate CreateSalesOrderInput
 */
function validateCreateSalesOrder(input, db) {
    if (!input.details || input.details.length === 0) {
        throw validationError('Sales order must have at least one detail line', 'details');
    }
    
    // Verify customer exists
    const customer = db.prepare('SELECT CustomerID FROM Sales_Customer WHERE CustomerID = ?').get(input.customerId);
    if (!customer) {
        throw validationError(`Customer ${input.customerId} not found`, 'customerId');
    }
    
    // Verify addresses exist
    const billAddr = db.prepare('SELECT AddressID FROM Person_Address WHERE AddressID = ?').get(input.billToAddressId);
    if (!billAddr) {
        throw validationError(`Billing address ${input.billToAddressId} not found`, 'billToAddressId');
    }
    
    const shipAddr = db.prepare('SELECT AddressID FROM Person_Address WHERE AddressID = ?').get(input.shipToAddressId);
    if (!shipAddr) {
        throw validationError(`Shipping address ${input.shipToAddressId} not found`, 'shipToAddressId');
    }
    
    // Validate each detail line
    for (let i = 0; i < input.details.length; i++) {
        const d = input.details[i];
        if (d.orderQty <= 0) {
            throw validationError(`Detail line ${i + 1}: orderQty must be positive`, 'details.orderQty');
        }
        if (d.unitPrice < 0) {
            throw validationError(`Detail line ${i + 1}: unitPrice cannot be negative`, 'details.unitPrice');
        }
        const product = db.prepare('SELECT ProductID, FinishedGoodsFlag FROM Production_Product WHERE ProductID = ?').get(d.productId);
        if (!product) {
            throw validationError(`Detail line ${i + 1}: Product ${d.productId} not found`, 'details.productId');
        }
    }
}

/**
 * Validate CreatePersonInput
 */
function validateCreatePerson(input) {
    if (!input.firstName || input.firstName.trim().length === 0) {
        throw validationError('First name is required', 'firstName');
    }
    if (!input.lastName || input.lastName.trim().length === 0) {
        throw validationError('Last name is required', 'lastName');
    }
    const validPersonTypes = ['SC', 'IN', 'SP', 'EM', 'VC', 'GC'];
    if (!validPersonTypes.includes(input.personType)) {
        throw validationError(`Person type must be one of: ${validPersonTypes.join(', ')}`, 'personType');
    }
    if (input.emailAddress && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.emailAddress)) {
        throw validationError('Invalid email address format', 'emailAddress');
    }
}

module.exports = { validateCreateProduct, validateCreateSalesOrder, validateCreatePerson, validationError };
