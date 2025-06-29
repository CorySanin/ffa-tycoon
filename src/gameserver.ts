import net from 'net';
import util from 'util';
import path from 'path';
import dns from 'dns';
import fsp from 'fs/promises';
import moment from 'moment';
import { WaitForFile, mvp } from './fileMan.ts';
import type { ParkInfo } from 'openrct2-remote-control';
import type { Moment } from 'moment';
const REMOTEPORT = 35711;
const TIMEOUT = 5000;

function sleep(timeout: number): Promise<void> {
    return new Promise((resolve, _) => setTimeout(resolve, timeout));
}

type ServerDefinition = {
    name: string;
    group: string;
    gamemode: string;
    motd: string | null;
    hostname: string;
    port: number;
    dir: string | false;
    index?: number;
};

type LoadData = {
    file: string;
    id: number;
};

type GenericCommandResponse = {
    result?: string | object | boolean;
}

interface ServerDetails extends ParkInfo {
    expiration?: Moment;
}

class GameServer {
    private name: string;
    private group: string;
    private mode: string;
    private motd: string | null;
    private hostname: string;
    private port: number;
    private dir: string | false;
    private details: ServerDetails;
    private ip: string | null;
    private id: number | null;
    private votes: Record<string, string>;
    private loaddata: LoadData;
    private serverIndex:number;

    constructor(server: Partial<ServerDefinition> = {}) {
        this.name = server.name || 'server';
        this.group = server.group || 'default';
        this.mode = server.gamemode || 'multiplayer';
        this.motd = server.motd || null;
        this.hostname = server.hostname || '127.0.0.1';
        this.port = server.port || REMOTEPORT;
        this.dir = server.dir || false;
        this.details = null;
        this.ip = null;
        this.id = null;
        this.votes = {};
        this.loaddata = null;
        this.serverIndex = server.index;
    }

    GetId(): number {
        return this.id;
    }

    SetId(id: number | null) {
        if (id === undefined) {
            throw new Error("id can't be undefined");
        }
        this.id = id;
    }

    HasDbEntry(): boolean {
        return this.GetId() !== null;
    }

    GetName(): string {
        return this.name;
    }

    GetGroup(): string {
        return this.group;
    }

    GetMode(): string {
        return this.mode;
    }

    async SavePark(destination: string): Promise<string | false> {
        if (!this.dir) {
            return false;
        }
        const filename = `${moment().format('YYYY-MM-DD_HH-mm-ss')}_${this.name}`.substring(0, 25).trim().replace(/\s/g, '-');
        const fullNamesv6 = path.join(this.dir, 'save', `${filename}.sv6`);
        const fullNamepark = path.join(this.dir, 'save', `${filename}.park`);
        await this.Execute(`save ${filename}`);
        try {
            const res = await Promise.any([
                WaitForFile(fullNamesv6),
                WaitForFile(fullNamepark)
            ]);
            if (res) {
                let fstat = await fsp.stat(res);
                let prsize = 0;
                for (let i = 0; i < 8; i++) {
                    if (fstat.size == prsize && prsize > 0) {
                        break;
                    }
                    prsize = fstat.size;
                    await sleep(2000);
                    fstat = await fsp.stat(res);
                }
                if (fstat.size === 0) {
                    await fsp.rm(res);
                    throw 'File is 0 bytes';
                }
                let basename = path.basename(res);
                await mvp(res, path.join(destination, basename));
                return basename;
            }
        }
        catch (ex) {
            console.log(ex);
        }
        return false;
    }

    SetLoadedPark(loaddata: LoadData) {
        this.loaddata = loaddata;
    }

    GetParkSave(): LoadData {
        return this.loaddata
    }

    TallyVotes(allMaps: string[]): string {
        const mapVotes: Record<string, number> = {};
        let mostVotes: string[] | null = null;
        for (let identifier in this.votes) {
            let map = this.votes[identifier];
            if (!(map in mapVotes)) {
                mapVotes[map] = 0;
            }
            mapVotes[map]++;
        }
        for (let map in mapVotes) {
            if (!mostVotes) {
                mostVotes = [map];
            }
            else {
                let votes = mapVotes[map];
                let maxVotes = mapVotes[mostVotes[0]];
                if (votes > maxVotes) {
                    mostVotes = [map];
                }
                else if (votes === maxVotes) {
                    mostVotes.push(map);
                }
            }
        }
        if (!mostVotes) {
            mostVotes = allMaps || [null];
        }
        return mostVotes[Math.floor(Math.random() * mostVotes.length)];
    }

    GetIndex(): number {
        return this.serverIndex;
    }

    /**
     * As a player cast a vote for a map
     * @param identifier ID, such as IP address or the like
     * @param map map to vote for
     */
    CastVote(identifier: string, map: string) {
        this.votes[identifier] = map;
    }

    NewPark(): void {
        this.SetId(this.loaddata?.id || null);
        this.SetLoadedPark(null);
        this.votes = {};
    }

    async GetDetails(force: boolean = false): Promise<ServerDetails | null> {
        try {
            let d = moment();
            if (force || !this.details?.expiration || d.isAfter(this.details.expiration)) {
                if (this.details = await this.GetPark()) {
                    this.details.expiration = d.add(2, 'minutes');
                }
            }
        }
        catch (ex) {
            console.log(`Error getting server details: ${ex}`);
        }
        return this.details;
    }

    GetDetailsSync(): ServerDetails | null {
        return this.details;
    }

    async GetIP(): Promise<string> {
        try {
            this.ip = (await (util.promisify(dns.lookup)(this.hostname))).address;
        }
        catch (ex) {
            console.error(`Error while resolving hostname ${this.hostname}: ${ex}`);
        }
        return this.ip;
    }

    async GetMOTD(): Promise<string> {
        if (this.motd) {
            return fsp.readFile(this.motd, 'utf-8');
        }
        else {
            return null;
        }
    }

    async Say(message: string): Promise<GenericCommandResponse> {
        return (await this.Execute(`say ${message}`)) as GenericCommandResponse;
    }

    async GetPark(): Promise<ServerDetails | null> {
        return (await this.Execute(`park`)) as ServerDetails | null;
    }

    Execute(command: string): Promise<GenericCommandResponse | null> {
        return new Promise((resolve, reject) => {
            try {
                const client = new net.Socket();
                const timeout = setTimeout(() => {
                    client.destroy();
                    reject('timeout');
                }, TIMEOUT);
                client.connect(this.port, this.hostname, function () {
                    client.write(typeof command === 'object' ? JSON.stringify(command) : command);
                });

                client.on('data', function (data) {
                    clearTimeout(timeout);
                    resolve(JSON.parse(data.toString()));
                    client.destroy();
                });

                client.on('close', function () {
                    clearTimeout(timeout);
                    resolve(null);
                });

                client.on('error', function (ex) {
                    clearTimeout(timeout);
                    client.destroy();
                    reject(ex);
                });
            }
            catch (ex) {
                reject(ex);
            }
        });
    }
}

export default GameServer;
export { GameServer };
export type { ServerDefinition, ServerDetails };
