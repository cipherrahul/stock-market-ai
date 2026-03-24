/**
 * Format and Number Utilities
 */

export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
  }).format(value);
};

export const formatPercent = (value: number, decimals: number = 2): string => {
  return `${value.toFixed(decimals)}%`;
};

export const formatNumber = (value: number, decimals: number = 2): string => {
  return value.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

export const formatLargeNumber = (value: number): string => {
  if (value >= 1000000) return (value / 1000000).toFixed(2) + 'M';
  if (value >= 1000) return (value / 1000).toFixed(2) + 'K';
  return value.toFixed(2);
};

export const formatDate = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export const formatDateTime = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

export const formatTime = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

export const getColorForValue = (value: number): string => {
  if (value > 0) return 'text-green-500';
  if (value < 0) return 'text-red-500';
  return 'text-gray-400';
};

export const getBackgroundColorForValue = (value: number): string => {
  if (value > 0) return 'bg-green-500/10';
  if (value < 0) return 'bg-red-500/10';
  return 'bg-gray-500/10';
};
