export enum DetailLevel {
    SHORT = 'short',
    MEDIUM = 'medium',
    DETAILED = 'detailed',
  }
  
  export interface SummarizationRequest {
    file: Express.Multer.File;
    detailLevel: DetailLevel;
    userId: string;
  }
  
  export interface SummarizationResponse {
    summary: string;
    recordId: string;
  }