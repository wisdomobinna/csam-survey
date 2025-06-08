// src/pages/Demographics.js

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
  Alert,
  AlertIcon,
  Card,
  CardBody,
  CardHeader,
  Heading,
  useToast,
  Spinner,
  Flex,
  HStack,
  Badge,
} from '@chakra-ui/react';

const Demographics = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [demographicsCompleted, setDemographicsCompleted] = useState(false);
  const [surveyLoading, setSurveyLoading] = useState(true);
  const [processingCompletion, setProcessingCompletion] = useState(false);

  const navigate = useNavigate();
  const toast = useToast();
  const iframeRef = useRef(null);

  const loadUserData = useCallback(async () => {
    try {
      setLoading(true);
      const userId = sessionStorage.getItem('userLoginId');
      if (!userId) {
        navigate('/login');
        return;
      }

      const userRef = doc(db, 'loginIDs', userId);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        throw new Error('User not found');
      }

      const data = userDoc.data();

      if (!data.hasConsented) {
        navigate('/consent');
        return;
      }
      if (data.demographicsCompleted) {
        navigate('/survey');
        return;
      }
      if (data.surveyCompleted) {
        navigate('/completion');
        return;
      }

    } catch (err) {
      console.error('Error loading user data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    loadUserData();
  }, [loadUserData]);

  const finalizeCompletion = useCallback(async (surveyData = {}) => {
    if (processingCompletion) return;
    try {
      setProcessingCompletion(true);
      const userId = sessionStorage.getItem('userLoginId');
      if (!userId) throw new Error('No user session');

      const userRef = doc(db, 'loginIDs', userId);
      await updateDoc(userRef, {
        demographicsCompleted: true,
        demographicsCompletedAt: serverTimestamp(),
        lastUpdated: serverTimestamp(),
        demographicsData: surveyData,
      });

      toast({
        title: 'Demographics Completed',
        description: 'Proceeding to main study...',
        status: 'success',
        duration: 2000,
      });

      setTimeout(() => navigate('/survey'), 1000);
    } catch (err) {
      console.error('Error saving completion:', err);
      setError(err.message);
      toast({
        title: 'Error',
        description: `Failed to save completion: ${err.message}`,
        status: 'error',
        duration: 5000,
      });
    } finally {
      setProcessingCompletion(false);
    }
  }, [navigate, toast, processingCompletion]);

  const handleManualCompletion = async () => {
    console.log('🔧 Manual completion triggered');
    setDemographicsCompleted(true);
    await finalizeCompletion({ type: 'manual_completion' });
  };

  useEffect(() => {
    const handleMessage = (event) => {
      if (event.origin.includes('qualtrics.com')) {
        try {
          const data = typeof event.data === 'object' ? event.data : { type: event.data };
          if (data.type === 'demographics_completed') {
            setDemographicsCompleted(true);
            finalizeCompletion(data);
          }
        } catch (err) {
          console.error('Error processing message:', err);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [finalizeCompletion]);

  const generateQualtricsUrl = () => {
    return 'https://georgetown.az1.qualtrics.com/jfe/form/SV_0lcUfUbcn7vo7qe';
  };

  const handleIframeLoad = () => {
    console.log('Iframe loaded');
    setSurveyLoading(false);
  };

  if (loading) {
    return (
      <Flex justify="center" align="center" minH="100vh">
        <VStack spacing={4}>
          <Spinner size="xl" color="blue.500" />
          <Text>Loading...</Text>
        </VStack>
      </Flex>
    );
  }

  if (error) {
    return (
      <Flex justify="center" align="center" minH="100vh">
        <Alert status="error">
          <AlertIcon />
          <Text>{error}</Text>
          <Button ml={4} onClick={() => navigate('/login')}>Back to Login</Button>
        </Alert>
      </Flex>
    );
  }

  return (
    <Box minH="100vh" bg="gray.50">
      <Box bg="white" borderBottom="1px solid" borderColor="gray.200" py={4}>
        <Container maxW="4xl">
          <VStack spacing={2}>
            <Heading>Demographics Survey</Heading>
            <HStack spacing={2}>
              <Badge colorScheme="blue">Step 2 of 3</Badge>
              <Badge colorScheme="gray">Consent → Demographics → Main Study</Badge>
            </HStack>
          </VStack>
        </Container>
      </Box>

      <Container maxW="4xl" py={6}>
        <VStack spacing={6}>
          <Card h="600px">
            <CardHeader>
              <HStack justify="space-between">
                <Text fontSize="lg" fontWeight="bold">📊 Demographics Survey</Text>
                {surveyLoading && <Spinner size="sm" />}
              </HStack>
            </CardHeader>
            <CardBody p={0}>
              <Box position="relative" h="full">
                {surveyLoading && (
                  <Flex position="absolute" inset="0" bg="white" zIndex={10} align="center" justify="center">
                    <VStack spacing={3}>
                      <Spinner size="lg" color="blue.500" />
                      <Text>Loading survey...</Text>
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
                  title="Demographics Survey"
                  style={{ border: 0, borderRadius: '0 0 8px 8px' }}
                />
              </Box>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <VStack spacing={4}>
                {demographicsCompleted ? (
                  <Button
                    colorScheme="blue"
                    size="lg"
                    onClick={() => navigate('/survey')}
                    isLoading={processingCompletion}
                    loadingText="Saving..."
                  >
                    Continue to Main Study →
                  </Button>
                ) : (
                  <>
                    <Button variant="solid" colorScheme="orange" size="sm" onClick={handleManualCompletion}>
                      🔧 DEBUG: Continue to Main Study
                    </Button>
                    <Text fontSize="xs" color="gray.500">
                      Use this if the survey completed but didn't signal automatically.
                    </Text>
                    <Alert status="info">
                      <AlertIcon />
                      Complete the survey above to continue.
                    </Alert>
                  </>
                )}
              </VStack>
            </CardBody>
          </Card>
        </VStack>
      </Container>
    </Box>
  );
};

export default Demographics;
