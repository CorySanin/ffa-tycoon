import express from 'express';
import fileUpload from 'express-fileupload';
import Helmet from 'helmet';
import bodyParser from 'body-parser';
import prom from 'prom-client';
import dayjs from 'dayjs';
import crypto from 'crypto';
import path from 'path';
import fsp from 'fs/promises';
import net from 'net';
import { DbAdapter } from './dbAdapter.ts';
import GameServer from './gameserver.ts';
import * as FileMan from './fileMan.ts';
import Vpnapi from './vpnapi.ts';
import type { AdapterOptions } from './dbAdapter.ts';
import type { VpnapiOptions } from './vpnapi.ts';
import type { ServerDefinition, ServerDetails } from './gameserver.ts';

const VIEWOPTIONS = {
    outputFunctionName: 'echo'
};

function standardizeMapName(name: string) {
    return name.split('.')[0].split('-')[0].toLowerCase();
}

interface WebOptions extends VpnapiOptions {
    port: number;
    privateport: number;
    pluginport: number;
    publicurl: string;
    motd: string;
    screenshotter: string;
    archivedir: string;
    db: Partial<AdapterOptions>;
    servers: ServerDefinition[];
}

class Web {
    private db: DbAdapter;
    private servers: GameServer[];
    private prom: prom.Registry;
    private screenshotter: string;
    private archive: string;
    private parktypes: string[];
    private parklists: { [type: string]: string[]; };

    constructor(options: Partial<WebOptions> = {}) {
        const that = this;
        const app = express();
        const privateapp = express();
        const vpnapi = new Vpnapi(options);
        const db = this.db = new DbAdapter(options.db);
        const port = process.env.PORT || options.port || 8080;
        const privateport = process.env.PRIVATEPORT || options.privateport || 8081;
        const pluginport = process.env.PLUGINPORT || options.pluginport || 35712;
        const publicurl = process.env.PUBLICURL || options.publicurl || '';
        const defaultMotd = process.env.MOTD || options.motd || null;
        this.screenshotter = process.env.SCREENSHOTTER || options.screenshotter || 'screenshotterhost';
        this.archive = options.archivedir || 'storage/archive';
        this.servers = [];
        this.parktypes = [];
        this.parklists = {};
        this.prom = prom.register;

        (options.servers || []).forEach(serverinfo => {
            serverinfo.motd = (serverinfo.motd === undefined) ? defaultMotd : serverinfo.motd;
            this.servers.push(new GameServer(serverinfo));
        });

        fsp.readdir(path.join(__dirname, 'parks'), { withFileTypes: true }).then(files => {
            for (const file of files) {
                if (file.isDirectory()) {
                    this.parktypes.push(file.name);
                    this.parklists[file.name] = [];
                }
            }
        }).catch(err => console.log(err)).then(this.UpdateAllParkLists).then(() => {
            this.parktypes.forEach(type => {
                app.get(`/${type}`, (_, res) => {
                    res.redirect(`https://github.com/CorySanin/ffa-tycoon-parks/tree/master/parks/${type}`);
                });
            });
        });
        setInterval(this.UpdateAllParkLists, 21600000);

        app.set('trust proxy', 1);
        app.set('view engine', 'ejs');
        app.set('view options', VIEWOPTIONS);
        app.use(Helmet({
            contentSecurityPolicy: false
        }));
        app.use(bodyParser.urlencoded({ extended: true }));
        app.use(bodyParser.json());
        app.use((_req, res, next) => {
            crypto.randomBytes(32, (err, randomBytes) => {
                if (err) {
                    console.error(err);
                    next(err);
                } else {
                    res.locals.cspNonce = randomBytes.toString("hex");
                    next();
                }
            });
        });

        privateapp.set('trust proxy', 1);
        privateapp.set('view engine', 'ejs');
        privateapp.set('view options', VIEWOPTIONS);
        privateapp.use(Helmet({
            contentSecurityPolicy: false
        }));
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
            await Promise.all(this.servers.map(s => s.GetDetails()));
            res.render('template',
                {
                    page: {
                        view: 'index',
                        title: 'Public OpenRCT2 Multiplayer Servers'
                    },
                    site: {
                        description: 'Join our free-for-all OpenRCT2 servers today and start building with other players immediately! No Discord verification required.'
                    },
                    servers: this.servers
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
            res.render('template',
                {
                    page: {
                        view: 'archive',
                        title: 'Previous Parks'
                    },
                    site: {
                        description: `Discover past parks here. Page ${page}.`
                    },
                    order,
                    pagenum: page
                },
                function (err, html) {
                    if (!err) {
                        res.set('Content-Security-Policy', `default-src 'self'; connect-src 'self' *; script-src 'self' 'nonce-${res.locals.cspNonce}'`);
                        res.send(html);
                    }
                    else {
                        res.send(err);
                    }
                });
        });

        app.get('/park/:park', async (req, res) => {
            let park = await db.getPark(parseInt(req.params.park));
            if (park) {
                res.render('template',
                    {
                        page: {
                            view: 'park',
                            title: `Park #${req.params.park} - ${park.name} - ${park.groupname} ${park.gamemode} - ${(new Date(park.date)).toLocaleDateString()}`
                        },
                        site: {
                            description: `Archived park saved on ${(new Date(park.date)).toLocaleDateString()}. Scenario ${park.scenario} in ${park.gamemode} mode, on ${park.name}.`,
                            socialimage: `${publicurl}/archive/${park.dir}/${park.thumbnail || park.largeimg}`
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

        app.get('/park/:park/viewer', async (req, res) => {
            let park = await db.getPark(parseInt(req.params.park));
            if (park) {
                res.render('viewer',
                    {
                        page: {
                            title: `View Park #${req.params.park} - ${park.name} - ${park.groupname} ${park.gamemode} - ${(new Date(park.date)).toLocaleDateString()}`
                        },
                        site: {
                            description: `Preview the save for ${park.scenario} in ${park.gamemode} mode, on ${park.name}. Screenshotted on ${(new Date(park.date)).toLocaleDateString()}`,
                            socialimage: `${publicurl}/archive/${park.dir}/${park.thumbnail || park.largeimg}`
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

        app.get('/rules', (req, res) => {
            res.render('template',
                {
                    page: {
                        view: 'rules-faq',
                        title: 'Server Rules & FAQ'
                    },
                    site: {
                        description: `Rules and FAQ's for the FFA-Tycoon OpenRCT2 multiplayer servers.`
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
                    },
                    site: {
                        description: `How to set up an OpenRCT2 server. A complete guide with troubleshooting suggestions. Easy method.`
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
            await Promise.all(this.servers.map(s => s.GetDetails(true)));
            res.render('admin/template',
                {
                    page: {
                        view: 'index',
                        title: 'Home'
                    },
                    servers: this.servers
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
            if (serverindex < this.servers.length && serverindex >= 0) {
                let server = this.servers[serverindex];
                await server.GetDetails(true);
                res.render('admin/template',
                    {
                        page: {
                            view: 'server',
                            title: 'Server'
                        },
                        server,
                        publicurl
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
            res.render('admin/template',
                {
                    page: {
                        view: 'archive',
                        title: 'Previous Parks'
                    },
                    order,
                    pagenum: page
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

        privateapp.get('/park/:park', async (req, res) => {
            let park = await db.getPark(parseInt(req.params.park));
            let files = [];
            try {
                files = await fsp.readdir(path.join(this.archive, park.dir), { withFileTypes: true });
                files = files.filter(f => (f.isFile() && f.name.toLowerCase().endsWith('.park'))).map(f => f.name).reverse();
            }
            catch (ex) {
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
                        files,
                        publicurl
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
            if (this.parktypes.includes(type)) {
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

        app.get('/load/:index/?', async (req, res) => {
            let serverindex = parseInt(req.params.index);
            if (serverindex < this.servers.length && serverindex >= 0) {
                let server = this.servers[serverindex];
                let type = server.GetMode() === 'free for all economy' ? 'economy' : 'sandbox';
                let restore = server.GetParkSave();
                let filename;
                let fullPath;
                if (restore !== null) {
                    let park = restore.file;
                    filename = park.split('/');
                    filename = filename.length ? filename[filename.length - 1] : 'err.park';
                    fullPath = path.join(this.archive, park);

                    // TODO: remove in later release:
                    server._id = restore.id;
                    server.SetLoadedPark(null);
                }
                else {
                    let park = server.TallyVotes(that.parklists[type]);
                    filename = `${park}-${type}.park`;
                    fullPath = path.join('parks', type, filename);
                }
                res.set('Content-Disposition', `attachment; filename="${filename}"`);
                res.sendFile(fullPath, {
                    root: __dirname
                }, (err) => {
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

        app.get('/api/healthcheck', (req, res) => {
            res.send('Healthy');
        });

        app.get('/api/parks/count', (req, res) => {
            res.send(this.InjectStatus(this.db.getParkCount(), 'good'));
        });

        app.get('/api/parks/:page?', async (req, res) => {
            const count = await this.db.getParkCount();
            const pages = await this.db.getMonthsSinceOldest();
            const page = Math.max(Math.min(parseInt(req.params.page) || 1, pages), 1);
            res.send({
                status: 'good',
                page,
                parks: this.db.getParks(page),
                count,
                pages
            });
        });

        app.get('/api/park/:park/?', (req, res) => {
            res.send(this.InjectStatus(this.db.getPark(parseInt(req.params.park) || 0), 'good'));
        });

        let getMissingImage = async (fullsize) => {
            let filename = fullsize ? 'fullsize' : 'thumbnail';
            let zoom = fullsize ? 0 : 3;
            let park = await db.getMissingImage(fullsize);

            if (park) {
                let dirname = park.dir;
                let archivepath = path.join(this.archive, dirname);
                let parksave = path.join(archivepath, park.filename);
                let image = await FileMan.DownloadPark(`http://${this._screenshotter}/upload?zoom=${zoom}`, parksave, archivepath, filename);
                if (image) {
                    db.replaceImage(fullsize, park.id, true);
                }
            }
        }

        let saveServers = async (req, res, servers, ispublic = true) => {
            let result = {
                status: 'bad'
            };
            let status = 400;
            if (!ispublic) {
                let datestring = dayjs().format('YYYY-MM-DD_HH-mm-ss');
                result.status = 'ok';
                status = 200;

                for (const serverindx in servers) {
                    const server = servers[serverindx];
                    let filename: string | false = false;
                    let dirname = `${datestring}_${server._name}`;
                    if (server._id) {
                        dirname = (await db.getPark(server._id)).dir;
                    }
                    let archivepath = path.join(this.archive, dirname);
                    try {
                        if (server._id || (!(await FileMan.FileExists(archivepath))
                            && (await FileMan.mkdir(archivepath)))) {
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
                        db.changeFileName(server._id, filename);
                        db.updateDate(server._id);
                        db.removeImages(server._id);
                    }
                    else {
                        let result = this.db.addPark({
                            name: server._name,
                            group: server._group,
                            gamemode: server._mode,
                            scenario: (await server.GetDetails()).park.name,
                            dir: dirname,
                            filename
                        });
                        server.id = result.lastInsertRowid;
                    }
                }
            }
            if (res) {
                res.status(status).send(result);
            }
        };

        privateapp.get('/api/group/save/:group', async (req, res) => {
            await saveServers(req, res, this.servers.filter(server => server.GetGroup() == req.params.group), false);
        });

        privateapp.get('/api/group/:group/save', async (req, res) => {
            await saveServers(req, res, this.servers.filter(server => server.GetGroup() == req.params.group), false);
        });

        app.get('/api/server/?', async (req, res) => {
            await Promise.all(this.servers.map(s => s.GetDetails()));
            res.status(200).send({
                servers: this.servers.map(s => {
                    const details = s.GetDetailsSync() || {} as ServerDetails;
                    return {
                        server: {
                            name: s.GetName(),
                            group: s.GetGroup(),
                            mode: s.GetMode()
                        },
                        park: details?.park,
                        network: {
                            players: ((details.network || {}).players || []).map(p => p.id)
                        }
                    };
                })
            });
        });

        privateapp.get('/api/server/:server/save', async (req, res) => {
            let servernum = parseInt(req.params.server);
            if (servernum >= 0 && servernum < this.servers.length) {
                await saveServers(req, res, [this.servers[servernum]], false);
            }
            else {
                res.status(400).send({
                    status: 'bad'
                });
            }
        });

        privateapp.get('/api/group/:group/stop', async (req, res) => {
            const servers = this.servers.filter(server => server.GetGroup() == req.params.group);
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
            if (servernum >= 0 && servernum < this.servers.length) {
                const server = this.servers[servernum];
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

        privateapp.get('/api/park/:park/?', async (req, res) => {
            let park = await db.getPark(parseInt(req.params.park));
            let result = {
                status: 'bad'
            };
            let status = 400;

            if (park) {
                status = 200;
                result = park;
                result.files = (await fsp.readdir(path.join(this._archive, park.dir), { withFileTypes: true }))
                    .filter(f => f.isFile() && f.name.toLowerCase().endsWith('.park'));
                result.status = 'ok';
            }
            res.status(status).send(result);
        });

        privateapp.put('/api/park/:park/?', async (req, res) => {
            try {
                let parkentry = db.getPark(parseInt(req.params.park));

                if (!parkentry || !req.files || !req.files.park) {
                    res.status(400).send({
                        status: 'bad'
                    });
                }
                else {
                    let park = req.files.park;
                    let filenameold = parkentry.filename;
                    let fullpathold = path.join(this.archive, parkentry.dir, filenameold);
                    let fextsep = park.name.lastIndexOf('.');
                    let fext = park.name.substring(fextsep, park.name.length);
                    let filenamenew = park.name.substring(0, Math.min(fextsep, 25)) + fext;
                    let fullpathnew = path.join(this.archive, parkentry.dir, filenamenew);
                    await fsp.unlink(fullpathold);

                    let files = await fsp.readdir(path.join(this.archive, parkentry.dir), { withFileTypes: true });
                    files = files.filter(f => f.isFile() && f.name.toLowerCase().endsWith('.park'));
                    let promises = [];
                    files.forEach(f => promises.push(fsp.unlink(path.join(this.archive, parkentry.dir, f.name))));
                    try {
                        await Promise.all(promises);
                    }
                    catch (ex) {
                        console.error(`Failed to remove all saves while uploading: ${ex}`);
                    }

                    await park.mv(fullpathnew);

                    db.changeFileName(parkentry.id, filenamenew);
                    db.removeImages(parkentry.id);

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
                let parkentry = db.getPark(parseInt(req.params.park));
                await (fsp.rm || fsp.rmdir)(path.join(this.archive, parkentry.dir), {
                    force: true,
                    maxRetries: 4,
                    recursive: true
                });
                db.deletePark(parseInt(parkentry.id));

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

        privateapp.post('/api/park/:park/save', async (req, res) => {
            let park = db.getPark(parseInt(req.params.park));
            let message = req.body;
            let result = {
                status: 'bad'
            };
            let status = 400;

            if (park) {
                if (req.body.action === 'select' && 'file' in message) {
                    db.changeFileName(park.id, message.file);
                    db.removeImages(park.id);
                    result.status = 'ok';
                    status = 200;
                }
                else if (req.body.action === 'rm' && 'file' in message && message.file !== park.filename) {
                    try {
                        await fsp.unlink(path.join(this.archive, park.dir, message.file));
                        result.status = 'ok';
                        status = 200;
                    }
                    catch (ex) {
                        console.error(`Failed to remove save: ${ex}`);
                    }
                }
                else if (req.body.action === 'rm-all') {
                    let files = await fsp.readdir(path.join(this.archive, park.dir), { withFileTypes: true });
                    files = files.filter(f => f.isFile() && f.name.toLowerCase().endsWith('.park') && f.name !== park.filename);
                    let promises = [];
                    files.forEach(f => promises.push(fsp.unlink(path.join(this.archive, park.dir, f.name))));
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
            const servers = this.servers.filter(server => server._group == req.params.group);
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

            if (server < this.servers.length && server >= 0 && message) {
                if ((await this.servers[server].Execute(`say ${message}`)).result) {
                    result.status = 'ok';
                    status = 200;
                }
            }
            res.status(status).send(result);
        });

        privateapp.post('/api/server/:server/staff', async (req, res) => {
            let server = parseInt(req.params.server);
            let type = req.body.type;
            let amount = parseInt(req.body.amount || 1);
            let result = {
                status: 'bad'
            };
            let status = 400;

            if (server < this.servers.length && server >= 0 && type && !isNaN(amount) && amount > 0) {
                if ((await this.servers[server].Execute(`hire ${type} ${amount}`)).result) {
                    result.status = 'ok';
                    status = 200;
                }
            }
            res.status(status).send(result);
        });

        privateapp.post('/api/server/:server/cheat', async (req, res) => {
            let server = parseInt(req.params.server);
            let payload = req.body.params;
            let result = {
                status: 'bad'
            };
            let status = 400;

            if (server < this.servers.length && server >= 0 && payload) {
                try {
                    if ((await this.servers[server].Execute(`cheat ${payload}`)).result) {
                        result.status = 'ok';
                        status = 200;
                    }
                }
                catch (ex) {
                    console.error(ex);
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

            if (server < this.servers.length && server >= 0) {
                if (req.body.action === 'update') {
                    if ((await this.servers[server].Execute(`update player ${player} ${req.body.properties.group}`)).result) {
                        result.status = 'ok';
                        status = 200;
                    }
                }
                else if (req.body.action === 'kick') {
                    if ((await this.servers[server].Execute(`kick ${player}`)).result) {
                        result.status = 'ok';
                        status = 200;
                    }
                }
            }
            res.status(status).send(result);
        });

        privateapp.post('/api/server/:server/load', async (req, res) => {
            let server = parseInt(req.params.server);
            let body = req.body;
            let result = {
                status: 'bad'
            };
            let status = 400;
            if (server < this.servers.length && server >= 0 && body.file) {
                this.servers[server].SetLoadedPark(body);
                status = 200;
                result.status = 'ok';
            }
            res.status(status).send(result);
        });

        privateapp.post('/api/ip', async (req, res) => {
            const bad = {
                status: 'bad'
            };
            if (req.body.ip) {
                let info = await vpnapi.get(req.body.ip);
                if (info) {
                    info.status = 'ok';
                    res.status(200).send(info);
                }
                else {
                    res.status(500).send(bad);
                }
            }
            else {
                res.status(400).send(bad);
            }
        });

        privateapp.get('/metrics', async (req, res) => {
            try {
                await Promise.all(this.servers.map(s => s.GetDetails(true)));
                res.set('Content-Type', this.prom.contentType);
                res.end(await this.prom.metrics());
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
                    that.servers.forEach(s => {
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
                    that.servers.forEach(s => {
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
                    that.servers.forEach(s => {
                        let details = s.GetDetailsSync();
                        if (details && details.network && details.network.players) {
                            this.set({ server: s._name }, details.network.players.length - 1);
                        }
                    });
                }
            })
        };

        let imagetype = true;
        if (this.screenshotter) {
            setInterval(() => {
                getMissingImage(imagetype = !imagetype);
            }, 1 * 60 * 1000);
        }

        app.use('/assets/', express.static('assets'));
        app.use('/archive/', express.static(this.archive));

        privateapp.use('/', app);

        let pluginserver = new net.Server();
        pluginserver.on('connection', async sock => {
            let addr = sock.remoteAddress;
            let server = null;
            for (let s in this.servers) {
                let srv = this.servers[s];
                if (addr.includes(await srv.GetIP())) {
                    server = srv;
                    break;
                }
            }
            if (server) {
                sock.on('data', async data => {
                    let payload = JSON.parse(data.toString());
                    if (payload.type === 'newpark') {
                        server.NewPark();
                        sock.write(JSON.stringify({
                            msg: 'done'
                        }));
                    }
                    else if (payload.type === 'loadpark') {
                        server._id = payload.id > -1 ? payload.id : (server.LoadParkSave() || { id: null }).id;
                        server.SetLoadedPark(null);
                        sock.write(JSON.stringify({
                            msg: 'done',
                            id: server._id
                        }));
                    }
                    else if (payload.type === 'archive') {
                        if ('id' in payload && payload.id >= 0) {
                            server._id = payload.id;
                        }
                        await saveServers(null, null, [server], false);
                        sock.write(JSON.stringify({
                            id: server._id,
                            msg: 'done'
                        }));
                    }
                    else if (payload.type === 'motd') {
                        sock.write(JSON.stringify({
                            id: server._id,
                            msg: await server.GetMOTD()
                        }));
                    }
                    else if (payload.type === 'vote') {
                        let type = server._mode === 'free for all economy' ? 'economy' : 'sandbox';
                        let map = standardizeMapName(payload.map || '').replaceAll(' ', '_');
                        if (map && map.length > 0) {
                            let possibleMatches = that.parklists[type].filter(p => p.startsWith(map));
                            if (possibleMatches.length == 1) {
                                server.CastVote(payload.identifier || 'null', possibleMatches[0]);
                                sock.write(JSON.stringify({
                                    msg: `vote for ${possibleMatches[0]} cast`
                                }));
                            }
                            else if (possibleMatches.length == 0) {
                                sock.write(JSON.stringify({
                                    msg: `${map} is not a valid map. Go to ffa-tycoon.com/${type} for the map list.`
                                }));
                            }
                            else {
                                sock.write(JSON.stringify({
                                    msg: `Multiple maps found: ${possibleMatches.join(', ')}`
                                }));
                            }
                        }
                        else {
                            sock.write(JSON.stringify({
                                msg: `That is not a valid map. Go to ffa-tycoon.com/${type} for the map list.`
                            }));
                        }
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

    UpdateAllParkLists = async () => {
        let prom = [];
        this.parktypes.forEach(parktype => {
            prom.push((async () => {
                let dir = path.join(__dirname, 'parks', parktype);
                this.parklists[parktype] = (await fsp.readdir(dir)).map(standardizeMapName);
            })());
        });
        await Promise.all(prom);
    }

    close = () => {
        this._webserver.close();
        this._privwebserver.close();
        this._pluginsocket.close();
    }
}

module.exports = Web;