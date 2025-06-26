import express from 'express';
import fileUpload from 'express-fileupload';
import Helmet from 'helmet';
import bodyParser from 'body-parser';
import prom from 'prom-client';
import dayjs from 'dayjs';
import crypto from 'crypto';
import path from 'path';
import { Dirent } from 'fs';
import fsp from 'fs/promises';
import net, { Server } from 'net';
import { DbAdapter } from './dbAdapter.ts';
import GameServer from './gameserver.ts';
import * as FileMan from './fileMan.ts';
import Vpnapi from './vpnapi.ts';
import type { AdapterOptions, ParkRecord } from './dbAdapter.ts';
import type { VpnapiOptions } from './vpnapi.ts';
import type { ServerDefinition, ServerDetails } from './gameserver.ts';

const VIEWOPTIONS = {
    outputFunctionName: 'echo'
};

function standardizeMapName(name: string) {
    return name.split('.')[0].split('-')[0].toLowerCase();
}

function cspGen(_: express.Request, res: express.Response, next: express.NextFunction) {
    crypto.randomBytes(32, (err, randomBytes) => {
        if (err) {
            console.error(err);
            next(err);
        } else {
            res.locals.cspNonce = randomBytes.toString("hex");
            next();
        }
    });
}

interface ParkResult {
    status: 'ok' | 'bad';
    park?: ParkRecord;
    files?: Dirent[];
}

interface WebOptions extends VpnapiOptions {
    port: number;
    privateport: number;
    pluginport: number;
    publicurl: string;
    motd: string;
    screenshotter: string;
    archivedir: string;
    mapsMetaDir: string;
    db: Partial<AdapterOptions>;
    servers: ServerDefinition[];
}

class Web {
    private db: DbAdapter;
    private servers: GameServer[];
    private prom: prom.Registry;
    private screenshotter: string;
    private archive: string;
    private mapsMeta: string;
    private parktypes: string[];
    private parklists: { [type: string]: string[]; };
    private webserver: Server;
    private privwebserver: Server;
    private pluginsocket: Server;

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
        this.mapsMeta = options.mapsMetaDir || 'maps';
        this.servers = [];
        this.parktypes = [];
        this.parklists = {};
        this.prom = prom.register;

        (options.servers || []).forEach((serverinfo, index) => {
            serverinfo.motd = (serverinfo.motd === undefined) ? defaultMotd : serverinfo.motd;
            serverinfo.index = index;
            this.servers.push(new GameServer(serverinfo));
        });

        fsp.readdir('parks', { withFileTypes: true }).then(files => {
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
        app.use(cspGen);

        privateapp.set('trust proxy', 1);
        privateapp.set('view engine', 'ejs');
        privateapp.set('view options', VIEWOPTIONS);
        privateapp.use(Helmet({
            contentSecurityPolicy: false
        }));
        privateapp.use(bodyParser.urlencoded({ extended: true }));
        privateapp.use(bodyParser.json());
        privateapp.use(cspGen);
        privateapp.use(fileUpload({
            createParentPath: true,
            abortOnLimit: true,
            limits: {
                fileSize: 100 * 1024 * 1024
            }
        }));

        //#region web endpoints

        app.get('/', async (_, res) => {
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

        app.get('/maps', async (_, res) => {
            const maps = JSON.parse((await fsp.readFile(path.join(this.mapsMeta, 'meta.json'))).toString());
            res.render('template',
                {
                    page: {
                        view: 'maps',
                        title: 'Map Pool'
                    },
                    site: {
                        description: 'Details for park scenarios that run on FFA Tycoon OpenRCT2 servers. Screenshots, descriptions, credits, and more. Don\'t forget to vote for the next map!'
                    },
                    maps: maps && maps['parks']
                },
                function (err, html) {
                    if (!err) {
                        res.send(html);
                    }
                    else {
                        res.send('something went uh-oh');
                        console.error(err);
                    }
                }
            );
        });

        app.get('/archive/{:page}', (req, res) => {
            const page = Math.max(parseInt(req.params.page) || 1, 1);
            const order = {
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
            const park = await db.getPark(parseInt(req.params.park));
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
            const park = await db.getPark(parseInt(req.params.park));
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

        app.get('/rules', (_, res) => {
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

        app.get('/guide', (_, res) => {
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

        privateapp.get('/', async (_, res) => {
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
            const serverindex = parseInt(req.params.index);
            if (serverindex < this.servers.length && serverindex >= 0) {
                const server = this.servers[serverindex];
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

        privateapp.get('/archive/{:page}', (req, res) => {
            const page = Math.max(parseInt(req.params.page) || 1, 1);
            const order = {
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
                        res.set('Content-Security-Policy', `default-src 'self'; connect-src 'self' *; script-src 'self' 'nonce-${res.locals.cspNonce}'`);
                        res.send(html);
                    }
                    else {
                        res.send(err);
                    }
                });
        });

        privateapp.get('/park/:park', async (req, res) => {
            const park = await db.getPark(parseInt(req.params.park));
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

        app.get('/faq', (_, res) => {
            res.redirect('/rules#faq');
        });

        app.get('/submit-map', (_, res) => {
            res.redirect('https://github.com/CorySanin/ffa-tycoon-parks#park-submission-guide');
        });

        app.get('/discord{/}', (_, res) => {
            res.redirect('https://discord.gg/QpztpR5QSH');
        });

        //#endregion

        app.get('/parks/:type{/}', async (req, res) => {
            const type = req.params.type;
            if (this.parktypes.includes(type)) {
                const dir = path.join('parks', type);
                const files = await fsp.readdir(dir);
                const file = files[Math.floor(Math.random() * files.length)];
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

        app.get('/load/:index{/}', async (req, res) => {
            const serverindex = parseInt(req.params.index);
            if (serverindex < this.servers.length && serverindex >= 0) {
                const server = this.servers[serverindex];
                const type = server.GetMode() === 'free for all economy' ? 'economy' : 'sandbox';
                const restore = server.GetParkSave();
                let filename: string;
                let fullPath: string;
                if (restore !== null) {
                    const park = restore.file;
                    const pathSplit = park.split('/');
                    filename = pathSplit.length ? pathSplit[pathSplit.length - 1] : 'err.park';
                    fullPath = path.join(this.archive, park);
                }
                else {
                    const park = server.TallyVotes(that.parklists[type]);
                    filename = `${park}-${type}.park`;
                    fullPath = path.join('parks', type, filename);
                }
                res.set('Content-Disposition', `attachment; filename="${filename}"`);
                res.sendFile(fullPath, {
                    root: process.cwd()
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

        app.get('/api/healthcheck', (_, res) => {
            res.send('Healthy');
        });

        app.get('/api/parks/count', async (_, res) => {
            res.send(this.InjectStatus({ count: await this.db.getParkCount() }, 'ok'));
        });

        app.get('/api/parks{/:page}', async (req, res) => {
            const count = await this.db.getParkCount();
            const pages = await this.db.getMonthsSinceOldest();
            const page = Math.max(Math.min(parseInt(req.params.page) || 1, pages), 1);
            res.send({
                status: 'good',
                page,
                parks: await this.db.getParks(page),
                count,
                pages
            });
        });

        app.get('/api/park/:park{/}', async (req, res) => {
            res.send(this.InjectStatus(await this.db.getPark(parseInt(req.params.park) || 0), 'ok'));
        });

        const getMissingImage = async (fullsize: boolean) => {
            const filename = `${fullsize ? 'fullsize' : 'thumbnail'}_${dayjs().format('YYMMDD-HHmmss')}`;
            const zoom = fullsize ? 0 : 3;
            const park = await db.getMissingImage(fullsize);

            if (park) {
                const dirname = park.dir;
                const archivepath = path.join(this.archive, dirname);
                const parksave = path.join(archivepath, park.filename);
                const image = await FileMan.DownloadPark(`http://${this.screenshotter}/upload?zoom=${zoom}`, parksave, archivepath, filename);
                if (image) {
                    await db.replaceImage(park.id, image, fullsize);
                }
            }
        }

        const saveServers = async (_: express.Request, res: express.Response, servers: GameServer[], ispublic: boolean = true) => {
            const result = {
                status: 'ok',
                results: []
            };
            let status = 200;
            if (!ispublic) {
                const datestring = dayjs().format('YYYY-MM-DD_HH-mm-ss');

                for (const serverindx in servers) {
                    const server = servers[serverindx];
                    let filename: string | false = false;
                    let dirname = `${datestring}_${server.GetName()}`;
                    if (server.HasDbEntry()) {
                        dirname = (await db.getPark(server.GetId())).dir;
                    }
                    const archivepath = path.join(this.archive, dirname);
                    try {
                        if (server.HasDbEntry() || (!(await FileMan.FileExists(archivepath))
                            && (await FileMan.mkdir(archivepath)))) {
                            for (let i = 0; i < 2; i++) {
                                filename = await server.SavePark(archivepath);
                                if (filename) {
                                    break;
                                }
                            }
                            if (!filename && !server.HasDbEntry()) {
                                await fsp.rm(archivepath, { recursive: true, force: true });
                            }
                        }
                    }
                    catch (ex) {
                        console.log(`Error saving ${server.GetName()}`, ex);
                        filename = false;
                    }
                    if (!filename) {
                        result.results.push({
                            server: server.GetIndex(),
                            status: 'bad'
                        });
                    }
                    else if (server.HasDbEntry()) {
                        await db.changeFileName(server.GetId(), filename);
                        await db.updateDate(server.GetId());
                        this.RemoveImages(await db.getPark(server.GetId()));
                        result.results.push({
                            server: server.GetIndex(),
                            status: 'ok',
                            id: server.GetId()
                        });
                    }
                    else {
                        const dbResult = await this.db.addPark({
                            name: server.GetName(),
                            groupname: server.GetGroup(),
                            gamemode: server.GetMode(),
                            scenario: (await server.GetDetails()).park.name,
                            dir: dirname,
                            filename
                        });
                        server.SetId(dbResult.id);
                        result.results.push({
                            server: server.GetIndex(),
                            status: 'ok',
                            id: dbResult.id
                        });
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

        app.get('/api/server{/}', async (req, res) => {
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
            const servernum = parseInt(req.params.server);
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
                        server.SetId(null);
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
            const servernum = parseInt(req.params.server);
            let result = {
                status: 'ok'
            };
            let status = 200;
            if (servernum >= 0 && servernum < this.servers.length) {
                const server = this.servers[servernum];
                try {
                    server.Execute('stop');
                    server.SetId(null);
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

        privateapp.get('/api/park/:park{/}', async (req, res) => {
            const park = await db.getPark(parseInt(req.params.park));
            const result: ParkResult = {
                status: 'bad'
            };
            let status = 400;

            if (park) {
                status = 200;
                result.park = park;
                result.files = (await fsp.readdir(path.join(this.archive, park.dir), { withFileTypes: true }))
                    .filter(f => f.isFile() && f.name.toLowerCase().endsWith('.park'));
                result.status = 'ok';
            }
            res.status(status).send(result);
        });

        privateapp.put('/api/park/:park{/}', async (req, res) => {
            try {
                const parkentry = await db.getPark(parseInt(req.params.park));

                if (!parkentry || !req.files || !req.files.park) {
                    res.status(400).send({
                        status: 'bad'
                    });
                }
                else {
                    const park = req.files.park as fileUpload.UploadedFile;
                    const filenameold = parkentry.filename;
                    const fullpathold = path.join(this.archive, parkentry.dir, filenameold);
                    const fextsep = park.name.lastIndexOf('.');
                    const fext = park.name.substring(fextsep, park.name.length);
                    const filenamenew = park.name.substring(0, Math.min(fextsep, 25)) + fext;
                    const fullpathnew = path.join(this.archive, parkentry.dir, filenamenew);
                    await fsp.unlink(fullpathold);

                    let files = await fsp.readdir(path.join(this.archive, parkentry.dir), { withFileTypes: true });
                    files = files.filter(f => f.isFile() && f.name.toLowerCase().endsWith('.park'));
                    const promises = [];
                    files.forEach(f => promises.push(fsp.unlink(path.join(this.archive, parkentry.dir, f.name))));
                    try {
                        await Promise.all(promises);
                    }
                    catch (ex) {
                        console.error(`Failed to remove all saves while uploading: ${ex}`);
                    }

                    await park.mv(fullpathnew);

                    await db.changeFileName(parkentry.id, filenamenew);
                    await this.RemoveImages(parkentry);

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

        privateapp.delete('/api/park/:park{/}', async (req, res) => {
            try {
                const parkentry = await db.getPark(parseInt(req.params.park));
                await (fsp.rm || fsp.rmdir)(path.join(this.archive, parkentry.dir), {
                    force: true,
                    maxRetries: 4,
                    recursive: true
                });
                await db.deletePark(parkentry.id);

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
            const park = await db.getPark(parseInt(req.params.park));
            const message = req.body;
            const result = {
                status: 'bad'
            };
            let status = 400;

            if (park) {
                if (req.body.action === 'select' && 'file' in message) {
                    await db.changeFileName(park.id, message.file);
                    await this.RemoveImages(park);
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
                    const promises = [];
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
            const servers = this.servers.filter(server => server.GetGroup() == req.params.group);
            let result = {
                status: 'ok'
            };
            let status = 200;
            if (servers.length > 0) {
                for (const serverindx in servers) {
                    const server = servers[serverindx];
                    try {
                        if (!(await server.Say(message)).result) {
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
            const server = parseInt(req.params.server);
            const message = req.body.message;
            const result = {
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
            const server = parseInt(req.params.server);
            const type = req.body.type;
            const amount = parseInt(req.body.amount || 1);
            const result = {
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
            const server = parseInt(req.params.server);
            const payload = req.body.params;
            const result = {
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
            const server = parseInt(req.params.server);
            const player = req.params.player
            const result = {
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
            const server = parseInt(req.params.server);
            const body = req.body;
            const result = {
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
                const info = await vpnapi.get(req.body.ip);
                if (info) {
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

        new prom.Gauge({
            name: 'ffatycoon_park_guests_count',
            help: 'Number of park guests',
            labelNames: ['server'],
            collect() {
                that.servers.forEach(s => {
                    const details = s.GetDetailsSync();
                    if (details && details.park) {
                        this.set({ server: s.GetName() }, details.park.guests);
                    }
                });
            }
        });

        new prom.Gauge({
            name: 'ffatycoon_park_rating',
            help: 'The park rating',
            labelNames: ['server'],
            collect() {
                that.servers.forEach(s => {
                    const details = s.GetDetailsSync();
                    if (details && details.park) {
                        this.set({ server: s.GetName() }, details.park.rating);
                    }
                });
            }
        });

        new prom.Gauge({
            name: 'ffatycoon_server_online',
            help: 'The number of players connected',
            labelNames: ['server'],
            collect() {
                that.servers.forEach(s => {
                    const details = s.GetDetailsSync();
                    if (details && details.network && details.network.players) {
                        this.set({ server: s.GetName() }, details.network.players.length - 1);
                    }
                });
            }
        });

        let imagetype = true;
        if (this.screenshotter) {
            setInterval(() => {
                getMissingImage(imagetype = !imagetype);
            }, 1 * 60 * 1000);
        }

        app.use('/assets/', express.static('assets'));
        app.use('/archive/', express.static(this.archive));
        app.use('/maps/images/', express.static(path.join(this.mapsMeta, 'thumbnails')));

        privateapp.use('/', app);

        const pluginserver = new net.Server();
        pluginserver.on('connection', async sock => {
            const addr = sock.remoteAddress;
            let server: null | GameServer = null;
            for (let s in this.servers) {
                const srv = this.servers[s];
                if (addr.includes(await srv.GetIP())) {
                    server = srv;
                    break;
                }
            }
            if (server) {
                sock.on('data', async data => {
                    const payload = JSON.parse(data.toString());
                    if (payload.type === 'newpark') {
                        server.NewPark();
                        sock.write(JSON.stringify({
                            msg: 'done'
                        }));
                    }
                    else if (payload.type === 'loadpark') {
                        server.SetId(payload.id > -1 ? payload.id : server.GetParkSave()?.id);
                        server.SetLoadedPark(null);
                        sock.write(JSON.stringify({
                            msg: 'done',
                            id: server.GetId()
                        }));
                    }
                    else if (payload.type === 'archive') {
                        if ('id' in payload && payload.id >= 0) {
                            server.SetId(payload.id);
                        }
                        await saveServers(null, null, [server], false);
                        sock.write(JSON.stringify({
                            id: server.GetId(),
                            msg: 'done'
                        }));
                    }
                    else if (payload.type === 'motd') {
                        sock.write(JSON.stringify({
                            id: server.GetId(),
                            msg: await server.GetMOTD()
                        }));
                    }
                    else if (payload.type === 'vote') {
                        const type = server.GetMode() === 'free for all economy' ? 'economy' : 'sandbox';
                        const map = standardizeMapName(payload.map || '').replaceAll(' ', '_');
                        if (map && map.length > 0) {
                            const possibleMatches = that.parklists[type].filter(p => p.startsWith(map));
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
                sock.destroy();
            }
        });

        function logServiceRunning(error: Error, name: string, port: string | number) {
            if (error) {
                throw error;
            }
            console.log(`${name} running on port ${port}`);
        }

        this.webserver = app.listen(port, (error) => logServiceRunning(error, 'ffa-tycoon', port));
        this.privwebserver = privateapp.listen(privateport, (error) => logServiceRunning(error, 'private backend', privateport));
        this.pluginsocket = pluginserver.listen(pluginport, () => console.log(`plugin server listening on port ${pluginport}`));
    }

    private InjectStatus = (obj: any, status: 'ok' | 'bad') => {
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

    private async RemoveImages(park: ParkRecord) {
        const dir = path.join(this.archive, park.dir);
        await this.db.removeImages(park.id);
        const rmPromises: Promise<void>[] = [];
        if (park.thumbnail && park.thumbnail.length) {
            rmPromises.push(fsp.unlink(path.join(dir, park.thumbnail)));
        }
        if (park.largeimg && park.largeimg.length) {
            rmPromises.push(fsp.unlink(path.join(dir, park.largeimg)));
        }
        await Promise.all(rmPromises);
    }

    UpdateAllParkLists = async () => {
        const prom = [];
        this.parktypes.forEach(parktype => {
            prom.push((async () => {
                const dir = path.join('parks', parktype);
                this.parklists[parktype] = (await fsp.readdir(dir)).map(standardizeMapName);
            })());
        });
        await Promise.all(prom);
    }

    close = () => {
        this.webserver.close();
        this.privwebserver.close();
        this.pluginsocket.close();
    }
}

export default Web;
export { Web };
