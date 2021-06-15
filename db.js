const path = require('path');
const LOG = require('log');
const sqlite = require('better-sqlite3');
const log = LOG.get('db')
const TABLE = 'parks';
const ITEMSPERPAGE = 30;

class DB {
    constructor(options = {}) {
        this.ITEMSPERPAGE = ITEMSPERPAGE;
        this._db = new sqlite(process.env.DBPATH || options.path || path.join(__dirname, 'storage', 'db', 'db.db'));
        const db = this._db;

        if (!db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='${TABLE}';`).get()) {
            db.prepare(`CREATE TABLE ${TABLE} (id INTEGER PRIMARY KEY, name VARCHAR(128), groupname VARCHAR(128), gamemode VARCHAR(128), date DATETIME, scenario VARCHAR(64), dir VARCHAR(64), thumbnail VARCHAR(16), largeimg VARCHAR(16));`).run();
        }

        this._queries = {
            ADDPARK: db.prepare(`INSERT INTO ${TABLE} (name,groupname,gamemode,date,scenario,dir,thumbnail,largeimg) VALUES (@name, @group, @gamemode, @date, @scenario, @dir, @thumbnail, @largeimg);`),
            GETPARKS: {},
            GETPARKCount: db.prepare(`SELECT COUNT(*) as count FROM ${TABLE}`),
            GETPARK: db.prepare(`SELECT * FROM ${TABLE} WHERE id = @id;`),
            DELETEPARK: db.prepare(`DELETE FROM ${TABLE} WHERE id = @id;`),
            IMAGES: {
                GETMISSINGTHUMBNAIL: db.prepare(`SELECT * FROM ${TABLE} WHERE thumbnail IS NULL LIMIT 1;`),
                GETMISSINGIMAGE: db.prepare(`SELECT * FROM ${TABLE} WHERE largeimg IS NULL LIMIT 1;`),
                REPLACETHUMBNAIL: db.prepare(`UPDATE ${TABLE} SET thumbnail = @thumbnail WHERE id = @id;`),
                REPLACEIMAGE: db.prepare(`UPDATE ${TABLE} SET largeimg = @largeimg WHERE id = @id;`),
                REMOVEIMAGES: db.prepare(`UPDATE ${TABLE} SET (largeimg, thumbnail) = (NULL, NULL) WHERE id = @id;`)
            }
        };

        ['name', 'groupname', 'gamemode', 'date', 'scenario'].forEach(col => {
            this._queries.GETPARKS[col] = {
                ASC: db.prepare(`SELECT * FROM ${TABLE} ORDER BY ${col} ASC LIMIT @offset, ${ITEMSPERPAGE};`),
                DESC: db.prepare(`SELECT * FROM ${TABLE} ORDER BY ${col} DESC LIMIT @offset, ${ITEMSPERPAGE};`)
            };
        });
    }

    AddPark(params = {}) {
        params.name = params.name || 'no name';
        params.group = params.group || 'default';
        params.gamemode = params.gamemode || 'multiplayer';
        params.date = params.date || (new Date()).getTime();
        return this._queries.ADDPARK.run(params);
    }

    GetParks(page = 1, orderby = 'date', order = false) {
        return this._queries.GETPARKS[orderby][order ? 'ASC' : 'DESC'].all({
            offset: (page - 1) * ITEMSPERPAGE
        });
    }

    GetParkCount() {
        let resp = this._queries.GETPARKCount.get();
        resp.pages = Math.ceil(resp.count / ITEMSPERPAGE);
        return resp;
    }

    GetPark(id = -1) {
        return this._queries.GETPARK.get({
            id
        });
    }

    getMissingImage(fullsize = true) {
        return (fullsize ? this._queries.IMAGES.GETMISSINGIMAGE : this._queries.IMAGES.GETMISSINGTHUMBNAIL).get();
    }

    ReplaceImage(fullsize = true, id, filename) {
        return (fullsize ? this._queries.IMAGES.REPLACEIMAGE : this._queries.IMAGES.REPLACETHUMBNAIL).run({
            id,
            thumbnail: filename,
            largeimg: filename
        });
    }

    RemoveImages(id) {
        return this._queries.IMAGES.REMOVEIMAGES.run({id});
    }

    DeletePark(id) {
        return this._queries.DELETEPARK.run({id});
    }
}

module.exports = DB;