import React from 'react';
import clsx from 'clsx';
import { getPacingColor, formatPercentage } from '@bravo-1/shared';

interface ProgressBarProps {
  value: number; // 0-1
  showPercentage?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function ProgressBar({
  value,
  showPercentage = false,
  size = 'md',
  className,
}: ProgressBarProps) {
  const percentage = Math.min(Math.max(value * 100, 0), 100);
  const color = getPacingColor(value);

  const sizeClasses = {
    sm: 'h-1.5',
    md: 'h-2',
    lg: 'h-3',
  };

  // Extract color name from the CSS class
  const colorName = color.includes('green')
    ? 'green'
    : color.includes('yellow')
      ? 'yellow'
      : color.includes('red')
        ? 'red'
        : 'gray';

  const bgColorClasses = {
    green: 'bg-gradient-to-r from-green-400 to-green-500',
    yellow: 'bg-gradient-to-r from-yellow-400 to-yellow-500',
    red: 'bg-gradient-to-r from-red-400 to-red-500',
    gray: 'bg-gradient-to-r from-gray-400 to-gray-500',
  };

  const textColorClasses = {
    green: 'text-green-700',
    yellow: 'text-yellow-700',
    red: 'text-red-700',
    gray: 'text-gray-700',
  };

  return (
    <div className={clsx('w-full', className)}>
      <div className="flex items-center">
        <div className="flex-1">
          <div
            className={clsx(
              'overflow-hidden rounded-full bg-gray-200 shadow-inner',
              sizeClasses[size]
            )}
          >
            <div
              className={clsx(
                'h-full transition-all duration-300 ease-out shadow-sm',
                bgColorClasses[colorName as keyof typeof bgColorClasses]
              )}
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
        {showPercentage && (
          <div
            className={clsx(
              'ml-3 text-sm font-medium min-w-[3rem] text-right',
              textColorClasses[colorName as keyof typeof textColorClasses]
            )}
          >
            {formatPercentage(value)}
          </div>
        )}
      </div>
    </div>
  );
}
