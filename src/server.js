/**
 * AdventureWorks GraphQL Server
 * 
 * Production-quality GraphQL API built on the AdventureWorks SQLite database.
 * 
 * Features:
 * - Apollo Server 5 with standalone HTTP server
 * - DataLoader for N+1 prevention
 * - Cursor-based (Relay-style) pagination
 * - Advanced filtering (eq, contains, gt, lt, between, in, etc.)
 * - Aggregation queries (salesByCategory, topProducts, etc.)
 * - Full-text search (SQLite FTS5)
 * - CRUD mutations
 * - GraphQL Subscriptions (WebSocket via graphql-ws)
 * - Query depth limiting
 * - Rate limiting
 * - In-memory LRU cache
 * - Request logging & analytics
 * - GraphiQL playground (Apollo Sandbox)
 * - Health check endpoint
 */

'use strict';

const http = require('http');
const { ApolloServer } = require('@apollo/server');
const { startStandaloneServer } = require('@apollo/server/standalone');
const { ApolloServerPluginLandingPageLocalDefault } = require('@apollo/server/plugin/landingPage/default');
const { makeExecutableSchema } = require('@graphql-tools/schema');
const { WebSocketServer } = require('ws');
const { useServer } = require('graphql-ws/use/ws');
const { PubSub } = require('graphql-subscriptions');
const depthLimit = require('graphql-depth-limit');

const { typeDefs } = require('./schema/typeDefs');
const { resolvers } = require('./resolvers');
const { createDataLoaders } = require('./dataloaders');
const { analytics } = require('./utils/analytics');

const PORT = process.env.PORT || 4000;

// ============================================================
// PubSub for GraphQL Subscriptions
// ============================================================
const pubsub = new PubSub();

// ============================================================
// Executable schema
// ============================================================
const schema = makeExecutableSchema({ typeDefs, resolvers });

async function startServer() {
    // ============================================================
    // HTTP Server (for subscriptions WebSocket sharing)
    // ============================================================
    const httpServer = http.createServer();
    
    // ============================================================
    // WebSocket server for subscriptions
    // ============================================================
    const wsServer = new WebSocketServer({
        server: httpServer,
        path: '/graphql/subscriptions',
    });
    
    const serverCleanup = useServer(
        {
            schema,
            context: async () => ({
                pubsub,
                loaders: createDataLoaders(),
            }),
            onError: (ctx, id, errors) => {
                console.error('[WS Error]', id, errors);
            },
        },
        wsServer
    );
    
    // ============================================================
    // Apollo Server
    // ============================================================
    const server = new ApolloServer({
        schema,
        introspection: true,
        plugins: [
            ApolloServerPluginLandingPageLocalDefault({ embed: true }),
            // WebSocket cleanup
            {
                async serverWillStart() {
                    return {
                        async drainServer() {
                            await serverCleanup.dispose();
                        },
                    };
                },
            },
            // Request logging & analytics
            {
                async requestDidStart({ request }) {
                    const startTime = Date.now();
                    const op = request.operationName || 'anonymous';
                    
                    if (process.env.LOG_QUERIES !== 'false') {
                        console.log(`[Query] ${op} — ${new Date().toISOString()}`);
                    }
                    
                    return {
                        async willSendResponse({ response }) {
                            const duration = Date.now() - startTime;
                            analytics.record({
                                operationName: op,
                                duration,
                                errors: response.body?.singleResult?.errors,
                            });
                            if (duration > 2000) {
                                console.warn(`[SLOW] ${op} took ${duration}ms`);
                            }
                        },
                        async didEncounterErrors({ errors }) {
                            for (const err of errors) {
                                console.error(`[Error] ${op}: ${err.message}`);
                            }
                        }
                    };
                }
            }
        ],
        validationRules: [
            depthLimit(12),
        ],
        formatError: (formattedError) => {
            if (process.env.NODE_ENV === 'production' &&
                formattedError.extensions?.code === 'INTERNAL_SERVER_ERROR') {
                return { message: 'Internal server error', extensions: { code: 'INTERNAL_SERVER_ERROR' } };
            }
            return formattedError;
        },
    });
    
    // ============================================================
    // Start the server (standalone manages its own HTTP)
    // ============================================================
    const { url } = await startStandaloneServer(server, {
        listen: { port: PORT },
        context: async ({ req }) => ({
            pubsub,
            loaders: createDataLoaders(),
            requestId: req.headers['x-request-id'] || Date.now().toString(),
        }),
    });
    
    // Also start the WS server on a separate port
    const WS_PORT = PORT + 1;
    await new Promise(resolve => httpServer.listen(WS_PORT, resolve));
    
    console.log(`
╔══════════════════════════════════════════════════════════╗
║     AdventureWorks GraphQL Server v3.0.0                 ║
╠══════════════════════════════════════════════════════════╣
║  GraphQL:     ${url.padEnd(40)} ║
║  GraphiQL:    ${url.padEnd(40)} ║
║  Health:      http://localhost:${PORT}/health${' '.repeat(12)}║
║  WS Subs:     ws://localhost:${WS_PORT}/graphql/subscriptions${' '.repeat(2)}║
╚══════════════════════════════════════════════════════════╝
    `);
    
    return { server, url };
}

// ============================================================
// Simple HTTP server for health checks (since standalone manages its own)
// ============================================================
const healthApp = http.createServer((req, res) => {
    const url = new URL(req.url, `http://localhost`);
    
    if (url.pathname === '/health') {
        const { getDb } = require('./db');
        try {
            const db = getDb();
            const orders = db.prepare('SELECT COUNT(*) as c FROM Sales_SalesOrderHeader').get();
            const products = db.prepare('SELECT COUNT(*) as c FROM Production_Product').get();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                status: 'ok',
                timestamp: new Date().toISOString(),
                database: 'connected',
                counts: { orders: orders.c, products: products.c },
                uptime: process.uptime().toFixed(2) + 's',
                version: '3.0.0',
                analytics: analytics.getSummary()
            }, null, 2));
        } catch (e) {
            res.writeHead(503, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'error', error: e.message }));
        }
    } else if (url.pathname === '/analytics') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(analytics.getSummary(), null, 2));
    } else {
        res.writeHead(404);
        res.end('Not Found');
    }
});

healthApp.listen(PORT + 2, () => {
    console.log(`Health check: http://localhost:${PORT + 2}/health`);
});

startServer().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
});
