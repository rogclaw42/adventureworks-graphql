/**
 * Schema Documentation Generator
 * Generates Markdown documentation from the GraphQL schema
 */

'use strict';

const { buildSchema, printSchema, introspectionFromSchema } = require('graphql');
const { typeDefs } = require('../schema/typeDefs');
const { makeExecutableSchema } = require('@graphql-tools/schema');
const { resolvers } = require('../resolvers');
const fs = require('fs');
const path = require('path');

const schema = makeExecutableSchema({ typeDefs, resolvers });

// Print SDL
const sdl = printSchema(schema);
fs.writeFileSync(path.join(__dirname, '../../schema.graphql'), sdl);
console.log('✅ Generated schema.graphql');

// Count types and fields
const typeMap = schema.getTypeMap();
let typeCount = 0, fieldCount = 0;
for (const [name, type] of Object.entries(typeMap)) {
    if (name.startsWith('__')) continue;
    if (type.getFields) {
        typeCount++;
        fieldCount += Object.keys(type.getFields()).length;
    }
}
console.log(`Schema: ${typeCount} types, ${fieldCount} fields`);
