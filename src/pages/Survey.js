// src/pages/Survey.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { ref, getDownloadURL } from 'firebase/storage';
import { db, storage, auth } from '../firebase/config';
import { onAuthStateChanged } from 'firebase/auth';
import { trackAssessment, assignImageBatch, checkSurveyCompletion } from '../utils/assessment-tracking';
import {
  Box,
  Flex,
  Button,
  Text,
  Image,
  Progress,
  Heading,
  Alert,
  AlertIcon,
  Container,
  Spinner,
  VStack,
  useToast,
} from '@chakra-ui/react';

const QUALTRICS_SURVEY_URL = "https://georgetown.az1.qualtrics.com/jfe/form/SV_e8oQEoEpj7Lkv5k";

const encodeQualtricsParams = (params) => {
  return Object.entries(params)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
};

const Survey = () => {
  const [images, setImages] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState('');
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [surveyLoaded, setSurveyLoaded] = useState(false);
  const [lastResponse, setLastResponse] = useState(null);
  const [canLoadNextForm, setCanLoadNextForm] = useState(true);
  const [isFormCompleted, setIsFormCompleted] = useState(false);
  
  const navigate = useNavigate();
  const toast = useToast();
  const loginId = sessionStorage.getItem('userLoginId');

  // Authentication Effect
  useEffect(() => {
    const loginId = sessionStorage.getItem('userLoginId');
    
    if (!loginId) {
      console.log('No loginId found, redirecting to login');
      navigate('/login');
      return;
    }
  
    // Remove refresh handler - this was causing the logout issue
    // window.onbeforeunload = () => {
    //   sessionStorage.removeItem('userLoginId');
    //   sessionStorage.removeItem('isAdmin');
    //   auth.signOut();
    // };
  
    let authUnsubscribe;
    const initAuth = async () => {
      try {
        if (!auth.currentUser) {
          console.log('No user found, redirecting to login');
          sessionStorage.removeItem('userLoginId');
          sessionStorage.removeItem('isAdmin');
          navigate('/login');
          return;
        }
  
        // Check completion status
        const isCompleted = await checkSurveyCompletion(loginId);
        if (isCompleted) {
          console.log('User has completed all surveys, redirecting to completion');
          navigate('/completion');
          return;
        }
  
        console.log('User authenticated:', auth.currentUser.uid);
        setIsAuthenticated(true);
        setInitializing(false);
      } catch (error) {
        console.error('Auth initialization error:', error);
        setError('Failed to initialize authentication');
        setInitializing(false);
        navigate('/login');
      }
    };
  
    initAuth();
    return () => {
      if (authUnsubscribe) authUnsubscribe();
    };
  }, [navigate]);

  // Load Images Effect
  useEffect(() => {
    const loadImages = async () => {
      if (!loginId || !isAuthenticated) {
        console.log('No loginId or not authenticated yet');
        return;
      }

      try {
        setLoading(true);
        const userRef = doc(db, 'userProgress', loginId);
        const userDoc = await getDoc(userRef);
        let assignedBatch;
        
        if (userDoc.exists() && userDoc.data()?.assignedBatch?.length > 0) {
          assignedBatch = userDoc.data().assignedBatch;
        } else {
          assignedBatch = await assignImageBatch(loginId);
        }

        if (!assignedBatch?.length) {
          throw new Error('No image batch assigned');
        }

        const verifiedImages = await Promise.all(
          assignedBatch.map(async (imageId) => {
            // Try all supported extensions
            for (const ext of ['.jpg', '.jpeg', '.png']) {
              const imageRef = ref(storage, `artwork-images/${imageId}${ext}`);
              try {
                const imageUrl = await getDownloadURL(imageRef);
                console.log(`Successfully loaded image ${imageId}${ext}`);
                return {
                  id: imageId,
                  imageUrl,
                  order: parseInt(imageId),
                  format: ext.substring(1) // Store the format that worked
                };
              } catch (error) {
                console.log(`Could not find image ${imageId}${ext}, trying next format...`);
                continue;
              }
            }
            console.warn(`Image ${imageId} not found in any supported format`);
            return null;
          })
        );

        const validImages = verifiedImages
          .filter(img => img !== null)
          .sort((a, b) => a.order - b.order);

        if (validImages.length === 0) {
          throw new Error('No valid images found in storage');
        }

        await updateDoc(userRef, {
          assignedBatch: validImages.map(img => img.id),
          lastUpdated: serverTimestamp()
        });

        setImages(validImages);
        
        const progress = userDoc.exists() ? (userDoc.data().progress || 0) : 0;
        setCurrentIndex(Math.min(progress, validImages.length - 1));
        setLoading(false);
      } catch (error) {
        console.error('Error loading images:', error);
        setError(`Failed to load survey: ${error.message}`);
        setLoading(false);
      }
    };

    if (isAuthenticated && !initializing) {
      loadImages();
    }
  }, [loginId, navigate, isAuthenticated, initializing]);

  // Survey Completion Effect
  useEffect(() => {
    const handleMessage = (event) => {
      if (event.origin !== "https://georgetown.az1.qualtrics.com") return;
      
      try {
        console.log('Message received from Qualtrics:', event.data);
        
        if (typeof event.data === 'string' && event.data.includes('QualtricsEOS')) {
          console.log('Survey completion detected');
          setFormSubmitted(true);
          setCanLoadNextForm(false);
          setIsFormCompleted(true);
          return;
        }
        
        if (typeof event.data === 'object') {
          const data = event.data;
          if (data.type === 'QualtricsEOS') {
            setFormSubmitted(true);
            setCanLoadNextForm(false);
            setIsFormCompleted(true);
            if (data.responseId) {
              setLastResponse(data.responseId);
            }
          }
        }
      } catch (error) {
        if (typeof event.data !== 'string' || event.data.startsWith('{')) {
          console.error('Error processing Qualtrics message:', error);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Reset states when moving to next image
  useEffect(() => {
    setFormSubmitted(false);
    setSurveyLoaded(false);
    setLastResponse(null);
    setCanLoadNextForm(true);
    setIsFormCompleted(false);
  }, [currentIndex]);

  const handleNext = async () => {
    if (!formSubmitted) {
      toast({
        title: "Survey Incomplete",
        description: "Please complete the survey before proceeding",
        status: "warning",
        duration: 3000,
      });
      return;
    }

    try {
      await trackAssessment(images[currentIndex].id, loginId, {
        responseId: lastResponse,
        completedAt: new Date().toISOString(),
        imageNumber: currentIndex + 1
      });
      
      const userRef = doc(db, 'userProgress', loginId);
      await updateDoc(userRef, {
        progress: currentIndex + 1,
        [`completedImages.${images[currentIndex].id}`]: {
          completedAt: serverTimestamp(),
          responseId: lastResponse
        },
        lastUpdated: serverTimestamp()
      });

      if (currentIndex >= images.length - 1) {
        navigate('/completion');
      } else {
        setFormSubmitted(false);
        setSurveyLoaded(false);
        setCanLoadNextForm(true);
        setIsFormCompleted(false);
        setCurrentIndex(prev => prev + 1);
      }
    } catch (error) {
      console.error('Error tracking assessment:', error);
      toast({
        title: "Error",
        description: "Failed to save progress. Please try again.",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const handleLogout = () => {
    auth.signOut().then(() => {
      sessionStorage.removeItem('userLoginId');
      sessionStorage.removeItem('isAdmin');
      navigate('/login');
    });
  };

  const handleSurveyError = (error) => {
    console.error('Survey error:', error);
    toast({
      title: 'Survey Error',
      description: 'There was an error loading the survey. Please try refreshing the page.',
      status: 'error',
      duration: 5000,
      isClosable: true,
    });
  };

  const getQualtricsUrl = () => {
    if (!images[currentIndex]?.id || !loginId) return '';

    const params = {
      loginId,
      imageId: images[currentIndex].id,
      imageNumber: currentIndex + 1,
      timestamp: new Date().toISOString(),
      totalImages: images.length,
      preventAutoAdvance: 'true'
    };

    return `${QUALTRICS_SURVEY_URL}?${encodeQualtricsParams(params)}`;
  };


  if (loading || initializing) {
    return (
      <Flex minH="100vh" align="center" justify="center">
        <VStack spacing={4}>
          <Spinner size="xl" />
          <Text>Loading survey...</Text>
        </VStack>
      </Flex>
    );
  }

  if (error) {
    return (
      <Flex minH="100vh" align="center" justify="center" p={4}>
        <Alert status="error" borderRadius="md">
          <AlertIcon />
          <VStack align="start">
            <Text fontWeight="bold">Error loading survey</Text>
            <Text>{error}</Text>
            <Button onClick={() => window.location.reload()} mt={2}>
              Try Again
            </Button>
          </VStack>
        </Alert>
      </Flex>
    );
  }

  return (
    <Box minH="100vh" bg="gray.50">
      {/* Header */}
      <Box position="fixed" top={0} left={0} right={0} bg="white" boxShadow="sm" zIndex={10}>
        <Container maxW="7xl" py={4}>
          <Flex justify="space-between" align="center" mb={2}>
            <Heading size="lg">Art Survey</Heading>
            <Flex gap={4} align="center">
              <Text>Image {currentIndex + 1} of {images.length}</Text>
              <Button 
                onClick={handleLogout}
                colorScheme="red"
                size="sm"
              >
                Logout
              </Button>
            </Flex>
          </Flex>
          <Progress value={(currentIndex / images.length) * 100} size="sm" />
        </Container>
      </Box>

      {/* Main Content */}
      <Container maxW="7xl" pt="100px" pb="100px">
        <Flex gap={8} direction={{ base: "column", lg: "row" }}>
          {/* Image Display */}
          <Box flex="2" bg="white" p={6} borderRadius="lg" boxShadow="md">
            <Image
              src={images[currentIndex]?.imageUrl}
              alt={`Artwork ${currentIndex + 1}`}
              w="full"
              h="auto"
              maxH="70vh"
              objectFit="contain"
              borderRadius="md"
              fallback={<Spinner />}
            />
          </Box>

          {/* Survey Form */}
          <Box flex="3" bg="white" borderRadius="lg" boxShadow="md" h="800px" overflow="hidden">
            {!surveyLoaded && (
              <Flex h="full" align="center" justify="center">
                <Spinner size="xl" />
              </Flex>
            )}
            {canLoadNextForm && (
              <iframe
                key={`${currentIndex}-${images[currentIndex]?.id}-${loginId}`}
                src={getQualtricsUrl()}
                title="Survey Form"
                width="100%"
                height="100%"
                style={{ 
                  display: surveyLoaded ? 'block' : 'none',
                  border: 'none'
                }}
                onLoad={() => {
                  console.log('Survey iframe loaded');
                  setSurveyLoaded(true);
                }}
                onError={handleSurveyError}
              />
            )}
            {isFormCompleted && !canLoadNextForm && (
              <Flex h="full" align="center" justify="center" p={8}>
                <Text fontSize="lg" color="gray.600" textAlign="center">
                  Form completed. Please click "Next Image" below to continue.
                </Text>
              </Flex>
            )}
          </Box>
        </Flex>
      </Container>

      {/* Footer */}
      <Box position="fixed" bottom={0} left={0} right={0} bg="white" borderTop="1px" borderColor="gray.200" zIndex={10}>
        <Container maxW="7xl" py={4}>
          <Flex justify="space-between" align="center">
            <Alert status={formSubmitted ? "success" : "warning"} borderRadius="md">
              <AlertIcon />
              {formSubmitted 
                ? "Response recorded - You can now proceed to the next image" 
                : "Please complete the current survey form before proceeding"}
            </Alert>
            <Button
              onClick={handleNext}
              colorScheme={formSubmitted ? "green" : "gray"}
              size="lg"
              ml={4}
              isDisabled={!formSubmitted}
            >
              {currentIndex === images.length - 1 ? 'Complete Survey' : 'Next Image'}
            </Button>
          </Flex>
        </Container>
      </Box>
    </Box>
  );
};

export default Survey;