import React, { Fragment } from 'react';
import { Menu as HeadlessMenu, Transition } from '@headlessui/react';
import { ChevronDownIcon } from '@heroicons/react/20/solid';
import clsx from 'clsx';

interface MenuProps {
  label: string | React.ReactNode;
  children: React.ReactNode;
  align?: 'left' | 'right';
  buttonClassName?: string;
}

export default function Menu({ label, children, align = 'right', buttonClassName }: MenuProps) {
  return (
    <HeadlessMenu as="div" className="relative inline-block text-left">
      <div>
        <HeadlessMenu.Button
          className={clsx(
            'inline-flex w-full justify-center items-center gap-x-1.5 rounded-md bg-white dark:bg-gray-800 px-3 py-2 text-sm font-medium text-gray-900 dark:text-white shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500',
            buttonClassName
          )}
        >
          {label}
          <ChevronDownIcon className="-mr-1 h-5 w-5 text-gray-400" aria-hidden="true" />
        </HeadlessMenu.Button>
      </div>

      <Transition
        as={Fragment}
        enter="transition ease-out duration-100"
        enterFrom="transform opacity-0 scale-95"
        enterTo="transform opacity-100 scale-100"
        leave="transition ease-in duration-75"
        leaveFrom="transform opacity-100 scale-100"
        leaveTo="transform opacity-0 scale-95"
      >
        <HeadlessMenu.Items
          className={clsx(
            'absolute z-10 mt-2 w-56 origin-top-right rounded-md bg-white dark:bg-gray-800 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none',
            align === 'right' ? 'right-0' : 'left-0'
          )}
        >
          <div className="py-1">{children}</div>
        </HeadlessMenu.Items>
      </Transition>
    </HeadlessMenu>
  );
}

// Menu Item component
Menu.Item = function MenuItem({
  children,
  onClick,
  disabled = false,
  icon: Icon,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <HeadlessMenu.Item disabled={disabled}>
      {({ active }) => (
        <button
          onClick={onClick}
          className={clsx(
            'group flex w-full items-center px-4 py-2 text-sm',
            active
              ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
              : 'text-gray-700 dark:text-gray-300',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        >
          {Icon && (
            <Icon
              className={clsx(
                'mr-3 h-5 w-5',
                active ? 'text-gray-500 dark:text-gray-400' : 'text-gray-400 dark:text-gray-500'
              )}
              aria-hidden="true"
            />
          )}
          {children}
        </button>
      )}
    </HeadlessMenu.Item>
  );
};

// Menu Divider component
Menu.Divider = function MenuDivider() {
  return <div className="my-1 h-px bg-gray-200 dark:bg-gray-700" />;
};
