import React from 'react';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import Dialog from './Dialog';

interface ConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
}

const variantIcons = {
  danger: ExclamationTriangleIcon,
  warning: ExclamationTriangleIcon,
  info: ExclamationTriangleIcon,
};

const variantColors = {
  danger: 'text-red-600 dark:text-red-400',
  warning: 'text-amber-600 dark:text-amber-400',
  info: 'text-blue-600 dark:text-blue-400',
};

export default function ConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'warning',
}: ConfirmationDialogProps) {
  const Icon = variantIcons[variant];

  return (
    <Dialog isOpen={isOpen} onClose={onClose} size="sm" showCloseButton={false}>
      <div className="sm:flex sm:items-start">
        <div
          className={`mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-${variant === 'danger' ? 'red' : variant === 'warning' ? 'amber' : 'blue'}-100 dark:bg-${variant === 'danger' ? 'red' : variant === 'warning' ? 'amber' : 'blue'}-900/20 sm:mx-0 sm:h-10 sm:w-10`}
        >
          <Icon className={`h-6 w-6 ${variantColors[variant]}`} aria-hidden="true" />
        </div>
        <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left">
          <h3 className="text-base font-semibold leading-6 text-gray-900 dark:text-white">
            {title}
          </h3>
          <div className="mt-2">
            <p className="text-sm text-gray-500 dark:text-gray-400">{message}</p>
          </div>
        </div>
      </div>
      <Dialog.Actions>
        <Dialog.Button variant="secondary" onClick={onClose}>
          {cancelText}
        </Dialog.Button>
        <Dialog.Button
          variant={variant === 'danger' ? 'danger' : 'primary'}
          onClick={() => {
            onConfirm();
            onClose();
          }}
        >
          {confirmText}
        </Dialog.Button>
      </Dialog.Actions>
    </Dialog>
  );
}
