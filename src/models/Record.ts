
import { DataTypes, Model, Sequelize } from "sequelize";

export default class Record extends Model {
    static initModel(sequelize:Sequelize){
        Record.init(
            {
              id: {
                  type: DataTypes.UUID,
                  allowNull: false,
                  defaultValue: DataTypes.UUIDV4,
                  primaryKey: true
              },
              user: {
                  type: DataTypes.UUID,
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