// src/pages/Demographics.js - One-time demographics survey
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import {
  Box,
  Button,
  Container,
  Text,
  VStack,
  HStack,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Badge,
  Card,
  CardBody,
  CardHeader,
  Heading,
  useToast,
  Spinner,
  Flex,
  Progress,
} from '@chakra-ui/react';

const Demographics = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userProgress, setUserProgress] = useState(null);
  const [surveyLoading, setSurveyLoading] = useState(true);
  const [demographicsCompleted, setDemographicsCompleted] = useState(false);
  const [sessionData, setSessionData] = useState({});
  const [processingCompletion, setProcessingCompletion] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();
  const iframeRef = useRef(null);

  // Load user data and check if demographics already completed
  const loadUserData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      
      const userId = sessionStorage.getItem('userLoginId');
      
      if (!userId) {
        console.error('Demographics: No user session found');
        setError('No user session found');
        navigate('/login');
        return;
      }

      console.log('Demographics: Loading user data for:', userId);
      
      // Get user document
      const userRef = doc(db, 'loginIDs', userId);
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists()) {
        console.error('Demographics: User document not found:', userId);
        setError('User not found');
        navigate('/login');
        return;
      }
      
      const userData = userDoc.data();
      console.log('Demographics: User data loaded:', {
        hasConsented: userData.hasConsented,
        demographicsCompleted: userData.demographicsCompleted,
        surveyCompleted: userData.surveyCompleted
      });
      
      // Critical check: Verify user has consented
      if (!userData.hasConsented) {
        console.log('Demographics: User has not consented, redirecting to consent page');
        navigate('/consent');
        return;
      }
      
      // Check if demographics already completed
      if (userData.demographicsCompleted) {
        console.log('Demographics: User has already completed demographics, redirecting to main survey');
        navigate('/survey');
        return;
      }
      
      // Check if survey is already completed (shouldn't happen, but just in case)
      if (userData.surveyCompleted) {
        console.log('Demographics: User has completed entire study, redirecting to completion page');
        navigate('/completion');
        return;
      }
      
      setUserProgress(userData);
      
      // Set up session data for Qualtrics
      const prolificPid = sessionStorage.getItem('prolificPid') || 'TEST_USER';
      const displayId = sessionStorage.getItem('displayId') || prolificPid;
      
      setSessionData({
        userId,
        prolificPid,
        displayId,
        isTestMode: sessionStorage.getItem('testMode') === 'true'
      });
      
      // Success message
      toast({
        title: 'Demographics Survey Loaded',
        description: 'Please complete the demographic questions to continue',
        status: 'info',
        duration: 3000,
      });
      
    } catch (error) {
      console.error('Demographics: Error loading user data:', error);
      setError(`Failed to load demographics survey: ${error.message}`);
      toast({
        title: 'Error Loading Demographics',
        description: error.message,
        status: 'error',
        duration: 5000,
      });
    } finally {
      setLoading(false);
    }
  }, [navigate, toast]);

  // Initialize component
  useEffect(() => {
    console.log('Demographics: Component mounting, loading user data...');
    loadUserData();
  }, [loadUserData]);

  // Set up Qualtrics message listener
  useEffect(() => {
    const handleQualtricsMessage = (event) => {
      try {
        // Log ALL messages to debug what Qualtrics is sending
        console.log('Demographics: Received message from origin:', event.origin);
        console.log('Demographics: Message data:', event.data);
        console.log('Demographics: Message type:', typeof event.data);
        
        // Handle different message formats that indicate completion
        if (event.data && typeof event.data === 'object') {
          console.log('Demographics: Received object message from Qualtrics:', event.data);
          
          // Look for completion messages
          if (event.data.type === 'survey_completed' || 
              event.data.type === 'form_completed' ||
              event.data.type === 'demographics_completed' ||
              event.data.type === 'survey_end' ||
              event.data.action === 'completed') {
            console.log('Demographics: Qualtrics demographics survey completed');
            setDemographicsCompleted(true);
            handleDemographicsCompletion(event.data);
          } else if (event.data.type === 'survey_ready') {
            console.log('Demographics: Qualtrics demographics survey ready');
            setSurveyLoading(false);
          }
        } 
        // Handle string messages
        else if (typeof event.data === 'string') {
          console.log('Demographics: Received string message:', event.data);
          
          if (event.data === 'survey_completed' || 
              event.data === 'form_completed' || 
              event.data === 'demographics_completed' ||
              event.data === 'qualtrics_completed' ||
              event.data.includes('completed') ||
              event.data.includes('finished') ||
              event.data.includes('end')) {
            console.log('Demographics: Demographics survey completed (string message)');
            setDemographicsCompleted(true);
            handleDemographicsCompletion({ type: 'demographics_completed', data: event.data });
          }
        }
        
        // Special handling for Qualtrics domain messages
        if (event.origin && event.origin.includes('qualtrics.com')) {
          console.log('Demographics: Message from Qualtrics domain detected');
          
          // Check if the message indicates survey completion
          if (event.data && (
              String(event.data).includes('complete') ||
              String(event.data).includes('finish') ||
              String(event.data).includes('end') ||
              String(event.data).includes('next')
            )) {
            console.log('Demographics: Detected completion signal from Qualtrics domain');
            setDemographicsCompleted(true);
          }
        }
        
      } catch (error) {
        console.error('Demographics: Error handling Qualtrics message:', error);
      }
    };

    console.log('Demographics: Setting up Qualtrics message listener');
    window.addEventListener('message', handleQualtricsMessage);
    
    return () => {
      console.log('Demographics: Cleaning up Qualtrics message listener');
      window.removeEventListener('message', handleQualtricsMessage);
    };
  }, []);

  // Handle demographics completion
  const handleDemographicsCompletion = async (surveyData) => {
    if (processingCompletion) return; // Prevent double processing
    
    try {
      setProcessingCompletion(true);
      
      const userId = sessionData.userId;
      
      if (!userId) {
        console.error('Demographics: Missing user ID for completion');
        return;
      }

      console.log('Demographics: Processing demographics completion for user:', userId);
      
      // Update user progress in Firestore
      const userRef = doc(db, 'loginIDs', userId);
      
      await updateDoc(userRef, {
        demographicsCompleted: true,
        demographicsCompletedAt: serverTimestamp(),
        demographicsData: {
          completedAt: serverTimestamp(),
          surveyData: surveyData || {},
          prolificPid: sessionData.prolificPid,
          isTestMode: sessionData.isTestMode
        }
      });
      
      console.log('Demographics: Demographics completion saved to Firestore');
      
      toast({
        title: 'Demographics Complete!',
        description: 'Thank you! Redirecting to the main study...',
        status: 'success',
        duration: 3000,
      });
      
      // Navigate to main survey after a brief delay
      setTimeout(() => {
        navigate('/survey');
      }, 2000);
      
    } catch (error) {
      console.error('Demographics: Error handling demographics completion:', error);
      toast({
        title: 'Error Saving Demographics',
        description: 'Please try again or contact support',
        status: 'error',
        duration: 5000,
      });
      setProcessingCompletion(false);
    }
  };

  // Handle manual completion (debug/fallback)
  const handleManualCompletion = async () => {
    if (!demographicsCompleted) {
      console.log('Demographics: Manual completion triggered by user');
      setDemographicsCompleted(true);
      await handleDemographicsCompletion({ type: 'manual_completion' });
    }
  };

  // Generate Qualtrics URL with parameters
  const generateQualtricsUrl = () => {
    const baseUrl = 'https://georgetown.az1.qualtrics.com/jfe/form/SV_0lcUfUbcn7vo7qe';
    
    const params = new URLSearchParams({
      user_id: sessionData.userId || 'unknown',
      prolific_pid: sessionData.prolificPid || 'test',
      display_id: sessionData.displayId || 'test',
      is_test: sessionData.isTestMode ? 'true' : 'false',
      source: 'demographics_survey'
    });
    
    const finalUrl = `${baseUrl}?${params.toString()}`;
    console.log('Demographics: Qualtrics URL parameters:', Object.fromEntries(params));
    return finalUrl;
  };

  // Handle iframe load
  const handleIframeLoad = () => {
    console.log('Demographics: Demographics survey iframe loaded');
    setSurveyLoading(false);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minH="100vh" bg="gray.50">
        <VStack spacing={4}>
          <Spinner size="xl" color="blue.500" />
          <Text>Loading demographics survey...</Text>
          <Text fontSize="sm" color="gray.600">
            User ID: {sessionStorage.getItem('userLoginId')?.substring(0, 8)}...
          </Text>
        </VStack>
      </Box>
    );
  }

  if (error) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minH="100vh" bg="gray.50">
        <Alert status="error" maxW="md">
          <AlertIcon />
          <Box>
            <AlertTitle>Error Loading Demographics</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
            <Button 
              mt={4} 
              colorScheme="blue" 
              onClick={() => navigate('/login')}
            >
              Return to Login
            </Button>
          </Box>
        </Alert>
      </Box>
    );
  }

  return (
    <Box minH="100vh" bg="gray.50">
      {/* Header */}
      <Box bg="white" borderBottom="1px" borderColor="gray.200" py={4}>
        <Container maxW="6xl">
          <HStack justify="space-between">
            <VStack align="start" spacing={1}>
              <Heading size="md">Image Evaluation Study</Heading>
              <HStack spacing={2}>
                <Badge colorScheme="purple">Demographics Survey</Badge>
                <Badge colorScheme="blue">Step 1 of 2</Badge>
                {sessionData.isTestMode && (
                  <Badge colorScheme="orange">Test Mode</Badge>
                )}
              </HStack>
            </VStack>
            
            <VStack align="end" spacing={1}>
              <Text fontSize="sm" color="gray.600">
                Progress: Step 1 - Demographics
              </Text>
              <Progress 
                value={25} 
                size="sm" 
                colorScheme="purple" 
                w="200px"
              />
            </VStack>
          </HStack>
        </Container>
      </Box>

      <Container maxW="4xl" py={6}>
        <VStack spacing={6}>
          {/* Instructions Card */}
          <Card w="full">
            <CardHeader>
              <HStack>
                <Text fontSize="lg">📋</Text>
                <Heading size="md">Demographics Information</Heading>
              </HStack>
            </CardHeader>
            <CardBody>
              <VStack spacing={3} align="start">
                <Text>
                  Before we begin the main study, please provide some basic demographic information. 
                  This survey will only appear once and takes about 2-3 minutes to complete.
                </Text>
                <Alert status="info">
                  <AlertIcon />
                  <Box>
                    <Text fontSize="sm">
                      <strong>Privacy:</strong> Your demographic information is kept strictly confidential 
                      and is only used for research analysis purposes.
                    </Text>
                  </Box>
                </Alert>
              </VStack>
            </CardBody>
          </Card>

          {/* Demographics Survey */}
          <Card w="full" h="600px">
            <CardHeader>
              <HStack justify="space-between">
                <HStack>
                  <Text fontSize="lg">👤</Text>
                  <Text fontWeight="bold">Demographics Survey</Text>
                </HStack>
                {surveyLoading && (
                  <HStack>
                    <Spinner size="sm" />
                    <Text fontSize="sm" color="gray.600">Loading survey...</Text>
                  </HStack>
                )}
              </HStack>
            </CardHeader>
            <CardBody p={0}>
              <Box position="relative" h="full">
                {surveyLoading && (
                  <Flex
                    position="absolute"
                    top="0"
                    left="0"
                    right="0"
                    bottom="0"
                    bg="white"
                    zIndex="10"
                    align="center"
                    justify="center"
                  >
                    <VStack spacing={3}>
                      <Spinner size="lg" color="purple.500" />
                      <Text>Loading demographics form...</Text>
                    </VStack>
                  </Flex>
                )}
                
                <iframe
                  ref={iframeRef}
                  src={generateQualtricsUrl()}
                  width="100%"
                  height="100%"
                  frameBorder="0"
                  onLoad={handleIframeLoad}
                  style={{
                    border: 'none',
                    borderRadius: '0 0 8px 8px'
                  }}
                  title="Demographics Survey"
                />
              </Box>
            </CardBody>
          </Card>

          {/* Navigation Card */}
          <Card w="full">
            <CardBody>
              <VStack spacing={4}>
                {/* Continue to Main Study Button - only shows when demographics completed */}
                {demographicsCompleted && (
                  <Button
                    colorScheme="blue"
                    size="lg"
                    onClick={() => navigate('/survey')}
                    isLoading={processingCompletion}
                    loadingText="Saving demographics..."
                    w="full"
                    maxW="400px"
                  >
                    Continue to Main Study →
                  </Button>
                )}

                {/* Debug button - remove once messaging works */}
                {!demographicsCompleted && (
                  <VStack spacing={2} w="full" maxW="400px">
                    <Button
                      colorScheme="orange"
                      variant="solid"
                      size="sm"
                      onClick={handleManualCompletion}
                      w="full"
                    >
                      🔧 DEBUG: Continue to Main Study
                    </Button>
                    <Text fontSize="xs" color="gray.500" textAlign="center">
                      Use this if you completed the demographics form but the button didn't appear
                    </Text>
                  </VStack>
                )}

                {/* Status message */}
                {!demographicsCompleted && (
                  <Alert status="info" maxW="400px">
                    <AlertIcon />
                    <Text fontSize="sm">
                      Complete the demographics survey above to continue to the main study
                    </Text>
                  </Alert>
                )}

                {demographicsCompleted && !processingCompletion && (
                  <Alert status="success" maxW="400px">
                    <AlertIcon />
                    <Text fontSize="sm">
                      Demographics completed! Click "Continue to Main Study" to proceed
                    </Text>
                  </Alert>
                )}

                {/* Next Steps Info */}
                <Box textAlign="center" color="gray.600" fontSize="sm" maxW="400px">
                  <Text>
                    <strong>Next:</strong> After completing demographics, you'll proceed to the main study 
                    where you'll evaluate {userProgress?.assignedImages?.length || 'several'} images.
                  </Text>
                </Box>
              </VStack>
            </CardBody>
          </Card>
        </VStack>
      </Container>
    </Box>
  );
};

export default Demographics;