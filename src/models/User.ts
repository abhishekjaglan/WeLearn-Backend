import { DataTypes, Model, Sequelize } from "sequelize";

export default class User extends Model {
    static initModel(sequelize:Sequelize){
        User.init(
            {
              id: {
                  type: DataTypes.UUID,
                  allowNull: false,
                  defaultValue: DataTypes.UUIDV4,
                  primaryKey: true
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