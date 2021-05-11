const net = require('net');
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const moment = require('moment');
const FileMan = require('./fileMan');
const REMOTEPORT = 35711;
const mv = require('mv');

async function mvPromise(src, dest) {
    return new Promise((resolve, reject) => {
        mv(src, dest, err => {
            if (err) {
                reject(err);
            }
            else {
                resolve();
            }
        });
    });
}

class GameServer {
    constructor(server = {}) {
        this._name = server.name || 'server';
        this._group = server.group || 'default';
        this._mode = server.gamemode || 'multiplayer';
        this._hostname = server.hostname || '127.0.0.1';
        this._port = server.port || REMOTEPORT;
        this._dir = server.dir || false;
        this._details = null;
    }

    SavePark = async (destination) => {
        if (!this._dir) {
            return false;
        }
        let filename = 'park';
        let fullName = path.join(this._dir, 'save', `${filename}.sv6`);
        await this.Execute(`save ${filename}`);
        try {
            if (await FileMan.WaitForFile(fullName)) {
                await mvPromise(fullName, destination);
                return true;
            }
        }
        catch (ex) {
            console.log(ex);
        }
        return false;
    }

    GetDetails = async (force = false) => {
        let d = moment();
        if (force || !this._details || d.isAfter(this._details.expiration)) {
            if (this._details = await this.Execute('park')) {
                this._details.expiration = d.add(3, 'minutes');
            }
        }
        return this._details;
    }

    Execute = (command) => {
        return new Promise((resolve, reject) => {
            var client = new net.Socket();
            client.connect(this._port, this._hostname, function () {
                client.write(typeof command === 'object' ? JSON.stringify(command) : command);
            });

            client.on('data', function (data) {
                resolve(JSON.parse(data));
                client.destroy();
            });

            client.on('close', function () {
                resolve(null);
            });
        });
    }
}

module.exports = GameServer;