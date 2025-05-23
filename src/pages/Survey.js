// src/pages/Survey.js (Updated version with consent check)
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { ref, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase/config';
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

const QUALTRICS_SURVEY_URL = "https://georgetown.az1.qualtrics.com/jfe/form/SV_2uHTpoplf5gc1SK";

const encodeQualtricsParams = (params) => {
  return Object.entries(params)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
};

const Survey = () => {
  const [images, setImages] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [surveyLoaded, setSurveyLoaded] = useState(false);
  const [lastResponse, setLastResponse] = useState(null);
  const [canLoadNextForm, setCanLoadNextForm] = useState(true);
  const [isFormCompleted, setIsFormCompleted] = useState(false);
  
  const navigate = useNavigate();
  const toast = useToast();
  const loginId = sessionStorage.getItem('userLoginId');

  // Load user data and images
  const loadUserData = async () => {
    if (!loginId) {
      navigate('/login');
      return;
    }

    try {
      setLoading(true);
      
      // Get user data from Firestore
      const userRef = doc(db, 'loginIDs', loginId);
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists()) {
        throw new Error('User not found');
      }
      
      const userData = userDoc.data();
      
      // Check if user has consented
      if (!userData.hasConsented) {
        console.log('User has not consented, redirecting to consent page');
        navigate('/consent');
        return;
      }
      
      // Get assigned images
      const assignedImages = userData.assignedImages || [];
      const completedImages = userData.completedImages || 0;
      
      if (assignedImages.length === 0) {
        throw new Error('No images assigned to this user');
      }
      
      // If marked as completed but hasn't viewed all images, fix the data
      if (userData.surveyCompleted && completedImages < assignedImages.length) {
        await updateDoc(userRef, {
          surveyCompleted: false,
          lastUpdated: serverTimestamp()
        });
      }

      // Load images from Firebase Storage
      const verifiedImages = await Promise.all(
        assignedImages.map(async (imageId, index) => {
          try {
            // Get image document to find URL info
            const imageDocRef = doc(db, 'images', imageId);
            const imageDoc = await getDoc(imageDocRef);
            
            if (!imageDoc.exists()) {
              console.error(`Image document ${imageId} not found in Firestore`);
              throw new Error(`Image document ${imageId} not found`);
            }
            
            const imageData = imageDoc.data();
            console.log(`Image data for ${imageId}:`, imageData);
            
            // Check if we have a URL (from the old format) or storagePath (from the new format)
            let storagePath;
            
            if (imageData.storagePath) {
              // If storagePath exists, use it, but make sure it has the images/ prefix
              storagePath = imageData.storagePath.includes('/') 
                ? imageData.storagePath 
                : `images/${imageData.storagePath}`;
            } else if (imageData.url) {
              // Extract the image number from the imageId
              const matches = imageId.match(/(\d+)/);
              const imageNumber = matches ? parseInt(matches[0]) : 1;
              
              // Reconstruct the path using the known format in Storage
              storagePath = `images/img_${imageNumber.toString().padStart(4, '0')}.jpeg`;
              
              console.log(`Converted path from ${imageData.url} to ${storagePath}`);
            } else {
              console.error(`No URL or storage path found for image ${imageId}`);
              throw new Error(`No URL or storage path found for image ${imageId}`);
            }
            
            console.log(`Attempting to load image from Firebase Storage: ${storagePath}`);
            
            try {
              // Get download URL from Firebase Storage
              const imageRef = ref(storage, storagePath);
              const imageUrl = await getDownloadURL(imageRef);
              
              console.log(`Successfully loaded image ${imageId} from ${storagePath}`);
              
              return {
                id: imageId,
                imageUrl: imageUrl,
                order: index + 1,
                format: imageData.fileExtension || '.jpg',
                prompt: `Please evaluate this image`
              };
            } catch (storageError) {
              console.error(`Storage error for ${imageId}:`, storageError);
              
              // FALLBACK: Use inline SVG data URI to ensure it works offline
              return {
                id: imageId,
                imageUrl: `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='600' viewBox='0 0 800 600'%3E%3Crect width='800' height='600' fill='%23f0f0f0'/%3E%3Ctext x='400' y='300' font-family='Arial' font-size='32' text-anchor='middle' dominant-baseline='middle'%3EImage ${imageId}%3C/text%3E%3C/svg%3E`,
                order: index + 1,
                format: imageData.fileExtension || '.jpg',
                prompt: `Please evaluate this image (placeholder)`
              };
            }
          } catch (error) {
            console.error(`Error loading image ${imageId}:`, error);
            
            // Return a fallback placeholder instead of null
            return {
              id: imageId,
              imageUrl: `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='600' viewBox='0 0 800 600'%3E%3Crect width='800' height='600' fill='%23f0f0f0'/%3E%3Ctext x='400' y='300' font-family='Arial' font-size='32' text-anchor='middle' dominant-baseline='middle'%3EFallback ${imageId}%3C/text%3E%3C/svg%3E`,
              order: index + 1,
              format: '.jpg',
              prompt: `Please evaluate this image (fallback)`
            };
          }
        })
      );

      // We don't need to filter out nulls since we're always returning something now
      setImages(verifiedImages);
      
      // Set current index to the number of completed images
      setCurrentIndex(Math.min(completedImages, verifiedImages.length - 1));
      setLoading(false);
    } catch (error) {
      console.error('Error loading user data:', error);
      setError(`Failed to load survey: ${error.message}`);
      setLoading(false);
    }
  };

  // Load data on mount
  useEffect(() => {
    loadUserData();
  }, []);

  // Handle Qualtrics messages
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
      const userRef = doc(db, 'loginIDs', loginId);
      
      // Update progress
      await updateDoc(userRef, {
        completedImages: currentIndex + 1,
        lastUpdated: serverTimestamp()
      });

      if (currentIndex >= images.length - 1) {
        // Mark survey as completed
        await updateDoc(userRef, {
          surveyCompleted: true,
          completedAt: serverTimestamp()
        });
        
        // Set in session storage
        sessionStorage.setItem('surveyCompleted', 'true');
        
        // Navigate to completion
        navigate('/completion');
      } else {
        setFormSubmitted(false);
        setSurveyLoaded(false);
        setCanLoadNextForm(true);
        setIsFormCompleted(false);
        setCurrentIndex(prev => prev + 1);
      }
    } catch (error) {
      console.error('Error updating progress:', error);
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
    sessionStorage.removeItem('userLoginId');
    sessionStorage.removeItem('isAdmin');
    navigate('/login');
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

  if (loading) {
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
            <Heading size="lg">Survey</Heading>
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
          <Progress value={((currentIndex + 1) / images.length) * 100} size="sm" />
        </Container>
      </Box>

      {/* Main Content */}
      <Container maxW="7xl" pt="100px" pb="100px">
        <Flex gap={8} direction={{ base: "column", lg: "row" }}>
          {/* Image Display */}
          <Box flex="2" bg="white" p={6} borderRadius="lg" boxShadow="md">
            <VStack spacing={4} align="stretch">
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
              
              {/* Image Info */}
              <Box
                p={4}
                bg="gray.50"
                borderRadius="md"
                borderLeft="4px"
                borderColor="blue.500"
              >
                <Text fontSize="lg" color="gray.700">
                  Image {currentIndex + 1} of {images.length}
                </Text>
                <Text fontSize="sm" color="gray.500">
                  ID: {images[currentIndex]?.id}
                </Text>
                {images[currentIndex]?.imageUrl.includes('svg+xml') && (
                  <Alert status="info" mt={2} size="sm">
                    <AlertIcon />
                    Using placeholder image for testing
                  </Alert>
                )}
              </Box>
            </VStack>
          </Box>

          {/* Survey Form */}
          <Box flex="3" bg="white" borderRadius="lg" boxShadow="md" h="800px" overflow="hidden">
            {!surveyLoaded && (
              <Flex h="full" align="center" justify="center">
                <VStack spacing={4}>
                  <Spinner size="xl" />
                  <Text>Loading survey form...</Text>
                </VStack>
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