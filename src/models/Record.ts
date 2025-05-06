
import { DataTypes, Model, Sequelize } from "sequelize";

export default class Record extends Model {
    declare id: number;
    declare user: number;
    declare mediaType: string;
    declare mediaName: string;
    declare createdAt: Date;

    static initModel(sequelize: Sequelize) {
        Record.init(
            {
                id: {
                    type: DataTypes.INTEGER,
                    allowNull: false,
                    primaryKey: true,
                    autoIncrement: true,
                },
                user: {
                    type: DataTypes.INTEGER,
                    allowNull: false,

                },
                mediaType: {
                    type: DataTypes.STRING,
                    allowNull: false,
                },
                mediaName: {
                    type: DataTypes.STRING,
                    allowNull: false,
                },
            },
            {
                // Other model options go here
                sequelize, // We need to pass the connection instance
                timestamps: true,
                createdAt: true,
                modelName: 'Record', // We need to choose the model name
                tableName: 'Records'
            },
        );
    }
};