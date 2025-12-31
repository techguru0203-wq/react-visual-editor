import { IRedisData } from './types';
import Redis from 'ioredis';

export class AppRedis {
  private redisClient: Redis;
  private defaultExpireInSec = 7 * 24 * 3600;

  constructor() {
    console.log('redis url: ', process.env.REDIS_URL);

    if (!process.env.REDIS_URL) {
      throw new Error('REDIS_URL environment variable is not set');
    }

    this.redisClient = new Redis(process.env.REDIS_URL, {
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      connectTimeout: 10000,
    });

    this.redisClient.on('connect', () => {
      console.log('Redis client connected');
    });

    this.redisClient.on('error', (err) => {
      console.error('Redis client error:', err);
    });

    this.redisClient.on('ready', () => {
      console.log('Redis client ready');
    });
  }

  getClient() {
    if (!this.redisClient) {
      throw new Error('Redis client not initialized');
    }
    return this.redisClient;
  }

  async setData(data: IRedisData) {
    let { key, val, expireInSec } = data;
    let expire = expireInSec || this.defaultExpireInSec;
    let value = typeof val === 'string' ? val : JSON.stringify(val);
    let result = '';
    console.log('redis.setData:', key, value, expire);
    try {
      result = await this.redisClient.set(key, value);
      this.redisClient.expire(key, expire);
    } catch (err) {
      console.error('redis.setData.error:', err);
    }
    if (result === 'OK') {
      console.log('Redis.setData.success:', key, expire);
    } else {
      console.error('Redis.setData.failure:', key, val, expire);
    }
  }

  async getData(key: string): Promise<string | null> {
    if (!key) {
      return null;
    }
    return await this.redisClient.get(key);
  }

  async clearData(key: string) {
    await this.redisClient.del(key);
  }
}

export const RedisSingleton = new AppRedis();
