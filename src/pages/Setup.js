// src/pages/Setup.js
import React, { useState } from 'react';
import { Box, Button, Container, Heading, Text, VStack, Alert, AlertIcon, Code, Divider } from '@chakra-ui/react';
import { initializeFirestore, verifySetup, checkInitializationStatus, clearAllData } from '../utils/firebaseSetup';

const Setup = () => {
  const [loading, setLoading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState(null);

  const checkStatus = async () => {
    try {
      const currentStatus = await checkInitializationStatus();
      setStatus(currentStatus);
    } catch (err) {
      console.error('Error checking status:', err);
      setError(`Status check failed: ${err.message}`);
    }
  };

  const handleSetup = async () => {
    setLoading(true);
    setError('');
    setMessage('');
    
    try {
      const result = await initializeFirestore();
      if (result) {
        setMessage('Setup completed successfully! Users and images have been created.');
        
        // Verify the setup
        const verification = await verifySetup();
        console.log('Verification result:', verification);
        
        if (verification.success) {
          setMessage(`Setup verified! Sample user: ${verification.sampleUser.loginId}`);
        }
      } else {
        setMessage('Database already initialized.');
      }
      
      await checkStatus();
    } catch (err) {
      console.error('Setup error:', err);
      setError(`Setup failed: ${err.message}`);
      
      // Log more detailed error info
      if (err.code) {
        setError(`${err.code}: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClearData = async () => {
    if (!window.confirm('Are you sure you want to clear all data? This cannot be undone.')) {
      return;
    }

    setClearing(true);
    setError('');
    setMessage('');

    try {
      await clearAllData();
      setMessage('All data cleared successfully!');
      await checkStatus();
    } catch (err) {
      console.error('Clear error:', err);
      setError(`Failed to clear data: ${err.message}`);
    } finally {
      setClearing(false);
    }
  };

  React.useEffect(() => {
    checkStatus();
  }, []);

  return (
    <Container maxW="md" py={10}>
      <VStack spacing={6}>
        <Heading>Database Setup</Heading>
        <Text>Initialize the database with users and images.</Text>
        
        {status && (
          <Box w="full" p={4} bg="gray.100" borderRadius="md">
            <Text fontWeight="bold">Current Status:</Text>
            <Text>Images: {status.imageCount} / {status.expectedImages || 1000}</Text>
            <Text>Users: {status.userCount} / {status.expectedUsers || 200}</Text>
            <Text>Initialized: {status.initialized ? 'Yes' : 'No'}</Text>
            {status.error && <Text color="red.500">Error: {status.error}</Text>}
          </Box>
        )}
        
        {message && (
          <Alert status="success">
            <AlertIcon />
            {message}
          </Alert>
        )}
        
        {error && (
          <Alert status="error">
            <AlertIcon />
            {error}
          </Alert>
        )}
        
        <VStack spacing={4} w="full">
          <Button
            colorScheme="blue"
            onClick={handleSetup}
            isLoading={loading}
            loadingText="Running setup..."
            size="lg"
            w="full"
          >
            Initialize Database
          </Button>
          
          <Button
            colorScheme="red"
            variant="outline"
            onClick={handleClearData}
            isLoading={clearing}
            loadingText="Clearing data..."
            size="sm"
          >
            Clear All Data
          </Button>
        </VStack>
        
        <Box w="full" p={4} bg="blue.50" borderRadius="md">
          <Text fontWeight="bold" mb={2}>Sample Credentials:</Text>
          <Code>Login ID: 0001, Password: a0001</Code>
          <br />
          <Code>Login ID: 0002, Password: b0002</Code>
          <br />
          <Code>Login ID: 0026, Password: z0026</Code>
          <br />
          <Code>Login ID: 0027, Password: a0027</Code>
        </Box>
        
        <Divider />
        
        <Box w="full" p={4} bg="orange.50" borderRadius="md">
          <Text fontWeight="bold" mb={2}>Troubleshooting:</Text>
          <Text fontSize="sm">
            1. Check Firebase Console → Firestore Rules
            <br />
            2. Ensure Firestore is enabled in your project
            <br />
            3. Check browser console for detailed errors
            <br />
            4. Verify Firebase configuration is correct
          </Text>
        </Box>
      </VStack>
    </Container>
  );
};

export default Setup;