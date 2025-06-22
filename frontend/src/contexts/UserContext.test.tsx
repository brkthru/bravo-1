import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { UserProvider, useUser } from './UserContext';

// Mock fetch
global.fetch = jest.fn();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

// Test component to access the UserContext
const TestComponent = () => {
  const { currentUser, isLoading, error } = useUser();
  
  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!currentUser) return <div>No user</div>;
  
  return (
    <div>
      <div data-testid="user-name">{currentUser.name}</div>
      <div data-testid="user-email">{currentUser.email}</div>
      <div data-testid="user-role">{currentUser.role}</div>
    </div>
  );
};

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <QueryClientProvider client={queryClient}>
      <UserProvider>
        {component}
      </UserProvider>
    </QueryClientProvider>
  );
};

describe('UserContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Clear React Query cache
    queryClient.clear();
  });

  test('provides loading state initially', () => {
    (global.fetch as jest.Mock).mockImplementation(() => 
      new Promise(() => {}) // Never resolves to test loading state
    );
    
    renderWithProviders(<TestComponent />);
    
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  test('provides current user when API returns account managers', async () => {
    const mockUsers = [
      {
        _id: 'user1',
        name: 'John Doe',
        email: 'john@example.com',
        role: 'account_manager',
        isActive: true
      },
      {
        _id: 'user2',
        name: 'Jane Smith',
        email: 'jane@example.com',
        role: 'senior_account_manager',
        isActive: true
      }
    ];

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: mockUsers })
    });

    renderWithProviders(<TestComponent />);

    await waitFor(() => {
      const userName = screen.getByTestId('user-name');
      expect(userName).toBeInTheDocument();
      // Should be one of the account managers
      expect(['John Doe', 'Jane Smith']).toContain(userName.textContent);
    });

    const userRole = screen.getByTestId('user-role');
    expect(['account_manager', 'senior_account_manager']).toContain(userRole.textContent);
  });

  test('handles API errors gracefully', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    renderWithProviders(<TestComponent />);

    await waitFor(() => {
      expect(screen.getByText('Error: Failed to load user')).toBeInTheDocument();
    });
  });

  test('handles empty user list', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: [] })
    });

    renderWithProviders(<TestComponent />);

    await waitFor(() => {
      expect(screen.getByText('No user')).toBeInTheDocument();
    });
  });

  test('handles API response with no account managers', async () => {
    const mockUsers = [
      {
        _id: 'user1',
        name: 'Trader One',
        email: 'trader1@example.com',
        role: 'media_trader',
        isActive: true
      },
      {
        _id: 'user2',
        name: 'Trader Two',
        email: 'trader2@example.com',
        role: 'senior_media_trader',
        isActive: true
      }
    ];

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: mockUsers })
    });

    renderWithProviders(<TestComponent />);

    await waitFor(() => {
      expect(screen.getByText('No user')).toBeInTheDocument();
    });
  });

  test('handles unsuccessful API response', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: false, error: 'Database error' })
    });

    renderWithProviders(<TestComponent />);

    await waitFor(() => {
      expect(screen.getByText('Error: Failed to load user')).toBeInTheDocument();
    });
  });

  test('handles non-ok HTTP response', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error'
    });

    renderWithProviders(<TestComponent />);

    await waitFor(() => {
      expect(screen.getByText('Error: Failed to load user')).toBeInTheDocument();
    });
  });

  test('only selects active account managers', async () => {
    const mockUsers = [
      {
        _id: 'user1',
        name: 'Active Manager',
        email: 'active@example.com',
        role: 'account_manager',
        isActive: true
      },
      {
        _id: 'user2',
        name: 'Inactive Manager',
        email: 'inactive@example.com',
        role: 'account_manager',
        isActive: false
      },
      {
        _id: 'user3',
        name: 'Media Trader',
        email: 'trader@example.com',
        role: 'media_trader',
        isActive: true
      }
    ];

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: mockUsers })
    });

    renderWithProviders(<TestComponent />);

    await waitFor(() => {
      expect(screen.getByTestId('user-name')).toHaveTextContent('Active Manager');
      expect(screen.getByTestId('user-email')).toHaveTextContent('active@example.com');
    });
  });

  test('provides consistent user across multiple consumers', async () => {
    const mockUsers = [
      {
        _id: 'user1',
        name: 'Test User',
        email: 'test@example.com',
        role: 'account_manager',
        isActive: true
      }
    ];

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: mockUsers })
    });

    const SecondTestComponent = () => {
      const { currentUser } = useUser();
      return <div data-testid="second-user-name">{currentUser?.name || 'No user'}</div>;
    };

    const { rerender } = render(
      <QueryClientProvider client={queryClient}>
        <UserProvider>
          <TestComponent />
          <SecondTestComponent />
        </UserProvider>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('user-name')).toHaveTextContent('Test User');
      expect(screen.getByTestId('second-user-name')).toHaveTextContent('Test User');
    });
  });

  test('throws error when useUser is used outside of UserProvider', () => {
    // Suppress console.error for this test
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    const ComponentWithoutProvider = () => {
      useUser();
      return null;
    };

    expect(() => {
      render(
        <QueryClientProvider client={queryClient}>
          <ComponentWithoutProvider />
        </QueryClientProvider>
      );
    }).toThrow('useUser must be used within a UserProvider');

    consoleSpy.mockRestore();
  });
});