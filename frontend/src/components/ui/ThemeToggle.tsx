import React from 'react';
import { RadioGroup } from '@headlessui/react';
import { SunIcon, MoonIcon, ComputerDesktopIcon } from '@heroicons/react/24/outline';
import { useTheme } from '../../contexts/ThemeContext';
import clsx from 'clsx';

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const options = [
    { value: 'light' as const, icon: SunIcon, label: 'Light' },
    { value: 'dark' as const, icon: MoonIcon, label: 'Dark' },
    { value: 'system' as const, icon: ComputerDesktopIcon, label: 'System' },
  ];

  return (
    <RadioGroup value={theme} onChange={setTheme}>
      <RadioGroup.Label className="sr-only">Theme</RadioGroup.Label>
      <div className="flex items-center space-x-1 rounded-lg bg-gray-100 dark:bg-gray-800 p-1">
        {options.map((option) => (
          <RadioGroup.Option
            key={option.value}
            value={option.value}
            className={({ checked }) =>
              clsx(
                'flex items-center justify-center rounded-md p-2 text-sm font-medium transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-500',
                checked
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              )
            }
          >
            <option.icon className="h-4 w-4" />
            <span className="sr-only">{option.label}</span>
          </RadioGroup.Option>
        ))}
      </div>
    </RadioGroup>
  );
}
