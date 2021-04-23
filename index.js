const path = require('path');
const fs = require('fs');
const json5 = require('json5');
const web = require('./web');

fs.readFile(process.env.CONFIG || path.join(__dirname, 'config', 'config.json5'), (err, data) => {
    if (err) {
        console.log(err);
    }
    else {
        let w = new web(json5.parse(data));
    }
});