const net = require('net');
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const REMOTEPORT = 35711;

class GameServer {
    constructor(server = {}) {
        this._name = server.name || 'server';
        this._group = server.group || 'default';
        this._hostname = server.hostname || '127.0.0.1';
        this._port = server.port || REMOTEPORT;
        this._dir = server.dir || false;
    }

    SavePark = async (destination) => {
        if (!this._dir) {
            return false;
        }
        let filename = 'park';
        let fullName = path.join(this._dir, 'save', `${filename}.sv6`);
        await this.Execute(`save ${filename}`);
        try {
            if (await this.WaitForFile(fullName)) {
                await fsp.rename(fullName, destination);
                return true;
            }
        }
        catch (ex){
            console.log(ex);
        }
        return false;
    }

    Execute = (command) => {
        return new Promise((resolve, reject) => {
            var client = new net.Socket();
            client.connect(this._port, this._hostname, function () {
                client.write(typeof command === 'object' ? JSON.stringify(command) : command);
            });

            client.on('data', function (data) {
                console.log('Received: ' + data);
                resolve(JSON.parse(data));
                client.destroy();
            });

            client.on('close', function () {
                console.log('Connection closed');
                resolve(null);
            });
        });
    }

    FileExists = (filename) => {
        return new Promise(async (resolve) => {
            try {
                await fsp.access(filename)
                resolve(true)
            }
            catch {
                resolve(false);
            }
        });
    }

    WaitForFile = (filename, timeout = 3000) => {
        return new Promise(async (resolve) => {
            let dirname = path.dirname(filename);
            let watcher = fs.watch(dirname);
            if (await this.FileExists(filename)) {
                watcher.close();
                resolve(true);
            }
            else {
                let t = setTimeout(() => {
                    watcher.close();
                    resolve(false);
                }, timeout);
                watcher.on('change', async () => {
                    let match = await this.FileExists(filename);
                    if (match) {
                        clearTimeout(t);
                        watcher.close();
                        resolve(true);
                    }
                });
            }
        });
    }
}

module.exports = GameServer;