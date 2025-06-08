import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import mv from 'mv';
import type { PathLike } from 'fs';

/**
 * Check if a file exists at the given path.
 * @param filename - The file to check.
 * @returns A promise that resolves to true if the file exists, false otherwise.
 */
function FileExists(filename: fs.PathLike): Promise<boolean> {
    return new Promise(async (resolve) => {
        try {
            await fsp.access(filename)
            resolve(true);
        }
        catch {
            resolve(false);
        }
    });
}

/**
 * Wait for a file to exist at the given path.
 * @param filename - The file to wait for.
 * @param timeout - The maximum time to wait for the file to exist, in milliseconds. Defaults to 3000.
 * @returns A promise that resolves to the filename if it exists, false otherwise.
 */
function WaitForFile(filename: string, timeout: number = 3000): Promise<false | string> {
    return new Promise(async (resolve) => {
        const dirname = path.dirname(filename);
        const watcher = fs.watch(dirname);
        if (await FileExists(filename)) {
            watcher.close();
            resolve(filename);
        }
        else {
            const t = setTimeout(() => {
                watcher.close();
                resolve(false);
            }, timeout);
            watcher.on('change', async () => {
                const match = await FileExists(filename);
                if (match) {
                    clearTimeout(t);
                    watcher.close();
                    resolve(filename);
                }
            });
        }
    });
}

/**
 * Download an image from the given URL and save it to the specified directory with the given name.
 * @param url - The URL of the image to download.
 * @param options - The options to use when downloading the image. Defaults to an empty object.
 * @param directory - The directory to save the image to.
 * @param name - The name of the image (without the extension) to save.
 * @returns The filename of the saved image if it was successfully downloaded and saved, false otherwise.
 */
async function DownloadImage(url: string | URL | globalThis.Request, options: RequestInit, directory: string, name: string): Promise<false | string> {
    const img = await fetch(url, options);
    if (!img.ok) {
        return false;
    }

    const filename = `${name}.png`;
    const filepath = path.join(directory, filename);
    try {
        await fsp.unlink(filepath);
    }
    catch { }

    await fsp.writeFile(filepath, Buffer.from(await img.arrayBuffer()));
    return filename;
}

/**
 * Upload a park file to the given URL and save the resulting image to the specified directory with the given name.
 * @param url - The URL of the image to download.
 * @param parksave - The path to the park file to upload.
 * @param directory - The directory to save the image to.
 * @param name - The name of the image (without the extension) to save.
 * @returns The filename of the saved image if it was successfully downloaded and saved, false otherwise.
 */
async function DownloadPark(url: string | URL | globalThis.Request, parksave: fs.PathLike, directory: string, name: string): Promise<false | string> {
    const body = new FormData();
    body.append('park', new Blob([await fsp.readFile(parksave)]));
    return await DownloadImage(url, {
        method: 'POST',
        body
    }, directory, name);
}

/**
 * mv a file to a new location. This function is a wrapper around the mv library.
 * @param src - The source file path.
 * @param dest - The destination file path.
 * @returns A promise that resolves when the file has been moved.
 */
function mvp(src: string, dest: string): Promise<void> {
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

/**
 * Make a directory and return true.
 * Exists to satisfy TypeScript's nagging about void return types.
 * @param dir - directory name to create
 * @returns - true
 */
async function mkdir(dir: PathLike): Promise<true> {
    await fsp.mkdir(dir);
    return true;
}

export {
    mvp,
    FileExists,
    WaitForFile,
    DownloadImage,
    DownloadPark,
    mkdir
};
