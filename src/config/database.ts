import { Sequelize } from "sequelize";
import dotenv from 'dotenv';
import { initializeModels } from "../models/index.js";

import '../models/Record.js';
import '../models/User.js';
import '../models/index.js';

dotenv.config();

const sequelize = new Sequelize({
    dialect: 'postgres',
    host: process.env.POSTGRES_HOST || 'localhost',
    port: Number(process.env.POSTGRES_PORT) || 5432,
    username: process.env.POSTGRES_USER || 'welearn_user',
    password: process.env.POSTGRES_PASSWORD || 'welearn_password',
    database: process.env.POSTGRES_DB || 'welearn_db',
    logging: process.env.NODE_ENV === 'development' ? console.log : false, // Log SQL in dev
});

export async function connectDB() {
    try {
        //checks connection to db
        await sequelize.authenticate();
        console.log('Database connection established successfully.')

        //initializing models after sequalize is initialized
        initializeModels();

        // creating/updating tables as per models
        await sequelize.sync({ alter: true });
    } catch (error) {
        console.error('Unable to connect to database:', error);
        await sequelize.close();
        process.exit(1);
    }
};

export default sequelize;