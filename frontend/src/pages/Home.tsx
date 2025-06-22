import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Campaign } from '@mediatool/shared';
import {
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import { useUser } from '../contexts/UserContext';
import clsx from 'clsx';

function getDaysInMonth(date: Date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDayOfWeek = firstDay.getDay();

  const days = [];
  
  // Add empty days for padding
  for (let i = 0; i < startingDayOfWeek; i++) {
    days.push(null);
  }
  
  // Add all days of the month
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(new Date(year, month, i));
  }
  
  return days;
}

function getCampaignStatus(campaign: Campaign) {
  const now = new Date();
  const endDate = new Date(campaign.dates.end);
  const daysLeft = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  
  const deliveryPacing = campaign.metrics?.deliveryPacing || 0;
  const spendPacing = campaign.metrics?.spendPacing || 0;
  
  // Calculate expected progress based on time elapsed
  const startDate = new Date(campaign.dates.start);
  const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const daysElapsed = Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const expectedProgress = Math.min(1, daysElapsed / totalDays);
  
  // Red: Over-pacing or ending soon with low delivery
  if (deliveryPacing > 1.1 || spendPacing > 1.1 || (daysLeft < 7 && deliveryPacing < 0.8)) {
    return 'red';
  }
  
  // Yellow: Slightly under-pacing or moderate time left
  if (deliveryPacing < expectedProgress * 0.9 || (daysLeft < 14 && deliveryPacing < 0.9)) {
    return 'yellow';
  }
  
  // Green: On track
  return 'green';
}

export default function Home() {
  const { currentUser } = useUser();
  const [currentDate, setCurrentDate] = useState(new Date());
  
  const { data: campaignsData, isLoading } = useQuery({
    queryKey: ['campaigns', 'my-campaigns'],
    queryFn: async () => {
      const response = await fetch('/api/campaigns');
      if (!response.ok) throw new Error('Failed to fetch campaigns');
      const data = await response.json();
      
      // Filter campaigns where current user is on the team
      if (currentUser) {
        return data.data.filter((campaign: Campaign) => 
          campaign.team?.leadAccountManager?.id === currentUser._id ||
          campaign.team?.mediaTrader?.id === currentUser._id ||
          campaign.team?.seniorAccountManager?.id === currentUser._id
        );
      }
      
      return data.data;
    },
    enabled: !!currentUser,
  });

  const campaigns = campaignsData || [];
  const days = getDaysInMonth(currentDate);
  const monthYear = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const navigateMonth = (direction: number) => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + direction, 1));
  };

  // Group campaigns by status
  const campaignsByStatus = {
    red: campaigns.filter((c: Campaign) => getCampaignStatus(c) === 'red'),
    yellow: campaigns.filter((c: Campaign) => getCampaignStatus(c) === 'yellow'),
    green: campaigns.filter((c: Campaign) => getCampaignStatus(c) === 'green'),
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Welcome back, {currentUser?.name || 'there'}!
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Here's your campaign overview and schedule
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Calendar Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-gray-900 dark:text-white flex items-center">
                <CalendarIcon className="h-5 w-5 mr-2" />
                My Calendar
              </h2>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => navigateMonth(-1)}
                  className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <ChevronLeftIcon className="h-5 w-5" />
                </button>
                <span className="text-sm font-medium">{monthYear}</span>
                <button
                  onClick={() => navigateMonth(1)}
                  className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <ChevronRightIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
          
          <div className="p-6">
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="text-center text-xs font-medium text-gray-500 dark:text-gray-400">
                  {day}
                </div>
              ))}
            </div>
            
            <div className="grid grid-cols-7 gap-1">
              {days.map((day, index) => {
                const isToday = day && 
                  day.getDate() === new Date().getDate() &&
                  day.getMonth() === new Date().getMonth() &&
                  day.getFullYear() === new Date().getFullYear();
                
                return (
                  <div
                    key={index}
                    className={clsx(
                      'aspect-square p-2 text-sm',
                      day && 'hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer rounded-md',
                      isToday && 'bg-primary-50 dark:bg-primary-900/20 font-semibold'
                    )}
                  >
                    {day && (
                      <div>
                        <div className={clsx(
                          isToday ? 'text-primary-600 dark:text-primary-400' : 'text-gray-900 dark:text-gray-100'
                        )}>
                          {day.getDate()}
                        </div>
                        {/* Campaign indicators */}
                        <div className="mt-1 flex gap-1">
                          {campaigns.filter((c: Campaign) => {
                            const campaignStart = new Date(c.dates.start);
                            const campaignEnd = new Date(c.dates.end);
                            return day >= campaignStart && day <= campaignEnd;
                          }).slice(0, 3).map((c: Campaign, i: number) => (
                            <div
                              key={i}
                              className={clsx(
                                'w-1.5 h-1.5 rounded-full',
                                getCampaignStatus(c) === 'red' && 'bg-red-500',
                                getCampaignStatus(c) === 'yellow' && 'bg-yellow-500',
                                getCampaignStatus(c) === 'green' && 'bg-green-500'
                              )}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Campaign Status Section */}
        <div className="space-y-4">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">
            Campaign Status Overview
          </h2>
          
          {/* Status Summary Cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <XCircleIcon className="h-8 w-8 text-red-600 dark:text-red-400" />
                <span className="text-2xl font-bold text-red-900 dark:text-red-100">
                  {campaignsByStatus.red.length}
                </span>
              </div>
              <p className="mt-2 text-sm text-red-700 dark:text-red-300">Needs Attention</p>
            </div>
            
            <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <ExclamationTriangleIcon className="h-8 w-8 text-yellow-600 dark:text-yellow-400" />
                <span className="text-2xl font-bold text-yellow-900 dark:text-yellow-100">
                  {campaignsByStatus.yellow.length}
                </span>
              </div>
              <p className="mt-2 text-sm text-yellow-700 dark:text-yellow-300">Monitor</p>
            </div>
            
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <CheckCircleIcon className="h-8 w-8 text-green-600 dark:text-green-400" />
                <span className="text-2xl font-bold text-green-900 dark:text-green-100">
                  {campaignsByStatus.green.length}
                </span>
              </div>
              <p className="mt-2 text-sm text-green-700 dark:text-green-300">On Track</p>
            </div>
          </div>

          {/* Campaign List */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-base font-medium text-gray-900 dark:text-white">
                My Active Campaigns
              </h3>
            </div>
            
            <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-96 overflow-y-auto">
              {isLoading ? (
                <div className="px-6 py-4 text-center text-gray-500">Loading campaigns...</div>
              ) : campaigns.length === 0 ? (
                <div className="px-6 py-4 text-center text-gray-500">No active campaigns</div>
              ) : (
                [...campaignsByStatus.red, ...campaignsByStatus.yellow, ...campaignsByStatus.green]
                  .map((campaign: Campaign) => {
                    const now = new Date();
                    const endDate = new Date(campaign.dates.end);
                    const daysLeft = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                    const status = getCampaignStatus(campaign);
                    
                    return (
                      <div key={campaign._id} className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center">
                              <div className={clsx(
                                'w-3 h-3 rounded-full mr-3',
                                status === 'red' && 'bg-red-500',
                                status === 'yellow' && 'bg-yellow-500',
                                status === 'green' && 'bg-green-500'
                              )} />
                              <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                                {campaign.name}
                              </h4>
                            </div>
                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                              {campaign.accountName}
                            </p>
                          </div>
                          
                          <div className="text-right">
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              ${campaign.budget.toLocaleString()}
                            </p>
                            <p className={clsx(
                              'text-xs',
                              daysLeft < 7 ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'
                            )}>
                              {daysLeft > 0 ? `${daysLeft} days left` : 'Ended'}
                            </p>
                          </div>
                        </div>
                        
                        <div className="mt-2 flex items-center text-xs text-gray-500 dark:text-gray-400">
                          <span>Delivery: {Math.round((campaign.metrics?.deliveryPacing || 0) * 100)}%</span>
                          <span className="mx-2">•</span>
                          <span>Spend: {Math.round((campaign.metrics?.spendPacing || 0) * 100)}%</span>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}