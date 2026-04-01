/**
 * In-memory LRU cache for query results
 * Reduces database load for frequently repeated queries
 */

class LRUCache {
    constructor(maxSize = 1000, ttlMs = 60000) {
        this.maxSize = maxSize;
        this.ttlMs = ttlMs;
        this.cache = new Map();
        this.stats = { hits: 0, misses: 0, sets: 0, evictions: 0 };
    }
    
    get(key) {
        const entry = this.cache.get(key);
        if (!entry) {
            this.stats.misses++;
            return undefined;
        }
        if (Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            this.stats.misses++;
            return undefined;
        }
        // LRU: move to end
        this.cache.delete(key);
        this.cache.set(key, entry);
        this.stats.hits++;
        return entry.value;
    }
    
    set(key, value) {
        if (this.cache.has(key)) {
            this.cache.delete(key);
        } else if (this.cache.size >= this.maxSize) {
            // Evict oldest (first entry)
            this.cache.delete(this.cache.keys().next().value);
            this.stats.evictions++;
        }
        this.cache.set(key, {
            value,
            expiresAt: Date.now() + this.ttlMs
        });
        this.stats.sets++;
    }
    
    delete(key) {
        return this.cache.delete(key);
    }
    
    clear() {
        this.cache.clear();
    }
    
    /**
     * Clear all entries with keys matching a pattern
     */
    invalidatePattern(pattern) {
        const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
        for (const key of this.cache.keys()) {
            if (regex.test(key)) {
                this.cache.delete(key);
            }
        }
    }
    
    getStats() {
        const total = this.stats.hits + this.stats.misses;
        return {
            ...this.stats,
            size: this.cache.size,
            hitRate: total > 0 ? (this.stats.hits / total * 100).toFixed(1) + '%' : 'N/A'
        };
    }
}

// Singleton cache instance
const queryCache = new LRUCache(2000, 300000); // 5-minute TTL, 2000 entries

/**
 * Cache-aware query executor
 * @param {string} cacheKey - unique key for this query
 * @param {Function} queryFn - function that returns query result
 * @param {boolean} [bypass=false] - bypass cache (for mutations)
 */
function cachedQuery(cacheKey, queryFn, bypass = false) {
    if (bypass) return queryFn();
    
    const cached = queryCache.get(cacheKey);
    if (cached !== undefined) return cached;
    
    const result = queryFn();
    queryCache.set(cacheKey, result);
    return result;
}

module.exports = { queryCache, cachedQuery, LRUCache };
