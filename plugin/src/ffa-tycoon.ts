/// <reference path="../types/openrct2.d.ts" />
const PREFIX = new RegExp('^(!|/)');
const ARCHIVE = new RegExp('^archive($| )', 'i');
const TIMEOUT = 20000;

(function () {
    let port = 35712;
    let hostname = 'ffa-tycoon';
    let autoArchive = false;
    let changeMade = false;

    function doCommand(command, callback) {
        let args: any;
        if ((args = doesCommandMatch(command, [ARCHIVE])) !== false) {
            sendToWeb({
                type: 'archive'
            }, resp => {
                callback(resp);
            });
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
                if (command !== false && isPlayerAdmin(getPlayer(e.player))) {
                    doCommand(command, result => {
                        if (typeof result === 'string') {
                            context.setTimeout(() => network.sendMessage(result, [e.player]), 300);
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
        version: '1.0.0',
        authors: ['Cory Sanin'],
        type: 'remote',
        licence: 'MIT',
        main
    });
}());