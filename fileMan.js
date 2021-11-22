const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const FormData = require('form-data');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));


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
            resolve(filename);
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
                    resolve(filename);
                }
            });
        }
    });
}

let DownloadImage = async (url, options, directory, name) => {
    let img = await fetch(url, options);

    if (!img.ok) {
        return null;
    }

    let filename = `${name}.png`;
    let filepath = path.join(directory, filename);

    try {
        await fsp.unlink(filepath);
    }
    catch { }

    await fsp.writeFile(filepath, await img.buffer());

    return filename;
}

let DownloadPark = async (url, parksave, directory, name) => {
    const body = new FormData();
    body.append('park', fs.createReadStream(parksave));
    return await DownloadImage(url, {
        method: 'POST',
        body
    }, directory, name);
}

module.exports = {
    FileExists,
    WaitForFile,
    DownloadImage,
    DownloadPark
}