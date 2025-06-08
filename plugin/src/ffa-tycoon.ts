/// <reference path="../types/openrct2.d.ts" />
/// <reference path="../types/string-extensions.d.ts" />
interface MotdArgs {
    motd: string
}

interface Payload {
    id?: number;
    msg: string;
}

(function () {
    const PREFIX = new RegExp('^(!|/)');
    const ARCHIVE = new RegExp('^archive($| )', 'i');
    const VOTE = new RegExp('^(vote|map)($| )', 'i');
    const RULES = new RegExp('^(rules|faq)($| )', 'i');
    const TIMEOUT = 20000;
    const MOTD_INTERVAL = 2000;
    const MOTD_ITERATIONS = 8;
    const ACTION_NAME = 'motdget';
    const ID_KEY = 'id';
    const result: GameActionResult = { error: 0 };

    let port = 35712;
    let hostname = 'ffa-tycoon';
    let autoArchive = false;
    let changeMade = false;
    let id = -1;
    let motd: string | null = null;
    let motdWindow: boolean = false;
    let adminPerm: PermissionType | null = null;

    function doCommand(command: string, caller: Player | null, callback: (response: string | false) => void) {
        let args: any;
        if (caller && isPlayerAdmin(caller) && (args = doesCommandMatch(command, [ARCHIVE])) !== false) {
            archivePark(callback);
        }
        else if ((args = doesCommandMatch(command, [RULES])) !== false) {
            context.setTimeout(() => network.sendMessage('https://ffa-tycoon.com/rules'), 200);
        }
        else if (caller && (args = doesCommandMatch(command, [VOTE])) !== false) {
            if (args.length == 0 || doesCommandMatch(args, ['help', '--help', '-h'])) {
                let type = park.getFlag('noMoney') ? 'sandbox' : 'economy';
                callback(JSON.stringify({
                    msg: `Vote for the next map with "!vote mapname" where mapname is a map from this list: ffa-tycoon.com/${type}`
                }));
            }
            else {
                sendToWeb({
                    type: 'vote',
                    identifier: caller.ipAddress,
                    map: args
                }, (resp: string | false) => {
                    callback(resp);
                });
            }
        }
        else {
            return false;
        }
        return true;
    }

    function sendToWeb(msg: string | object, callback: (value: string | false) => void = function(){}) {
        if (typeof msg !== 'string') {
            msg = JSON.stringify(msg);
        }
        let sock = network.createSocket();
        let timeout = context.setTimeout(() => {
            sock.destroy(new Error('timed out'));
            callback(false);
        }, TIMEOUT);
        sock.on('data', (data) => {
            context.clearTimeout(timeout);
            sock.destroy(new Error('no error'));
            callback(data);
        });
        sock.connect(port, hostname, () => {
            sock.write(msg as string);
        });
    }

    function getCommand(str: string): boolean | string {
        if (str.match(PREFIX)) {
            return str.replace(PREFIX, '').trim();
        }
        return false;
    }

    function doesCommandMatch(str: string, commands: (string | RegExp)[]): boolean | string {
        for (const command of commands) {
            if (typeof command === 'string') {
                if (str.startsWith(command)) {
                    let ret = str.substring(command.length, str.length).trim();
                    return (ret) ? ret : true;
                }
            }
            else {
                if (str.match(command)) {
                    return str.replace(command, '').trim();
                }
            }
        }
        return false;
    }

    function isPlayerAdmin(player: Player) {
        if (player === null || adminPerm === null) {
            return false;
        }
        var perms: PermissionType[] = network.getGroup(player.group).permissions;
        return perms.indexOf(adminPerm) >= 0;
    }

    function getPlayer(playerID: number): Player | null {
        if (playerID === -1) {
            return null;
        }
        return network.getPlayer(playerID);
    }

    function sendMOTD(payload: MotdArgs, remaining: number) {
        if (remaining <= 0) {
            return;
        }
        context.executeAction(ACTION_NAME, payload);
        context.setTimeout(() => sendMOTD(payload, remaining - 1), MOTD_INTERVAL);
    }

    function updateId(payload: Payload) {
        if (typeof payload?.id === 'number') {
            id = payload.id;
            if (id > -1) {
                context.getParkStorage().set(ID_KEY, id);
            }
        }
    }

    function archivePark(callback?: (value: string | false) => void) {
        sendToWeb({
            type: 'archive',
            id
        }, (result: string | false) => {
            if (result) {
                updateId(JSON.parse(result));
            }
            if (callback) {
                callback(result);
            }
        });
    }

    function main() {
        if (network.mode === 'server') {
            let saveStorage = context.getParkStorage();
            id = saveStorage.get(ID_KEY, id);
            adminPerm = context.sharedStorage.get('remote-control.adminperm', context.sharedStorage.get('sanin.adminperm', 'modify_groups'));
            port = context.sharedStorage.get('ffa-tycoon.port', port);
            hostname = context.sharedStorage.get('ffa-tycoon.hostname', hostname);
            autoArchive = context.sharedStorage.get('ffa-tycoon.autoArchive', autoArchive);
            context.subscribe('network.chat', (e) => {
                let msg = e.message;
                let command = getCommand(msg);
                if (typeof command == 'string') {
                    doCommand(command, getPlayer(e.player), (result: string | false) => {
                        if (!result) {
                            return;
                        }
                        let payload: Payload = JSON.parse(result);
                        context.setTimeout(() => network.sendMessage(payload.msg, [e.player]), 200);
                        updateId(payload);
                    });
                }
            });

            if (autoArchive) {
                context.subscribe('action.execute', e => {
                    changeMade = changeMade || e.player > 0;
                });

                context.subscribe('network.leave', _ => {
                    if (network.players.length <= 2 && changeMade) {
                        context.setTimeout(() => {
                            if (network.players.length === 1 && changeMade) {
                                changeMade = false;
                                archivePark();
                            }
                        }, 3000);
                    }
                });

                context.subscribe('interval.day', () => {
                    if (date.month === 0 && date.day === 1 && changeMade) {
                        changeMade = false;
                        archivePark();
                    }
                });
            }

            context.setTimeout(() => sendToWeb({
                type: id >= 0 ? 'loadpark' : 'newpark',
                id
            }, resp => {
                console.log(`${id >= 0 ? 'restored' : 'reset'} park id: ${resp}`);
            }), 5000);

            context.registerAction<MotdArgs>(ACTION_NAME,
                () => result,
                () => result);

            context.subscribe('network.join', e => {
                sendToWeb({
                    type: 'motd'
                }, msg => {
                    if (msg && msg.length) {
                        let payload: Payload = JSON.parse(msg);
                        updateId(payload);
                        motd = payload.msg;
                        if (motd && motd.length) {
                            sendMOTD({ motd } as MotdArgs, MOTD_ITERATIONS);
                        }
                    }
                });
            });
        }
        else {
            const LINEHEIGHT = 14;
            const BUTTONHEIGHT = LINEHEIGHT * 3;


            function getBtnPosition(windowDimensions: CoordsXY): CoordsXY {
                return {
                    y: windowDimensions.y - BUTTONHEIGHT - (LINEHEIGHT / 2),
                    x: windowDimensions.x / 2 - 100
                }
            }

            function createReadmeWindow(readme: string): boolean {
                const CHARWIDTH = 5;
                const LABELNAME = 'labelNo';
                const CLASS = 'ffatycoonwelcome';
                let windowInitialSize: CoordsXY = { x: 0, y: 0 };
                let widgets: WidgetDesc[] = [];
                let width = 42;

                readme.split('\n').forEach((text, index) => {
                    width = Math.max(width, text.length);
                    widgets.push({
                        type: 'label',
                        name: LABELNAME + index,
                        x: 8,
                        y: 20 + (LINEHEIGHT * index),
                        width: width * CHARWIDTH + 20,
                        height: LINEHEIGHT,
                        text
                    });
                });
                windowInitialSize.y = widgets.length * (LINEHEIGHT) + (LINEHEIGHT * 4) + 20;
                windowInitialSize.x = width * CHARWIDTH + 32;
                widgets.push({
                    type: 'button',
                    name: 'closebtn',
                    width: 200,
                    height: BUTTONHEIGHT,
                    text: 'Close',
                    x: getBtnPosition(windowInitialSize).x,
                    y: getBtnPosition(windowInitialSize).y,
                    onClick: () => ui.getWindow(CLASS).close()
                });
                let welcomeWindow: WindowDesc = {
                    classification: CLASS,
                    title: 'Welcome!',
                    x: 400,
                    y: 200,
                    width: windowInitialSize.x,
                    height: windowInitialSize.y,
                    colours: [7, 7],
                    widgets
                }
                return (ui.openWindow(welcomeWindow)).widgets.length > 0;
            }

            context.registerAction<MotdArgs>(ACTION_NAME,
                () => result,
                (args) => {
                    const README = args.args.motd;
                    if (motdWindow === null && README && README.length) {
                        motdWindow = motdWindow || createReadmeWindow(README);
                    }
                    return result;
                });
        }
    }

    registerPlugin({
        name: 'ffa-tycoon',
        version: '1.4.1',
        authors: ['Cory Sanin'],
        type: 'remote',
        licence: 'MIT',
        minApiVersion: 77,
        targetApiVersion: 77,
        main
    });
}());