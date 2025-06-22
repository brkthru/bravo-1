import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import MySchedule from './MySchedule';
import { UserProvider } from '../contexts/UserContext';

// Mock the useUser hook
jest.mock('../contexts/UserContext', () => ({
  ...jest.requireActual('../contexts/UserContext'),
  useUser: () => ({
    currentUser: {
      _id: 'test-user-id',
      name: 'Test User',
      email: 'test@example.com',
      role: 'account_manager'
    },
    isLoading: false
  })
}));

// Mock fetch
global.fetch = jest.fn();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <UserProvider>
          {component}
        </UserProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('MySchedule', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            _id: '1',
            name: 'Test Campaign 1',
            accountName: 'Test Account 1',
            budget: 10000,
            dates: {
              start: new Date().toISOString(),
              end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days from now
            },
            team: {
              leadAccountManager: { id: 'test-user-id', name: 'Test User' }
            },
            metrics: {
              deliveryPacing: 0.8,
              spendPacing: 0.75
            }
          },
          {
            _id: '2',
            name: 'Critical Campaign',
            accountName: 'Important Client',
            budget: 50000,
            dates: {
              start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
              end: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString() // 2 days from now
            },
            team: {
              leadAccountManager: { id: 'test-user-id', name: 'Test User' }
            },
            metrics: {
              deliveryPacing: 0.4, // Under-pacing
              spendPacing: 0.35
            }
          }
        ]
      })
    });
  });

  test('renders the MySchedule page', async () => {
    renderWithProviders(<MySchedule />);
    
    expect(screen.getByText('My Schedule')).toBeInTheDocument();
    expect(screen.getByText(/Your personalized campaign cockpit/)).toBeInTheDocument();
  });

  test('displays calendar with current month', () => {
    renderWithProviders(<MySchedule />);
    
    const currentMonth = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    expect(screen.getByText(currentMonth)).toBeInTheDocument();
    
    // Check for day headers
    expect(screen.getByText('Sun')).toBeInTheDocument();
    expect(screen.getByText('Mon')).toBeInTheDocument();
    expect(screen.getByText('Sat')).toBeInTheDocument();
  });

  test('navigates between months', () => {
    renderWithProviders(<MySchedule />);
    
    const currentDate = new Date();
    const nextMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
    const nextMonthName = nextMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    
    // Click next month button
    const nextButton = screen.getAllByRole('button').find(btn => 
      btn.querySelector('[class*="ChevronRightIcon"]')
    );
    
    if (nextButton) {
      fireEvent.click(nextButton);
      expect(screen.getByText(nextMonthName)).toBeInTheDocument();
    }
  });

  test('displays campaigns and stats', async () => {
    renderWithProviders(<MySchedule />);
    
    await waitFor(() => {
      expect(screen.getByText('Active Campaigns')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument(); // Number of campaigns
      expect(screen.getByText('Needs Attention')).toBeInTheDocument();
      expect(screen.getByText('1')).toBeInTheDocument(); // Critical campaign
    });
  });

  test('displays priority tasks', async () => {
    renderWithProviders(<MySchedule />);
    
    await waitFor(() => {
      expect(screen.getByText('Priority Tasks')).toBeInTheDocument();
      expect(screen.getByText('Critical Campaign')).toBeInTheDocument();
      expect(screen.getByText('Important Client')).toBeInTheDocument();
      expect(screen.getByText('2d left')).toBeInTheDocument();
      expect(screen.getByText('Urgent')).toBeInTheDocument();
    });
  });

  test('selects a date and shows campaigns for that date', async () => {
    renderWithProviders(<MySchedule />);
    
    // Wait for campaigns to load
    await waitFor(() => {
      expect(screen.getByText('Test Campaign 1')).toBeInTheDocument();
    });
    
    // Click on today's date
    const today = new Date().getDate().toString();
    const todayButtons = screen.getAllByText(today);
    const todayButton = todayButtons.find(btn => 
      btn.closest('button') && !btn.closest('button')?.className.includes('text-gray-400')
    );
    
    if (todayButton) {
      fireEvent.click(todayButton.closest('button')!);
      
      // Check selected date details
      const selectedDateText = new Date().toLocaleDateString('en-US', { 
        weekday: 'long', 
        month: 'long', 
        day: 'numeric' 
      });
      expect(screen.getByText(selectedDateText)).toBeInTheDocument();
    }
  });

  test('shows today\'s events for current date', async () => {
    renderWithProviders(<MySchedule />);
    
    await waitFor(() => {
      expect(screen.getByText("Today's Events")).toBeInTheDocument();
      expect(screen.getByText('Campaign Review - Holiday Season')).toBeInTheDocument();
      expect(screen.getByText('10:00 AM')).toBeInTheDocument();
    });
  });

  test('displays priority indicators correctly', async () => {
    renderWithProviders(<MySchedule />);
    
    await waitFor(() => {
      // Check for priority indicators (colored dots)
      const priorityTasks = screen.getByText('Priority Tasks').closest('div')?.parentElement;
      if (priorityTasks) {
        // Critical priority should have red indicator
        const criticalTask = screen.getByText('Critical Campaign').closest('div');
        expect(criticalTask?.querySelector('[class*="bg-red-500"]')).toBeInTheDocument();
      }
    });
  });

  test('shows quick action buttons', async () => {
    renderWithProviders(<MySchedule />);
    
    await waitFor(() => {
      expect(screen.getAllByText('View Details')).toHaveLength(2);
      expect(screen.getAllByText('Check Pacing')).toHaveLength(2);
      expect(screen.getByText('Take Action')).toBeInTheDocument(); // Only for critical
    });
  });

  test('displays today\'s focus summary', async () => {
    renderWithProviders(<MySchedule />);
    
    await waitFor(() => {
      expect(screen.getByText("Today's Focus")).toBeInTheDocument();
      const focusText = screen.getByText(/You have/);
      expect(focusText).toBeInTheDocument();
      expect(focusText.textContent).toContain('1 critical');
    });
  });

  test('handles loading state', () => {
    renderWithProviders(<MySchedule />);
    
    // Before data loads
    expect(screen.getByText('Loading tasks...')).toBeInTheDocument();
  });

  test('handles empty campaigns', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [] })
    });
    
    renderWithProviders(<MySchedule />);
    
    await waitFor(() => {
      expect(screen.getByText('No priority tasks')).toBeInTheDocument();
      expect(screen.getByText('0')).toBeInTheDocument(); // Active campaigns count
    });
  });

  test('filters campaigns by current user', async () => {
    const campaigns = [
      {
        _id: '1',
        name: 'My Campaign',
        accountName: 'Account 1',
        budget: 10000,
        dates: {
          start: new Date().toISOString(),
          end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        },
        team: {
          leadAccountManager: { id: 'test-user-id', name: 'Test User' }
        },
        metrics: { deliveryPacing: 0.8, spendPacing: 0.75 }
      },
      {
        _id: '2',
        name: 'Other Campaign',
        accountName: 'Account 2',
        budget: 20000,
        dates: {
          start: new Date().toISOString(),
          end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        },
        team: {
          leadAccountManager: { id: 'other-user-id', name: 'Other User' }
        },
        metrics: { deliveryPacing: 0.9, spendPacing: 0.85 }
      }
    ];
    
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: campaigns })
    });
    
    renderWithProviders(<MySchedule />);
    
    await waitFor(() => {
      expect(screen.getByText('My Campaign')).toBeInTheDocument();
      expect(screen.queryByText('Other Campaign')).not.toBeInTheDocument();
    });
  });
});