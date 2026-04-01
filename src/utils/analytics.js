/**
 * Query Analytics Module
 * Tracks GraphQL query performance and usage patterns
 */

class QueryAnalytics {
    constructor() {
        this.queries = [];
        this.maxEntries = 10000;
        this.startTime = Date.now();
    }
    
    record(query) {
        if (this.queries.length >= this.maxEntries) {
            this.queries.shift(); // Remove oldest
        }
        this.queries.push({
            ...query,
            timestamp: Date.now()
        });
    }
    
    getSummary() {
        const now = Date.now();
        const last1h = this.queries.filter(q => now - q.timestamp < 3600000);
        const last24h = this.queries.filter(q => now - q.timestamp < 86400000);
        
        const avgDuration = (arr) => arr.length > 0
            ? arr.reduce((s, q) => s + (q.duration || 0), 0) / arr.length
            : 0;
        
        // Top operations
        const opCounts = {};
        for (const q of this.queries) {
            if (q.operationName) {
                opCounts[q.operationName] = (opCounts[q.operationName] || 0) + 1;
            }
        }
        const topOperations = Object.entries(opCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([name, count]) => ({ name, count }));
        
        // Slowest queries
        const slowest = [...this.queries]
            .filter(q => q.duration)
            .sort((a, b) => b.duration - a.duration)
            .slice(0, 5)
            .map(q => ({
                operationName: q.operationName,
                duration: q.duration,
                timestamp: new Date(q.timestamp).toISOString()
            }));
        
        return {
            totalQueries: this.queries.length,
            last1hCount: last1h.length,
            last24hCount: last24h.length,
            avgDurationMs: Math.round(avgDuration(last1h)),
            errorCount: this.queries.filter(q => q.errors && q.errors.length > 0).length,
            topOperations,
            slowestQueries: slowest,
            uptime: Math.floor((now - this.startTime) / 1000) + 's'
        };
    }
}

const analytics = new QueryAnalytics();

module.exports = { analytics };
