import React from 'react';
import { SunIcon, MoonIcon, ComputerDesktopIcon } from '@heroicons/react/24/outline';
import { useTheme } from '../../contexts/ThemeContext';
import clsx from 'clsx';

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const options = [
    { value: 'light' as const, icon: SunIcon, label: 'Light' },
    { value: 'dark' as const, icon: MoonIcon, label: 'Dark' },
    { value: 'system' as const, icon: ComputerDesktopIcon, label: 'System' }
  ];

  return (
    <div className="flex items-center space-x-1 rounded-lg bg-gray-100 dark:bg-gray-800 p-1">
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => setTheme(option.value)}
          className={clsx(
            'flex items-center justify-center rounded-md p-2 text-sm font-medium transition-all',
            theme === option.value
              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          )}
          title={option.label}
        >
          <option.icon className="h-4 w-4" />
          <span className="sr-only">{option.label}</span>
        </button>
      ))}
    </div>
  );
}