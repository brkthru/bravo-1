import React from 'react';
import { Switch as HeadlessSwitch } from '@headlessui/react';
import clsx from 'clsx';

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: {
    switch: 'h-4 w-8',
    thumb: 'h-3 w-3',
    translate: 'translate-x-4',
  },
  md: {
    switch: 'h-6 w-11',
    thumb: 'h-5 w-5',
    translate: 'translate-x-5',
  },
  lg: {
    switch: 'h-7 w-14',
    thumb: 'h-6 w-6',
    translate: 'translate-x-7',
  },
};

export default function Switch({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  size = 'md',
}: SwitchProps) {
  const sizes = sizeClasses[size];

  return (
    <HeadlessSwitch.Group as="div" className="flex items-center">
      <HeadlessSwitch
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className={clsx(
          'relative inline-flex flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
          sizes.switch,
          checked ? 'bg-primary-600' : 'bg-gray-200 dark:bg-gray-700',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <span className="sr-only">{label}</span>
        <span
          aria-hidden="true"
          className={clsx(
            'pointer-events-none inline-block transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
            sizes.thumb,
            checked ? sizes.translate : 'translate-x-0'
          )}
        />
      </HeadlessSwitch>
      {(label || description) && (
        <HeadlessSwitch.Label as="span" className="ml-3 flex flex-col">
          {label && (
            <span className="text-sm font-medium text-gray-900 dark:text-white">{label}</span>
          )}
          {description && (
            <span className="text-sm text-gray-500 dark:text-gray-400">{description}</span>
          )}
        </HeadlessSwitch.Label>
      )}
    </HeadlessSwitch.Group>
  );
}
