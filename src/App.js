// src/App.js - Updated with clean login system
import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { ChakraProvider, extendTheme } from '@chakra-ui/react';
import Login from './pages/Login';
import Survey from './pages/Survey';
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

// Simple route protection
const PrivateRoute = ({ children }) => {
  const navigate = useNavigate();
  const loginId = sessionStorage.getItem('userLoginId');

  useEffect(() => {
    if (!loginId) {
      navigate('/login', { replace: true });
    }
  }, [loginId, navigate]);

  return children;
};

// Admin-only route
const AdminRoute = ({ children }) => {
  const navigate = useNavigate();
  const isAdmin = sessionStorage.getItem('isAdmin');
  const loginId = sessionStorage.getItem('userLoginId');

  useEffect(() => {
    if (!isAdmin || loginId !== 'ADMIN') {
      navigate('/login', { replace: true });
    }
  }, [isAdmin, loginId, navigate]);

  return children;
};

// Smart redirect based on session - but always allow fresh start from root
const RootRedirect = () => {
  const navigate = useNavigate();
  
  useEffect(() => {
    // Always redirect fresh visits to login page
    // This allows users to start fresh sessions
    navigate('/login', { replace: true });
  }, [navigate]);

  return null;
};

function App() {
  return (
    <ChakraProvider theme={theme}>
      <BrowserRouter>
        <Routes>
          {/* Main login page - handles all user types */}
          <Route path="/login" element={<Login />} />
          
          {/* Setup page (if still needed) */}
          <Route path="/setup" element={<Setup />} />
          
          {/* Protected study flow routes */}
          <Route 
            path="/consent" 
            element={
              <PrivateRoute>
                <ConsentPage />
              </PrivateRoute>
            } 
          />
          <Route 
            path="/survey" 
            element={
              <PrivateRoute>
                <Survey />
              </PrivateRoute>
            } 
          />
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