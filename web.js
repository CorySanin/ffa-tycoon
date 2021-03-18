const express = require('express');
const Helmet = require('helmet');
const bodyParser = require('body-parser');
const TOTP = require('otpauth').TOTP;
const moment = require('moment');
const FormData = require('form-data');
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const DB = require('./db');
const GameServer = require('./gameserver');
const FileMan = require('./fileMan');

const exists = async (filename) => {
    try {
        await fsp.access(filename);
        return true;
    }
    catch {
        return false;
    }
};

class Web {
    constructor(options = {}) {
        const app = express();
        // this._db = new DB(options.db);
        // const db = this._db;
        let port = process.env.PORT || options.port || 8080;
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

        //#region web endpoints

        app.get('/', (req, res) => {
            res.render('template',
                {
                    page: {
                        view: 'index',
                        title: 'Public OpenRCT2 Multiplayer Servers'
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

        app.get('/archive', (req, res) => {
            res.render('template',
                {
                    page: {
                        view: 'archive',
                        title: 'Previous Parks'
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

        //#endregion

        app.get('/api/save/group/:group', async (req, res) => {
            let group = req.params.group;
            let result = {
                status: 'bad'
            };
            if (this.CheckTotp(req) || process.env.TESTING || true) {
                let datestring = moment().format('YYYY-MM-DD_HH-mm-ss');
                result.status = 'ok';
                this._servers.filter(server => server._group == group).forEach(async server => {
                    try {
                        let dirname = path.join(this._archive, `${datestring}_${server._name}`);
                        let parksave = path.join(dirname, 'park.sv6');

                        if ((await exists(dirname))
                            || !!(await fsp.mkdir(dirname))
                            || !(await server.SavePark(parksave))) {
                            result.status = 'bad';
                        }
                        else {
                            const body = new FormData();
                            body.append('park', fs.createReadStream(parksave));

                            let thumbnail = await FileMan.DownloadImage(`http://${this._screenshotter}/upload`, {
                                method: 'POST',
                                body
                            }, dirname, 'thumbnail');
                        }
                    }
                    catch (ex) {
                        console.log(ex);
                    }
                });
                // TODO: get server info
                // TODO: insert in db
            }
            res.send(result);
        });

        app.listen(port, () => console.log(`ffa-tycoon running on port ${port}`));
    }

    CheckTotp = (req) => {
        return 'body' in req && 'totp' in req.body && (new TOTP({ secret: this._totp })).validate({ token: req.body.totp, window: 2 }) !== null;
    }
}

module.exports = Web;