// src/pages/Login.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase/config';
import { signInAnonymously } from 'firebase/auth';
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
        sessionStorage.setItem('isAdmin', 'true');
        navigate('/admin');
        return;
      }

      // First check if login ID exists
      const userDoc = await getDoc(doc(db, 'loginIDs', loginId));
      
      if (!userDoc.exists()) {
        setError('Invalid login ID');
        return;
      }

      // Sign in anonymously first
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
        description: 'Welcome to the Art Survey',
        status: 'success',
        duration: 2000,
      });

      // Navigate to survey
      navigate('/survey');
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