// src/pages/AdminLogin.js - Dedicated admin login page
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Icon,
  HStack,
} from '@chakra-ui/react';
import { Settings, Shield } from 'lucide-react';

const AdminLogin = () => {
  const [adminPassword, setAdminPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => {
    // Check if already admin
    const isAdmin = sessionStorage.getItem('isAdmin');
    if (isAdmin === 'true') {
      navigate('/admin/dashboard');
    }
  }, [navigate]);

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setError('');

    if (!adminPassword.trim()) {
      setError('Please enter admin credentials');
      return;
    }

    if (adminPassword.trim() !== 'ADMIN') {
      setError('Invalid admin credentials');
      return;
    }

    try {
      setLoading(true);
      
      // Set admin session
      sessionStorage.setItem('userLoginId', 'ADMIN');
      sessionStorage.setItem('isAdmin', 'true');
      
      toast({
        title: 'Admin Access Granted',
        description: 'Welcome to the admin dashboard',
        status: 'success',
        duration: 2000,
      });
      
      navigate('/admin');
    } catch (error) {
      console.error('Admin login error:', error);
      setError('Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box minH="100vh" bg="gray.50">
      <Container maxW="sm" pt={20}>
        <Card boxShadow="xl">
          <CardHeader>
            <VStack spacing={2}>
              <HStack>
                <Icon as={Shield} color="green.500" size={24} />
                <Heading size="lg" textAlign="center">
                  Admin Dashboard
                </Heading>
              </HStack>
              <Text fontSize="sm" color="gray.600" textAlign="center">
                Administrator Access Portal
              </Text>
            </VStack>
          </CardHeader>
          <CardBody>
            <form onSubmit={handleAdminLogin}>
              <VStack spacing={6}>
                <VStack spacing={2} w="full">
                  <HStack w="full" justify="center">
                    <Icon as={Settings} color="gray.500" />
                    <Text fontSize="sm" fontWeight="medium" color="gray.700">
                      Enter Admin Credentials
                    </Text>
                  </HStack>
                  
                  <Input
                    type="password"
                    placeholder="Admin Password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    textAlign="center"
                    bg="white"
                    border="2px solid"
                    borderColor={adminPassword === 'ADMIN' ? 'green.300' : 'gray.200'}
                    size="lg"
                    autoFocus
                  />
                </VStack>

                {error && (
                  <Alert status="error" borderRadius="md">
                    <AlertIcon />
                    <Text fontSize="sm">{error}</Text>
                  </Alert>
                )}

                <Button
                  type="submit"
                  colorScheme="green"
                  width="full"
                  isLoading={loading}
                  loadingText="Authenticating..."
                  size="lg"
                  leftIcon={<Shield />}
                >
                  Access Admin Dashboard
                </Button>

                <Button
                  variant="ghost"
                  colorScheme="gray"
                  size="sm"
                  onClick={() => navigate('/login')}
                >
                  ← Back to Study Login
                </Button>
              </VStack>
            </form>
          </CardBody>
        </Card>

        <Box mt={6} textAlign="center">
          <Text fontSize="xs" color="gray.500">
            Authorized personnel only. All access is logged and monitored.
          </Text>
        </Box>
      </Container>
    </Box>
  );
};

export default AdminLogin;