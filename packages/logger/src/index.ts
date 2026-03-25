/**
 * Centralized Structured Logging Module
 * 
 * Uses Winston for JSON-formatted structured logging across all services
 * Includes correlation IDs for request tracing
 */

import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { Request, Response, NextFunction } from 'express';

const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const SERVICE_NAME = process.env.SERVICE_NAME || 'stock-market-agent';
const ENVIRONMENT = process.env.NODE_ENV || 'development';

/**
 * Custom format for structured JSON logging
 */
const customFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf((info) => {
    const log: Record<string, any> = {
      timestamp: info.timestamp,
      level: info.level.toUpperCase(),
      service: SERVICE_NAME,
      environment: ENVIRONMENT,
      message: info.message,
    };

    // Add correlation ID if available
    if (info.correlationId) {
      log.correlationId = info.correlationId;
    }

    // Add user info if available
    if (info.userId) {
      log.userId = info.userId;
    }

    // Add request info if available
    if (info.path) {
      log.path = info.path;
      log.method = info.method;
      log.duration = info.duration;
      log.statusCode = info.statusCode;
    }

    // Add error info if available
    if (info.error) {
      log.error = info.error;
      log.stack = info.stack;
    }

    // Add custom metadata
    if (info.metadata) {
      log.metadata = info.metadata;
    }

    return JSON.stringify(log);
  })
);

/**
 * Create Winston logger instance
 */
export const logger = winston.createLogger({
  format: customFormat,
  defaultMeta: {
    service: SERVICE_NAME,
    environment: ENVIRONMENT,
  },
  transports: [
    // Console transport for development
    new winston.transports.Console({
      level: LOG_LEVEL,
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),

    // File transport for all logs
    new DailyRotateFile({
      level: 'info',
      filename: 'logs/%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '100m',
      maxDays: '30',
      format: customFormat,
    }),

    // File transport for errors only
    new DailyRotateFile({
      level: 'error',
      filename: 'logs/errors/%DATE%-error.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '100m',
      maxDays: '90',
      format: customFormat,
    }),
  ],
});

/**
 * Express middleware for logging requests
 */
export function requestLoggingMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const startTime = Date.now();
  const correlationId = req.get('X-Request-ID') || generateCorrelationId();

  // Store correlation ID in request for use in downstream code
  (req as any).correlationId = correlationId;

  // Log incoming request
  logger.info('Incoming request', {
    correlationId,
    method: req.method,
    path: req.path,
    userId: (req as any).userId,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });

  // Capture response
  const originalSend = res.send;
  res.send = function (data) {
    const duration = Date.now() - startTime;

    logger.info('Outgoing response', {
      correlationId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      userId: (req as any).userId,
    });

    return originalSend.call(this, data);
  };

  next();
}

/**
 * Generate unique correlation ID
 */
export function generateCorrelationId(): string {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substr(2, 9);
  return `${timestamp}-${randomStr}`;
}

/**
 * Log database query execution
 */
export function logDatabaseQuery(
  query: string,
  duration: number,
  correlationId?: string,
  error?: Error
) {
  const logData: Record<string, any> = {
    correlationId,
    message: error ? 'Database query error' : 'Database query executed',
    query: query.substring(0, 200), // Truncate long queries
    duration,
  };

  if (error) {
    logger.error('Database query error', {
      ...logData,
      error: error.message,
      stack: error.stack,
    });
  } else {
    logger.debug('Database query executed', logData);
  }
}

/**
 * Log authentication event
 */
export function logAuthEvent(
  event: 'LOGIN' | 'LOGOUT' | 'REGISTER' | 'TOKEN_REFRESH' | 'AUTH_FAILED',
  userId: string,
  correlationId?: string,
  metadata?: Record<string, any>
) {
  logger.info(`Authentication event: ${event}`, {
    correlationId,
    userId,
    event,
    metadata,
  });
}

/**
 * Log trading event
 */
export function logTradingEvent(
  event: 'ORDER_PLACED' | 'ORDER_EXECUTED' | 'ORDER_CANCELLED' | 'TRADE_FAILED',
  userId: string,
  orderId: string,
  correlationId?: string,
  metadata?: Record<string, any>
) {
  logger.info(`Trading event: ${event}`, {
    correlationId,
    userId,
    orderId,
    event,
    metadata,
  });
}

/**
 * Log risk management event
 */
export function logRiskEvent(
  event: 'RISK_LIMIT_EXCEEDED' | 'POSITION_LIMIT' | 'MARGIN_CALL',
  userId: string,
  correlationId?: string,
  metadata?: Record<string, any>
) {
  logger.warn(`Risk event: ${event}`, {
    correlationId,
    userId,
    event,
    metadata,
  });
}

/**
 * Log system error
 */
export function logSystemError(
  error: Error,
  correlationId?: string,
  context?: Record<string, any>
) {
  logger.error('System error', {
    correlationId,
    error: error.message,
    stack: error.stack,
    context,
  });
}

/**
 * Log service startup
 */
export function logServiceStartup(serviceName: string, port: number) {
  logger.info(`Service started: ${serviceName}:${port}`, {
    service: serviceName,
    port,
    environment: ENVIRONMENT,
    uptime: process.uptime(),
  });
}

/**
 * Log service shutdown
 */
export function logServiceShutdown(serviceName: string, reason: string) {
  logger.info(`Service shutdown: ${serviceName}`, {
    service: serviceName,
    reason,
    uptime: process.uptime(),
  });
}

/**
 * Export logger for use in services
 */
export default logger;

export default Logger;
