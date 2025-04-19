
import { DataTypes, Model, Sequelize } from "sequelize";
import { UUIDTypes } from "uuid";

export default class Record extends Model {
    declare id: String;
    declare user: String;
    declare mediaType: String;
    declare mediaName: String;
    declare createdAt: Date;

    static initModel(sequelize:Sequelize){
        Record.init(
            {
              id: {
                  type: DataTypes.STRING,
                  allowNull: false,
                  primaryKey: true,
                autoIncrement: true,
              },
              user: {
                  type: DataTypes.STRING,
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