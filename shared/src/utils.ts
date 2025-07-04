// Utility functions for formatting and calculations

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

export const formatPercentage = (value: number, decimals = 1): string => {
  return `${(value * 100).toFixed(decimals)}%`;
};

export const formatDate = (date: Date | string): string => {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(date));
};

export const calculateDaysElapsed = (startDate: Date, endDate: Date): number => {
  const now = new Date();
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (now < start) return 0;
  if (now > end) return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

  return Math.ceil((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
};

export const calculateTotalDuration = (startDate: Date, endDate: Date): number => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
};

export const calculatePacing = (actual: number, planned: number): number => {
  if (planned === 0) return 0;
  return actual / planned;
};

export const getStatusColor = (status: 'L1' | 'L2' | 'L3'): string => {
  switch (status) {
    case 'L1':
      return 'bg-green-100 text-green-800';
    case 'L2':
      return 'bg-yellow-100 text-yellow-800';
    case 'L3':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

export const getPacingColor = (pacing: number): string => {
  if (pacing < 0.8) return 'bg-red-500';
  if (pacing < 0.95) return 'bg-yellow-500';
  if (pacing > 1.2) return 'bg-red-500';
  return 'bg-green-500';
};

export const generateId = (): string => {
  return Math.random().toString(36).substr(2, 9);
};
