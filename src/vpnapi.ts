import { LRUCache } from 'lru-cache';

type VpnapiOptions = {
    vpnapikey: string;
    max: number;
};

type VpnApiResponse = {
    status?: 'ok' | 'bad';
    message?: string;
    security: {
        vpn: boolean;
        proxy: boolean;
        tor: boolean;
        relay: boolean;
    };
    location: {
        city: string;
        region: string;
        country: string;
        continent: string;
        region_code: string;
        country_code: string;
        continent_code: string;
        latitude: string;
        longitude: string;
        time_zone: string;
        locale_code: string;
        metro_code?: string;
        is_in_european_union: boolean;
    };
    network: {
        network: string;
        autonomous_system_number: string;
        autonomous_system_organization: string;
    };
}

interface ForwardedVpnApiResponse extends VpnApiResponse {
    status: 'ok' | 'bad';
}

class Vpnapi {
    private apikey?: string;
    private cache: LRUCache<string, any>;

    constructor(options: Partial<VpnapiOptions> = {}) {
        this.apikey = options.vpnapikey;
        this.cache = new LRUCache({
            max: options.max || 100,
        });
    }

    async get(ip: string): Promise<null | ForwardedVpnApiResponse> {
        if (!this.apikey) {
            return null;
        }
        const val = this.cache.get(ip);
        if (val) {
            return val;
        }
        else {
            const resp = await fetch(`https://vpnapi.io/api/${ip}?key=${this.apikey}`);
            if (!resp.ok) {
                return null;
            }

            const body = await resp.json() as VpnApiResponse;
            body.status = 'ok';
            this.cache.set(ip, body);
            return body as ForwardedVpnApiResponse;
        }
    };
}

export default Vpnapi;
export { Vpnapi };
export type { VpnapiOptions, ForwardedVpnApiResponse };
