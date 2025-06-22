import React from 'react';
import clsx from 'clsx';
import { CampaignStatus } from '@mediatool/shared';

interface StatusBadgeProps {
  status: CampaignStatus | string;
  className?: string;
}

const getStatusStyles = (status: string): string => {
  const normalizedStatus = status.toLowerCase();
  
  if (normalizedStatus.includes('live')) {
    return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
  } else if (normalizedStatus.includes('scheduled')) {
    return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
  } else if (normalizedStatus.includes('completed') || normalizedStatus.includes('ended')) {
    return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400';
  } else if (normalizedStatus.includes('paused')) {
    return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
  } else if (normalizedStatus.includes('draft')) {
    return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400';
  } else if (normalizedStatus === 'l1' || normalizedStatus === 'active') {
    return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
  } else if (normalizedStatus === 'l2') {
    return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
  } else if (normalizedStatus === 'l3') {
    return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
  }
  
  return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400';
};

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        getStatusStyles(status),
        className
      )}
    >
      {status}
    </span>
  );
}