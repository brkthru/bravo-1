import React, { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, GridReadyEvent, SelectionChangedEvent } from 'ag-grid-community';
import 'ag-grid-enterprise';
import { 
  MagnifyingGlassIcon, 
  PlusIcon, 
  ArrowDownIcon,
  ArrowUpIcon,
  CurrencyDollarIcon,
  ChartBarIcon,
  RocketLaunchIcon,
  CalendarDaysIcon,
  SparklesIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import { campaignApi } from '../services/api';
import { Campaign, formatCurrency, formatPercentage } from '@mediatool/shared';
import StatusBadge from '../components/ui/StatusBadge';
import ProgressBar from '../components/ui/ProgressBar';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import CampaignDetail from '../components/CampaignDetail';
import { useTheme } from '../contexts/ThemeContext';

// Stat card component
function StatCard({ 
  name, 
  stat, 
  previousStat, 
  change, 
  changeType,
  icon: Icon
}: {
  name: string;
  stat: string;
  previousStat?: string;
  change?: string;
  changeType?: 'increase' | 'decrease';
  icon: any;
}) {
  return (
    <div className="relative overflow-hidden rounded-lg bg-white dark:bg-gray-800 px-4 py-5 shadow sm:px-6 sm:py-6">
      <dt>
        <div className="absolute rounded-md bg-gradient-to-r from-primary-500 to-primary-600 p-3">
          <Icon className="h-6 w-6 text-white" aria-hidden="true" />
        </div>
        <p className="ml-16 truncate text-sm font-medium text-gray-500 dark:text-gray-400">{name}</p>
      </dt>
      <dd className="ml-16 flex items-baseline">
        <p className="text-2xl font-semibold text-gray-900 dark:text-white">{stat}</p>
        {change && (
          <p
            className={`ml-2 flex items-baseline text-sm font-semibold ${
              changeType === 'increase' ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {changeType === 'increase' ? (
              <ArrowUpIcon className="h-5 w-5 flex-shrink-0 self-center text-green-500" aria-hidden="true" />
            ) : (
              <ArrowDownIcon className="h-5 w-5 flex-shrink-0 self-center text-red-500" aria-hidden="true" />
            )}
            <span className="sr-only"> {changeType === 'increase' ? 'Increased' : 'Decreased'} by </span>
            {change}
          </p>
        )}
      </dd>
    </div>
  );
}

// Enhanced cell renderers with animations
const StatusCellRenderer = ({ value }: { value: any }) => (
  <div className="animate-fadeIn">
    <StatusBadge status={value} />
  </div>
);

const TeamCellRenderer = ({ data }: { data: Campaign }) => {
  // Add defensive checks for team property
  if (!data.team || !data.team.leadAccountManager) {
    return (
      <div className="text-gray-500 text-sm">
        No team assigned
      </div>
    );
  }

  const { leadAccountManager, mediaTrader } = data.team;
  const initials = leadAccountManager.name.split(' ').map(n => n[0]).join('');
  
  // Generate DiceBear avatar URLs
  const leadAvatar = `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(leadAccountManager.name)}`;
  const traderAvatar = mediaTrader ? `https://api.dicebear.com/9.x/miniavs/svg?seed=${encodeURIComponent(mediaTrader.name)}` : null;
  
  return (
    <div className="flex items-center animate-slideIn">
      <div className="flex -space-x-2">
        {/* Lead Account Manager Avatar */}
        <img 
          className="h-8 w-8 rounded-full border-2 border-white dark:border-gray-800 z-10 bg-gray-100" 
          src={leadAccountManager.avatar || leadAvatar} 
          alt={leadAccountManager.name} 
        />
        
        {/* Media Trader Avatar (if exists) */}
        {mediaTrader && (
          <img 
            className="h-8 w-8 rounded-full border-2 border-white dark:border-gray-800 bg-gray-100" 
            src={mediaTrader.avatar || traderAvatar} 
            alt={mediaTrader.name} 
          />
        )}
      </div>
      
      <div className="ml-3">
        <div className="text-sm font-medium text-gray-900 dark:text-gray-100 leading-tight">
          {leadAccountManager.name}
        </div>
        {mediaTrader && (
          <div className="text-xs text-gray-500 dark:text-gray-400">
            +{mediaTrader.name.split(' ')[0]}
          </div>
        )}
      </div>
    </div>
  );
};

// Inline sparkline bar component
const SparklineBarRenderer = ({ value }: { value: number }) => {
  const percentage = value * 100;
  const bars = 10; // number of bars to show
  
  // Calculate how many bars to fill and colors for overpacing
  let greenBars = 0;
  let redBars = 0;
  let normalColorBars = 0;
  
  if (percentage > 100) {
    // Calculate proportional green/red split
    const greenProportion = 100 / percentage;
    greenBars = Math.ceil(bars * greenProportion);
    redBars = bars - greenBars;
  } else {
    // Normal coloring for under 100%
    normalColorBars = Math.round((percentage / 100) * bars);
  }
  
  return (
    <div className="flex items-center space-x-1 py-1">
      <div className="flex space-x-0.5">
        {Array.from({ length: bars }, (_, i) => {
          let barColor = 'bg-gray-200 dark:bg-gray-700';
          let opacity = 0.3;
          
          if (percentage > 100) {
            // Overpacing: green then red
            if (i < greenBars) {
              barColor = 'bg-green-500 dark:bg-green-400';
              opacity = 0.8 + (i / bars) * 0.2;
            } else {
              barColor = 'bg-red-500 dark:bg-red-400';
              opacity = 0.8 + (i / bars) * 0.2;
            }
          } else if (i < normalColorBars) {
            // Normal pacing: color based on percentage
            if (percentage > 80) {
              barColor = 'bg-green-500 dark:bg-green-400';
            } else if (percentage > 50) {
              barColor = 'bg-yellow-500 dark:bg-yellow-400';
            } else {
              barColor = 'bg-blue-500 dark:bg-blue-400';
            }
            opacity = 0.8 + (i / bars) * 0.2;
          }
          
          return (
            <div
              key={i}
              className={`w-2 h-5 rounded-sm transition-all ${barColor}`}
              style={{
                opacity,
                height: `${12 + (i / bars) * 8}px`
              }}
            />
          );
        })}
      </div>
      <span className="text-xs font-medium text-gray-600 dark:text-gray-400 ml-2">
        {formatPercentage(value)}
      </span>
    </div>
  );
};

const ProgressCellRenderer = ({ value }: { value: number }) => (
  <div className="py-1">
    <ProgressBar value={value} showPercentage />
  </div>
);

const CurrencyCellRenderer = ({ value }: { value: number }) => (
  <span className="font-medium text-gray-900 dark:text-gray-100">{formatCurrency(value)}</span>
);

const MediaActivityCellRenderer = ({ value }: { value: string }) => {
  const colorMap: Record<string, string> = {
    'None active': 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400 border border-gray-200 dark:border-gray-700',
    'Some active': 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800',
    'All active': 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800',
    'Pending': 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800',
  };

  const iconMap: Record<string, string> = {
    'None active': '○',
    'Some active': '◐',
    'All active': '●',
    'Pending': '◷',
  };

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${colorMap[value] || 'bg-gray-100 text-gray-800'}`}>
      <span className="text-base leading-none">{iconMap[value] || '○'}</span>
      {value}
    </span>
  );
};

// Custom header with sparkle animation
const CustomHeader = ({ displayName, column }: any) => {
  const [isHovered, setIsHovered] = useState(false);
  
  return (
    <div 
      className="flex items-center space-x-1 w-full h-full"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <span className="text-gray-700 dark:text-gray-300 font-medium">{displayName}</span>
      {isHovered && <SparklesIcon className="h-4 w-4 text-primary-400 animate-pulse" />}
    </div>
  );
};

// Sparkline bar renderer for progress metrics
const createSparklineData = (value: number): number[] => {
  // Create array showing progress build-up
  const steps = 20;
  const data = [];
  for (let i = 0; i < steps; i++) {
    data.push(Math.min((i / steps) * value * 100, value * 100));
  }
  return data;
};

export default function CampaignList() {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [gridApi, setGridApi] = useState<any>(null);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const { resolvedTheme } = useTheme();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['campaigns', searchTerm, currentPage, pageSize],
    queryFn: () => campaignApi.getAll(searchTerm || undefined, currentPage, pageSize),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const campaigns = data?.campaigns;
  const pagination = data?.pagination;

  const columnDefs = useMemo<ColDef[]>(() => [
    {
      headerName: '',
      field: 'selection',
      checkboxSelection: true,
      headerCheckboxSelection: true,
      width: 50,
      pinned: 'left',
      suppressMenu: true,
      sortable: false,
      filter: false,
    },
    {
      field: 'name',
      headerName: 'Campaign Details',
      flex: 2,
      minWidth: 200,
      headerComponent: CustomHeader,
      cellRenderer: ({ data }: { data: Campaign }) => (
        <div className="cursor-pointer hover:text-primary-600 dark:hover:text-primary-400 py-1">
          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{data.name}</div>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-xs text-gray-500 dark:text-gray-400">{data.campaignNumber}</span>
            {data.accountName && (
              <>
                <span className="text-xs text-gray-400 dark:text-gray-500">•</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">{data.accountName}</span>
              </>
            )}
            <span className="text-xs text-gray-400 dark:text-gray-500">•</span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {formatCurrency(data.budget.total)} budget
            </span>
            {data.dates && (
              <>
                <span className="text-xs text-gray-400 dark:text-gray-500">•</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {new Date(data.dates.start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {new Date(data.dates.end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </>
            )}
          </div>
        </div>
      ),
    },
    {
      field: 'displayStatus',
      headerName: 'Status',
      width: 150,
      cellRenderer: ({ value }: { value: string }) => (
        <div className="animate-fadeIn">
          <StatusBadge status={value || 'Draft'} />
        </div>
      ),
      headerComponent: CustomHeader,
      enableRowGroup: true,
    },
    {
      field: 'team',
      headerName: 'Team',
      flex: 1,
      minWidth: 150,
      cellRenderer: TeamCellRenderer,
      headerComponent: CustomHeader,
    },
    {
      field: 'mediaActivity',
      headerName: 'Media Activity',
      width: 140,
      cellRenderer: MediaActivityCellRenderer,
      headerComponent: CustomHeader,
      enableRowGroup: true,
    },
    {
      field: 'metrics.deliveryPacing',
      headerName: 'Delivery Pacing',
      width: 180,
      cellRenderer: SparklineBarRenderer,
      valueFormatter: ({ value }) => formatPercentage(value),
      headerComponent: CustomHeader,
    },
    {
      field: 'metrics.spendPacing',
      headerName: 'Spend Pacing',
      width: 180,
      cellRenderer: SparklineBarRenderer,
      valueFormatter: ({ value }) => formatPercentage(value),
      headerComponent: CustomHeader,
    },
    {
      field: 'budget.total',
      headerName: 'Budget',
      width: 120,
      cellRenderer: CurrencyCellRenderer,
      valueFormatter: ({ value }) => formatCurrency(value),
      headerComponent: CustomHeader,
      aggFunc: 'sum',
    },
  ], [resolvedTheme]);

  const defaultColDef = useMemo(() => ({
    sortable: true,
    filter: true,
    resizable: true,
    floatingFilter: true,
    menuTabs: ['filterMenuTab', 'generalMenuTab', 'columnsMenuTab'],
  }), []);

  const onGridReady = useCallback((params: GridReadyEvent) => {
    setGridApi(params.api);
  }, []);

  const handleSearch = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
    setCurrentPage(1); // Reset to first page when searching
  }, []);

  const handleNewCampaign = useCallback(() => {
    console.log('New campaign clicked');
  }, []);

  const onSelectionChanged = useCallback((event: SelectionChangedEvent) => {
    const selectedRows = event.api.getSelectedRows();
    if (selectedRows.length === 1) {
      setSelectedCampaign(selectedRows[0]);
    }
  }, []);

  const onRowClicked = useCallback((event: any) => {
    setSelectedCampaign(event.data);
  }, []);

  // Calculate stats
  const stats = useMemo(() => {
    if (!campaigns) return null;
    
    // Note: These are calculated from current page only
    // TODO: Add API endpoint for aggregated stats across all campaigns
    const totalBudget = campaigns.reduce((sum, c) => sum + c.budget.total, 0);
    const totalSpent = campaigns.reduce((sum, c) => sum + c.budget.spent, 0);
    const activeCampaigns = campaigns.filter(c => c.displayStatus !== 'Draft' && c.displayStatus !== 'Completed').length;
    const avgMargin = campaigns.reduce((sum, c) => sum + c.metrics.margin, 0) / campaigns.length;

    return {
      totalCampaigns: pagination?.total || campaigns.length,
      totalBudget,
      totalSpent,
      activeCampaigns: pagination?.total || campaigns.length, // Show total for now
      avgMargin
    };
  }, [campaigns, pagination]);

  if (error) {
    return (
      <div className="p-6">
        <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-4">
          <div className="text-sm text-red-700 dark:text-red-400">
            Error loading campaigns: {error instanceof Error ? error.message : 'Unknown error'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 bg-gray-50 dark:bg-gray-900 min-h-full">
      {/* Header with integrated search */}
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold leading-tight tracking-tight text-gray-900 dark:text-white">Campaigns</h1>
          <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
            Manage your advertising campaigns and track performance
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex items-center space-x-3">
          {/* Compact search */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MagnifyingGlassIcon className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={handleSearch}
              className="block w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-800 placeholder-gray-500 dark:placeholder-gray-400 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:placeholder-gray-400 dark:focus:placeholder-gray-500 focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          <button
            onClick={() => refetch()}
            className="inline-flex items-center p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            disabled={isLoading}
            title="Refresh"
          >
            <ArrowPathIcon className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={handleNewCampaign}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            New Campaign
          </button>
        </div>
      </div>

      {/* Stats cards */}
      {stats && (
        <div className="mt-8">
          <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-white mb-4">Overview</h3>
          <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              name="Total Campaigns"
              stat={stats.totalCampaigns.toLocaleString()}
              icon={CalendarDaysIcon}
              change="12%"
              changeType="increase"
            />
            <StatCard
              name="Total Budget"
              stat={formatCurrency(stats.totalBudget)}
              icon={CurrencyDollarIcon}
              change="4.75%"
              changeType="increase"
            />
            <StatCard
              name="Active Campaigns"
              stat={stats.activeCampaigns.toLocaleString()}
              icon={RocketLaunchIcon}
              change="2"
              changeType="increase"
            />
            <StatCard
              name="Average Margin"
              stat={formatPercentage(stats.avgMargin)}
              icon={ChartBarIcon}
              change="3.2%"
              changeType="decrease"
            />
          </dl>
        </div>
      )}

      {/* Campaigns table */}
      <div className="mt-8">
        <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-white mb-4">Campaign Details</h3>
        <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
          <div 
            className={resolvedTheme === 'dark' ? "ag-theme-alpine-dark" : "ag-theme-alpine"} 
            style={{ height: 600, width: '100%' }}
          >
            <AgGridReact
              columnDefs={columnDefs}
              rowData={campaigns || []}
              defaultColDef={defaultColDef}
              onGridReady={onGridReady}
              pagination={false}
              rowSelection="multiple"
              animateRows={true}
              enableRangeSelection={true}
              suppressMenuHide={true}
              getRowId={(params) => params.data._id}
              loading={isLoading}
              onSelectionChanged={onSelectionChanged}
              onRowClicked={onRowClicked}
              sideBar={{
                toolPanels: [
                  {
                    id: 'columns',
                    labelDefault: 'Columns',
                    labelKey: 'columns',
                    iconKey: 'columns',
                    toolPanel: 'agColumnsToolPanel',
                  },
                  {
                    id: 'filters',
                    labelDefault: 'Filters',
                    labelKey: 'filters',
                    iconKey: 'filter',
                    toolPanel: 'agFiltersToolPanel',
                  },
                ],
                defaultToolPanel: '',
              }}
              statusBar={{
                statusPanels: [
                  { statusPanel: 'agTotalAndFilteredRowCountComponent', align: 'left' },
                  { statusPanel: 'agAggregationComponent', align: 'right' },
                ],
              }}
              loadingOverlayComponent={() => (
                <div className="flex items-center justify-center h-full">
                  <LoadingSpinner size="lg" />
                  <span className="ml-2 text-gray-600 dark:text-gray-400">Loading campaigns...</span>
                </div>
              )}
            />
          </div>
          
          {/* Pagination Controls */}
          {pagination && (
            <div className="bg-white dark:bg-gray-800 px-4 py-3 flex items-center justify-between border-t border-gray-200 dark:border-gray-700 sm:px-6">
              <div className="flex-1 flex justify-between sm:hidden">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage(Math.min(pagination.totalPages, currentPage + 1))}
                  disabled={currentPage === pagination.totalPages}
                  className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    Showing{' '}
                    <span className="font-medium">{((currentPage - 1) * pageSize) + 1}</span>
                    {' '}to{' '}
                    <span className="font-medium">{Math.min(currentPage * pageSize, pagination.total)}</span>
                    {' '}of{' '}
                    <span className="font-medium">{pagination.total.toLocaleString()}</span>
                    {' '}results
                  </p>
                </div>
                <div className="flex items-center space-x-3">
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1); // Reset to first page when changing page size
                    }}
                    className="text-sm border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-gray-300"
                  >
                    <option value={10}>10 per page</option>
                    <option value={25}>25 per page</option>
                    <option value={50}>50 per page</option>
                    <option value={100}>100 per page</option>
                  </select>
                  
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                    <button
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span className="sr-only">First</span>
                      <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M15.707 15.707a1 1 0 01-1.414 0l-5-5a1 1 0 010-1.414l5-5a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 010 1.414zm-6 0a1 1 0 01-1.414 0l-5-5a1 1 0 010-1.414l5-5a1 1 0 011.414 1.414L5.414 10l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center px-2 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span className="sr-only">Previous</span>
                      <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </button>
                    
                    <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300">
                      Page {currentPage} of {pagination.totalPages}
                    </span>
                    
                    <button
                      onClick={() => setCurrentPage(Math.min(pagination.totalPages, currentPage + 1))}
                      disabled={currentPage === pagination.totalPages}
                      className="relative inline-flex items-center px-2 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span className="sr-only">Next</span>
                      <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setCurrentPage(pagination.totalPages)}
                      disabled={currentPage === pagination.totalPages}
                      className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span className="sr-only">Last</span>
                      <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10.293 15.707a1 1 0 010-1.414L14.586 10l-4.293-4.293a1 1 0 111.414-1.414l5 5a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0zm-6 0a1 1 0 010-1.414L8.586 10 4.293 5.707a1 1 0 111.414-1.414l5 5a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Campaign Detail Panel */}
      {selectedCampaign && (
        <CampaignDetail
          campaign={selectedCampaign}
          onClose={() => setSelectedCampaign(null)}
        />
      )}
    </div>
  );
}