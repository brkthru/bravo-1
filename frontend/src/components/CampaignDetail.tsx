import React from 'react';
import { Campaign, formatCurrency, formatPercentage, formatDate } from '@mediatool/shared';
import { 
  CalendarDaysIcon, 
  UserGroupIcon, 
  ChartBarIcon,
  CurrencyDollarIcon,
  ArrowTrendingUpIcon,
  SparklesIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import StatusBadge from './ui/StatusBadge';
import ProgressBar from './ui/ProgressBar';

interface CampaignDetailProps {
  campaign: Campaign;
  onClose: () => void;
}

export default function CampaignDetail({ campaign, onClose }: CampaignDetailProps) {
  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-gray-500 dark:bg-gray-900 bg-opacity-75 dark:bg-opacity-75 transition-opacity" onClick={onClose} />
        
        <div className="fixed inset-y-0 right-0 pl-10 max-w-full flex">
          <div className="relative w-screen max-w-3xl">
            <div className="h-full flex flex-col bg-white dark:bg-gray-800 shadow-xl">
              {/* Header */}
              <div className="flex-shrink-0">
                <div className="px-4 py-6 bg-gray-50 dark:bg-gray-700 sm:px-6">
                  <div className="flex items-start justify-between space-x-3">
                    <div className="space-y-1">
                      <h2 className="text-lg font-medium text-gray-900 dark:text-white">
                        {campaign.name}
                      </h2>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {campaign.campaignNumber}
                      </p>
                    </div>
                    <div className="flex h-7 items-center">
                      <StatusBadge status={campaign.status} />
                      <button
                        type="button"
                        className="ml-4 rounded-md bg-white dark:bg-gray-800 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
                        onClick={onClose}
                      >
                        <span className="sr-only">Close panel</span>
                        <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto">
                <div className="px-4 py-6 sm:px-6 space-y-6">
                  {/* Metrics Grid */}
                  <div className="grid grid-cols-2 gap-4">
                    <MetricCard
                      icon={CurrencyDollarIcon}
                      label="Total Budget"
                      value={formatCurrency(campaign.budget.total)}
                      subValue={`${formatCurrency(campaign.budget.spent)} spent`}
                      color="blue"
                    />
                    <MetricCard
                      icon={ChartBarIcon}
                      label="Campaign Margin"
                      value={formatPercentage(campaign.metrics.margin)}
                      subValue={`Target: 70%`}
                      color="green"
                    />
                    <MetricCard
                      icon={ArrowTrendingUpIcon}
                      label="Delivery Pacing"
                      value={formatPercentage(campaign.metrics.deliveryPacing)}
                      progress={campaign.metrics.deliveryPacing}
                      color="yellow"
                    />
                    <MetricCard
                      icon={SparklesIcon}
                      label="Spend Pacing"
                      value={formatPercentage(campaign.metrics.spendPacing)}
                      progress={campaign.metrics.spendPacing}
                      color="purple"
                    />
                  </div>

                  {/* Team Section */}
                  {campaign.team && campaign.team.leadAccountManager ? (
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                      <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3 flex items-center">
                        <UserGroupIcon className="h-5 w-5 mr-2 text-gray-400" />
                        Team
                      </h3>
                      <div className="space-y-3">
                        <TeamMember
                          role="Lead Account Manager"
                          name={campaign.team.leadAccountManager.name}
                          email={campaign.team.leadAccountManager.email}
                          avatar={campaign.team.leadAccountManager.avatar}
                        />
                        {campaign.team.mediaTrader && (
                          <TeamMember
                            role="Media Trader"
                            name={campaign.team.mediaTrader.name}
                            email={campaign.team.mediaTrader.email}
                            avatar={campaign.team.mediaTrader.avatar}
                          />
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                      <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3 flex items-center">
                        <UserGroupIcon className="h-5 w-5 mr-2 text-gray-400" />
                        Team
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">No team assigned</p>
                    </div>
                  )}

                  {/* Timeline */}
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3 flex items-center">
                      <CalendarDaysIcon className="h-5 w-5 mr-2 text-gray-400" />
                      Timeline
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500 dark:text-gray-400">Start Date</span>
                        <span className="text-gray-900 dark:text-gray-100">{formatDate(campaign.dates.start)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500 dark:text-gray-400">End Date</span>
                        <span className="text-gray-900 dark:text-gray-100">{formatDate(campaign.dates.end)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500 dark:text-gray-400">Duration</span>
                        <span className="text-gray-900 dark:text-gray-100">{campaign.dates.totalDuration} days</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500 dark:text-gray-400">Days Elapsed</span>
                        <span className="text-gray-900 dark:text-gray-100">{campaign.dates.daysElapsed} days</span>
                      </div>
                      <div className="mt-2">
                        <ProgressBar value={campaign.dates.daysElapsed / campaign.dates.totalDuration} showPercentage />
                      </div>
                    </div>
                  </div>

                  {/* Line Items */}
                  {campaign.lineItems && campaign.lineItems.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                        Line Items ({campaign.lineItems.length})
                      </h3>
                      <div className="space-y-2">
                        {campaign.lineItems.map((item) => (
                          <div key={item._id} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium text-gray-900 dark:text-white">{item.name}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  {item.channel} • {formatCurrency(item.price)}
                                </p>
                              </div>
                              <StatusBadge status={item.status === 'active' ? 'L1' : 'L3'} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="flex-shrink-0 px-4 py-4 bg-gray-50 dark:bg-gray-700 flex justify-end space-x-3">
                <button
                  type="button"
                  className="bg-white dark:bg-gray-800 py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                  onClick={onClose}
                >
                  Close
                </button>
                <button
                  type="button"
                  className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                >
                  Edit Campaign
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper components
function MetricCard({ icon: Icon, label, value, subValue, progress, color }: any) {
  const colorClasses = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
    purple: 'bg-purple-500',
  };

  return (
    <div className="bg-white dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
      <div className="flex items-start">
        <div className={`rounded-lg p-2 ${colorClasses[color]} bg-opacity-10`}>
          <Icon className={`h-6 w-6 text-${color}-600 dark:text-${color}-400`} />
        </div>
        <div className="ml-3 flex-1">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</p>
          <p className="text-xl font-semibold text-gray-900 dark:text-white">{value}</p>
          {subValue && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{subValue}</p>}
          {progress !== undefined && (
            <div className="mt-2">
              <ProgressBar value={progress} size="sm" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TeamMember({ role, name, email, avatar }: any) {
  // Generate DiceBear avatar if none provided
  const fallbackAvatar = `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(name || 'default')}`;
  
  return (
    <div className="flex items-center space-x-3">
      <img 
        className="h-10 w-10 rounded-full bg-gray-100" 
        src={avatar || fallbackAvatar} 
        alt={name} 
      />
      <div>
        <p className="text-sm font-medium text-gray-900 dark:text-white">{name}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">{role} • {email}</p>
      </div>
    </div>
  );
}