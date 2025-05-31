// src/pages/Survey.js - Complete fixed version with proper image loading
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { ref, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase/config';
import { checkSurveyCompletion } from '../utils/assessment-tracking';
import {
  Box,
  Button,
  Container,
  Image,
  Text,
  VStack,
  HStack,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Progress,
  Badge,
  Card,
  CardBody,
  CardHeader,
  Heading,
  useToast,
  Spinner,
  Icon,
  Flex,
  Divider,
} from '@chakra-ui/react';
import { ChevronLeft, ChevronRight, Eye, Clock, CheckCircle, ArrowRight } from 'lucide-react';

const Survey = () => {
  const [images, setImages] = useState([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userProgress, setUserProgress] = useState(null);
  const [surveyLoading, setSurveyLoading] = useState(false);
  const [completedImages, setCompletedImages] = useState(new Set());
  const [qualtricsReady, setQualtricsReady] = useState(false);
  const [sessionData, setSessionData] = useState({});
  const navigate = useNavigate();
  const toast = useToast();
  const iframeRef = useRef(null);

  // Load user data and images
  const loadUserData = useCallback(async () => {
    try {
      setLoading(true);
      const userId = sessionStorage.getItem('userLoginId');
      
      if (!userId) {
        setError('No user session found');
        navigate('/login');
        return;
      }

      console.log('Loading user data for:', userId);
      
      // Get user document
      const userRef = doc(db, 'loginIDs', userId);
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists()) {
        setError('User not found');
        navigate('/login');
        return;
      }
      
      const userData = userDoc.data();
      console.log('User data loaded:', userData);
      
      // Check if user has consented
      if (!userData.hasConsented) {
        console.log('User has not consented, redirecting...');
        navigate('/consent');
        return;
      }
      
      // Get assigned images
      const assignedImages = userData.assignedImages || [];
      console.log('Assigned images:', assignedImages);
      
      if (assignedImages.length === 0) {
        setError('No images assigned to this user');
        return;
      }
      
      // Load image data with proper error handling
      const imagePromises = assignedImages.map(async (imageData, index) => {
        try {
          console.log(`Loading image ${index + 1}:`, imageData);
          
          // Image data should already contain the download URL from assignment
          if (imageData.url) {
            return {
              ...imageData,
              loaded: true
            };
          }
          
          // Fallback: if no URL, try to get it from storage
          if (imageData.path) {
            console.log(`Getting download URL for path: ${imageData.path}`);
            const imageRef = ref(storage, imageData.path);
            const downloadURL = await getDownloadURL(imageRef);
            
            return {
              ...imageData,
              url: downloadURL,
              loaded: true
            };
          }
          
          // Last resort: construct path from name and set
          if (imageData.name && imageData.set) {
            const constructedPath = `${imageData.set}/${imageData.name}`;
            console.log(`Constructing path: ${constructedPath}`);
            const imageRef = ref(storage, constructedPath);
            const downloadURL = await getDownloadURL(imageRef);
            
            return {
              ...imageData,
              path: constructedPath,
              url: downloadURL,
              loaded: true
            };
          }
          
          throw new Error(`Insufficient image data: ${JSON.stringify(imageData)}`);
          
        } catch (error) {
          console.error(`Error loading image ${index + 1}:`, error);
          console.error('Image data:', imageData);
          
          return {
            ...imageData,
            error: error.message,
            loaded: false
          };
        }
      });
      
      const loadedImages = await Promise.all(imagePromises);
      console.log('All images processed:', loadedImages);
      
      // Filter out failed images and log them
      const validImages = loadedImages.filter(img => img.loaded);
      const failedImages = loadedImages.filter(img => !img.loaded);
      
      if (failedImages.length > 0) {
        console.error('Failed to load images:', failedImages);
        console.error('This might indicate missing images in Firebase Storage or incorrect paths');
      }
      
      if (validImages.length === 0) {
        setError('No images could be loaded. Please contact support.');
        return;
      }
      
      setImages(validImages);
      setUserProgress(userData);
      
      // Set up completed images tracking
      const completed = new Set();
      if (userData.completedImageIds) {
        userData.completedImageIds.forEach(id => completed.add(id));
      }
      setCompletedImages(completed);
      
      // Determine starting image index
      const completedImagesCount = userData.completedImages || 0;
      const startIndex = Math.min(completedImagesCount, validImages.length - 1);
      setCurrentImageIndex(startIndex);
      
      console.log(`Loaded ${validImages.length} images, starting at index ${startIndex}`);
      
      if (failedImages.length > 0) {
        console.warn(`${failedImages.length} images failed to load`);
      }
      
      // Set up session data for Qualtrics
      const prolificPid = sessionStorage.getItem('prolificPid') || 'TEST_USER';
      const displayId = sessionStorage.getItem('displayId') || prolificPid;
      
      setSessionData({
        userId,
        prolificPid,
        displayId,
        isTestMode: sessionStorage.getItem('testMode') === 'true'
      });
      
    } catch (error) {
      console.error('Error loading user data:', error);
      setError(`Failed to load study data: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  // Initialize component
  useEffect(() => {
    loadUserData();
  }, [loadUserData]);

  // Set up Qualtrics message listener
  useEffect(() => {
    const handleQualtricsMessage = (event) => {
      try {
        if (event.data && typeof event.data === 'object') {
          console.log('Received message from Qualtrics:', event.data);
          
          if (event.data.type === 'survey_completed') {
            handleSurveyCompletion(event.data);
          } else if (event.data.type === 'survey_ready') {
            setQualtricsReady(true);
            setSurveyLoading(false);
          }
        }
      } catch (error) {
        console.error('Error handling Qualtrics message:', error);
      }
    };

    console.log('Setting up Qualtrics message listener');
    window.addEventListener('message', handleQualtricsMessage);
    
    return () => {
      console.log('Cleaning up Qualtrics message listener');
      window.removeEventListener('message', handleQualtricsMessage);
    };
  }, [currentImageIndex]);

  // Handle survey completion
  const handleSurveyCompletion = async (surveyData) => {
    try {
      const userId = sessionData.userId;
      const currentImage = images[currentImageIndex];
      
      if (!currentImage || !userId) {
        console.error('Missing required data for survey completion');
        return;
      }

      console.log('Processing survey completion for image:', currentImage.id);
      
      // Update completed images tracking
      const newCompletedImages = new Set(completedImages);
      newCompletedImages.add(currentImage.id);
      setCompletedImages(newCompletedImages);
      
      // Update user progress in Firestore
      const userRef = doc(db, 'loginIDs', userId);
      const newCompletedCount = newCompletedImages.size;
      
      await updateDoc(userRef, {
        completedImages: newCompletedCount,
        completedImageIds: Array.from(newCompletedImages),
        lastImageCompleted: currentImage.id,
        lastCompletionTime: serverTimestamp(),
        [`imageCompletion_${currentImage.id}`]: {
          completedAt: serverTimestamp(),
          surveyData: surveyData,
          imageIndex: currentImageIndex
        }
      });
      
      console.log(`Updated user progress: ${newCompletedCount}/${images.length} images completed`);
      
      toast({
        title: 'Response Saved',
        description: `Image ${currentImageIndex + 1} evaluation completed`,
        status: 'success',
        duration: 2000,
      });
      
      // Check if all images are completed
      if (newCompletedCount >= images.length) {
        // Mark survey as completed
        await updateDoc(userRef, {
          surveyCompleted: true,
          completedAt: serverTimestamp()
        });
        
        toast({
          title: 'Study Completed!',
          description: 'Thank you for your participation',
          status: 'success',
          duration: 3000,
        });
        
        // Navigate to completion page
        setTimeout(() => {
          navigate('/completion');
        }, 2000);
      } else {
        // Move to next image
        const nextIndex = currentImageIndex + 1;
        if (nextIndex < images.length) {
          setCurrentImageIndex(nextIndex);
          setQualtricsReady(false);
        }
      }
      
    } catch (error) {
      console.error('Error handling survey completion:', error);
      toast({
        title: 'Error Saving Response',
        description: 'Please try again or contact support',
        status: 'error',
        duration: 5000,
      });
    }
  };

  // Navigate between images
  const navigateToImage = (index) => {
    if (index >= 0 && index < images.length) {
      setCurrentImageIndex(index);
      setQualtricsReady(false);
      setSurveyLoading(true);
    }
  };

  // Generate Qualtrics URL with parameters
  const generateQualtricsUrl = () => {
    const currentImage = images[currentImageIndex];
    if (!currentImage) return '';
    
    const baseUrl = process.env.REACT_APP_QUALTRICS_SURVEY_URL;
    if (!baseUrl) {
      console.error('Qualtrics survey URL not configured');
      return '';
    }
    
    const params = new URLSearchParams({
      user_id: sessionData.userId || 'unknown',
      prolific_pid: sessionData.prolificPid || 'test',
      image_id: currentImage.id || 'unknown',
      image_name: currentImage.name || 'unknown',
      image_set: currentImage.set || 'unknown',
      image_index: currentImageIndex.toString(),
      total_images: images.length.toString(),
      is_test: sessionData.isTestMode ? 'true' : 'false'
    });
    
    const finalUrl = `${baseUrl}?${params.toString()}`;
    console.log('Qualtrics URL parameters:', Object.fromEntries(params));
    return finalUrl;
  };

  // Handle iframe load
  const handleIframeLoad = () => {
    console.log('Survey iframe loaded for image:', images[currentImageIndex]?.id);
    setSurveyLoading(false);
  };

  // Get current image
  const currentImage = images[currentImageIndex];
  const progressPercentage = images.length > 0 ? Math.round((completedImages.size / images.length) * 100) : 0;
  
  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minH="100vh">
        <VStack spacing={4}>
          <Spinner size="xl" color="blue.500" />
          <Text>Loading your assigned images...</Text>
        </VStack>
      </Box>
    );
  }

  if (error) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minH="100vh">
        <Alert status="error" maxW="md">
          <AlertIcon />
          <Box>
            <AlertTitle>Error Loading Study</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Box>
        </Alert>
      </Box>
    );
  }

  if (!currentImage) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minH="100vh">
        <Alert status="warning" maxW="md">
          <AlertIcon />
          <Box>
            <AlertTitle>No Image Available</AlertTitle>
            <AlertDescription>No image data found for current index.</AlertDescription>
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
                <Badge colorScheme="blue">
                  Image {currentImageIndex + 1} of {images.length}
                </Badge>
                <Badge colorScheme="green">
                  {completedImages.size} completed
                </Badge>
                {sessionData.isTestMode && (
                  <Badge colorScheme="orange">Test Mode</Badge>
                )}
              </HStack>
            </VStack>
            
            <VStack align="end" spacing={1}>
              <Text fontSize="sm" color="gray.600">
                Progress: {progressPercentage}%
              </Text>
              <Progress 
                value={progressPercentage} 
                size="sm" 
                colorScheme="blue" 
                w="200px"
              />
            </VStack>
          </HStack>
        </Container>
      </Box>

      <Container maxW="6xl" py={6}>
        <HStack spacing={6} align="start">
          {/* Left Side - Image Display */}
          <Box flex="1" maxW="500px">
            <Card>
              <CardHeader>
                <VStack spacing={2}>
                  <HStack w="full" justify="space-between">
                    <Text fontSize="sm" color="gray.600">
                      {currentImage.set?.toUpperCase()} - {currentImage.name}
                    </Text>
                    {completedImages.has(currentImage.id) && (
                      <Badge colorScheme="green" leftIcon={<CheckCircle size={12} />}>
                        Completed
                      </Badge>
                    )}
                  </HStack>
                  <Divider />
                </VStack>
              </CardHeader>
              <CardBody>
                <VStack spacing={4}>
                  <Box
                    position="relative"
                    w="full"
                    maxW="400px"
                    mx="auto"
                    bg="gray.100"
                    borderRadius="md"
                    overflow="hidden"
                  >
                    <Image
                      src={currentImage.url}
                      alt={`Study image ${currentImageIndex + 1}`}
                      w="full"
                      h="auto"
                      maxH="400px"
                      objectFit="contain"
                      onError={(e) => {
                        console.error('Image failed to load:', currentImage);
                        e.target.style.display = 'none';
                      }}
                    />
                  </Box>
                  
                  {/* Image Navigation */}
                  <HStack spacing={2} w="full" justify="center">
                    <Button
                      leftIcon={<ChevronLeft />}
                      size="sm"
                      variant="outline"
                      onClick={() => navigateToImage(currentImageIndex - 1)}
                      isDisabled={currentImageIndex === 0}
                    >
                      Previous
                    </Button>
                    
                    <Text fontSize="sm" color="gray.600" minW="100px" textAlign="center">
                      {currentImageIndex + 1} of {images.length}
                    </Text>
                    
                    <Button
                      rightIcon={<ChevronRight />}
                      size="sm"
                      variant="outline"
                      onClick={() => navigateToImage(currentImageIndex + 1)}
                      isDisabled={currentImageIndex === images.length - 1}
                    >
                      Next
                    </Button>
                  </HStack>
                </VStack>
              </CardBody>
            </Card>
          </Box>

          {/* Right Side - Survey */}
          <Box flex="2">
            <Card h="600px">
              <CardHeader>
                <HStack justify="space-between">
                  <HStack>
                    <Icon as={Eye} color="blue.500" />
                    <Text fontWeight="bold">Image Evaluation Survey</Text>
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
                        <Spinner size="lg" color="blue.500" />
                        <Text>Loading evaluation form...</Text>
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
                    title={`Survey for image ${currentImageIndex + 1}`}
                  />
                </Box>
              </CardBody>
            </Card>
          </Box>
        </HStack>

        {/* Bottom Progress Bar */}
        <Card mt={6}>
          <CardBody>
            <VStack spacing={3}>
              <HStack w="full" justify="space-between">
                <Text fontSize="sm" fontWeight="medium">
                  Study Progress
                </Text>
                <Text fontSize="sm" color="gray.600">
                  {completedImages.size} of {images.length} images completed
                </Text>
              </HStack>
              
              <Progress 
                value={progressPercentage} 
                size="lg" 
                colorScheme="blue" 
                w="full"
                bg="gray.100"
              />
              
              <HStack spacing={4} fontSize="sm" color="gray.600">
                <HStack>
                  <Icon as={Clock} size={16} />
                  <Text>Estimated time remaining: {Math.max(0, (images.length - completedImages.size) * 2)} minutes</Text>
                </HStack>
                <HStack>
                  <Icon as={CheckCircle} size={16} />
                  <Text>{progressPercentage}% complete</Text>
                </HStack>
              </HStack>
              
              {completedImages.size === images.length && (
                <Alert status="success" borderRadius="md">
                  <AlertIcon />
                  <Box>
                    <AlertTitle>Study Complete!</AlertTitle>
                    <AlertDescription>
                      You have successfully evaluated all assigned images. 
                      You will be redirected to the completion page shortly.
                    </AlertDescription>
                  </Box>
                </Alert>
              )}
            </VStack>
          </CardBody>
        </Card>
      </Container>
    </Box>
  );
};

export default Survey;