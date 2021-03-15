const path = require('path');
const LOG = require('log');
const sqlite = require('better-sqlite3');
const log = LOG.get('db')
const TABLE = 'parks';

class DB {
    constructor(options = {}) {
        this._db = new sqlite(process.env.DBPATH || options.path || path.join(__dirname, 'storage', 'db', 'db.db'));
        const db = this._db;
        
        if(!db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='${TABLE}';`).get()){
            db.prepare(`CREATE TABLE ${TABLE} (name VARCHAR(128), date DATETIME, scenario VARCHAR(64), hasImg INTEGER);`).run();
        }

        this._queries = {

        }
    }
}

module.exports = DB; 