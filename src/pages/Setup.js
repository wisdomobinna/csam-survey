// src/pages/Setup.js - Fixed component with correct imports
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Heading,
  VStack,
  HStack,
  Text,
  Button,
  Card,
  CardBody,
  CardHeader,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  useToast,
  Spinner,
  Badge,
  Icon,
  Divider,
  Code,
  OrderedList,
  ListItem
} from '@chakra-ui/react';
import {
  Database,
  CheckCircle,
  AlertTriangle,
  Settings,
  RefreshCw,
  Trash2,
  Shield
} from 'lucide-react';

// Import utilities with correct function names
import { 
  verifySetup, 
  clearAllData, 
  resetImageAssignments,
  getAssignmentStats 
} from '../utils/firebaseSetup';

const Setup = () => {
  const [loading, setLoading] = useState(false);
  const [setupStatus, setSetupStatus] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => {
    // Check if user is admin
    const isAdmin = sessionStorage.getItem('isAdmin');
    if (!isAdmin || isAdmin !== 'true') {
      navigate('/login');
    }
  }, [navigate]);

  const handleVerifySetup = async () => {
    try {
      setVerifying(true);
      
      toast({
        title: 'Verifying Setup',
        description: 'Checking Firebase configuration...',
        status: 'info',
        duration: 2000,
      });

      const result = await verifySetup();
      setSetupStatus(result);

      if (result.success) {
        toast({
          title: 'Setup Verified',
          description: 'Firebase configuration is working correctly',
          status: 'success',
          duration: 3000,
        });
      } else {
        toast({
          title: 'Setup Issues Found',
          description: result.error || 'Some components are not working correctly',
          status: 'warning',
          duration: 5000,
        });
      }
    } catch (error) {
      console.error('Setup verification error:', error);
      toast({
        title: 'Verification Failed',
        description: error.message,
        status: 'error',
        duration: 5000,
      });
      setSetupStatus({ success: false, error: error.message });
    } finally {
      setVerifying(false);
    }
  };

  const handleClearData = async () => {
    if (!window.confirm('Are you sure? This will delete ALL user data except admin. This cannot be undone!')) {
      return;
    }

    try {
      setLoading(true);
      
      toast({
        title: 'Clearing Data',
        description: 'Removing all user data...',
        status: 'warning',
        duration: 3000,
      });

      await clearAllData();

      toast({
        title: 'Data Cleared',
        description: 'All user data has been successfully removed',
        status: 'success',
        duration: 3000,
      });

      // Refresh setup status
      handleVerifySetup();
    } catch (error) {
      console.error('Clear data error:', error);
      toast({
        title: 'Clear Failed',
        description: error.message,
        status: 'error',
        duration: 5000,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResetAssignments = async () => {
    if (!window.confirm('Reset all image assignments? Users will need to be reassigned images.')) {
      return;
    }

    try {
      setLoading(true);
      
      await resetImageAssignments();
      
      toast({
        title: 'Assignments Reset',
        description: 'Image assignment counts have been reset',
        status: 'success',
        duration: 3000,
      });

      handleVerifySetup();
    } catch (error) {
      console.error('Reset assignments error:', error);
      toast({
        title: 'Reset Failed',
        description: error.message,
        status: 'error',
        duration: 5000,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box minH="100vh" bg="gray.50">
      <Container maxW="4xl" py={8}>
        <VStack spacing={6}>
          <Card w="full">
            <CardHeader>
              <HStack>
                <Icon as={Settings} color="blue.500" />
                <Heading size="lg">System Setup & Verification</Heading>
              </HStack>
            </CardHeader>
            <CardBody>
              <VStack spacing={4}>
                <Text color="gray.600">
                  Use this page to verify your Firebase configuration and manage system data.
                </Text>
                
                <HStack spacing={4}>
                  <Button
                    leftIcon={<Database />}
                    colorScheme="blue"
                    onClick={handleVerifySetup}
                    isLoading={verifying}
                    loadingText="Verifying..."
                  >
                    Verify Setup
                  </Button>
                  
                  <Button
                    leftIcon={<RefreshCw />}
                    colorScheme="orange"
                    variant="outline"
                    onClick={handleResetAssignments}
                    isLoading={loading}
                  >
                    Reset Assignments
                  </Button>
                  
                  <Button
                    leftIcon={<Trash2 />}
                    colorScheme="red"
                    variant="outline"
                    onClick={handleClearData}
                    isLoading={loading}
                  >
                    Clear All Data
                  </Button>
                </HStack>
              </VStack>
            </CardBody>
          </Card>

          {setupStatus && (
            <Card w="full">
              <CardHeader>
                <HStack>
                  <Icon 
                    as={setupStatus.success ? CheckCircle : AlertTriangle} 
                    color={setupStatus.success ? "green.500" : "red.500"} 
                  />
                  <Heading size="md">
                    Setup Status: {setupStatus.success ? 'Success' : 'Issues Found'}
                  </Heading>
                </HStack>
              </CardHeader>
              <CardBody>
                <VStack spacing={4} align="start">
                  {setupStatus.success ? (
                    <>
                      <Alert status="success">
                        <AlertIcon />
                        <Box>
                          <AlertTitle>System Ready!</AlertTitle>
                          <AlertDescription>
                            All components are working correctly.
                          </AlertDescription>
                        </Box>
                      </Alert>
                      
                      {setupStatus.storage && (
                        <Box w="full">
                          <Text fontWeight="bold" mb={2}>Storage Test Results:</Text>
                          <VStack spacing={2} align="start">
                            {setupStatus.storage.map((result, index) => (
                              <HStack key={index}>
                                <Icon 
                                  as={result.status === 'success' ? CheckCircle : AlertTriangle}
                                  color={result.status === 'success' ? 'green.500' : 'red.500'}
                                  size={16}
                                />
                                <Text fontSize="sm">
                                  {result.path}: {result.status === 'success' ? 'Accessible' : result.error}
                                </Text>
                              </HStack>
                            ))}
                          </VStack>
                        </Box>
                      )}
                      
                      {setupStatus.assignments && (
                        <Box w="full">
                          <Text fontWeight="bold" mb={2}>Assignment Statistics:</Text>
                          <HStack spacing={4}>
                            <Badge colorScheme="blue">
                              Set 1: {setupStatus.assignments.set1 ? Object.values(setupStatus.assignments.set1).reduce((a, b) => a + b, 0) : 0} assignments
                            </Badge>
                            <Badge colorScheme="green">
                              Set 2: {setupStatus.assignments.set2 ? Object.values(setupStatus.assignments.set2).reduce((a, b) => a + b, 0) : 0} assignments
                            </Badge>
                          </HStack>
                        </Box>
                      )}
                    </>
                  ) : (
                    <Alert status="error">
                      <AlertIcon />
                      <Box>
                        <AlertTitle>Setup Issues Detected</AlertTitle>
                        <AlertDescription>
                          {setupStatus.error || 'Some components are not working correctly'}
                        </AlertDescription>
                      </Box>
                    </Alert>
                  )}
                  
                  <Divider />
                  
                  <Box>
                    <Text fontSize="sm" color="gray.500">
                      Last checked: {setupStatus.timestamp}
                    </Text>
                  </Box>
                </VStack>
              </CardBody>
            </Card>
          )}

          <Card w="full">
            <CardHeader>
              <Heading size="md">Setup Instructions</Heading>
            </CardHeader>
            <CardBody>
              <VStack spacing={3} align="start">
                <Text fontWeight="bold">Required Firebase Storage Structure:</Text>
                <OrderedList spacing={1} fontSize="sm">
                  <ListItem>Create folder: <Code>set1</Code></ListItem>
                  <ListItem>Upload images 1.png through 1200.png to set1/</ListItem>
                  <ListItem>Create folder: <Code>set2</Code></ListItem>
                  <ListItem>Upload images 1201.png through 2400.png to set2/</ListItem>
                </OrderedList>
                
                <Text fontWeight="bold" mt={4}>Firestore Collections:</Text>
                <OrderedList spacing={1} fontSize="sm">
                  <ListItem><Code>loginIDs</Code> - User accounts and assignments</ListItem>
                  <ListItem><Code>imageAssignments</Code> - Assignment tracking</ListItem>
                </OrderedList>
              </VStack>
            </CardBody>
          </Card>

          <Button
            leftIcon={<Shield />}
            colorScheme="green"
            onClick={() => navigate('/admin')}
            variant="outline"
          >
            Back to Admin Dashboard
          </Button>
        </VStack>
      </Container>
    </Box>
  );
};

export default Setup;