const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const fetch = require('node-fetch');


let FileExists = (filename) => {
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

let WaitForFile = (filename, timeout = 3000) => {
    return new Promise(async (resolve) => {
        let dirname = path.dirname(filename);
        let watcher = fs.watch(dirname);
        if (await FileExists(filename)) {
            watcher.close();
            resolve(true);
        }
        else {
            let t = setTimeout(() => {
                watcher.close();
                resolve(false);
            }, timeout);
            watcher.on('change', async () => {
                let match = await FileExists(filename);
                if (match) {
                    clearTimeout(t);
                    watcher.close();
                    resolve(true);
                }
            });
        }
    });
}

let DownloadImage = async (url, options, directory, name) => {
    let img = await fetch(url, options);
    let filename = `${name}.png`;
    let filepath = path.join(directory, filename);

    await fsp.writeFile(filepath, await img.buffer());

    return filename;
}

module.exports = {
    FileExists,
    WaitForFile,
    DownloadImage
}