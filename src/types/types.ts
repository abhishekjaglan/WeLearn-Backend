

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

export interface Block {
        BlockType: 'LINE' | 'WORD' | string;
        Text?: string;
        Id?: string;
        Relationships?: Relationship[];
    }

export interface Relationship {
        Type: 'CHILD' | string;
        Ids?: string[];
    }