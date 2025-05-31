// src/pages/Setup.js - Fixed Shield import

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Heading,
  Text,
  Button,
  VStack,
  HStack,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  useToast,
  Spinner,
  Card,
  CardBody,
  Progress,
  Icon,
  Badge
} from '@chakra-ui/react';

// Fixed lucide-react import
import { ShieldCheck, UserPlus, Database } from 'lucide-react';

// Import Firebase setup functions
import { assignImagesToUser } from '../utils/firebaseSetup';
import { db } from '../firebase/config';
import { collection, getDocs } from 'firebase/firestore';

const Setup = () => {
  const navigate = useNavigate();
  const toast = useToast();
  
  const [loading, setLoading] = useState(false);
  const [setupComplete, setSetupComplete] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('');
  const [userCount, setUserCount] = useState(0);

  // Check current setup status
  useEffect(() => {
    checkSetupStatus();
  }, []);

  const checkSetupStatus = async () => {
    try {
      // Check if users already exist
      const usersRef = collection(db, 'loginIDs');
      const usersSnapshot = await getDocs(usersRef);
      
      let count = 0;
      usersSnapshot.forEach((doc) => {
        if (doc.id !== 'ADMIN') {
          count++;
        }
      });
      
      setUserCount(count);
      setSetupComplete(count > 0);
      
    } catch (error) {
      console.error('Error checking setup status:', error);
    }
  };

  const runSetup = async () => {
    try {
      setLoading(true);
      setProgress(0);
      setCurrentStep('Initializing setup...');

      // Create 10 test users
      const totalUsers = 10;
      
      for (let i = 1; i <= totalUsers; i++) {
        setCurrentStep(`Creating user ${i} of ${totalUsers}...`);
        setProgress((i / totalUsers) * 100);
        
        const userId = `USER_${String(i).padStart(3, '0')}`;
        await assignImagesToUser(userId);
        
        // Small delay to show progress
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      setCurrentStep('Setup complete!');
      setProgress(100);
      setSetupComplete(true);
      setUserCount(totalUsers);

      toast({
        title: 'Setup Completed',
        description: `Successfully created ${totalUsers} users with image assignments`,
        status: 'success',
        duration: 5000,
      });

    } catch (error) {
      console.error('Setup error:', error);
      toast({
        title: 'Setup Failed',
        description: error.message,
        status: 'error',
        duration: 5000,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxW="2xl" py={8}>
      <VStack spacing={8}>
        {/* Header */}
        <VStack spacing={4} textAlign="center">
          <Icon as={Database} w={12} h={12} color="blue.500" />
          <Heading>Study Setup</Heading>
          <Text color="gray.600">
            Initialize the study with test users and image assignments
          </Text>
        </VStack>

        {/* Status Card */}
        <Card w="full">
          <CardBody>
            <VStack spacing={4}>
              <HStack justify="space-between" w="full">
                <Text fontWeight="bold">Setup Status</Text>
                <Badge 
                  colorScheme={setupComplete ? 'green' : 'gray'}
                  variant="subtle"
                >
                  {setupComplete ? 'Complete' : 'Not Started'}
                </Badge>
              </HStack>
              
              {setupComplete && (
                <Alert status="success">
                  <AlertIcon />
                  <Box>
                    <AlertTitle>Setup Complete!</AlertTitle>
                    <AlertDescription>
                      {userCount} users have been created with image assignments.
                    </AlertDescription>
                  </Box>
                </Alert>
              )}

              {!setupComplete && (
                <Alert status="info">
                  <AlertIcon />
                  <Box>
                    <AlertTitle>Ready to Setup</AlertTitle>
                    <AlertDescription>
                      Click the button below to create test users and assign images.
                    </AlertDescription>
                  </Box>
                </Alert>
              )}
            </VStack>
          </CardBody>
        </Card>

        {/* Setup Progress */}
        {loading && (
          <Card w="full">
            <CardBody>
              <VStack spacing={4}>
                <Text fontWeight="bold">Setup Progress</Text>
                <Progress value={progress} w="full" colorScheme="blue" />
                <Text fontSize="sm" color="gray.600">{currentStep}</Text>
              </VStack>
            </CardBody>
          </Card>
        )}

        {/* Setup Actions */}
        <Card w="full">
          <CardBody>
            <VStack spacing={4}>
              <Icon as={ShieldCheck} w={8} h={8} color="green.500" />
              <Text fontWeight="bold">Setup Options</Text>
              
              <VStack spacing={3} w="full">
                <Button
                  colorScheme="blue"
                  size="lg"
                  leftIcon={<Icon as={UserPlus} />}
                  onClick={runSetup}
                  isLoading={loading}
                  loadingText="Setting up..."
                  isDisabled={setupComplete}
                  w="full"
                >
                  {setupComplete ? 'Setup Already Complete' : 'Run Initial Setup'}
                </Button>
                
                <Text fontSize="sm" color="gray.600" textAlign="center">
                  This will create 10 test users and assign 10 images to each user
                  (5 from set1, 5 from set2)
                </Text>
              </VStack>
            </VStack>
          </CardBody>
        </Card>

        {/* Navigation */}
        <HStack spacing={4}>
          <Button
            variant="outline"
            onClick={() => navigate('/admin')}
          >
            Back to Admin
          </Button>
          
          {setupComplete && (
            <Button
              colorScheme="green"
              onClick={() => navigate('/admin/dashboard')}
            >
              Go to Dashboard
            </Button>
          )}
        </HStack>
      </VStack>
    </Container>
  );
};

export default Setup;