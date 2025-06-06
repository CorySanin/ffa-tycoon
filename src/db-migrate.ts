import dayjs from 'dayjs';
import sq from 'better-sqlite3';
import DbAdapter from './dbAdapter.ts';

const destDb = new DbAdapter({
    path: 'storage/db/new.db'
});
await destDb.sync();
const sourceDb = sq('storage/db/old.db');


const TABLE = 'parks';

const GETPARK = sourceDb.prepare(`SELECT * FROM ${TABLE} WHERE id = @id;`);
const GETNEWEST = sourceDb.prepare(`SELECT * FROM ${TABLE} ORDER BY id DESC LIMIT 0, 1;`);
const oldest = GETNEWEST.get();

for (let i = 1; i <= oldest['id']; i++) {
    const park = GETPARK.get({id: i});
    if (park){
        const day = dayjs(park['date']);
        const newData = day.toISOString();
        console.log(`UPDATING ${park['id']}: ${park['date']} ➡️ '${newData}'`);
        await destDb.addPark({
            name: park['name'],
            scenario: park['scenario'],
            groupname: park['groupname'],
            gamemode: park['gamemode'],
            thumbnail: park['thumbnail'],
            largeimg: park['largeimg'],
            dir: park['dir'],
            filename: park['filename'],
            date: newData
        });
    }
    else {
        console.log(`skipping id ${i}`);
        await destDb.addPark({});
        await destDb.deletePark(i);
    }
}
sourceDb.close();
