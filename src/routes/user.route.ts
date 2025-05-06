import { Router } from "express";
import { userController } from "../controllers/user.controller.js";

const userRouter = Router();

// TODO: Add controller class/function
userRouter.get('/', (req, res, next) => { userController.getUser(req, res, next) });
userRouter.post('/', (req, res, next) => { userController.createUser(req, res, next) });
userRouter.get('/all', (req, res, next) => { userController.getAllUsers(req, res, next) });
userRouter.delete('/', (req, res, next) => { userController.deleteUser(req, res, next) });

export default userRouter;