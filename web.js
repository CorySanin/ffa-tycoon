const express = require('express');
const Helmet = require('helmet');
const bodyParser = require('body-parser');
const TOTP = require('otpauth').TOTP;
const moment = require('moment');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const DB = require('./db');
const GameServer = require('./gameserver');
const FileMan = require('./fileMan');

const CSPNONCE = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

const exists = async (filename) => {
    try {
        await fsp.access(filename);
        return true;
    }
    catch {
        return false;
    }
};

const genNonceForCSP = (length = 16) => {
    let bytes = crypto.randomBytes(length);
    let chars = [];
    for (let i = 0; i < bytes.length; i++) {
        chars.push(CSPNONCE[bytes[i] % CSPNONCE.length]);
    }
    return chars.join('');
}

class Web {
    constructor(options = {}) {
        const app = express();
        const privateapp = express();
        const db = this._db = new DB(options.db);
        const port = process.env.PORT || options.port || 8080;
        const privateport = process.env.PRIVATEPORT || options.privateport || 8081;
        this._totp = process.env.TOTP || options.totp || '';
        this._screenshotter = process.env.SCREENSHOTTER || options.screenshotter || 'screenshotterhost';
        this._archive = options.archivedir || 'storage/archive';
        this._servers = [];

        (options.servers || []).forEach(serverinfo => {
            this._servers.push(new GameServer(serverinfo));
        });

        app.set('trust proxy', 1);
        app.set('view engine', 'ejs');
        app.use(Helmet());
        app.use(bodyParser.urlencoded({ extended: true }));
        app.use(bodyParser.json());
        app.use('/assets/', express.static('assets'));
        app.use('/archive/', express.static(this._archive));

        privateapp.set('trust proxy', 1);
        privateapp.set('view engine', 'ejs');
        privateapp.use(Helmet());
        privateapp.use(bodyParser.urlencoded({ extended: true }));
        privateapp.use(bodyParser.json());
        privateapp.use('/assets/', express.static('assets'));

        //#region web endpoints

        app.get('/', async (req, res) => {
            await Promise.all(this._servers.map(s => s.GetDetails()));
            res.render('template',
                {
                    page: {
                        view: 'index',
                        title: 'Public OpenRCT2 Multiplayer Servers'
                    },
                    servers: this._servers
                },
                function (err, html) {
                    if (!err) {
                        res.send(html);
                    }
                    else {
                        res.send(err);
                    }
                });
        });

        app.get('/archive/:page?', (req, res) => {
            let page = Math.max(parseInt(req.params.page) || 1, 1);
            let order = {
                orderby: req.query.sort || req.query.orderby,
                order: (req.query.asc || req.query.order) === 'ASC'
            };
            let nonce = genNonceForCSP();
            res.render('template',
                {
                    page: {
                        view: 'archive',
                        title: 'Previous Parks'
                    },
                    order,
                    pagenum: page,
                    nonce
                },
                function (err, html) {
                    if (!err) {
                        res.set('Content-Security-Policy', `default-src 'self'; connect-src 'self' *; script-src 'self' 'nonce-${nonce}'`)
                        res.send(html);
                    }
                    else {
                        res.send(err);
                    }
                });
        });

        app.get('/park/:park', (req, res) => {
            let park = db.GetPark(parseInt(req.params.park));
            res.render('template',
                {
                    page: {
                        view: 'park',
                        title: ``
                    },
                    park
                },
                function (err, html) {
                    if (!err) {
                        res.send(html);
                    }
                    else {
                        res.send(err);
                    }
                });
        });

        app.get('/guide', (req, res) => {
            res.render('template',
                {
                    page: {
                        view: 'guide',
                        title: 'OpenRCT2 Hosting Guide'
                    }
                },
                function (err, html) {
                    if (!err) {
                        res.send(html);
                    }
                    else {
                        res.send(err);
                    }
                });
        });

        privateapp.get('/', async (req, res) => {
            await Promise.all(this._servers.map(s => s.GetDetails()));
            res.render('admin/template',
                {
                    page: {
                        view: 'index',
                        title: 'Home'
                    },
                    servers: this._servers
                },
                function (err, html) {
                    if (!err) {
                        res.send(html);
                    }
                    else {
                        res.send(err);
                    }
                }
            );
        });

        privateapp.get('/archive', (req, res) => {
            res.render('admin/template',
                {
                    page: {
                        view: 'archive',
                        title: 'Home'
                    }
                },
                function (err, html) {
                    if (!err) {
                        res.send(html);
                    }
                    else {
                        res.send(err);
                    }
                });
        });

        //#endregion

        app.get('/api/parks/count', (req, res) => {
            res.send(this.InjectStatus(this._db.GetParkCount(), 'good'));
        });

        app.get('/api/parks/:page?', (req, res) => {
            let count = this._db.GetParkCount();
            let page = Math.max(Math.min(parseInt(req.params.page) || 1, count.pages), 1);
            res.send({
                status: 'good',
                page,
                parks: this._db.GetParks(page, req.query.sort || req.query.orderby, (req.query.asc || req.query.order) === 'true'),
                count: count.count,
                pages: count.pages
            });
        });

        app.get('/api/park/:id', (req, res) => {
            res.send(this.InjectStatus(this._db.GetPark(parseInt(req.params.id) || 0), 'good'));
        });

        let savegroup = async (req, res, ispublic = true) => {
            let group = req.params.group;
            let result = {
                status: 'bad'
            };
            if (!ispublic || this.CheckTotp(req)) {
                let datestring = moment().format('YYYY-MM-DD_HH-mm-ss');
                result.status = 'ok';

                const serversingroup = this._servers.filter(server => server._group == group);

                for (const serverindx in serversingroup) {
                    const server = serversingroup[serverindx];
                    try {
                        let dirname = `${datestring}_${server._name}`;
                        let archivepath = path.join(this._archive, dirname);
                        let parksave = path.join(archivepath, 'park.sv6');

                        if ((await exists(archivepath))
                            || !!(await fsp.mkdir(archivepath))
                            || !(await server.SavePark(parksave))) {
                            result.status = 'bad';
                        }
                        else {

                            let thumbnail, largeimg;
                            try {
                                let values = await Promise.all([
                                    FileMan.DownloadPark(`http://${this._screenshotter}/upload`, parksave, archivepath, 'thumbnail'),
                                    FileMan.DownloadPark(`http://${this._screenshotter}/upload?zoom=0`, parksave, archivepath, 'fullsize'),
                                ]);
                                thumbnail = values[0];
                                largeimg = values[1];
                            }
                            catch (ex) {
                                console.log('Problem downloading thumbnail', ex);
                            }
                            this._db.AddPark({
                                name: server._name,
                                group: server._group,
                                gamemode: server._mode,
                                scenario: (await server.GetDetails()).park.name,
                                dir: dirname,
                                thumbnail,
                                largeimg
                            });
                        }
                    }
                    catch (ex) {
                        console.log(`Error saving ${server.name}`, ex);
                        result.status = 'bad';
                    }
                }
            }
            res.send(result);
        };

        app.get('/api/save/group/:group', async (req, res) => {
            await savegroup(req, res, true);
        });

        privateapp.get('/api/save/group/:group', async (req, res) => {
            await savegroup(req, res, false);
        });

        app.listen(port, () => console.log(`ffa-tycoon running on port ${port}`));
        privateapp.listen(privateport, () => console.log(`private backend running on port ${privateport}`));
    }

    InjectStatus = (obj, status) => {
        if (obj) {
            obj.status = status;
            return obj;
        }
        else {
            return {
                status: 'bad'
            };
        }
    }

    CheckTotp = (req) => {
        return 'body' in req && 'totp' in req.body && (new TOTP({ secret: this._totp })).validate({ token: req.body.totp, window: 2 }) !== null;
    }
}

module.exports = Web;