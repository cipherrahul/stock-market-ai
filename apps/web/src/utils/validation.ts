/**
 * Form Validation Utilities
 */

export interface ValidationError {
  field: string;
  message: string;
}

export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validatePassword = (password: string): ValidationError[] => {
  const errors: ValidationError[] = [];

  if (password.length < 8) {
    errors.push({
      field: 'password',
      message: 'Password must be at least 8 characters',
    });
  }

  if (!/[A-Z]/.test(password)) {
    errors.push({
      field: 'password',
      message: 'Password must contain uppercase letter',
    });
  }

  if (!/[0-9]/.test(password)) {
    errors.push({
      field: 'password',
      message: 'Password must contain number',
    });
  }

  return errors;
};

export const validateTradingForm = (data: {
  symbol?: string;
  quantity?: number | string;
  price?: number | string;
}): ValidationError[] => {
  const errors: ValidationError[] = [];

  if (!data.symbol || !data.symbol.trim()) {
    errors.push({
      field: 'symbol',
      message: 'Symbol is required',
    });
  }

  if (!data.quantity || Number(data.quantity) <= 0) {
    errors.push({
      field: 'quantity',
      message: 'Quantity must be greater than 0',
    });
  }

  if (!data.price || Number(data.price) <= 0) {
    errors.push({
      field: 'price',
      message: 'Price must be greater than 0',
    });
  }

  return errors;
};

export const validateUserSettings = (data: {
  riskLevel?: string;
  maxPositionSize?: number | string;
}): ValidationError[] => {
  const errors: ValidationError[] = [];

  if (
    !data.riskLevel ||
    !['low', 'medium', 'high'].includes(data.riskLevel)
  ) {
    errors.push({
      field: 'riskLevel',
      message: 'Invalid risk level',
    });
  }

  if (!data.maxPositionSize || Number(data.maxPositionSize) <= 0) {
    errors.push({
      field: 'maxPositionSize',
      message: 'Max position size must be greater than 0',
    });
  }

  return errors;
};
