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
            db.prepare(`CREATE TABLE ${TABLE} (id INTEGER PRIMARY KEY, name VARCHAR(128), groupname VARCHAR(128), date DATETIME, scenario VARCHAR(64), dir VARCHAR(64), thumbnail VARCHAR(16), largeimg VARCHAR(16));`).run();
        }

        this._queries = {
            ADDPARK: db.prepare(`INSERT INTO ${TABLE} (name,groupname,date,scenario,dir,thumbnail,largeimg) VALUES (@name, @group, @date, @scenario, @dir, @thumbnail, @largeimg);`),
            GETPARKS: db.prepare(`SELECT * FROM ${TABLE} ORDER BY date DESC;`),
            GETPARK: db.prepare(`SELECT * FROM ${TABLE} WHERE id = @id;`)
        }
    }

    AddPark(params={}){
        params.name = params.name || 'no name';
        params.group = params.group || 'default';
        params.date = params.date || (new Date()).getTime();
        return this._queries.ADDPARK.run(params);
    }
}

module.exports = DB; 