import dotenv from 'dotenv';

dotenv.config();

export const config = {
    //app
    PORT: process.env.PORT || 3005,
    NODE_ENV: process.env.NODE_ENV || 'development',
    //aws
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
    AWS_REGION: process.env.AWS_REGION,
    AWS_S3_BUCKET: process.env.AWS_S3_BUCKET,
    /// gemini - llm
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    //redis
    REDIS_HOST: process.env.REDIS_HOST || 'localhost',
    REDIS_PORT: process.env.REDIS_PORT || 6379,
    // bcrypt
    BCRYPT_SALT_ROUNDS: parseInt(process.env.BCRYPT_SALT_ROUNDS || '10'),
}