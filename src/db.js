/**
 * Database connection module
 * Provides a singleton better-sqlite3 instance for the AdventureWorks database
 */

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'adventureworks.db');

let db;

function getDb() {
    if (!db) {
        db = new Database(DB_PATH, { readonly: false });
        db.pragma('journal_mode = WAL');
        db.pragma('foreign_keys = ON');
        db.pragma('cache_size = -64000'); // 64MB cache
        db.pragma('synchronous = NORMAL');
    }
    return db;
}

module.exports = { getDb };
