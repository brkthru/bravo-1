import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from './contexts/ThemeContext';
import { UserProvider } from './contexts/UserContext';
import Layout from './components/Layout';
import Home from './pages/Home';
import CampaignList from './pages/CampaignList';
import AnalyticsPlaceholder from './pages/AnalyticsPlaceholder';
import Settings from './pages/Settings';
import MySchedule from './pages/MySchedule';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: (failureCount, error: any) => {
        // Don't retry on 4xx errors
        if (error?.response?.status >= 400 && error?.response?.status < 500) {
          return false;
        }
        return failureCount < 3;
      },
    },
  },
});

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <UserProvider>
          <Router>
            <Routes>
              <Route path="/" element={<Layout />}>
                <Route index element={<Home />} />
                <Route path="my-schedule" element={<MySchedule />} />
                <Route
                  path="accounts"
                  element={
                    <div className="p-6">
                      <h1 className="text-2xl">Accounts (Coming Soon)</h1>
                    </div>
                  }
                />
                <Route path="campaigns" element={<CampaignList />} />
                <Route
                  path="line-items"
                  element={
                    <div className="p-6">
                      <h1 className="text-2xl">Line Items (Coming Soon)</h1>
                    </div>
                  }
                />
                <Route
                  path="media-plans"
                  element={
                    <div className="p-6">
                      <h1 className="text-2xl">Media Plans (Coming Soon)</h1>
                    </div>
                  }
                />
                <Route
                  path="platform-buys"
                  element={
                    <div className="p-6">
                      <h1 className="text-2xl">Platform Buys (Coming Soon)</h1>
                    </div>
                  }
                />
                <Route path="analytics" element={<AnalyticsPlaceholder />} />
                <Route
                  path="reports"
                  element={
                    <div className="p-6">
                      <h1 className="text-2xl">Reports (Coming Soon)</h1>
                    </div>
                  }
                />
                <Route
                  path="invoices"
                  element={
                    <div className="p-6">
                      <h1 className="text-2xl">Invoices (Coming Soon)</h1>
                    </div>
                  }
                />
                <Route path="settings" element={<Settings />} />
                <Route
                  path="users"
                  element={
                    <div className="p-6">
                      <h1 className="text-2xl">Users (Coming Soon)</h1>
                    </div>
                  }
                />
              </Route>
            </Routes>
          </Router>
        </UserProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
