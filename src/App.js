// src/App.js - Simplified version
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

// Simple redirect to login
const RootRedirect = () => {
  const navigate = useNavigate();
  
  useEffect(() => {
    navigate('/login', { replace: true });
  }, [navigate]);

  return null;
};

function App() {
  return (
    <ChakraProvider theme={theme}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/setup" element={<Setup />} />
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
          <Route 
            path="/admin" 
            element={
              <AdminRoute>
                <AdminDashboard />
              </AdminRoute>
            } 
          />
          <Route path="/" element={<RootRedirect />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ChakraProvider>
  );
}

export default App;