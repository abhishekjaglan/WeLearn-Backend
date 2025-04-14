import { UUIDTypes } from "uuid";
import User from "../models/User";
import { AppError, DatabaseError } from "../types/error.type";
import { CreateUser, DeleteUser, GetUser } from "../types/types";
import logger from "../utils/logger";

export class UserService{
    
    async createUser(user: CreateUser) {
        // check if user exists
        let existingUser;
        try {
            existingUser = await User.findOne({ where: { firstName: user.firstName, lastName: user.lastName } });
        } catch (err: any) {
            logger.error(`Error fetching the user: ${user}`, err);
            throw new DatabaseError(err.message);
        }

        if(existingUser){
            logger.error(`User already exists`);
            throw new AppError("User already exists", 400);
        }

        let newUser;
        try {
            newUser = await User.create({ firstName: user.firstName, lastName: user.lastName });
        } catch (err: any) {
            logger.error(`Error creating the user: ${user}`, err);
            throw new DatabaseError(err.message);
        }

        if(newUser){
            logger.info(`User ${newUser.firstName} ${newUser.lastName} created!`);
        }
        
        return {
            id: newUser.id ,
            firstName: newUser.firstName,
            lastName: newUser.lastName
        }
    }

    async getUser(userId: string) {
        // check if user exists
        let existingUser;
        try {
            existingUser = await User.findOne({ where: { id: userId }});
        } catch (err: any) {
            logger.error(`Error fetching the user: ${userId}`, err);
            throw new DatabaseError(err.message);
        }

        if(!existingUser){
            logger.error(`User does not exist`);
            throw new AppError("User does not exist exists", 400); 
        }

        return existingUser;
    }

    async getAllUsers(){

        let allUsers;
        try {
            allUsers = await User.findAll();   
        } catch (err: any) {
            logger.error(`Error fetching all the users`, err);
            throw new DatabaseError(err.message);
        }

        if(allUsers){
            return allUsers
        }

        logger.warn(`No users found`);
        return 
    }

    async deleteUser(userId: string){
        
        // check if user exists
        let existingUser;
        try {
            existingUser = await User.findOne({ where: { id: userId }});
        } catch (err: any) {
            logger.error(`Error fetching the user: ${userId}`, err);
            throw new DatabaseError(err.message);
        }

        if(!existingUser){
            logger.error(`User does not exist`);
            throw new AppError(`User does not exist`, 400);
        }

        let deletedUser;
        try {
            deletedUser = await User.destroy({ where: { id: userId } });
            logger.info(`Deleted user: ${deletedUser}`);
        } catch (err: any) {
            logger.error(`Error deleting the user: ${userId}`, err);
            throw new DatabaseError(err.message);
        }

        return deletedUser;
    }
}