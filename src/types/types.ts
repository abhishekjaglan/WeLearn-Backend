import { UUIDTypes } from "uuid";

export interface CreateUser{
    firstName: String,
    lastName: String,
}

export interface GetUser{
    firstName: String,
    lastName: String,
}

export interface DeleteUser{
    firstName: String,
    lastName: String,
}

export interface CreateRecord{
    user: string,
    mediaType: String,
    mediaName: String,
}