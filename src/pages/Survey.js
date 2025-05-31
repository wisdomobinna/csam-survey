// src/pages/Survey.js - Complete image evaluation interface with Qualtrics integration
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, serverTimestamp, setDoc, collection } from 'firebase/firestore';
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
  Badge,
  HStack,
  Card,
  CardBody,
  CardHeader,
  IconButton,
  Tooltip,
} from '@chakra-ui/react';
import { 
  LogOut, 
  RefreshCw, 
  Eye, 
  CheckCircle, 
  AlertTriangle,
  Info,
  ExternalLink
} from 'lucide-react';

const QUALTRICS_SURVEY_URL = process.env.REACT_APP_QUALTRICS_SURVEY_URL || "https://georgetown.az1.qualtrics.com/jfe/form/SV_2uHTpoplf5gc1SK";

// Folder metadata for display purposes
const FOLDER_INFO = {
  'cc3m_filtered': { 
    name: 'Conceptual Captions (Filtered)', 
    color: 'blue',
    description: 'Curated high-quality conceptual images'
  },
  'cc3m_unfiltered': { 
    name: 'Conceptual Captions (Unfiltered)', 
    color: 'green',
    description: 'Raw conceptual images without filtering'
  },
  'laion_filtered': { 
    name: 'LAION Dataset (Filtered)', 
    color: 'purple',
    description: 'Curated LAION dataset images'
  },
  'laion_unfiltered': { 
    name: 'LAION Dataset (Unfiltered)', 
    color: 'orange',
    description: 'Raw LAION dataset images'
  }
};

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
  const [imageLoadError, setImageLoadError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  
  const navigate = useNavigate();
  const toast = useToast();
  const loginId = sessionStorage.getItem('userLoginId');
  const prolificPid = sessionStorage.getItem('prolificPid');

  // Load user data and images
  const loadUserData = async () => {
    if (!loginId) {
      console.error('No login ID found in session');
      navigate('/login');
      return;
    }

    try {
      setLoading(true);
      console.log('Loading user data for:', loginId);
      
      // Get user data from Firestore
      const userRef = doc(db, 'loginIDs', loginId);
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists()) {
        throw new Error('User not found');
      }
      
      const userData = userDoc.data();
      console.log('User data loaded:', userData);
      
      // Check if user has consented
      if (!userData.hasConsented) {
        console.log('User has not consented, redirecting to consent page');
        navigate('/consent');
        return;
      }
      
      // Get assigned images (should be 4 images, one from each folder)
      const assignedImages = userData.assignedImages || [];
      const completedImages = userData.completedImages || 0;
      
      if (assignedImages.length === 0) {
        throw new Error('No images assigned to this user. Please contact support.');
      }
      
      console.log(`Loading ${assignedImages.length} assigned images:`, assignedImages);
      
      // If marked as completed but hasn't viewed all images, fix the data
      if (userData.surveyCompleted && completedImages < assignedImages.length) {
        console.log('Fixing survey completion status');
        await updateDoc(userRef, {
          surveyCompleted: false,
          lastUpdated: serverTimestamp()
        });
      }

      // Load images from Firestore and Firebase Storage
      const loadedImages = await Promise.all(
        assignedImages.map(async (imageId, index) => {
          try {
            console.log(`Loading image ${imageId}...`);
            
            // Get image document from Firestore
            const imageDocRef = doc(db, 'images', imageId);
            const imageDoc = await getDoc(imageDocRef);
            
            if (!imageDoc.exists()) {
              console.error(`Image document ${imageId} not found in Firestore`);
              throw new Error(`Image document ${imageId} not found`);
            }
            
            const imageData = imageDoc.data();
            console.log(`Image data for ${imageId}:`, imageData);
            
            // Get the storage path
            const storagePath = imageData.storagePath;
            if (!storagePath) {
              throw new Error(`No storage path found for image ${imageId}`);
            }
            
            console.log(`Loading image from Firebase Storage: ${storagePath}`);
            
            try {
              // Get download URL from Firebase Storage
              const imageRef = ref(storage, storagePath);
              const imageUrl = await getDownloadURL(imageRef);
              
              console.log(`Successfully loaded image ${imageId} from ${storagePath}`);
              
              // Get folder info for display
              const folderInfo = FOLDER_INFO[imageData.category] || FOLDER_INFO[imageData.folder] || {
                name: 'Unknown Category',
                color: 'gray',
                description: 'Category information not available'
              };
              
              return {
                id: imageId,
                imageUrl: imageUrl,
                order: index + 1,
                category: imageData.category || imageData.folder,
                folder: imageData.folder,
                folderInfo: folderInfo,
                imageNumber: imageData.imageNumber || parseInt(imageId),
                storagePath: storagePath,
                prompt: `Please evaluate this image from ${folderInfo.name}`,
                isLoaded: true
              };
            } catch (storageError) {
              console.error(`Storage error for ${imageId}:`, storageError);
              
              // Create fallback placeholder
              const folderInfo = FOLDER_INFO[imageData.category] || FOLDER_INFO[imageData.folder] || {
                name: 'Unknown Category',
                color: 'gray',
                description: 'Category information not available'
              };
              
              return {
                id: imageId,
                imageUrl: `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='600' viewBox='0 0 800 600'%3E%3Crect width='800' height='600' fill='%23f0f0f0'/%3E%3Ctext x='400' y='250' font-family='Arial' font-size='24' text-anchor='middle' fill='%23666'%3EImage ${imageId}%3C/text%3E%3Ctext x='400' y='300' font-family='Arial' font-size='18' text-anchor='middle' fill='%23888'%3E${folderInfo.name}%3C/text%3E%3Ctext x='400' y='350' font-family='Arial' font-size='14' text-anchor='middle' fill='%23aaa'%3EPlaceholder - Check Storage%3C/text%3E%3C/svg%3E`,
                order: index + 1,
                category: imageData.category || imageData.folder,
                folder: imageData.folder,
                folderInfo: folderInfo,
                imageNumber: imageData.imageNumber || parseInt(imageId),
                storagePath: storagePath,
                prompt: `Please evaluate this placeholder for ${folderInfo.name}`,
                isPlaceholder: true,
                isLoaded: false
              };
            }
          } catch (error) {
            console.error(`Error loading image ${imageId}:`, error);
            
            // Return a basic fallback
            return {
              id: imageId,
              imageUrl: `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='600' viewBox='0 0 800 600'%3E%3Crect width='800' height='600' fill='%23f8f8f8'/%3E%3Ctext x='400' y='300' font-family='Arial' font-size='20' text-anchor='middle' fill='%23999'%3EImage ${imageId} - Error Loading%3C/text%3E%3C/svg%3E`,
              order: index + 1,
              category: 'unknown',
              folder: 'unknown',
              folderInfo: { name: 'Error', color: 'red', description: 'Failed to load image data' },
              imageNumber: parseInt(imageId) || 0,
              prompt: `Error loading image ${imageId}`,
              isPlaceholder: true,
              hasError: true,
              isLoaded: false
            };
          }
        })
      );

      setImages(loadedImages);
      
      // Set current index to the number of completed images
      setCurrentIndex(Math.min(completedImages, loadedImages.length - 1));
      setLoading(false);
      
      console.log(`Loaded ${loadedImages.length} images, starting at index ${completedImages}`);
      
      // Show welcome message
      toast({
        title: 'Images Loaded Successfully',
        description: `Ready to evaluate ${loadedImages.length} images. Starting with image ${completedImages + 1}.`,
        status: 'success',
        duration: 3000,
      });
      
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
      // Only accept messages from Qualtrics
      if (event.origin !== "https://georgetown.az1.qualtrics.com") {
        console.log('Ignoring message from:', event.origin);
        return;
      }
      
      try {
        console.log('Message received from Qualtrics:', event.data);
        
        // Handle string-based completion signals
        if (typeof event.data === 'string' && event.data.includes('QualtricsEOS')) {
          console.log('Survey completion detected via string');
          handleSurveyCompletion();
          return;
        }
        
        // Handle object-based completion signals
        if (typeof event.data === 'object' && event.data !== null) {
          const data = event.data;
          if (data.type === 'QualtricsEOS' || data.event === 'survey_complete') {
            console.log('Survey completion detected via object');
            if (data.responseId) {
              setLastResponse(data.responseId);
              console.log('Qualtrics Response ID captured:', data.responseId);
            }
            handleSurveyCompletion(data.responseId);
          }
        }
      } catch (error) {
        // Only log significant errors, ignore parsing errors for non-JSON strings
        if (typeof event.data !== 'string' || event.data.startsWith('{')) {
          console.error('Error processing Qualtrics message:', error);
        }
      }
    };

    console.log('Setting up Qualtrics message listener');
    window.addEventListener('message', handleMessage);
    
    return () => {
      console.log('Cleaning up Qualtrics message listener');
      window.removeEventListener('message', handleMessage);
    };
  }, [currentIndex, images, loginId]);

  // Handle survey completion
  const handleSurveyCompletion = async (responseId = null) => {
    console.log('Handling survey completion for image:', currentIndex + 1);
    
    setFormSubmitted(true);
    setCanLoadNextForm(false);
    setIsFormCompleted(true);
    
    // Track the completion with full metadata
    try {
      const currentImage = images[currentIndex];
      const completionData = {
        userId: loginId,
        imageId: currentImage.id,
        imageNumber: currentIndex + 1,
        category: currentImage.category,
        folder: currentImage.folder,
        responseId: responseId || lastResponse,
        prolificPid: prolificPid,
        userIdSentToQualtrics: prolificPid || loginId,
        completedAt: serverTimestamp(),
        sessionInfo: {
          studyId: new URLSearchParams(window.location.search).get('STUDY_ID'),
          sessionId: new URLSearchParams(window.location.search).get('SESSION_ID')
        }
      };
      
      // Save to completion tracking collection
      const completionRef = doc(collection(db, 'imageCompletions'));
      await setDoc(completionRef, completionData);
      
      console.log('Image completion tracked:', completionData);
      
    } catch (error) {
      console.error('Error tracking image completion:', error);
    }
  };

  // Reset states when moving to next image
  useEffect(() => {
    setFormSubmitted(false);
    setSurveyLoaded(false);
    setLastResponse(null);
    setCanLoadNextForm(true);
    setIsFormCompleted(false);
    setImageLoadError(false);
  }, [currentIndex]);

  const handleNext = async () => {
    if (!formSubmitted) {
      toast({
        title: "Survey Incomplete",
        description: "Please complete the survey form before proceeding to the next image",
        status: "warning",
        duration: 4000,
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
        
        toast({
          title: "Study Complete!",
          description: "Thank you for your participation. Redirecting to completion page...",
          status: "success",
          duration: 3000,
        });
        
        // Navigate to completion after a short delay
        setTimeout(() => {
          navigate('/completion');
        }, 2000);
      } else {
        // Move to next image
        setFormSubmitted(false);
        setSurveyLoaded(false);
        setCanLoadNextForm(true);
        setIsFormCompleted(false);
        setCurrentIndex(prev => prev + 1);
        
        toast({
          title: "Progress Saved",
          description: `Moving to image ${currentIndex + 2} of ${images.length}`,
          status: "success",
          duration: 2000,
        });
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
    const confirmLogout = window.confirm('Are you sure you want to logout? Your progress has been saved and you can return later to continue.');
    if (confirmLogout) {
      sessionStorage.removeItem('userLoginId');
      sessionStorage.removeItem('prolificPid');
      sessionStorage.removeItem('displayId');
      navigate('/login');
    }
  };

  const handleRefreshSurvey = () => {
    setSurveyLoaded(false);
    setCanLoadNextForm(true);
    setFormSubmitted(false);
    setIsFormCompleted(false);
    
    toast({
      title: 'Survey Refreshed',
      description: 'The survey form has been reloaded',
      status: 'info',
      duration: 2000,
    });
  };

  const handleImageError = () => {
    setImageLoadError(true);
    console.error('Error loading image:', images[currentIndex]?.imageUrl);
  };

  const handleImageRetry = async () => {
    if (retryCount < 3) {
      setRetryCount(prev => prev + 1);
      setImageLoadError(false);
      
      // Try to reload the image URL
      const currentImage = images[currentIndex];
      if (currentImage && !currentImage.isPlaceholder) {
        try {
          const imageRef = ref(storage, currentImage.storagePath);
          const newImageUrl = await getDownloadURL(imageRef);
          
          // Update the image URL
          const updatedImages = [...images];
          updatedImages[currentIndex] = {
            ...currentImage,
            imageUrl: newImageUrl
          };
          setImages(updatedImages);
          
          toast({
            title: 'Image Reloaded',
            description: 'Successfully refreshed the image',
            status: 'success',
            duration: 2000,
          });
        } catch (error) {
          console.error('Error retrying image load:', error);
          toast({
            title: 'Retry Failed',
            description: 'Could not reload the image. Using placeholder.',
            status: 'error',
            duration: 3000,
          });
        }
      }
    } else {
      toast({
        title: 'Maximum Retries Reached',
        description: 'Please proceed with the placeholder image or contact support',
        status: 'warning',
        duration: 4000,
      });
    }
  };

  const getQualtricsUrl = () => {
    if (!images[currentIndex]?.id || !loginId) return '';

    const currentImage = images[currentIndex];
    
    // Get Prolific ID from session for user_id field
    const userIdForQualtrics = prolificPid || loginId;
    
    const params = {
      // PRIMARY USER IDENTIFICATION for Qualtrics
      user_id: userIdForQualtrics,
      
      // SECONDARY IDENTIFIERS for internal tracking
      internal_user_id: loginId,
      prolific_pid: prolificPid || '',
      
      // IMAGE AND STUDY INFORMATION
      image_id: currentImage.id,
      image_number: currentIndex + 1,
      total_images: images.length,
      category: currentImage.category,
      folder: currentImage.folder,
      image_storage_path: currentImage.storagePath,
      
      // SESSION INFORMATION
      session_timestamp: new Date().toISOString(),
      study_id: new URLSearchParams(window.location.search).get('STUDY_ID') || '',
      session_id: new URLSearchParams(window.location.search).get('SESSION_ID') || '',
      
      // TECHNICAL PARAMETERS
      prevent_auto_advance: 'true',
      source: prolificPid ? 'prolific' : 'direct'
    };

    console.log('Qualtrics URL parameters:', params);
    return `${QUALTRICS_SURVEY_URL}?${encodeQualtricsParams(params)}`;
  };

  if (loading) {
    return (
      <Flex minH="100vh" align="center" justify="center" bg="gray.50">
        <VStack spacing={4}>
          <Spinner size="xl" color="blue.500" />
          <Text>Loading your assigned images...</Text>
          <Text fontSize="sm" color="gray.600">This may take a moment</Text>
        </VStack>
      </Flex>
    );
  }

  if (error) {
    return (
      <Flex minH="100vh" align="center" justify="center" p={4} bg="gray.50">
        <Alert status="error" borderRadius="md" maxW="lg">
          <AlertIcon />
          <VStack align="start">
            <Text fontWeight="bold">Error loading survey</Text>
            <Text>{error}</Text>
            <HStack mt={3}>
              <Button onClick={() => window.location.reload()} colorScheme="red">
                Try Again
              </Button>
              <Button onClick={handleLogout} variant="outline">
                Return to Login
              </Button>
            </HStack>
          </VStack>
        </Alert>
      </Flex>
    );
  }

  const currentImage = images[currentIndex];

  return (
    <Box minH="100vh" bg="gray.50">
      {/* Header */}
      <Box position="fixed" top={0} left={0} right={0} bg="white" boxShadow="sm" zIndex={10}>
        <Container maxW="7xl" py={4}>
          <Flex justify="space-between" align="center" mb={2}>
            <VStack align="start" spacing={1}>
              <Heading size="lg">Image Evaluation Survey</Heading>
              <HStack>
                <Text fontSize="sm" color="gray.600">
                  Image {currentIndex + 1} of {images.length}
                </Text>
                {currentImage && (
                  <Badge colorScheme={currentImage.folderInfo.color} size="sm">
                    {currentImage.folderInfo.name}
                  </Badge>
                )}
              </HStack>
            </VStack>
            <HStack spacing={3}>
              <Text fontSize="sm" color="gray.600" fontFamily="mono">
                {prolificPid ? `${prolificPid.substring(0, 8)}...` : loginId?.substring(0, 12)}
              </Text>
              <Tooltip label="Refresh survey form">
                <IconButton
                  icon={<RefreshCw />}
                  onClick={handleRefreshSurvey}
                  size="sm"
                  variant="outline"
                  aria-label="Refresh survey"
                />
              </Tooltip>
              <Button 
                leftIcon={<LogOut />}
                onClick={handleLogout}
                colorScheme="red"
                size="sm"
              >
                Logout
              </Button>
            </HStack>
          </Flex>
          <Progress 
            value={((currentIndex + 1) / images.length) * 100} 
            size="sm"
            colorScheme={currentImage?.folderInfo.color || "blue"}
          />
        </Container>
      </Box>

      {/* Main Content */}
      <Container maxW="7xl" pt="120px" pb="120px">
        <Flex gap={8} direction={{ base: "column", lg: "row" }}>
          {/* Image Display */}
          <Box flex="2" bg="white" p={6} borderRadius="lg" boxShadow="md">
            <VStack spacing={4} align="stretch">
              <Card>
                <CardBody p={0} position="relative">
                  {imageLoadError ? (
                    <VStack spacing={4} p={8} minH="400px" justify="center">
                      <AlertTriangle size={48} color="#E53E3E" />
                      <Text fontSize="lg" fontWeight="bold" color="red.600">
                        Image Failed to Load
                      </Text>
                      <Text textAlign="center" color="gray.600">
                        There was an issue loading this image. You can try refreshing or proceed with the evaluation.
                      </Text>
                      <HStack>
                        <Button 
                          leftIcon={<RefreshCw />}
                          onClick={handleImageRetry}
                          colorScheme="blue"
                          isDisabled={retryCount >= 3}
                        >
                          Retry ({3 - retryCount} left)
                        </Button>
                        <Button 
                          leftIcon={<Eye />}
                          onClick={() => setImageLoadError(false)}
                          variant="outline"
                        >
                          Use Placeholder
                        </Button>
                      </HStack>
                    </VStack>
                  ) : (
                    <Image
                      src={currentImage?.imageUrl}
                      alt={`Image ${currentIndex + 1}`}
                      w="full"
                      h="auto"
                      maxH="70vh"
                      objectFit="contain"
                      borderRadius="md"
                      fallback={<Spinner />}
                      onError={handleImageError}
                      border={currentImage?.isPlaceholder ? "2px dashed #CBD5E0" : "none"}
                    />
                  )}
                </CardBody>
              </Card>
              
              {/* Image Info */}
              <Card>
                <CardHeader pb={2}>
                  <HStack justify="space-between">
                    <Text fontSize="lg" fontWeight="bold" color="gray.700">
                      Image {currentIndex + 1} of {images.length}
                    </Text>
                    <Badge colorScheme={currentImage?.folderInfo.color} variant="solid">
                      {currentImage?.folderInfo.name}
                    </Badge>
                  </HStack>
                </CardHeader>
                <CardBody pt={0}>
                  <VStack align="start" spacing={2}>
                    <Text fontSize="sm" color="gray.600">
                      {currentImage?.folderInfo.description}
                    </Text>
                    
                    <HStack spacing={4} fontSize="sm" color="gray.500" wrap="wrap">
                      <Text>ID: {currentImage?.id}</Text>
                      <Text>Category: {currentImage?.category}</Text>
                      {currentImage?.imageNumber && (
                        <Text>Number: {currentImage.imageNumber}</Text>
                      )}
                      {currentImage?.isLoaded && (
                        <Badge colorScheme="green" size="sm">Loaded</Badge>
                      )}
                    </HStack>
                    
                    {currentImage?.isPlaceholder && (
                      <Alert status="warning" size="sm">
                        <AlertIcon />
                        <Text fontSize="sm">
                          {currentImage.hasError ? 
                            "Error loading image - using placeholder" : 
                            "Using placeholder for testing"}
                        </Text>
                      </Alert>
                    )}
                  </VStack>
                </CardBody>
              </Card>
            </VStack>
          </Box>

          {/* Survey Form */}
          <Box flex="3" bg="white" borderRadius="lg" boxShadow="md" h="800px" overflow="hidden">
            {!surveyLoaded && canLoadNextForm && (
              <Flex h="full" align="center" justify="center">
                <VStack spacing={4}>
                  <Spinner size="xl" color={currentImage?.folderInfo.color || "blue"} />
                  <Text>Loading evaluation form...</Text>
                  <Text fontSize="sm" color="gray.500">
                    For {currentImage?.folderInfo.name}
                  </Text>
                  <Text fontSize="xs" color="gray.400">
                    This may take a few seconds
                  </Text>
                </VStack>
              </Flex>
            )}
            
            {canLoadNextForm && (
              <iframe
                key={`${currentIndex}-${currentImage?.id}-${loginId}`}
                src={getQualtricsUrl()}
                title="Evaluation Form"
                width="100%"
                height="100%"
                style={{ 
                  display: surveyLoaded ? 'block' : 'none',
                  border: 'none'
                }}
                onLoad={() => {
                  console.log('Survey iframe loaded for image:', currentImage?.id);
                  setSurveyLoaded(true);
                }}
                onError={() => {
                  console.error('Survey iframe failed to load');
                  toast({
                    title: 'Survey Load Error',
                    description: 'There was an error loading the survey. Please try refreshing.',
                    status: 'error',
                    duration: 5000,
                    isClosable: true,
                  });
                }}
              />
            )}
            
            {isFormCompleted && !canLoadNextForm && (
              <Flex h="full" align="center" justify="center" p={8}>
                <VStack spacing={4}>
                  <CheckCircle size={48} color="#38A169" />
                  <Text fontSize="lg" color="green.600" textAlign="center" fontWeight="bold">
                    ✓ Evaluation Complete
                  </Text>
                  <Text color="gray.600" textAlign="center">
                    Your response has been recorded successfully. Click "Next Image" below to continue.
                  </Text>
                  {lastResponse && (
                    <Text fontSize="xs" color="gray.500" fontFamily="mono">
                      Response ID: {lastResponse}
                    </Text>
                  )}
                </VStack>
              </Flex>
            )}
          </Box>
        </Flex>
      </Container>

      {/* Footer */}
      <Box position="fixed" bottom={0} left={0} right={0} bg="white" borderTop="1px" borderColor="gray.200" zIndex={10}>
        <Container maxW="7xl" py={4}>
          <Flex justify="space-between" align="center">
            <Alert 
              status={formSubmitted ? "success" : "info"} 
              borderRadius="md"
              variant="left-accent"
              maxW="lg"
            >
              <AlertIcon />
              <VStack align="start" spacing={0}>
                <Text fontSize="sm" fontWeight="medium">
                  {formSubmitted 
                    ? "✓ Response recorded successfully" 
                    : "Please complete the evaluation form"}
                </Text>
                <Text fontSize="xs" color="gray.500">
                  {formSubmitted 
                    ? "You can now proceed to the next image" 
                    : "All questions must be answered before continuing"}
                </Text>
              </VStack>
            </Alert>
            
            <HStack spacing={3}>
              {currentIndex === images.length - 1 && (
                <Text fontSize="sm" color="gray.600" fontStyle="italic">
                  This is your final image
                </Text>
              )}
              
              <Button
                onClick={handleNext}
                colorScheme={formSubmitted ? "green" : "gray"}
                size="lg"
                isDisabled={!formSubmitted}
                leftIcon={currentIndex === images.length - 1 ? <CheckCircle /> : undefined}
              >
                {currentIndex === images.length - 1 ? 'Complete Study' : 'Next Image'}
              </Button>
            </HStack>
          </Flex>
        </Container>
      </Box>
    </Box>
  );
};

export default Survey;