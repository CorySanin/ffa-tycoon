const net = require('net');
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const moment = require('moment');
const FileMan = require('./fileMan');
const REMOTEPORT = 35711;
const mv = require('mv');

function mvPromise(src, dest) {
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

function sleep(timeout) {
    return new Promise((resolve, reject) => setTimeout(resolve, timeout));
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
        let more = '';
        if(this._details){
            more = `_${this._details.park.name}`;
        }
        let filename = `${this._name}${more}_${this._mode}`.substring(0,25).trim().replace(/\s/g, '-');
        let fullNamesv6 = path.join(this._dir, 'save', `${filename}.sv6`);
        let fullNamepark = path.join(this._dir, 'save', `${filename}.park`);
        await this.Execute(`save ${filename}`);
        try {
            let res = await Promise.any([
                FileMan.WaitForFile(fullNamesv6),
                FileMan.WaitForFile(fullNamepark)
            ]);
            if (res) {
                let fstat = await fsp.stat(res);
                let prsize = 0;
                for(let i = 0; i < 8; i++){
                    if(fstat.size == prsize && prsize > 0){
                        break;
                    }
                    prsize = fstat.size;
                    await sleep(2000);
                    fstat = await fsp.stat(res);
                }
                if(fstat.size === 0){
                    await fsp.rm(res);
                    throw 'File is 0 bytes';
                }
                let basename = path.basename(res);
                await mvPromise(res, path.join(destination, basename));
                return basename;
            }
        }
        catch (ex) {
            console.log(ex);
        }
        return false;
    }

    GetDetails = async (force = false) => {
        try {
            let d = moment();
            if (force || !this._details || d.isAfter(this._details.expiration)) {
                if (this._details = await this.Execute('park')) {
                    this._details.expiration = d.add(2, 'minutes');
                }
            }
        }
        catch (ex) {
            console.log(`Error getting server details: ${ex}`);
        }
        return this._details;
    }

    GetDetailsSync = () => {
        return this._details;
    }

    Execute = (command) => {
        return new Promise((resolve, reject) => {
            try {
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

                client.on('error', function (ex) {
                    reject(ex);
                });
            }
            catch (ex) {
                reject(ex);
            }
        });
    }
}

module.exports = GameServer;