import { Model, Op, Sequelize } from 'sequelize';
import dayjs from 'dayjs';
import { DataTypes, ModelStatic } from 'sequelize';

const TABLE = 'parks';

type AdapterOptions = {
    path: string;
}

type NewParkProperties = {
    name?: string;
    groupname?: string;
    gamemode?: string;
    date?: Date;
    thumbnail?: string;
    largeimg?: string;
    dir: string;
    filename: string;
}

class DbAdapter {
    private model: ModelStatic<Model<any, any>>

    constructor(options: Partial<AdapterOptions> = {}) {
        const sequelize = new Sequelize({
            dialect: 'sqlite',
            storage: process.env.DBPATH || options.path || 'ffaweb.db'
        });
        this.model = sequelize.define(TABLE, {
            id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
            name: { type: DataTypes.STRING(128), defaultValue: 'no name' },
            groupname: { type: DataTypes.STRING(128), defaultValue: 'default' },
            gamemode: { type: DataTypes.STRING(128), defaultValue: 'multiplayer' },
            date: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
            scenario: { type: DataTypes.STRING(64) },
            dir: { type: DataTypes.STRING(64) },
            thumbnail: { type: DataTypes.STRING(16), defaultValue: null },
            largeimg: { type: DataTypes.STRING(16), defaultValue: null },
            filename: { type: DataTypes.STRING(32) }
        });
        this.model.sync();
    }

    addPark(params: Partial<NewParkProperties>): Promise<Model<any, any>> {
        return this.model.create(params);
    }

    getParks(page = 1): Promise<Model<any, any>[]> {
        const now = dayjs();
        const pageMonth = now.add(1 - page, 'month').startOf('month');
        const endOfMonth = pageMonth.endOf('month');
        return this.model.findAll({
            where: {
                date: {
                    [Op.gte]: pageMonth,
                    [Op.lt]: endOfMonth
                }
            }
        });
    }

    getParkCount(): Promise<number> {
        return this.model.count();
    }

    getPark(id = -1): Promise<Model<any, any>> {
        return this.model.findByPk(id);
    }

    changeFileName(parkId: number, filename: string): Promise<[affectedCount: number]> {
        return this.model.update({ filename }, { where: { id: parkId } });
    }

    updateDate(parkId: number, date: Date | null = null): Promise<[affectedCount: number]> {
        return this.model.update({ date: date || (new Date()).getTime() }, { where: { id: parkId } });
    }

    getMissingImage(fullsize = true): Promise<Model<any, any>> {
        return this.model.findOne({
            where: {
                [fullsize ? 'largeimg' : 'thumbnail']: null
            },
            limit: 1,
        });
    }

    replaceImage(id: number, filename: string, fullsize = true): Promise<[affectedCount: number]> {
        return this.model.update({ [fullsize ? 'largeimg' : 'thumbnail']: filename }, { where: { id } });
    }

    removeImages(parkId: number): Promise<[affectedCount: number]> {
        return this.model.update({ largeimg: null, thumbnail: null }, { where: { id: parkId } });
    }

    deletePark(parkId: number): Promise<number> {
        return this.model.destroy({ where: { id: parkId } });
    }
}

export default DbAdapter;
export { DbAdapter };
export type { AdapterOptions };
