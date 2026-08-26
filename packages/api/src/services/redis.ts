import { createClient, RedisClientType } from 'redis';

const globalForRedis = globalThis as unknown as {
  redis: RedisClientType | undefined;
};

export const redis = globalForRedis.redis || createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 10) {
        return new Error('Redis connection failed after multiple retries');
      }
      return Math.min(retries * 100, 3000);
    }
  }
});

redis.on('error', (err) => console.error('Redis Client Error:', err));
redis.on('connect', () => console.log('✅ Connected to Redis'));
redis.on('disconnect', () => console.log('❌ Disconnected from Redis'));

if (process.env.NODE_ENV !== 'production') {
  globalForRedis.redis = redis;
}

export const cacheService = {
  async set(key: string, value: any, ttl?: number) {
    try {
      const serialized = JSON.stringify(value);
      if (ttl) {
        await redis.setEx(key, ttl, serialized);
      } else {
        await redis.set(key, serialized);
      }
    } catch (error) {
      console.error('Cache set error:', error);
    }
  },

  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await redis.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  },

  async del(key: string) {
    try {
      await redis.del(key);
    } catch (error) {
      console.error('Cache delete error:', error);
    }
  },

  async invalidatePattern(pattern: string) {
    try {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(keys);
      }
    } catch (error) {
      console.error('Cache invalidation error:', error);
    }
  }
};

export default redis;
