// Common types for the application
export interface User {
  id: string;
  name: string;
  email: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface FormData {
  email: string;
  password: string;
  remember: boolean;
}

export interface PresignedUrlResponse {
  uploadId: string;
  presignedUrl: string;
  s3Key: string;
  expiresIn: number;
}

export interface UploadCompleteRequest {
  uploadId: string;
  s3Key: string;
  fileName: string;
  fileSize: number;
  fileType: string;
}
