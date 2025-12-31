import { User } from '@prisma/client';

export interface IRedisUserData {
  currentUser: User;
}
export interface IRedisData {
  key: string;
  val: string | IRedisUserData;
  expireInSec?: number;
}
