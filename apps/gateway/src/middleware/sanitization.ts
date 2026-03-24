/**
 * Input Sanitization Middleware
 * Removes XSS attacks and sanitizes all input data
 */

import { Request, Response, NextFunction } from 'express';
import xss from 'xss';
import validator from 'validator';

declare global {
  namespace Express {
    interface Request {
      sanitized?: boolean;
    }
  }
}

/**
 * Recursively sanitize all request properties
 */
function sanitizeValue(value: any): any {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string') {
    // Remove XSS attacks and SQL injection patterns
    let sanitized = xss(value, {
      whiteList: {}, // No HTML tags allowed
      stripIgnoredTag: true,
    });

    // Additional protection against SQL injection sequences
    sanitized = sanitized.replace(/(\b(UNION|SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER)\b)/gi, '');

    // Trim and limit length
    sanitized = sanitized.trim().substring(0, 10000);

    return sanitized;
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }

  if (typeof value === 'object') {
    const sanitized: any = {};
    for (const key in value) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        sanitized[key] = sanitizeValue(value[key]);
      }
    }
    return sanitized;
  }

  return value;
}

/**
 * Middleware to sanitize request body, query, and params
 */
export const sanitizationMiddleware = (req: Request, res: Response, next: NextFunction) => {
  try {
    // Sanitize body
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeValue(req.body);
    }

    // Sanitize query parameters
    if (req.query && typeof req.query === 'object') {
      for (const key in req.query) {
        if (typeof req.query[key] === 'string') {
          req.query[key] = sanitizeValue(req.query[key]);
        }
      }
    }

    // Sanitize params
    if (req.params && typeof req.params === 'object') {
      req.params = sanitizeValue(req.params);
    }

    // Mark as sanitized
    req.sanitized = true;

    next();
  } catch (error) {
    console.error('Sanitization error:', error);
    res.status(400).json({
      error: 'Invalid request format',
      errorCode: 'SANITIZATION_ERROR',
      requestId: req.id,
    });
  }
};

/**
 * Email validation helper
 */
export function validateEmail(email: string): boolean {
  return validator.isEmail(email);
}

/**
 * Password validation helper
 */
export function validatePassword(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  if (!/[!@#$%^&*]/.test(password)) {
    errors.push('Password must contain at least one special character (!@#$%^&*)');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Symbol validation (stock ticker)
 */
export function validateSymbol(symbol: string): boolean {
  return /^[A-Z]{1,6}$/.test(symbol.toUpperCase());
}

/**
 * UUID validation
 */
export function validateUUID(uuid: string): boolean {
  return validator.isUUID(uuid);
}
