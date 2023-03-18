(function () {
    var PREFIX = new RegExp('^(!|/)');
    var ARCHIVE = new RegExp('^archive($| )', 'i');
    var VOTE = new RegExp('^(vote|map)($| )', 'i');
    var RULES = new RegExp('^(rules|faq)($| )', 'i');
    var TIMEOUT = 20000;
    var ACTION_NAME = 'motdget';
    var result = { error: 0 };
    var port = 35712;
    var hostname = 'ffa-tycoon';
    var autoArchive = false;
    var changeMade = false;
    var id = -1;
    var motd = null;
    function doCommand(command, caller, callback) {
        var args;
        if (isPlayerAdmin(caller) && (args = doesCommandMatch(command, [ARCHIVE])) !== false) {
            sendToWeb({
                type: 'archive',
                id: id
            }, function (resp) {
                callback(resp);
            });
        }
        else if ((args = doesCommandMatch(command, [RULES])) !== false) {
            context.setTimeout(function () { return network.sendMessage('https://ffa-tycoon.com/rules'); }, 200);
        }
        else if ((args = doesCommandMatch(command, [VOTE])) !== false) {
            if (args.length == 0 || doesCommandMatch(args, ['help', '--help', '-h'])) {
                var type = park.getFlag('noMoney') ? 'sandbox' : 'economy';
                callback(JSON.stringify({
                    msg: "Vote for the next map with \"!vote mapname\" where mapname is a map from this list: ffa-tycoon.com/".concat(type)
                }));
            }
            else {
                sendToWeb({
                    type: 'vote',
                    identifier: caller.ipAddress,
                    map: args
                }, function (resp) {
                    callback(resp);
                });
            }
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
        sock.connect(port, hostname, function () {
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
                if (typeof command == 'string') {
                    doCommand(command, network.getPlayer(e.player), function (result) {
                        var payload = JSON.parse(result);
                        context.setTimeout(function () { return network.sendMessage(payload.msg, [e.player]); }, 200);
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
            context.setTimeout(function () { return sendToWeb({
                type: 'newpark'
            }, function (resp) {
                console.log("reset park id: ".concat(resp));
            }); }, 5000);
            context.registerAction(ACTION_NAME, function () { return result; }, function () { return result; });
            context.subscribe('network.join', function (e) {
                sendToWeb({
                    type: 'motd'
                }, function (msg) {
                    if (msg && msg.length) {
                        motd = JSON.parse(msg).msg;
                        if (motd && motd.length) {
                            context.executeAction(ACTION_NAME, {
                                motd: motd
                            });
                        }
                    }
                });
            });
        }
        else {
            context.registerAction(ACTION_NAME, function () { return result; }, function (args) {
                var README = args.motd || args.args.motd;
                if (motd === null && README && README.length) {
                    var LINEHEIGHT_1 = 14;
                    var CHARWIDTH_1 = 5;
                    var BUTTONHEIGHT_1 = LINEHEIGHT_1 * 3;
                    var LABELNAME_1 = 'labelNo';
                    var windowInitialSize = { x: 0, y: 0 };
                    var widgets_1 = [];
                    var lines_1 = 0;
                    var width_1 = 42;
                    function getBtnPosition(windowDimensions) {
                        return {
                            y: windowDimensions.y - BUTTONHEIGHT_1 - (LINEHEIGHT_1 / 2),
                            x: windowDimensions.x / 2 - 100
                        };
                    }
                    README.split('\n').forEach(function (text, index) {
                        width_1 = Math.max(width_1, text.length);
                        widgets_1.push({
                            type: 'label',
                            name: LABELNAME_1 + index,
                            x: 8,
                            y: 20 + (LINEHEIGHT_1 * index),
                            width: width_1 * CHARWIDTH_1 + 20,
                            height: LINEHEIGHT_1,
                            text: text
                        });
                        lines_1++;
                    });
                    windowInitialSize.y = lines_1 * (LINEHEIGHT_1) + (LINEHEIGHT_1 * 4) + 20;
                    windowInitialSize.x = width_1 * CHARWIDTH_1 + 32;
                    widgets_1.push({
                        type: 'button',
                        name: 'closebtn',
                        width: 200,
                        height: BUTTONHEIGHT_1,
                        text: 'Close',
                        x: getBtnPosition(windowInitialSize).x,
                        y: getBtnPosition(windowInitialSize).y,
                        onClick: function () { return ui.getWindow(welcomeWindow_1.classification).close(); }
                    });
                    var welcomeWindow_1 = {
                        classification: 'ffatycoonwelcome',
                        title: 'Welcome!',
                        x: 400,
                        y: 200,
                        width: windowInitialSize.x,
                        height: windowInitialSize.y,
                        colours: [7, 7],
                        widgets: widgets_1
                    };
                    ui.openWindow(welcomeWindow_1);
                }
                motd = true;
                return result;
            });
        }
    }
    registerPlugin({
        name: 'ffa-tycoon',
        version: '1.2.2',
        authors: ['Cory Sanin'],
        type: 'remote',
        licence: 'MIT',
        targetApiVersion: 65,
        main: main
    });
}());
