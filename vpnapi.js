const LRUCache = require('lru-cache').LRUCache;

class Vpnapi {
    constructor(options = {}) {
        this._apikey = options.apikey || options.vpnapikey;
        this._cache = new LRUCache({
            max: options.max || 100,
        });
    }

    get = async (ip) => {
        if (!this._apikey) {
            return null;
        }
        let val = this._cache.get(ip);
        if (val) {
            return val;
        }
        else {
            let resp = await fetch(`https://vpnapi.io/api/${ip}?key=${this._apikey}`);
            if (!resp.ok) {
                return null;
            }

            let body = await resp.json();
            this._cache.set(ip, body);
            return body;
        }
    };
}

module.exports = Vpnapi;
