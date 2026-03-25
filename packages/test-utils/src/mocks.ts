/**
 * Test utilities for mocking external services
 */

/**
 * Mock Redis client
 */
export function createMockRedisClient() {
  const store = new Map<string, any>();
  
  return {
    get: jest.fn(async (key: string) => store.get(key)),
    set: jest.fn(async (key: string, value: any, options?: any) => {
      store.set(key, value);
      if (options?.EX) {
        setTimeout(() => store.delete(key), options.EX * 1000);
      }
    }),
    del: jest.fn(async (key: string) => store.delete(key)),
    expire: jest.fn(async (key: string, seconds: number) => {
      setTimeout(() => store.delete(key), seconds * 1000);
    }),
    incr: jest.fn(async (key: string) => {
      const current = (store.get(key) as number) || 0;
      const next = current + 1;
      store.set(key, next);
      return next;
    }),
    decr: jest.fn(async (key: string) => {
      const current = (store.get(key) as number) || 0;
      const next = current - 1;
      store.set(key, next);
      return next;
    }),
    lpush: jest.fn(async (key: string, ...values: any[]) => {
      const list = (store.get(key) as any[]) || [];
      list.unshift(...values);
      store.set(key, list);
    }),
    rpush: jest.fn(async (key: string, ...values: any[]) => {
      const list = (store.get(key) as any[]) || [];
      list.push(...values);
      store.set(key, list);
    }),
    lrange: jest.fn(async (key: string, start: number, end: number) => {
      const list = (store.get(key) as any[]) || [];
      return list.slice(start, end + 1);
    }),
    hset: jest.fn(async (key: string, field: string, value: any) => {
      const obj = (store.get(key) as any) || {};
      obj[field] = value;
      store.set(key, obj);
    }),
    hget: jest.fn(async (key: string, field: string) => {
      const obj = (store.get(key) as any) || {};
      return obj[field];
    }),
    hgetall: jest.fn(async (key: string) => {
      return (store.get(key) as any) || {};
    }),
    ping: jest.fn(async () => 'PONG'),
    quit: jest.fn(),
  };
}

/**
 * Mock Kafka producer
 */
export function createMockKafkaProducer() {
  const messages: any[] = [];
  
  return {
    send: jest.fn(async (record: any) => {
      messages.push(record);
      return [
        {
          topicName: record.topic,
          partition: 0,
          errorCode: 0,
          offset: `${messages.length - 1}`,
          timestamp: Date.now(),
        },
      ];
    }),
    getMessages: () => messages,
    clearMessages: () => messages.splice(0, messages.length),
    disconnect: jest.fn(),
  };
}

/**
 * Mock Kafka consumer
 */
export function createMockKafkaConsumer() {
  const listeners = new Map<string, Function[]>();
  
  return {
    subscribe: jest.fn(async (topics: any) => {
      // subscribe implementation
    }),
    run: jest.fn(async (config: any) => {
      // store the callbacks for testing
      if (config.eachMessage) {
        if (!listeners.has('message')) {
          listeners.set('message', []);
        }
        listeners.get('message')!.push(config.eachMessage);
      }
    }),
    // Helper for tests to emit messages
    emitMessage: async (topic: string, partition: number, message: any) => {
      const callbacks = listeners.get('message') || [];
      for (const callback of callbacks) {
        await callback({ topic, partition, message });
      }
    },
    disconnect: jest.fn(),
  };
}

/**
 * Mock axios HTTP client
 */
export function createMockHttpClient() {
  return {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    patch: jest.fn(),
    interceptors: {
      request: {
        use: jest.fn(),
        eject: jest.fn(),
      },
      response: {
        use: jest.fn(),
        eject: jest.fn(),
      },
    },
  };
}

/**
 * Mock external API service
 */
export function createMockExternalService(responses?: Record<string, any>) {
  return {
    request: jest.fn(async (path: string) => {
      if (responses && responses[path]) {
        return responses[path];
      }
      return { status: 200, data: {} };
    }),
  };
}
