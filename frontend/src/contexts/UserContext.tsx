import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '@mediatool/shared';

interface UserContextType {
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
  isLoading: boolean;
  error: string | null;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // For now, we'll simulate selecting a random user from the database
    // In a real app, this would be from authentication
    const fetchCurrentUser = async () => {
      try {
        const response = await fetch('/api/users');
        if (!response.ok) {
          throw new Error('Failed to load user');
        }
        const result = await response.json();
        if (!result.success) {
          throw new Error('Failed to load user');
        }
        if (result.data && result.data.length > 0) {
          // Pick a random active account manager for demo purposes
          const accountManagers = result.data.filter((u: User) => 
            u.isActive && (u.role?.includes('account') || u.role === 'account_manager' || u.role === 'senior_account_manager')
          );
          if (accountManagers.length > 0) {
            const randomUser = accountManagers[Math.floor(Math.random() * accountManagers.length)];
            setCurrentUser(randomUser);
          } else if (result.data.length > 0) {
            // Fallback to any user
            setCurrentUser(result.data[0]);
          }
        }
      } catch (err) {
        console.error('Failed to fetch current user:', err);
        setError('Failed to load user');
      } finally {
        setIsLoading(false);
      }
    };

    fetchCurrentUser();
  }, []);

  return (
    <UserContext.Provider value={{ currentUser, setCurrentUser, isLoading, error }}>
      {children}
    </UserContext.Provider>
  );
};