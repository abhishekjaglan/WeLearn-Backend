import { DataTypes, Model, Sequelize } from "sequelize";

export default class User extends Model {
  declare id: number;
  declare firstName: string;
  declare lastName: string;

  static initModel(sequelize: Sequelize) {
    User.init(
      {
        id: {
          type: DataTypes.INTEGER,
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