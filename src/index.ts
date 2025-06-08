import path from 'path';
import fs from 'fs';
import json5 from 'json5';
import Web from './web.ts';

fs.readFile(process.env.CONFIG || path.join('config', 'config.json5'), (err, data) => {
    if (err) {
        console.log(err);
    }
    else {
        let w = new Web(json5.parse(data.toString()));
        process.on('SIGTERM', w.close);
    }
});
