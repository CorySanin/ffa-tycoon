const express = require('express');
const Helmet = require('helmet');
const bodyParser = require('body-parser');
const net = require('net');
const TOTP = require('otpauth').TOTP;
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const DB = require('./db');
const { time } = require('console');
//const { resolve } = require('path');

const REMOTEPORT = 35711;

class Web {
    constructor(options = {}) {
        const app = express();
        // this._db = new DB(options.db);
        // const db = this._db;
        this._totp = process.env.totp || options.totp || '';
        this._servers = options.servers || [];
        let port = process.env.PORT || options.port || 8080;

        app.set('trust proxy', 1);
        app.set('view engine', 'ejs');
        app.use(Helmet());
        app.use(bodyParser.urlencoded({ extended: true }));
        app.use(bodyParser.json());
        app.use('/assets/', express.static('assets'));
        app.use('/storage/archive/', express.static('archive'));

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

        app.get('/api/save', async (req, res) => {
            let result = {
                status: 'bad'
            };
            if (this.CheckTotp(req) || process.env.TESTING) {
                await this.Execute(this._servers[0].hostname, this._servers[0].port || REMOTEPORT, 'save park');
                if(await this.WaitForFile(path.join(this._servers[0].dir, 'save', 'park.sv6'))){
                    console.log('found file!')
                    result.status = 'ok';

                    // TODO: get server info
                    // TODO: get screenshot
                }
            }
            res.send(result);
        });

        app.listen(port, () => console.log(`ffa-tycoon running on port ${port}`));
    }

    CheckTotp = (req) => {
        return 'body' in req && 'totp' in req.body && (new TOTP({ secret: this._totp })).validate({ token: req.body.totp, window: 2 }) !== null;
    }

    Execute = (server, port, command) => {
        return new Promise((resolve, reject) => {
            var client = new net.Socket();
            client.connect(port, server, function () {
                client.write(typeof command === 'object' ? JSON.stringify(command) : command);
            });

            client.on('data', function (data) {
                console.log('Received: ' + data);
                resolve(JSON.parse(data));
                client.destroy();
            });

            client.on('close', function () {
                console.log('Connection closed');
                resolve(null);
            });
        });
    }

    FileExists = (filename) => {
        return new Promise(async (resolve) => {
            try{
                await fsp.access(filename)
                resolve(true)
            }
            catch{
                resolve(false);
            }
        });
    }

    WaitForFile = (filename, timeout = 3000) => {
        return new Promise(async (resolve) => {
            let dirname = path.dirname(filename);
            let watcher = fs.watch(dirname);
            if(await this.FileExists(filename)){
                watcher.close();
                resolve(true);
            }
            else{
                let t = setTimeout(() => {
                    watcher.close();
                    resolve(false);
                }, timeout);
                watcher.on('change', async () => {
                    let match = await this.FileExists(filename);
                    if(match){
                        clearTimeout(t);
                        watcher.close();
                        resolve(true);
                    }
                });
            }
        });
    }
}

module.exports = Web;