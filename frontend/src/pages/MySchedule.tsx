import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Campaign } from '@mediatool/shared';
import {
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  FlagIcon,
  DocumentTextIcon,
  CurrencyDollarIcon,
  ArrowTrendingUpIcon,
  FireIcon,
} from '@heroicons/react/24/outline';
import { StarIcon } from '@heroicons/react/24/solid';
import { useUser } from '../contexts/UserContext';
import clsx from 'clsx';

// Mock events for demo purposes - in production these would come from a calendar API
const mockEvents = [
  { id: 1, title: 'Campaign Review - Holiday Season', time: '10:00 AM', type: 'meeting' },
  { id: 2, title: 'Budget Check - Tech Giant Q1', time: '2:00 PM', type: 'review' },
  { id: 3, title: 'Client Call - Spring Launch', time: '3:30 PM', type: 'call' },
];

function getDaysInMonth(date: Date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDayOfWeek = firstDay.getDay();

  const days = [];
  
  // Add previous month's days for padding
  const prevMonth = new Date(year, month, 0);
  const prevMonthDays = prevMonth.getDate();
  for (let i = startingDayOfWeek - 1; i >= 0; i--) {
    days.push({
      date: new Date(year, month - 1, prevMonthDays - i),
      isCurrentMonth: false,
    });
  }
  
  // Add all days of the current month
  for (let i = 1; i <= daysInMonth; i++) {
    days.push({
      date: new Date(year, month, i),
      isCurrentMonth: true,
    });
  }
  
  // Add next month's days to complete the grid
  const remainingDays = 42 - days.length; // 6 weeks * 7 days
  for (let i = 1; i <= remainingDays; i++) {
    days.push({
      date: new Date(year, month + 1, i),
      isCurrentMonth: false,
    });
  }
  
  return days;
}

function getTaskPriority(campaign: Campaign) {
  const now = new Date();
  const endDate = new Date(campaign.dates.end);
  const daysLeft = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  
  const deliveryPacing = campaign.metrics?.deliveryPacing || 0;
  const spendPacing = campaign.metrics?.spendPacing || 0;
  
  // Critical: Ending very soon or severely under/over pacing
  if (daysLeft < 3 || deliveryPacing < 0.5 || deliveryPacing > 1.3) {
    return 'critical';
  }
  
  // High: Ending soon or pacing issues
  if (daysLeft < 7 || deliveryPacing < 0.7 || deliveryPacing > 1.15) {
    return 'high';
  }
  
  // Medium: Moderate timeline or slight pacing issues
  if (daysLeft < 14 || deliveryPacing < 0.85 || deliveryPacing > 1.05) {
    return 'medium';
  }
  
  return 'low';
}

export default function MySchedule() {
  const { currentUser } = useUser();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  
  const { data: campaignsData, isLoading } = useQuery({
    queryKey: ['campaigns', 'my-campaigns-schedule'],
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
      
      return data.data.slice(0, 20); // Limit for demo
    },
    enabled: !!currentUser,
  });

  const campaigns = campaignsData || [];
  const days = getDaysInMonth(currentDate);
  const monthYear = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const navigateMonth = (direction: number) => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + direction, 1));
  };

  // Get campaigns that need attention, sorted by priority
  const priorityTasks = campaigns
    .map((campaign: Campaign) => ({
      ...campaign,
      priority: getTaskPriority(campaign),
      daysLeft: Math.ceil((new Date(campaign.dates.end).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)),
    }))
    .sort((a: any, b: any) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    })
    .slice(0, 10); // Top 10 priority items

  // Get campaigns for selected date
  const campaignsOnDate = campaigns.filter((campaign: Campaign) => {
    const start = new Date(campaign.dates.start);
    const end = new Date(campaign.dates.end);
    const selected = new Date(selectedDate);
    selected.setHours(0, 0, 0, 0);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    return selected >= start && selected <= end;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          My Schedule
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Your personalized campaign cockpit for {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Calendar Section - 2 columns wide */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-medium text-gray-900 dark:text-white flex items-center">
                  <CalendarIcon className="h-5 w-5 mr-2" />
                  Campaign Calendar
                </h2>
                <div className="flex items-center space-x-4">
                  <button
                    onClick={() => navigateMonth(-1)}
                    className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <ChevronLeftIcon className="h-5 w-5" />
                  </button>
                  <span className="text-sm font-medium min-w-[120px] text-center">{monthYear}</span>
                  <button
                    onClick={() => navigateMonth(1)}
                    className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <ChevronRightIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
            
            <div className="p-6">
              <div className="grid grid-cols-7 gap-px mb-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="text-center text-xs font-medium text-gray-500 dark:text-gray-400 pb-2">
                    {day}
                  </div>
                ))}
              </div>
              
              <div className="grid grid-cols-7 gap-px bg-gray-200 dark:bg-gray-700">
                {days.map((day, index) => {
                  const isToday = day.isCurrentMonth && 
                    day.date.getDate() === new Date().getDate() &&
                    day.date.getMonth() === new Date().getMonth() &&
                    day.date.getFullYear() === new Date().getFullYear();
                  
                  const isSelected = 
                    day.date.getDate() === selectedDate.getDate() &&
                    day.date.getMonth() === selectedDate.getMonth() &&
                    day.date.getFullYear() === selectedDate.getFullYear();
                  
                  // Count campaigns on this day
                  const campaignCount = campaigns.filter((campaign: Campaign) => {
                    const start = new Date(campaign.dates.start);
                    const end = new Date(campaign.dates.end);
                    const current = new Date(day.date);
                    current.setHours(0, 0, 0, 0);
                    start.setHours(0, 0, 0, 0);
                    end.setHours(0, 0, 0, 0);
                    return current >= start && current <= end;
                  }).length;
                  
                  return (
                    <button
                      key={index}
                      onClick={() => setSelectedDate(day.date)}
                      className={clsx(
                        'min-h-[80px] p-2 text-sm bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors relative',
                        !day.isCurrentMonth && 'text-gray-400 dark:text-gray-500',
                        day.isCurrentMonth && 'text-gray-900 dark:text-gray-100',
                        isToday && 'ring-2 ring-inset ring-primary-500',
                        isSelected && 'bg-primary-50 dark:bg-primary-900/20'
                      )}
                    >
                      <div className={clsx(
                        'font-medium',
                        isToday && 'text-primary-600 dark:text-primary-400'
                      )}>
                        {day.date.getDate()}
                      </div>
                      
                      {/* Campaign indicators */}
                      {campaignCount > 0 && day.isCurrentMonth && (
                        <div className="mt-1">
                          <div className="flex flex-wrap gap-1">
                            {Array.from({ length: Math.min(campaignCount, 3) }).map((_, i) => (
                              <div
                                key={i}
                                className="w-1.5 h-1.5 rounded-full bg-primary-500"
                              />
                            ))}
                            {campaignCount > 3 && (
                              <span className="text-xs text-gray-500">+{campaignCount - 3}</span>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {/* Today's events (mock) */}
                      {isToday && (
                        <div className="absolute bottom-1 left-1 right-1">
                          <div className="text-xs text-primary-600 dark:text-primary-400 truncate">
                            {mockEvents.length} events
                          </div>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
            
            {/* Selected Date Details */}
            <div className="px-6 pb-6 border-t border-gray-200 dark:border-gray-700 pt-4">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </h3>
              
              {/* Events for selected date */}
              {selectedDate.toDateString() === new Date().toDateString() && (
                <div className="space-y-2 mb-4">
                  <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Today's Events
                  </h4>
                  {mockEvents.map(event => (
                    <div key={event.id} className="flex items-center text-sm">
                      <ClockIcon className="h-4 w-4 text-gray-400 mr-2" />
                      <span className="text-gray-500 dark:text-gray-400 mr-2">{event.time}</span>
                      <span className="text-gray-900 dark:text-white">{event.title}</span>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Active campaigns on selected date */}
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Active Campaigns ({campaignsOnDate.length})
                </h4>
                {campaignsOnDate.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">No campaigns on this date</p>
                ) : (
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {campaignsOnDate.slice(0, 5).map((campaign: Campaign) => (
                      <div key={campaign._id} className="text-sm text-gray-900 dark:text-white">
                        • {campaign.name}
                      </div>
                    ))}
                    {campaignsOnDate.length > 5 && (
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        +{campaignsOnDate.length - 5} more
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Priority Tasks Section - 1 column wide */}
        <div className="space-y-6">
          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Active Campaigns</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{campaigns.length}</p>
                </div>
                <ChartBarIcon className="h-8 w-8 text-gray-400" />
              </div>
            </div>
            
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Needs Attention</p>
                  <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                    {priorityTasks.filter((t: any) => t.priority === 'critical' || t.priority === 'high').length}
                  </p>
                </div>
                <ExclamationTriangleIcon className="h-8 w-8 text-red-400" />
              </div>
            </div>
          </div>

          {/* Priority Tasks */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center">
                <FlagIcon className="h-5 w-5 mr-2" />
                Priority Tasks
              </h3>
            </div>
            
            <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-[600px] overflow-y-auto">
              {isLoading ? (
                <div className="px-6 py-4 text-center text-gray-500">Loading tasks...</div>
              ) : priorityTasks.length === 0 ? (
                <div className="px-6 py-4 text-center text-gray-500">No priority tasks</div>
              ) : (
                priorityTasks.map((task: any) => (
                  <div key={task._id} className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center">
                          <div className={clsx(
                            'w-2 h-2 rounded-full mr-3 flex-shrink-0 mt-1.5',
                            task.priority === 'critical' && 'bg-red-500',
                            task.priority === 'high' && 'bg-orange-500',
                            task.priority === 'medium' && 'bg-yellow-500',
                            task.priority === 'low' && 'bg-green-500'
                          )} />
                          <div>
                            <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                              {task.name}
                            </h4>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {task.accountName}
                            </p>
                          </div>
                        </div>
                        
                        <div className="mt-2 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                          <span className="flex items-center">
                            <CurrencyDollarIcon className="h-3.5 w-3.5 mr-1" />
                            ${task.budget.toLocaleString()}
                          </span>
                          <span className="flex items-center">
                            <ArrowTrendingUpIcon className="h-3.5 w-3.5 mr-1" />
                            {Math.round((task.metrics?.deliveryPacing || 0) * 100)}% delivered
                          </span>
                        </div>
                      </div>
                      
                      <div className="text-right ml-4">
                        <p className={clsx(
                          'text-sm font-medium',
                          task.daysLeft < 3 ? 'text-red-600 dark:text-red-400' : 
                          task.daysLeft < 7 ? 'text-orange-600 dark:text-orange-400' : 
                          'text-gray-900 dark:text-white'
                        )}>
                          {task.daysLeft > 0 ? `${task.daysLeft}d left` : 'Ended'}
                        </p>
                        {task.priority === 'critical' && (
                          <div className="mt-1 flex items-center text-red-600 dark:text-red-400">
                            <FireIcon className="h-4 w-4" />
                            <span className="text-xs ml-1">Urgent</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Quick actions */}
                    <div className="mt-3 flex items-center gap-2">
                      <button className="text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300">
                        View Details
                      </button>
                      <span className="text-gray-300 dark:text-gray-600">•</span>
                      <button className="text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300">
                        Check Pacing
                      </button>
                      {task.priority === 'critical' && (
                        <>
                          <span className="text-gray-300 dark:text-gray-600">•</span>
                          <button className="text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300">
                            Take Action
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Today's Focus */}
          <div className="bg-gradient-to-r from-primary-50 to-primary-100 dark:from-primary-900/20 dark:to-primary-800/20 rounded-lg p-4">
            <h4 className="text-sm font-medium text-primary-900 dark:text-primary-100 flex items-center mb-2">
              <StarIcon className="h-4 w-4 mr-1" />
              Today's Focus
            </h4>
            <p className="text-sm text-primary-700 dark:text-primary-300">
              You have <span className="font-semibold">{priorityTasks.filter((t: any) => t.priority === 'critical').length} critical</span> and{' '}
              <span className="font-semibold">{priorityTasks.filter((t: any) => t.priority === 'high').length} high priority</span> campaigns that need attention today.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Icon import that was missing
const ChartBarIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
  </svg>
);