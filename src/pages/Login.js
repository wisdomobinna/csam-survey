// src/pages/Login.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase/config';
import { signInAnonymously } from 'firebase/auth';
import { checkSurveyCompletion } from '../utils/assessment-tracking';
import {
  Box,
  Button,
  Container,
  Input,
  Text,
  VStack,
  Alert,
  AlertIcon,
  Card,
  CardBody,
  CardHeader,
  Heading,
  useToast,
} from '@chakra-ui/react';

const Login = () => {
  const [loginId, setLoginId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => {
    const existingLoginId = sessionStorage.getItem('userLoginId');
    const isAdmin = sessionStorage.getItem('isAdmin');
    if (existingLoginId) {
      navigate('/survey');
    } else if (isAdmin) {
      navigate('/admin');
    }
  }, [navigate]);

  const validateLoginId = (id) => {
    if (id === 'ADMIN') return true;
    const pattern = /^EV25-\d{3}$/;
    return pattern.test(id);
  };

  const handleInputChange = (e) => {
    let value = e.target.value.toUpperCase();
    
    if (value === 'ADMIN') {
      setLoginId(value);
      return;
    }

    // If the input is being deleted, just update the state
    if (value.length < loginId.length) {
      setLoginId(value);
      return;
    }

    // Add hyphen automatically after EV25
    if (value.length === 4 && !value.includes('-')) {
      value = value + '-';
    }
    
    // Only allow numbers after EV25-
    if (value.length > 5) {
      const prefix = value.slice(0, 5);
      const numbers = value.slice(5).replace(/[^0-9]/g, '');
      value = prefix + numbers;
    }

    // Limit to the format EV25-XXX
    if (value.length <= 8) {
      setLoginId(value);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
  
    if (!loginId) {
      setError('Please enter a login ID');
      return;
    }
  
    if (!validateLoginId(loginId)) {
      setError('Invalid login ID format');
      return;
    }
  
    try {
      setLoading(true);
  
      if (loginId === 'ADMIN') {
        try {
          // First sign in anonymously
          const userCredential = await signInAnonymously(auth);
          console.log('Anonymous auth successful for admin:', userCredential.user.uid);
          
          // Set session storage for admin
          sessionStorage.setItem('userLoginId', 'ADMIN');
          sessionStorage.setItem('isAdmin', 'true');
          
          toast({
            title: 'Admin login successful',
            status: 'success',
            duration: 2000,
          });
  
          // Navigate to admin dashboard
          navigate('/admin');
          return;
        } catch (adminError) {
          console.error('Admin login error:', adminError);
          setError('Admin authentication failed. Please try again.');
          return;
        }
      }
  
      // For regular users:
      // First check if login ID exists
      const userDoc = await getDoc(doc(db, 'loginIDs', loginId));
      
      if (!userDoc.exists()) {
        setError('Invalid login ID');
        return;
      }
  
      // Check if user has completed all surveys
      const isCompleted = await checkSurveyCompletion(loginId);
      
      // Sign in anonymously
      const userCredential = await signInAnonymously(auth);
      console.log('Anonymous auth successful:', userCredential.user.uid);
  
      // Set session data
      sessionStorage.setItem('userLoginId', loginId);
      
      // Update user's last login time
      await updateDoc(doc(db, 'loginIDs', loginId), {
        lastLogin: serverTimestamp()
      });
  
      toast({
        title: 'Login successful',
        status: 'success',
        duration: 2000,
      });
  
      // Navigate based on completion status
      if (isCompleted) {
        navigate('/completion');
      } else {
        navigate('/survey');
      }
      
    } catch (error) {
      console.error('Login error:', error);
      setError('Failed to log in. Please try again.');
    } finally {
      setLoading(false);
    }
  };


  return (
    <Box minH="100vh" bg="gray.50">
      <Container maxW="md" pt={20}>
        <Card boxShadow="xl">
          <CardHeader>
            <Heading size="lg" textAlign="center">Art Survey Portal</Heading>
          </CardHeader>
          <center>Enter your Login ID</center>
          <CardBody>
            <form onSubmit={handleLogin}>
              <VStack spacing={6}>
                <Box w="full">
                  <Input
                    type="text"
                    placeholder=""
                    value={loginId}
                    onChange={handleInputChange}
                    textAlign="center"
                    fontSize="lg"
                    letterSpacing="wider"
                    maxLength={8}
                    autoComplete="off"
                    autoCapitalize="characters"/>
                  <Text fontSize="sm" color="gray.500" textAlign="center" mt={2}>
                    Format: EV25-XXX (where X is a number)
                  </Text>
                </Box>

                {error && (
                  <Alert status="error" borderRadius="md">
                    <AlertIcon />
                    {error}
                  </Alert>
                )}

                <Button
                  type="submit"
                  colorScheme="blue"
                  width="full"
                  isLoading={loading}
                  loadingText="Logging in..."
                >
                  {loginId === 'ADMIN' ? 'Access Admin Dashboard' : 'Start Survey'}
                </Button>
              </VStack>
            </form>
          </CardBody>
        </Card>
      </Container>
    </Box>
  );
};

export default Login;