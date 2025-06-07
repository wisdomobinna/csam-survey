// src/App.js - Updated with Demographics route
import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { ChakraProvider, extendTheme } from '@chakra-ui/react';
import Login from './pages/Login';
import Survey from './pages/Survey';
import Demographics from './pages/Demographics';
import AdminDashboard from './pages/AdminDashboard';
import Completion from './pages/Completion';
import Setup from './pages/Setup';
import ConsentPage from './pages/ConsentPage';

const theme = extendTheme({
  styles: {
    global: {
      body: { bg: 'gray.50' }
    }
  }
});

// Enhanced route protection with better logging
const PrivateRoute = ({ children }) => {
  const navigate = useNavigate();
  const loginId = sessionStorage.getItem('userLoginId');

  useEffect(() => {
    console.log('PrivateRoute: Checking authentication...', { loginId });
    
    if (!loginId) {
      console.log('PrivateRoute: No login ID found, redirecting to login');
      navigate('/login', { replace: true });
      return;
    }
    
    console.log('PrivateRoute: User authenticated, allowing access');
  }, [loginId, navigate]);

  // Don't render children if no login ID
  if (!loginId) {
    return null;
  }

  return children;
};

// Admin-only route
const AdminRoute = ({ children }) => {
  const navigate = useNavigate();
  const isAdmin = sessionStorage.getItem('isAdmin');
  const loginId = sessionStorage.getItem('userLoginId');

  useEffect(() => {
    console.log('AdminRoute: Checking admin access...', { isAdmin, loginId });
    
    if (!isAdmin || loginId !== 'ADMIN') {
      console.log('AdminRoute: Admin access denied, redirecting to login');
      navigate('/login', { replace: true });
      return;
    }
    
    console.log('AdminRoute: Admin access granted');
  }, [isAdmin, loginId, navigate]);

  // Don't render children if not admin
  if (!isAdmin || loginId !== 'ADMIN') {
    return null;
  }

  return children;
};

// Smart redirect based on session
const RootRedirect = () => {
  const navigate = useNavigate();
  
  useEffect(() => {
    console.log('RootRedirect: Determining where to redirect user...');
    
    const loginId = sessionStorage.getItem('userLoginId');
    const isAdmin = sessionStorage.getItem('isAdmin');
    
    if (isAdmin === 'true' && loginId === 'ADMIN') {
      console.log('RootRedirect: Admin user detected, redirecting to admin dashboard');
      navigate('/admin', { replace: true });
    } else {
      console.log('RootRedirect: No valid session, redirecting to login');
      navigate('/login', { replace: true });
    }
  }, [navigate]);

  return null;
};

function App() {
  // Add global error boundary logging
  useEffect(() => {
    const handleError = (event) => {
      console.error('Global error caught:', event.error);
    };
    
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  return (
    <ChakraProvider theme={theme}>
      <BrowserRouter>
        <Routes>
          {/* Main login page - handles all user types */}
          <Route path="/login" element={<Login />} />
          
          {/* Setup page */}
          <Route path="/setup" element={<Setup />} />
          
          {/* Protected study flow routes - IN ORDER */}
          <Route 
            path="/consent" 
            element={
              <PrivateRoute>
                <ConsentPage />
              </PrivateRoute>
            } 
          />
          
          {/* NEW: Demographics survey (one-time, after consent) */}
          <Route 
            path="/demographics" 
            element={
              <PrivateRoute>
                <Demographics />
              </PrivateRoute>
            } 
          />
          
          {/* Main survey (repeating, after demographics) */}
          <Route 
            path="/survey" 
            element={
              <PrivateRoute>
                <Survey />
              </PrivateRoute>
            } 
          />
          
          {/* Completion page */}
          <Route 
            path="/completion" 
            element={
              <PrivateRoute>
                <Completion />
              </PrivateRoute>
            } 
          />
          
          {/* Admin dashboard - protected route */}
          <Route 
            path="/admin" 
            element={
              <AdminRoute>
                <AdminDashboard />
              </AdminRoute>
            } 
          />
          
          {/* Root and catch-all routes */}
          <Route path="/" element={<RootRedirect />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ChakraProvider>
  );
}

export default App;