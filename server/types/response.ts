import { Response } from 'express';
import { AuthenticatedLocals, AuthenticatedProfileLocals } from './authTypes';

export type ResponseData<T> =
  | Readonly<{ success: false; errorMsg: string }>
  | Readonly<{ success: true; data: T }>
  | Readonly<{
      success: true;
      data: {
        list: T;
        pagination: PaginationInfo;
      };
    }>;
export type StandardResponse<T = any> = Response<ResponseData<T>>;
export type AuthenticatedResponse<T = any> = Response<
  ResponseData<T>,
  AuthenticatedLocals
>;
export type ProfileResponse<T = any> = Response<
  ResponseData<T>,
  AuthenticatedProfileLocals
>;
export type PaginationInfo = {
  page: number;
  limit: number;
  total: number;
};
