export const formatCurrency = (value: number, decimals: number = 2): string => {
  return `$${value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
};

export const formatPercentage = (value: number, decimals: number = 2): string => {
  return `${value.toFixed(decimals)}%`;
};

export const formatDate = (date: string | Date): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const calculateReturn = (current: number, initial: number): number => {
  return ((current - initial) / initial) * 100;
};

export const calculateSharpeRatio = (returns: number[], riskFreeRate: number = 0.02): number => {
  const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance =
    returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance);

  return stdDev === 0 ? 0 : (meanReturn - riskFreeRate) / stdDev;
};

export const calculateMaxDrawdown = (prices: number[]): number => {
  let maxDrawdown = 0;
  let peak = prices[0];

  for (let i = 1; i < prices.length; i++) {
    if (prices[i] > peak) {
      peak = prices[i];
    }
    const drawdown = (peak - prices[i]) / peak;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }

  return maxDrawdown;
};
