import React from 'react';
import { Disclosure as HeadlessDisclosure, Transition } from '@headlessui/react';
import { ChevronUpIcon } from '@heroicons/react/20/solid';
import clsx from 'clsx';

interface DisclosureProps {
  title: string | React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
}

export default function Disclosure({
  title,
  children,
  defaultOpen = false,
  className,
}: DisclosureProps) {
  return (
    <HeadlessDisclosure defaultOpen={defaultOpen}>
      {({ open }) => (
        <div className={clsx('w-full', className)}>
          <HeadlessDisclosure.Button className="flex w-full justify-between rounded-lg bg-gray-100 dark:bg-gray-800 px-4 py-2 text-left text-sm font-medium text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none focus-visible:ring focus-visible:ring-primary-500 focus-visible:ring-opacity-75">
            <span>{title}</span>
            <ChevronUpIcon
              className={clsx(
                'h-5 w-5 text-gray-500 dark:text-gray-400 transition-transform duration-200',
                open ? 'rotate-180 transform' : ''
              )}
            />
          </HeadlessDisclosure.Button>
          <Transition
            enter="transition duration-100 ease-out"
            enterFrom="transform scale-95 opacity-0"
            enterTo="transform scale-100 opacity-100"
            leave="transition duration-75 ease-out"
            leaveFrom="transform scale-100 opacity-100"
            leaveTo="transform scale-95 opacity-0"
          >
            <HeadlessDisclosure.Panel className="px-4 pb-2 pt-4 text-sm text-gray-500 dark:text-gray-400">
              {children}
            </HeadlessDisclosure.Panel>
          </Transition>
        </div>
      )}
    </HeadlessDisclosure>
  );
}

// Compound component for grouped disclosures
Disclosure.Group = function DisclosureGroup({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={clsx('space-y-2', className)}>{children}</div>;
};
