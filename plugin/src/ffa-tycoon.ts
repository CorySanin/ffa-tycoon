/// <reference path="../types/openrct2.d.ts" />
const PREFIX = new RegExp('^(!|/)');
const ARCHIVE = new RegExp('^archive($| )', 'i');
const VOTE = new RegExp('^(vote|map)($| )', 'i');
const TIMEOUT = 20000;

(function () {
    let port = 35712;
    let hostname = 'ffa-tycoon';
    let autoArchive = false;
    let changeMade = false;
    let id = -1;

    function doCommand(command: string, caller: Player, callback) {
        let args: any;
        if ((args = doesCommandMatch(command, [ARCHIVE])) !== false) {
            sendToWeb({
                type: 'archive',
                id
            }, (resp: string) => {
                callback(resp);
            });
        }
        else if ((args = doesCommandMatch(command, [VOTE])) !== false) {
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
                }, (resp: string) => {
                    callback(resp);
                });
            }
        }
        else {
            return false;
        }
        return true;
    }

    function sendToWeb(msg: string | object, callback) {
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
        let s = sock.connect(port, hostname, () => {
            sock.write(msg as string);
        });
    }

    function getCommand(str): boolean | string {
        if (str.match(PREFIX)) {
            return str.replace(PREFIX, '').trim();
        }
        return false;
    }

    function doesCommandMatch(str, commands): boolean | string {
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
        var perms: string[] = network.getGroup(player.group).permissions;
        return perms.indexOf('kick_player') >= 0;
    }

    function getPlayer(playerID: number): Player {
        if (playerID === -1) {
            return null;
        }
        var player: Player = null; //network.getPlayer(playerID);
        var players = network.players;
        for (const p of players) {
            if (p.id === playerID) {
                player = p;
            }
        }
        return player;
    }

    function main() {
        if (network.mode === 'server') {

            port = context.sharedStorage.get('ffa-tycoon.port', port);
            hostname = context.sharedStorage.get('ffa-tycoon.hostname', hostname);
            autoArchive = context.sharedStorage.get('ffa-tycoon.autoArchive', autoArchive);
            context.subscribe('network.chat', (e) => {
                let msg = e.message;
                let command = getCommand(msg);
                if (typeof command == 'string' && isPlayerAdmin(getPlayer(e.player))) {
                    doCommand(command, network.getPlayer(e.player), (result: string) => {
                        let payload = JSON.parse(result);
                        context.setTimeout(() => network.sendMessage(payload.msg, [e.player]), 200);
                        if ('id' in payload) {
                            id = payload.id;
                        }
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
                                sendToWeb({
                                    type: 'archive'
                                }, () => 0);
                            }
                        }, 3000);
                    }
                });
            }
        }
    }

    context.setTimeout(() => sendToWeb({
        type: 'newpark'
    }, resp => {
        console.log(`reset park id: ${resp}`);
    }), 5000);

    registerPlugin({
        name: 'ffa-tycoon',
        version: '1.2.0',
        authors: ['Cory Sanin'],
        type: 'remote',
        licence: 'MIT',
        targetApiVersion: 65,
        main
    });
}());