import React, { useState, useEffect } from 'react';
import {
  UserCircleIcon,
  CalendarDaysIcon,
  BriefcaseIcon,
  UserGroupIcon,
  SparklesIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';
import { useUser } from '../contexts/UserContext';
import { useQuery } from '@tanstack/react-query';
import { User } from '@mediatool/shared';

const avatarStyles = [
  { id: 'adventurer', name: 'Adventurer' },
  { id: 'adventurer-neutral', name: 'Adventurer Neutral' },
  { id: 'avataaars', name: 'Avataaars' },
  { id: 'avataaars-neutral', name: 'Avataaars Neutral' },
  { id: 'big-ears', name: 'Big Ears' },
  { id: 'big-ears-neutral', name: 'Big Ears Neutral' },
  { id: 'big-smile', name: 'Big Smile' },
  { id: 'bottts', name: 'Bottts' },
  { id: 'bottts-neutral', name: 'Bottts Neutral' },
  { id: 'croodles', name: 'Croodles' },
  { id: 'croodles-neutral', name: 'Croodles Neutral' },
  { id: 'dylan', name: 'Dylan' },
  { id: 'fun-emoji', name: 'Fun Emoji' },
  { id: 'glass', name: 'Glass' },
  { id: 'icons', name: 'Icons' },
  { id: 'identicon', name: 'Identicon' },
  { id: 'initials', name: 'Initials' },
  { id: 'lorelei', name: 'Lorelei' },
  { id: 'lorelei-neutral', name: 'Lorelei Neutral' },
  { id: 'micah', name: 'Micah' },
  { id: 'miniavs', name: 'Miniavs' },
  { id: 'notionists', name: 'Notionists' },
  { id: 'notionists-neutral', name: 'Notionists Neutral' },
  { id: 'open-peeps', name: 'Open Peeps' },
  { id: 'personas', name: 'Personas' },
  { id: 'pixel-art', name: 'Pixel Art' },
  { id: 'pixel-art-neutral', name: 'Pixel Art Neutral' },
  { id: 'rings', name: 'Rings' },
  { id: 'shapes', name: 'Shapes' },
  { id: 'thumbs', name: 'Thumbs' },
];

const roles = [
  'Media Trader',
  'Senior Media Trader',
  'Account Manager',
  'Senior Account Manager',
  'Account Director',
  'VP of Media',
  'Media Coordinator',
  'Media Strategist',
];

// Remove static managers - we'll fetch from API

export default function Settings() {
  const { currentUser } = useUser();
  const [profile, setProfile] = useState({
    name: currentUser?.name || 'Account Manager',
    email: currentUser?.email || 'account.manager@company.com',
    role: currentUser?.role?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Account Manager',
    manager: '',
    avatarStyle: 'avataaars',
    outOfOffice: false,
    outOfOfficeStart: '',
    outOfOfficeEnd: '',
    backupPerson: '',
  });
  
  // Fetch all users for manager/backup dropdowns
  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await fetch('/api/users');
      if (!response.ok) throw new Error('Failed to fetch users');
      return response.json();
    },
  });
  
  const managers = usersData?.data?.filter((u: User) => 
    u.role?.includes('senior') || u.role?.includes('director') || u.role?.includes('vp')
  ) || [];
  
  const allUsers = usersData?.data || [];
  
  // Update profile when currentUser changes
  useEffect(() => {
    if (currentUser) {
      setProfile(prev => ({
        ...prev,
        name: currentUser.name || prev.name,
        email: currentUser.email || prev.email,
        role: currentUser.role?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || prev.role,
      }));
    }
  }, [currentUser]);

  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const avatarUrl = `https://api.dicebear.com/9.x/${profile.avatarStyle}/svg?seed=${encodeURIComponent(profile.name)}`;

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="md:grid md:grid-cols-3 md:gap-6">
        <div className="md:col-span-1">
          <div className="px-4 sm:px-0">
            <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-white">Profile Settings</h3>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Manage your personal information and preferences.
            </p>
          </div>
        </div>

        <div className="mt-5 md:col-span-2 md:mt-0">
          <div className="shadow sm:overflow-hidden sm:rounded-md">
            <div className="space-y-6 bg-white dark:bg-gray-800 px-4 py-5 sm:p-6">
              {/* Avatar Section */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Avatar
                </label>
                <div className="mt-2 flex items-center space-x-5">
                  <img
                    className="h-24 w-24 rounded-full bg-gray-100"
                    src={avatarUrl}
                    alt={profile.name}
                  />
                  <div className="flex-1">
                    <label htmlFor="avatar-style" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Avatar Style
                    </label>
                    <select
                      id="avatar-style"
                      value={profile.avatarStyle}
                      onChange={(e) => setProfile({ ...profile, avatarStyle: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                    >
                      {avatarStyles.map((style) => (
                        <option key={style.id} value={style.id}>
                          {style.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Name */}
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  <UserCircleIcon className="inline h-5 w-5 mr-1" />
                  Full Name
                </label>
                <input
                  type="text"
                  id="name"
                  value={profile.name}
                  onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                />
              </div>

              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Email Address
                </label>
                <input
                  type="email"
                  id="email"
                  value={profile.email}
                  onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                />
              </div>

              {/* Role */}
              <div>
                <label htmlFor="role" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  <BriefcaseIcon className="inline h-5 w-5 mr-1" />
                  Role
                </label>
                <select
                  id="role"
                  value={profile.role}
                  onChange={(e) => setProfile({ ...profile, role: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                >
                  {roles.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </div>

              {/* Manager */}
              <div>
                <label htmlFor="manager" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  <UserGroupIcon className="inline h-5 w-5 mr-1" />
                  Manager
                </label>
                <select
                  id="manager"
                  value={profile.manager}
                  onChange={(e) => setProfile({ ...profile, manager: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                >
                  <option value="">Select a manager</option>
                  {managers.map((manager: User) => (
                    <option key={manager._id} value={manager._id}>
                      {manager.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Out of Office Section */}
      <div className="mt-10 md:grid md:grid-cols-3 md:gap-6">
        <div className="md:col-span-1">
          <div className="px-4 sm:px-0">
            <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-white">Out of Office</h3>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Set your availability and assign a backup person.
            </p>
          </div>
        </div>

        <div className="mt-5 md:col-span-2 md:mt-0">
          <div className="shadow sm:overflow-hidden sm:rounded-md">
            <div className="space-y-6 bg-white dark:bg-gray-800 px-4 py-5 sm:p-6">
              {/* Out of Office Toggle */}
              <div className="flex items-start">
                <div className="flex h-5 items-center">
                  <input
                    id="out-of-office"
                    type="checkbox"
                    checked={profile.outOfOffice}
                    onChange={(e) => setProfile({ ...profile, outOfOffice: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                </div>
                <div className="ml-3 text-sm">
                  <label htmlFor="out-of-office" className="font-medium text-gray-700 dark:text-gray-300">
                    Enable Out of Office
                  </label>
                  <p className="text-gray-500 dark:text-gray-400">
                    Automatically notify team members when you're away.
                  </p>
                </div>
              </div>

              {profile.outOfOffice && (
                <>
                  {/* Date Range */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="start-date" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        <CalendarDaysIcon className="inline h-5 w-5 mr-1" />
                        Start Date
                      </label>
                      <input
                        type="date"
                        id="start-date"
                        value={profile.outOfOfficeStart}
                        onChange={(e) => setProfile({ ...profile, outOfOfficeStart: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                      />
                    </div>
                    <div>
                      <label htmlFor="end-date" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        <CalendarDaysIcon className="inline h-5 w-5 mr-1" />
                        End Date
                      </label>
                      <input
                        type="date"
                        id="end-date"
                        value={profile.outOfOfficeEnd}
                        onChange={(e) => setProfile({ ...profile, outOfOfficeEnd: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                      />
                    </div>
                  </div>

                  {/* Backup Person */}
                  <div>
                    <label htmlFor="backup" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      <UserGroupIcon className="inline h-5 w-5 mr-1" />
                      Backup Person
                    </label>
                    <select
                      id="backup"
                      value={profile.backupPerson}
                      onChange={(e) => setProfile({ ...profile, backupPerson: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                    >
                      <option value="">Select a backup person</option>
                      {allUsers
                        .filter((u: User) => u._id !== currentUser?._id)
                        .map((person: User) => (
                          <option key={person._id} value={person._id}>
                            {person.name}
                          </option>
                        ))}
                    </select>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="mt-8 flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
        >
          {saved ? (
            <>
              <CheckIcon className="h-5 w-5 mr-2" />
              Saved!
            </>
          ) : (
            <>
              <SparklesIcon className="h-5 w-5 mr-2" />
              Save Changes
            </>
          )}
        </button>
      </div>
    </div>
  );
}