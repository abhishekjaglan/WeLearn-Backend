import { DataTypes, Model, Sequelize } from "sequelize";
import { UUIDTypes } from "uuid";

export default class User extends Model {
    declare id: String;
    declare firstName: String
    declare lastName: String
    
    static initModel(sequelize:Sequelize){
        User.init(
            {
              id: {
                  type: DataTypes.STRING,
                  allowNull: false,
                  primaryKey: true,
                  autoIncrement: true,
              },
              firstName: {
                type: DataTypes.STRING,
                allowNull: false,
                
              },
              lastName: {
                type: DataTypes.STRING,
                allowNull: false,
              },
            },
            {
              // Other model options go here
              sequelize, // We need to pass the connection instance
              timestamps: true,
              createdAt: true,
              modelName: 'User', // We need to choose the model name
              tableName: 'Users'
            },
        );
    }
};