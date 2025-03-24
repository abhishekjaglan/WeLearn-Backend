import express ,{ Request, Response } from "express";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3005;

app.use(express.json());

app.get('/health', async(req: Request, res: Response) => {
    res.status(200).json({
        status: "ok",
        message: "WeLearn Backend is running"
    });
});

app.listen(PORT, (err) => {
    if(err){
        console.error(`Error starting backend server!`)
    }
    console.log(`WeLearn backend server running on port ${PORT}!`);
});