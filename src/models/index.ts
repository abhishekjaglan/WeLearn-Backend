import User from "./User";
import Record from "./Record";
import sequelize from "../config/database";

export function initializeModels(){
    User.initModel(sequelize);
    Record.initModel(sequelize);

    User.hasMany(Record, { foreignKey: 'user' });
    Record.belongsTo(User, { foreignKey: 'user' });
}