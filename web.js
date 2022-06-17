const express = require('express');
const fileUpload = require('express-fileupload');
const Helmet = require('helmet');
const bodyParser = require('body-parser');
const prom = require('prom-client');
const moment = require('moment'); //TODO: replace moment
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const net = require('net');
const DB = require('./db');
const GameServer = require('./gameserver');
const FileMan = require('./fileMan');

const CSPNONCE = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const VIEWOPTIONS = {
    outputFunctionName: 'echo'
};

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
        const that = this;
        const app = express();
        const privateapp = express();
        const db = this._db = new DB(options.db);
        const port = process.env.PORT || options.port || 8080;
        const privateport = process.env.PRIVATEPORT || options.privateport || 8081;
        const pluginport = process.env.PLUGINPORT || options.pluginport || 35712;
        this._screenshotter = process.env.SCREENSHOTTER || options.screenshotter || 'screenshotterhost';
        this._archive = options.archivedir || 'storage/archive';
        this._servers = [];
        this._parktypes = [];
        this._prom = prom.register;

        (options.servers || []).forEach(serverinfo => {
            this._servers.push(new GameServer(serverinfo));
        });

        fsp.readdir(path.join(__dirname, 'parks'), { withFileTypes: true }).then(files => {
            for (const file of files) {
                if (file.isDirectory()) {
                    this._parktypes.push(file.name);
                }
            }
        }).catch(err => console.log(err));

        app.set('trust proxy', 1);
        app.set('view engine', 'ejs');
        app.set('view options', VIEWOPTIONS);
        app.use(Helmet());
        app.use(bodyParser.urlencoded({ extended: true }));
        app.use(bodyParser.json());

        privateapp.set('trust proxy', 1);
        privateapp.set('view engine', 'ejs');
        privateapp.set('view options', VIEWOPTIONS);
        privateapp.use(Helmet());
        privateapp.use(bodyParser.urlencoded({ extended: true }));
        privateapp.use(bodyParser.json());
        privateapp.use(fileUpload({
            createParentPath: true,
            abortOnLimit: true,
            limits: {
                fileSize: 100 * 1024 * 1024
            }
        }));

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
                        res.set('Content-Security-Policy', `default-src 'self'; connect-src 'self' *; script-src 'self' 'nonce-${nonce}'`);
                        res.send(html);
                    }
                    else {
                        res.send(err);
                    }
                });
        });

        app.get('/park/:park', (req, res) => {
            let park = db.GetPark(parseInt(req.params.park));
            if (park) {
                res.render('template',
                    {
                        page: {
                            view: 'park',
                            title: `Park #${req.params.park} - ${park.name} - ${park.groupname} ${park.gamemode} - ${(new Date(park.date)).toLocaleDateString()}`
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
            }
            else {
                res.status(404).send('404');
            }
        });

        app.get('/park/:park/viewer', (req, res) => {
            let park = db.GetPark(parseInt(req.params.park));
            if (park) {
                res.render('viewer',
                    {
                        page: {
                            title: `View Park #${req.params.park} - ${park.name} - ${park.groupname} ${park.gamemode} - ${(new Date(park.date)).toLocaleDateString()}`
                        },
                        park
                    },
                    function (err, html) {
                        if (!err) {
                            res.set('Content-Security-Policy', `default-src 'self'; connect-src 'self' *; script-src 'self'`);
                            res.send(html);
                        }
                        else {
                            res.send(err);
                        }
                    });
            }
            else {
                res.status(404).send('404');
            }
        });

        app.get('/rules', (req, res) => {
            res.render('template',
                {
                    page: {
                        view: 'rules-faq',
                        title: 'Server Rules & FAQ'
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

        privateapp.get('/', async (req, res) => {
            await Promise.all(this._servers.map(s => s.GetDetails(true)));
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

        privateapp.get('/server/:index', async (req, res) => {
            let serverindex = parseInt(req.params.index);
            if (serverindex < this._servers.length && serverindex >= 0) {
                let server = this._servers[serverindex];
                await server.GetDetails(true);
                res.render('admin/template',
                    {
                        page: {
                            view: 'server',
                            title: 'Server'
                        },
                        server
                    },
                    function (err, html) {
                        if (!err) {
                            res.send(html);
                        }
                        else {
                            res.status(500).send(err);
                        }
                    });
            }
            else {
                res.status(400).send('error');
            }
        });

        privateapp.get('/archive/:page?', (req, res) => {
            let page = Math.max(parseInt(req.params.page) || 1, 1);
            let order = {
                orderby: req.query.sort || req.query.orderby,
                order: (req.query.asc || req.query.order) === 'ASC'
            };
            let nonce = genNonceForCSP();
            res.render('admin/template',
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

        privateapp.get('/park/:park', async (req, res) => {
            let park = db.GetPark(parseInt(req.params.park));
            let files = [];
            try{
                files = await fsp.readdir(path.join(this._archive, park.dir), { withFileTypes: true });
                files = files.filter(f => (f.isFile() && f.name.toLowerCase().endsWith('.park'))).map(f => f.name).reverse();
            }
            catch(ex){
                console.error(ex);
            }
            if (park) {
                res.render('admin/template',
                    {
                        page: {
                            view: 'park',
                            title: `Park #${req.params.park} - ${park.name} - ${park.groupname} ${park.gamemode} - ${(new Date(park.date)).toLocaleDateString()}`
                        },
                        park,
                        files
                    },
                    function (err, html) {
                        if (!err) {
                            res.send(html);
                        }
                        else {
                            res.send(err);
                        }
                    });
            }
            else {
                res.status(404).send('404');
            }
        });

        app.get('/faq', (req, res) => {
            res.redirect('/rules#faq');
        });

        app.get('/submit-map', (req, res) => {
            res.redirect('https://github.com/CorySanin/ffa-tycoon-parks#park-submission-guide');
        });

        app.get('/discord/?', (req, res) => {
            res.redirect('https://discord.gg/QpztpR5QSH');
        });

        //#endregion

        app.get('/parks/:type/?', async (req, res) => {
            let type = req.params.type;
            if (this._parktypes.includes(type)) {
                let dir = path.join(__dirname, 'parks', type);
                let files = await fsp.readdir(dir);
                let file = files[Math.floor(Math.random() * files.length)];
                res.set('Content-Disposition', `attachment; filename="${file}"`);
                res.sendFile(path.join(dir, file), (err) => {
                    if (err) {
                        res.status(500).send('500 server error');
                        console.log(`Error sending park file: ${err}`);
                    }
                });
            }
            else {
                res.status(404).send('404');
            }
        });

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

        app.get('/api/park/:park/?', (req, res) => {
            res.send(this.InjectStatus(this._db.GetPark(parseInt(req.params.park) || 0), 'good'));
        });

        let getMissingImage = async (fullsize) => {
            let filename = fullsize ? 'fullsize' : 'thumbnail';
            let zoom = fullsize ? 0 : 3;
            let park = db.getMissingImage(fullsize);

            if (park) {
                let dirname = park.dir;
                let archivepath = path.join(this._archive, dirname);
                let parksave = path.join(archivepath, park.filename);
                let image = await FileMan.DownloadPark(`http://${this._screenshotter}/upload?zoom=${zoom}`, parksave, archivepath, filename);
                if (image) {
                    db.ReplaceImage(fullsize, park.id, image);
                }
            }
        }

        let saveServers = async (req, res, servers, ispublic = true) => {
            let result = {
                status: 'bad'
            };
            let status = 400;
            if (!ispublic) {
                let datestring = moment().format('YYYY-MM-DD_HH-mm-ss');
                result.status = 'ok';
                status = 200;

                for (const serverindx in servers) {
                    const server = servers[serverindx];
                    let filename = false;
                    let dirname = `${datestring}_${server._name}`;
                    if (server._id) {
                        dirname = (await db.GetPark(server._id)).dir;
                    }
                    let archivepath = path.join(this._archive, dirname);
                    try {
                        if (server._id || (!(await exists(archivepath))
                            && !(await fsp.mkdir(archivepath)))) {
                            for (let i = 0; i < 2; i++) {
                                filename = await server.SavePark(archivepath);
                                if (filename) {
                                    break;
                                }
                            }
                            if (!filename && !server._id) {
                                await fsp.rm(archivepath, { recursive: true, force: true });
                            }
                        }
                    }
                    catch (ex) {
                        console.log(`Error saving ${server.name}`, ex);
                        filename = false;
                    }
                    if (!filename) {
                        result.status = 'bad';
                        status = 500;
                    }
                    else if (server._id) {
                        db.ChangeFileName(server._id, filename);
                        db.UpdateDate(server._id);
                        db.RemoveImages(server._id);
                    }
                    else {
                        let result = this._db.AddPark({
                            name: server._name,
                            group: server._group,
                            gamemode: server._mode,
                            scenario: (await server.GetDetails()).park.name,
                            dir: dirname,
                            filename
                        });
                        server._id = result.lastInsertRowid;
                    }
                }
            }
            if (res) {
                res.status(status).send(result);
            }
        };

        app.get('/api/group/save/:group', async (req, res) => {
            await saveServers(req, res, this._servers.filter(server => server._group == req.params.group), true);
        });

        privateapp.get('/api/group/save/:group', async (req, res) => {
            await saveServers(req, res, this._servers.filter(server => server._group == req.params.group), false);
        });

        privateapp.get('/api/group/:group/save', async (req, res) => {
            await saveServers(req, res, this._servers.filter(server => server._group == req.params.group), false);
        });

        app.get('/api/server/?', async (req, res) => {
            await Promise.all(this._servers.map(s => s.GetDetails()));
            res.status(200).send({
                servers: this._servers.map(s => {
                    let details = s._details || {};
                    return {
                        server: {
                            name: s._name,
                            group: s._group,
                            mode: s._mode
                        },
                        park: details.park,
                        network: {
                            players: ((details.network || {}).players || []).map(p => p.id)
                        }
                    };
                })
            });
        });

        privateapp.get('/api/server/:server/save', async (req, res) => {
            let servernum = parseInt(req.params.server);
            if (servernum >= 0 && servernum < this._servers.length) {
                await saveServers(req, res, [this._servers[servernum]], false);
            }
            else {
                res.status(400).send({
                    status: 'bad'
                });
            }
        });

        privateapp.get('/api/group/:group/stop', async (req, res) => {
            const servers = this._servers.filter(server => server._group == req.params.group);
            let result = {
                status: 'ok'
            };
            let status = 200;
            if (servers.length > 0) {
                for (const serverindx in servers) {
                    const server = servers[serverindx];
                    try {
                        server.Execute('stop');
                        server._id = null;
                    }
                    catch (ex) {
                        console.log(`Error stopping server: ${ex}`);
                        result = {
                            status: 'bad'
                        };
                        status = 500;
                    }
                }
            }
            else {
                result = {
                    status: 'bad'
                };
                status = 400;
            }
            res.status(status).send(result);
        });

        privateapp.get('/api/server/:server/stop', async (req, res) => {
            let servernum = parseInt(req.params.server);
            let result = {
                status: 'ok'
            };
            let status = 200;
            if (servernum >= 0 && servernum < this._servers.length) {
                const server = this._servers[servernum];
                try {
                    server.Execute('stop');
                    server._id = null;
                }
                catch (ex) {
                    console.log(`Error stopping server: ${ex}`);
                    result = {
                        status: 'bad'
                    };
                    status = 500;
                }
            }
            else {
                result = {
                    status: 'bad'
                };
                status = 400;
            }
            res.status(status).send(result);
        });

        privateapp.post('/api/park/:park/save', async (req, res) => {
            let park = db.GetPark(parseInt(req.params.park));
            let message = req.body;
            let result = {
                status: 'bad'
            };
            let status = 400;

            if (park) {
                if (req.body.action === 'select' && 'file' in message) {
                    db.ChangeFileName(park.id, message.file);
                    db.RemoveImages(park.id);
                    result.status = 'ok';
                    status = 200;
                }
                else if (req.body.action === 'rm' && 'file' in message && message.file !== park.filename) {
                    try {
                        await fsp.unlink(path.join(this._archive, park.dir, message.file));
                        result.status = 'ok';
                        status = 200;
                    }
                    catch (ex) {
                        console.error(`Failed to remove save: ${ex}`);
                    }
                }
                else if (req.body.action === 'rm-all') {
                    let files = await fsp.readdir(path.join(this._archive, park.dir), { withFileTypes: true });
                    files = files.filter(f => f.isFile() && f.name.toLowerCase().endsWith('.park') && f.name !== park.filename);
                    let promises = [];
                    files.forEach(f => promises.push(fsp.unlink(path.join(this._archive, park.dir, f.name))));
                    try {
                        await Promise.all(promises);
                        result.status = 'ok';
                        status = 200;
                    }
                    catch (ex) {
                        console.error(`Failed to remove all non-selected saves: ${ex}`);
                    }
                }
            }
            res.status(status).send(result);
        });

        privateapp.post('/api/group/:group/send', async (req, res) => {
            const message = req.body.message;
            const servers = this._servers.filter(server => server._group == req.params.group);
            let result = {
                status: 'ok'
            };
            let status = 200;
            if (servers.length > 0) {
                for (const serverindx in servers) {
                    const server = servers[serverindx];
                    try {
                        if (!(await server.Execute(`say ${message}`)).result) {
                            result.status = 'bad';
                            status = 500;
                        }
                    }
                    catch (ex) {
                        console.log(`Error sending messages: ${ex}`);
                        result = {
                            status: 'bad'
                        };
                        status = 500;
                    }
                }
            }
            else {
                result = {
                    status: 'bad'
                };
                status = 400;
            }
            res.status(status).send(result);
        });

        privateapp.post('/api/server/:server/send', async (req, res) => {
            let server = parseInt(req.params.server);
            let message = req.body.message;
            let result = {
                status: 'bad'
            };
            let status = 400;

            if (server < this._servers.length && server >= 0 && message) {
                if ((await this._servers[server].Execute(`say ${message}`)).result) {
                    result.status = 'ok';
                    status = 200;
                }
            }
            res.status(status).send(result);
        });

        privateapp.post('/api/server/:server/player/:player', async (req, res) => {
            let server = parseInt(req.params.server);
            let player = req.params.player
            let result = {
                status: 'bad'
            };
            let status = 400;

            if (server < this._servers.length && server >= 0) {
                if (req.body.action === 'update') {
                    if ((await this._servers[server].Execute(`update player ${player} ${req.body.properties.group}`)).result) {
                        result.status = 'ok';
                        status = 200;
                    }
                }
                else if (req.body.action === 'kick') {
                    if ((await this._servers[server].Execute(`kick ${player}`)).result) {
                        result.status = 'ok';
                        status = 200;
                    }
                }
            }
            res.status(status).send(result);
        });

        privateapp.put('/api/park/:park/?', async (req, res) => {
            try {
                let parkentry = db.GetPark(parseInt(req.params.park));

                if (!parkentry || !req.files || !req.files.park) {
                    res.status(400).send({
                        status: 'bad'
                    });
                }
                else {
                    let park = req.files.park;
                    let filenameold = parkentry.filename;
                    let fullpathold = path.join(this._archive, parkentry.dir, filenameold);
                    let fextsep = park.name.lastIndexOf('.');
                    let fext = park.name.substring(fextsep, park.name.length);
                    let filenamenew = park.name.substring(0, Math.min(fextsep, 25)) + fext;
                    let fullpathnew = path.join(this._archive, parkentry.dir, filenamenew);
                    await fsp.unlink(fullpathold);

                    let files = await fsp.readdir(path.join(this._archive, parkentry.dir), { withFileTypes: true });
                    files = files.filter(f => f.isFile() && f.name.toLowerCase().endsWith('.park'));
                    let promises = [];
                    files.forEach(f => promises.push(fsp.unlink(path.join(this._archive, parkentry.dir, f.name))));
                    try {
                        await Promise.all(promises);
                    }
                    catch (ex) {
                        console.error(`Failed to remove all saves while uploading: ${ex}`);
                    }

                    await park.mv(fullpathnew);

                    db.ChangeFileName(parkentry.id, filenamenew);
                    db.RemoveImages(parkentry.id);

                    res.send({
                        status: 'ok'
                    });
                }
            }
            catch (ex) {
                console.log(ex);
                res.status(500).send({
                    status: 'bad'
                });
            }
        });

        privateapp.delete('/api/park/:park/?', async (req, res) => {
            try {
                let parkentry = db.GetPark(parseInt(req.params.park));
                await (fsp.rm || fsp.rmdir)(path.join(this._archive, parkentry.dir), {
                    force: true,
                    maxRetries: 4,
                    recursive: true
                });
                db.DeletePark(parseInt(parkentry.id));

                res.send({
                    status: 'ok'
                });
            }
            catch (ex) {
                console.log(ex);
                res.status(500).send({
                    status: 'bad'
                });
            }
        });

        privateapp.get('/metrics', async (req, res) => {
            try {
                await Promise.all(this._servers.map(s => s.GetDetails(true)));
                res.set('Content-Type', this._prom.contentType);
                res.end(await this._prom.metrics());
            }
            catch (ex) {
                res.status(500).send(ex);
            }
        });

        prom.collectDefaultMetrics({
            prefix: 'ffatycoon_'
        });

        this._metrics = {
            guests: new prom.Gauge({
                name: 'ffatycoon_park_guests_count',
                help: 'Number of park guests',
                labelNames: ['server'],
                collect() {
                    that._servers.forEach(s => {
                        let details = s.GetDetailsSync();
                        if (details && details.park) {
                            this.set({ server: s._name }, details.park.guests);
                        }
                    });
                }
            }),
            rating: new prom.Gauge({
                name: 'ffatycoon_park_rating',
                help: 'The park rating',
                labelNames: ['server'],
                collect() {
                    that._servers.forEach(s => {
                        let details = s.GetDetailsSync();
                        if (details && details.park) {
                            this.set({ server: s._name }, details.park.rating);
                        }
                    });
                }
            }),
            online: new prom.Gauge({
                name: 'ffatycoon_server_online',
                help: 'The number of players connected',
                labelNames: ['server'],
                collect() {
                    that._servers.forEach(s => {
                        let details = s.GetDetailsSync();
                        if (details && details.network && details.network.players) {
                            this.set({ server: s._name }, details.network.players.length - 1);
                        }
                    });
                }
            })
        };

        let imagetype = true;
        if (this._screenshotter) {
            setInterval(() => {
                getMissingImage(imagetype = !imagetype);
            }, 1 * 60 * 1000);
        }

        app.use('/assets/', express.static('assets'));
        app.use('/archive/', express.static(this._archive));

        privateapp.use('/', app);

        let pluginserver = new net.Server();
        pluginserver.on('connection', async sock => {
            let addr = sock.remoteAddress;
            let server = null;
            for (let s in this._servers) {
                let srv = this._servers[s];
                if (addr.includes(await srv.GetIP())) {
                    server = srv;
                    break;
                }
            }
            if (server) {
                sock.on('data', async data => {
                    let payload = JSON.parse(data);
                    if (payload.type === 'newpark') {
                        server._id = null;
                        sock.write(JSON.stringify({
                            msg: 'done'
                        }));
                    }
                    else if (payload.type === 'archive') {
                        if('id' in payload && payload.id >= 0){
                            server._id = payload.id;
                        }
                        await saveServers(null, null, [server], false);
                        sock.write(JSON.stringify({
                            id: server._id,
                            msg: 'done'
                        }));
                    }
                });
            }
            else {
                console.error(`Got a plugin connection from unknown IP ${addr}`);
                sock.close();
            }
        });

        this._webserver = app.listen(port, () => console.log(`ffa-tycoon running on port ${port}`));
        this._privwebserver = privateapp.listen(privateport, () => console.log(`private backend running on port ${privateport}`));
        this._pluginsocket = pluginserver.listen(pluginport, () => console.log(`plugin server listening on port ${pluginport}`));
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

    close() {
        this._webserver.close();
        this._privwebserver.close();
        this._pluginsocket.close();
    }
}

module.exports = Web;