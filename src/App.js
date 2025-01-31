// src/App.js
import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { ChakraProvider, extendTheme } from '@chakra-ui/react';
import Login from './pages/Login';
import Survey from './pages/Survey';
import AdminDashboard from './pages/AdminDashboard';
import Completion from './pages/Completion';

const theme = extendTheme({
  styles: {
    global: {
      body: { bg: 'gray.50' }
    }
  }
});

const SurveyWrapper = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleSurveyComplete = (event) => {
      if (event.data.surveyComplete) {
        const params = new URLSearchParams(location.search);
        const currentImageNumber = Number(params.get('imageNumber') || 1);
        if (currentImageNumber >= 12) {
          navigate('/completion');
        } else {
          navigate(`/survey?imageNumber=${currentImageNumber + 1}`);
        }
      }
    };

    window.addEventListener('message', handleSurveyComplete);
    return () => window.removeEventListener('message', handleSurveyComplete);
  }, [navigate, location]);

  return <Survey />;
};

// Updated PrivateRoute component with role checking
const PrivateRoute = ({ children }) => {
  const navigate = useNavigate();
  const loginId = sessionStorage.getItem('userLoginId');
  const isAdmin = sessionStorage.getItem('isAdmin');

  useEffect(() => {
    // If no authentication at all, redirect to login
    if (!loginId && !isAdmin) {
      navigate('/login', { replace: true });
    }
  }, [loginId, isAdmin, navigate]);

  return children;
};

// Updated AdminRoute component with strict admin checking
const AdminRoute = ({ children }) => {
  const navigate = useNavigate();
  const isAdmin = sessionStorage.getItem('isAdmin');
  const loginId = sessionStorage.getItem('userLoginId');

  useEffect(() => {
    // Specifically check for admin credentials
    if (!isAdmin || loginId !== 'ADMIN') {
      navigate('/login', { replace: true });
    }
  }, [isAdmin, loginId, navigate]);

  return children;
};

// Root component to handle initial auth check
const RootRedirect = () => {
  const navigate = useNavigate();
  const isAdmin = sessionStorage.getItem('isAdmin');
  const loginId = sessionStorage.getItem('userLoginId');

  useEffect(() => {
    if (isAdmin && loginId === 'ADMIN') {
      navigate('/admin', { replace: true });
    } else if (loginId && !isAdmin) {
      navigate('/survey', { replace: true });
    } else {
      navigate('/login', { replace: true });
    }
  }, [navigate, isAdmin, loginId]);

  return null;
};

function App() {
  return (
    <ChakraProvider theme={theme}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route 
            path="/survey" 
            element={
              <PrivateRoute>
                <SurveyWrapper />
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