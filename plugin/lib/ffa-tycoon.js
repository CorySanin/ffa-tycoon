var PREFIX = new RegExp('^(!|/)');
var ARCHIVE = new RegExp('^archive($| )', 'i');
var TIMEOUT = 20000;
(function () {
    var port = 35712;
    var hostname = 'ffa-tycoon';
    var autoArchive = false;
    var changeMade = false;
    var id = -1;
    function doCommand(command, callback) {
        var args;
        if ((args = doesCommandMatch(command, [ARCHIVE])) !== false) {
            sendToWeb({
                type: 'archive',
                id: id
            }, function (resp) {
                callback(resp);
            });
        }
        else {
            return false;
        }
        return true;
    }
    function sendToWeb(msg, callback) {
        if (typeof msg !== 'string') {
            msg = JSON.stringify(msg);
        }
        var sock = network.createSocket();
        var timeout = context.setTimeout(function () {
            sock.destroy(new Error('timed out'));
            callback(false);
        }, TIMEOUT);
        sock.on('data', function (data) {
            context.clearTimeout(timeout);
            sock.destroy(new Error('no error'));
            callback(data);
        });
        var s = sock.connect(port, hostname, function () {
            sock.write(msg);
        });
    }
    function getCommand(str) {
        if (str.match(PREFIX)) {
            return str.replace(PREFIX, '').trim();
        }
        return false;
    }
    function doesCommandMatch(str, commands) {
        for (var _i = 0, commands_1 = commands; _i < commands_1.length; _i++) {
            var command = commands_1[_i];
            if (typeof command === 'string') {
                if (str.startsWith(command)) {
                    var ret = str.substring(command.length, str.length).trim();
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
    function isPlayerAdmin(player) {
        var perms = network.getGroup(player.group).permissions;
        return perms.indexOf('kick_player') >= 0;
    }
    function getPlayer(playerID) {
        if (playerID === -1) {
            return null;
        }
        var player = null;
        var players = network.players;
        for (var _i = 0, players_1 = players; _i < players_1.length; _i++) {
            var p = players_1[_i];
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
            context.subscribe('network.chat', function (e) {
                var msg = e.message;
                var command = getCommand(msg);
                if (command !== false && isPlayerAdmin(getPlayer(e.player))) {
                    doCommand(command, function (result) {
                        var payload = JSON.parse(result);
                        context.setTimeout(function () { return network.sendMessage(payload.msg, [e.player]); }, 300);
                        if ('id' in payload) {
                            id = payload.id;
                        }
                    });
                }
            });
            if (autoArchive) {
                context.subscribe('action.execute', function (e) {
                    changeMade = changeMade || e.player > 0;
                });
                context.subscribe('network.leave', function (_) {
                    if (network.players.length <= 2 && changeMade) {
                        context.setTimeout(function () {
                            if (network.players.length === 1 && changeMade) {
                                changeMade = false;
                                sendToWeb({
                                    type: 'archive'
                                }, function () { return 0; });
                            }
                        }, 3000);
                    }
                });
            }
        }
    }
    context.setTimeout(function () { return sendToWeb({
        type: 'newpark'
    }, function (resp) {
        console.log("reset park id: " + resp);
    }); }, 5000);
    registerPlugin({
        name: 'ffa-tycoon',
        version: '1.1.0',
        authors: ['Cory Sanin'],
        type: 'remote',
        licence: 'MIT',
        main: main
    });
}());
