import Record from "../models/Record";
import { UserService } from "./user.service";
import logger from "../utils/logger";
import { AppError, DatabaseError } from "../types/error.type";
import { CreateRecord } from "../types/types";
import { UUIDTypes } from "uuid";

export class RecordService {
    private userService: UserService;

    constructor() {
        this.userService = new UserService();
    }

    async createRecord(userId: string, record: CreateRecord){
        // check if user exists
        let existingUser;
        try {
            existingUser = await this.userService.getUser(userId);
        } catch (err: any) {
            logger.error(`Error fetching the user: ${userId}`, err);
            throw new DatabaseError(err.message);
        }

        if(!existingUser){
            logger.error(`User does not exist`);
            throw new AppError("User does not exist", 400); 
        }

        let newRecord;
        try {
            newRecord = await Record.create({ user: existingUser.id, mediaType: record.mediaType, mediaName: record.mediaName });
        } catch (err: any) {
            logger.error(`Error creating the record: ${record}`, err);
            throw new DatabaseError(err.message);
        }

        if(newRecord){
            logger.info(`Record ${newRecord} created!`);
        }
        
        return {
            id: newRecord.id ,
            user: newRecord.user,
            mediaType: newRecord.mediaType,
            mediaName: newRecord.mediaName
        }
    }

    async getRecordsByUser(userId: string){
        // check if user exists
        let existingUser;
        try {
            existingUser = await this.userService.getUser(userId);
        } catch (err: any) {
            logger.error(`Error fetching the user: ${userId}`, err);
            throw new DatabaseError(err.message);
        }

        if(!existingUser){
            logger.error(`User does not exist`);
            throw new AppError("User does not exist", 400); 
        }

        let records;
        try {
            records = await Record.findAll({ where: { user: existingUser.id } });
        } catch (err: any) {
            logger.error(`Error fetching the records for user: ${userId}`, err);
            throw new DatabaseError(err.message);
        }

        return records;
    }

    async getRecordById(userId: string, recordId: string){
        // check if user exists
        let existingUser;
        try {
            existingUser = await this.userService.getUser(userId);
        } catch (err: any) {
            logger.error(`Error fetching the user: ${userId}`, err);
            throw new DatabaseError(err.message);
        }

        if(!existingUser){
            logger.error(`User does not exist`);
            throw new AppError("User does not exist", 400); 
        }

        let record;
        try {
            record = await Record.findOne({ where: { id: recordId, user: existingUser.id } });
        } catch (err: any) {
            logger.error(`Error fetching the record for user: ${existingUser.id}`, err);
            throw new DatabaseError(err.message);
        }

        return record;
    }

    async deleteRecordsByUser(userId: string){
        // check if user exists
        let existingUser;
        try {
            existingUser = await this.userService.getUser(userId);
        } catch (err: any) {
            logger.error(`Error fetching the user: ${userId}`, err);
            throw new DatabaseError(err.message);
        }

        if(!existingUser){
            logger.error(`User does not exist`);
            throw new AppError("User does not exist", 400); 
        }

        let records;
        try {
            records = await Record.destroy({ where: { user: existingUser.id } });
        } catch (err: any) {
            logger.error(`Error deleting the records for user: ${userId}`, err);
            throw new DatabaseError(err.message);
        }

        return records;
    }

    async deleteRecordById(userId: string, recordId: string){
        // check if user exists
        let existingUser;
        try {
            existingUser = await this.userService.getUser(userId);
        } catch (err: any) {
            logger.error(`Error fetching the user: ${userId}`, err);
            throw new DatabaseError(err.message);
        }

        if(!existingUser){
            logger.error(`User does not exist`);
            throw new AppError("User does not exist", 400); 
        }

        let record;
        try {
            record = await Record.destroy({ where: { id: recordId, user: existingUser.id } });
        } catch (err: any) {
            logger.error(`Error deleting the record for id: ${recordId}`, err);
            throw new DatabaseError(err.message);
        }

        return record;
    }
}