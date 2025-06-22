import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { 
  HomeIcon, 
  ChartBarIcon, 
  DocumentTextIcon,
  CogIcon,
  UserCircleIcon,
  ArrowTrendingUpIcon,
  BuildingOfficeIcon,
  ClipboardDocumentListIcon,
  ShoppingCartIcon,
  ChartPieIcon,
  CalendarIcon
} from '@heroicons/react/24/outline';
import { BoltIcon } from '@heroicons/react/24/solid';
import clsx from 'clsx';
import ThemeToggle from './ui/ThemeToggle';
import { useTheme } from '../contexts/ThemeContext';
import { useUser } from '../contexts/UserContext';

const navigationGroups = [
  {
    name: 'Main',
    items: [
      { name: 'Home', href: '/', icon: HomeIcon },
      { name: 'My Schedule', href: '/my-schedule', icon: CalendarIcon },
    ]
  },
  {
    name: 'Planning',
    items: [
      { name: 'Accounts', href: '/accounts', icon: BuildingOfficeIcon },
      { name: 'Campaigns', href: '/campaigns', icon: ChartBarIcon },
      { name: 'Line Items', href: '/line-items', icon: DocumentTextIcon },
    ]
  },
  {
    name: 'Execution',
    items: [
      { name: 'Media Plans', href: '/media-plans', icon: ClipboardDocumentListIcon },
      { name: 'Platform Buys', href: '/platform-buys', icon: ShoppingCartIcon },
    ]
  },
  {
    name: 'Analytics',
    items: [
      { name: 'Dashboard', href: '/analytics', icon: ChartPieIcon },
      { name: 'Reports', href: '/reports', icon: DocumentTextIcon },
    ]
  },
  {
    name: 'Billing',
    items: [
      { name: 'Invoices', href: '/invoices', icon: ArrowTrendingUpIcon },
    ]
  },
  {
    name: 'System',
    items: [
      { name: 'Settings', href: '/settings', icon: CogIcon },
      { name: 'Users', href: '/users', icon: UserCircleIcon },
    ]
  }
];

export default function Layout() {
  const location = useLocation();
  const { resolvedTheme } = useTheme();
  const { currentUser, isLoading } = useUser();
  
  const userName = currentUser?.name || 'Account Manager';
  const userRole = currentUser?.role?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'View profile';
  const avatarUrl = currentUser?.name 
    ? `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(currentUser.name)}`
    : 'https://api.dicebear.com/9.x/avataaars/svg?seed=Account%20Manager';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Sidebar */}
      <div className="fixed inset-y-0 flex w-64 flex-col">
        {/* Sidebar component */}
        <div className="flex min-h-0 flex-1 flex-col bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
          <div className="flex h-16 flex-shrink-0 items-center px-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center">
              <BoltIcon className="h-8 w-8 text-primary-600 dark:text-primary-400" />
              <span className="ml-2 text-xl font-bold text-gray-900 dark:text-white">Bravo</span>
            </div>
          </div>
          <div className="flex flex-1 flex-col overflow-y-auto">
            <nav className="flex-1 px-2 py-4">
              {navigationGroups.map((group) => (
                <div key={group.name} className="mb-6">
                  <h3 className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    {group.name}
                  </h3>
                  <div className="space-y-1">
                    {group.items.map((item) => {
                      const isActive = location.pathname === item.href || 
                        (item.href !== '/' && location.pathname.startsWith(item.href));
                      return (
                        <Link
                          key={item.name}
                          to={item.href}
                          className={clsx(
                            isActive
                              ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                              : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white',
                            'group flex items-center rounded-md px-2 py-2 text-sm font-medium'
                          )}
                        >
                          <item.icon
                            className={clsx(
                              isActive ? 'text-primary-500 dark:text-primary-400' : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-500 dark:group-hover:text-gray-400',
                              'mr-3 h-6 w-6 flex-shrink-0'
                            )}
                            aria-hidden="true"
                          />
                          {item.name}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>
          </div>
          
          {/* User section */}
          <div className="flex flex-shrink-0 border-t border-gray-200 dark:border-gray-700 p-4">
            <Link to="/settings" className="group block w-full flex-shrink-0">
              <div className="flex items-center">
                <div>
                  <img 
                    src={avatarUrl}
                    alt={userName}
                    className="h-9 w-9 rounded-full bg-gray-100"
                  />
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white">
                    {isLoading ? 'Loading...' : userName}
                  </p>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-300">
                    {isLoading ? '...' : userRole}
                  </p>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="pl-64 flex flex-col">
        {/* Top bar */}
        <div className="sticky top-0 z-10 flex h-16 flex-shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="flex flex-1 justify-between px-4">
            <div className="flex flex-1 items-center">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {(() => {
                  for (const group of navigationGroups) {
                    const activeItem = group.items.find(item => 
                      location.pathname === item.href || 
                      (item.href !== '/' && location.pathname.startsWith(item.href))
                    );
                    if (activeItem) return activeItem.name;
                  }
                  return 'Dashboard';
                })()}
              </h2>
            </div>
            <div className="ml-4 flex items-center space-x-4 md:ml-6">
              <ThemeToggle />
              <div className="text-xs text-gray-500 dark:text-gray-400">
                v1.0
              </div>
              <Link to="/settings" className="rounded-full hover:ring-2 hover:ring-primary-500 transition-all">
                <img 
                  src={avatarUrl}
                  alt={userName}
                  className="h-8 w-8 rounded-full bg-gray-100"
                />
              </Link>
            </div>
          </div>
        </div>

        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}