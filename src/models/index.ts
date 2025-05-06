import User from "./User.js";
import Record from "./Record.js";
import sequelize from "../config/database.js";

export function initializeModels() {
    User.initModel(sequelize);
    Record.initModel(sequelize);

    User.hasMany(Record, { foreignKey: 'user' });
    Record.belongsTo(User, { foreignKey: 'user' });
}