// src/pages/Survey.js - Updated flow: Consent → Main Survey → Demographics → Completion
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
  Flex,
  Divider,
} from '@chakra-ui/react';

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
  const [processingNext, setProcessingNext] = useState(false);
  
  // Key states for automatic progression
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [canLoadNextForm, setCanLoadNextForm] = useState(true);
  const [isFormCompleted, setIsFormCompleted] = useState(false);
  const [lastResponse, setLastResponse] = useState(null);
  
  // Demographics survey states - NOW COMES AFTER MAIN SURVEY
  const [showingDemographics, setShowingDemographics] = useState(false);
  const [demographicsCompleted, setDemographicsCompleted] = useState(false);
  const [demographicsLoaded, setDemographicsLoaded] = useState(false);
  const [lastQuestionReached, setLastQuestionReached] = useState(false);
  const [processingDemographics, setProcessingDemographics] = useState(false);
  const [isCompletingStudy, setIsCompletingStudy] = useState(false); // NEW: Track completion state
  
  const navigate = useNavigate();
  const toast = useToast();
  const iframeRef = useRef(null);

  // Load user data and determine starting point
  const loadUserData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      
      const userId = sessionStorage.getItem('userLoginId');
      
      if (!userId) {
        console.error('Survey: No user session found');
        setError('No user session found');
        navigate('/login');
        return;
      }

      console.log('Survey: Loading user data for:', userId);
      
      const userRef = doc(db, 'loginIDs', userId);
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists()) {
        console.error('Survey: User document not found:', userId);
        setError('User not found');
        navigate('/login');
        return;
      }
      
      const userData = userDoc.data();
      console.log('Survey: User data loaded:', {
        hasConsented: userData.hasConsented,
        mainSurveyCompleted: userData.mainSurveyCompleted,
        demographicsCompleted: userData.demographicsCompleted,
        surveyCompleted: userData.surveyCompleted,
        assignedImages: userData.assignedImages?.length,
        completedImages: userData.completedImages
      });
      
      // UPDATED FLOW LOGIC:
      // 1. Check consent first
      if (!userData.hasConsented) {
        console.log('Survey: User has not consented, redirecting to consent page');
        navigate('/consent');
        return;
      }
      
      // 2. Check if FULLY completed (main survey + demographics)
      const isFullyCompleted = await checkSurveyCompletion(userId);
      if (isFullyCompleted || userData.surveyCompleted) {
        console.log('Survey: User has completed entire study, redirecting to completion page');
        navigate('/completion');
        return;
      }
      
      // 3. Check if main survey is completed but demographics is not
      if (userData.mainSurveyCompleted && !userData.demographicsCompleted) {
        console.log('Survey: Main survey completed, showing demographics survey');
        setShowingDemographics(true);
        setDemographicsCompleted(false);
        setLoading(false);
        return;
      }
      
      // 4. If we get here, user needs to do main survey
      console.log('Survey: Starting main survey (images evaluation)');
      
      const assignedImages = userData.assignedImages || [];
      console.log('Survey: Assigned images:', assignedImages);
      
      if (assignedImages.length === 0) {
        console.error('Survey: No images assigned to user');
        setError('No images assigned to this user. Please contact support.');
        return;
      }
      
      // Load images (your existing image loading logic)
      const imagePromises = assignedImages.map(async (imageData, index) => {
        try {
          console.log(`Survey: Loading image ${index + 1}:`, imageData);
          
          if (imageData.url && imageData.path) {
            return {
              ...imageData,
              loaded: true
            };
          }
          
          let imagePath;
          let imageName;
          let imageSet;
          let imageId;
          
          if (imageData.name && imageData.name.match(/^\d+\.png$/)) {
            const imageNumber = parseInt(imageData.name.replace('.png', ''));
            imageSet = imageNumber <= 1200 ? 'set1' : 'set2';
            imageName = imageData.name;
            imagePath = `${imageSet}/${imageName}`;
            imageId = `${imageSet}_${imageNumber}`;
          }
          else if (imageData.set && imageData.name) {
            imageSet = imageData.set;
            imageName = imageData.name;
            imagePath = `${imageSet}/${imageName}`;
            imageId = imageData.id || `${imageSet}_${imageName.replace('.png', '')}`;
          }
          else if (imageData.path) {
            imagePath = imageData.path;
            const pathParts = imagePath.split('/');
            imageSet = pathParts[0];
            imageName = pathParts[1];
            imageId = imageData.id || `${imageSet}_${imageName.replace('.png', '')}`;
          }
          else if (imageData.name && imageData.name.includes('_')) {
            console.warn(`Survey: Old format image name detected: ${imageData.name}`);
            
            const numberMatch = imageData.name.match(/(\d+)$/);
            if (numberMatch) {
              const extractedNumber = parseInt(numberMatch[1]);
              const imageNumber = extractedNumber;
              imageSet = imageNumber <= 1200 ? 'set1' : 'set2';
              imageName = `${imageNumber}.png`;
              imagePath = `${imageSet}/${imageName}`;
              imageId = `${imageSet}_${imageNumber}`;
              
              console.log(`Survey: Mapped old format ${imageData.name} to ${imagePath}`);
            } else {
              throw new Error(`Cannot map old format image name: ${imageData.name}`);
            }
          }
          else if (imageData.id && imageData.id.includes('_')) {
            const parts = imageData.id.split('_');
            if (parts.length >= 2) {
              imageSet = parts[0];
              const imageNumber = parts[1];
              imageName = `${imageNumber}.png`;
              imagePath = `${imageSet}/${imageName}`;
              imageId = imageData.id;
            } else {
              throw new Error(`Invalid image ID format: ${imageData.id}`);
            }
          }
          else {
            throw new Error(`Insufficient image data to construct path: ${JSON.stringify(imageData)}`);
          }
          
          if (!imagePath) {
            throw new Error(`Could not construct image path from: ${JSON.stringify(imageData)}`);
          }
          
          console.log(`Survey: Constructed path: ${imagePath} for image:`, imageData);
          
          const imageRef = ref(storage, imagePath);
          const downloadURL = await getDownloadURL(imageRef);
          
          return {
            id: imageId,
            name: imageName,
            set: imageSet,
            path: imagePath,
            url: downloadURL,
            index: index,
            loaded: true,
            ...imageData
          };
          
        } catch (error) {
          console.error(`Survey: Error loading image ${index + 1}:`, error);
          console.error('Survey: Image data:', imageData);
          
          return {
            ...imageData,
            error: error.message,
            loaded: false
          };
        }
      });
      
      const loadedImages = await Promise.all(imagePromises);
      console.log('Survey: All images processed:', loadedImages);
      
      const validImages = loadedImages.filter(img => img.loaded);
      const failedImages = loadedImages.filter(img => !img.loaded);
      
      if (failedImages.length > 0) {
        console.error('Survey: Failed to load images:', failedImages);
        toast({
          title: 'Some Images Failed to Load',
          description: `${failedImages.length} out of ${loadedImages.length} images could not be loaded`,
          status: 'warning',
          duration: 5000,
        });
      }
      
      if (validImages.length === 0) {
        setError('No images could be loaded. Please contact support.');
        return;
      }
      
      setImages(validImages);
      setUserProgress(userData);
      
      const completed = new Set();
      if (userData.completedImageIds) {
        userData.completedImageIds.forEach(id => completed.add(id));
      }
      setCompletedImages(completed);
      
      let startIndex = 0;
      for (let i = 0; i < validImages.length; i++) {
        const imageId = validImages[i].id;
        if (!completed.has(imageId)) {
          startIndex = i;
          break;
        }
      }
      setCurrentImageIndex(startIndex);
      
      console.log(`Survey: Loaded ${validImages.length} images, starting at index ${startIndex}`);
      
      const prolificPid = sessionStorage.getItem('prolificPid') || 'TEST_USER';
      const displayId = sessionStorage.getItem('displayId') || prolificPid;
      
      setSessionData({
        userId,
        prolificPid,
        displayId,
        isTestMode: sessionStorage.getItem('testMode') === 'true'
      });
      
      toast({
        title: 'Study Loaded Successfully',
        description: `Ready to evaluate ${validImages.length} images`,
        status: 'success',
        duration: 3000,
      });
      
    } catch (error) {
      console.error('Survey: Error loading user data:', error);
      setError(`Failed to load study data: ${error.message}`);
      toast({
        title: 'Error Loading Study',
        description: error.message,
        status: 'error',
        duration: 5000,
      });
    } finally {
      setLoading(false);
    }
  }, [navigate, toast]);

  useEffect(() => {
    console.log('Survey: Component mounting, loading user data...');
    loadUserData();
  }, [loadUserData]);

  // Handle demographics completion - NOW AT THE END
  const handleDemographicsCompletion = useCallback(async (surveyData = {}) => {
    if (processingDemographics) return;
    
    try {
      setProcessingDemographics(true);
      const userId = sessionData.userId || sessionStorage.getItem('userLoginId');
      
      if (!userId) throw new Error('No user session');

      console.log('Survey: Finalizing demographics completion for user:', userId);

      const userRef = doc(db, 'loginIDs', userId);
      await updateDoc(userRef, {
        demographicsCompleted: true,
        demographicsCompletedAt: serverTimestamp(),
        surveyCompleted: true, // MARK AS FULLY COMPLETED NOW
        completedAt: serverTimestamp(),
        lastUpdated: serverTimestamp(),
        demographicsData: surveyData,
      });

      console.log('Survey: Demographics completion saved, study is now complete!');

      toast({
        title: 'Study Completed!',
        description: 'Thank you for your participation. Redirecting to completion page...',
        status: 'success',
        duration: 3000,
      });

      setDemographicsCompleted(true);
      setShowingDemographics(false);
      setIsCompletingStudy(true); // NEW: Set completing state
      
      // Now redirect to completion page
      setTimeout(() => {
        navigate('/completion');
      }, 2000);
      
    } catch (err) {
      console.error('Error saving demographics completion:', err);
      setError(err.message);
      toast({
        title: 'Error',
        description: `Failed to save demographics: ${err.message}`,
        status: 'error',
        duration: 5000,
      });
    } finally {
      setProcessingDemographics(false);
    }
  }, [sessionData.userId, toast, navigate, processingDemographics]);

  // Combined message listener for both demographics and main survey
  useEffect(() => {
    const handleMessage = (event) => {
      // Check if message is from Qualtrics
      if (!event.origin.includes('qualtrics.com')) return;
      
      try {
        console.log('Message received from Qualtrics:', event.data);
        
        if (showingDemographics) {
          // Handle demographics survey messages
          const messageData = event.data;
          let isCompletionSignal = false;
          let isLastQuestionSignal = false;

          // Check for object-type messages
          if (typeof messageData === 'object' && messageData !== null) {
            const type = (messageData.type || '').toLowerCase();
            const action = (messageData.action || '').toLowerCase();
            
            if (type.includes('complete') || 
                type.includes('finished') || 
                type.includes('end') ||
                type.includes('submit') ||
                action.includes('complete') ||
                messageData.demographics_completed ||
                messageData.survey_completed ||
                messageData.QualtricsAction === 'Submit') {
              isCompletionSignal = true;
            }

            if (type.includes('last_question') ||
                messageData.lastQuestion ||
                messageData.final_question) {
              isLastQuestionSignal = true;
            }
          }

          // Check for string-type messages
          if (typeof messageData === 'string') {
            const lowerMessage = messageData.toLowerCase();
            if (lowerMessage.includes('complete') ||
                lowerMessage.includes('finished') ||
                lowerMessage.includes('demographics_completed') ||
                lowerMessage.includes('thank you')) {
              isCompletionSignal = true;
            }
          }

          // Handle completion
          if (isCompletionSignal) {
            console.log('Demographics: Completion signal detected from Qualtrics!');
            handleDemographicsCompletion(messageData);
          }

          // Handle last question
          if (isLastQuestionSignal) {
            console.log('Demographics: Last question reached');
            setLastQuestionReached(true);
          }

          // Handle survey ready
          if ((typeof messageData === 'object' && messageData.type === 'survey_ready') ||
              (typeof messageData === 'string' && messageData.includes('ready'))) {
            setDemographicsLoaded(true);
            setSurveyLoading(false);
          }
        } else {
          // Handle main survey messages (your existing logic)
          if (typeof event.data === 'string' && event.data.includes('QualtricsEOS')) {
            console.log('Main survey completion detected via string message');
            handleQualtricsCompletion(event.data);
            return;
          }
          
          if (typeof event.data === 'object') {
            const data = event.data;
            if (data.type === 'QualtricsEOS') {
              console.log('Main survey completion detected via object message');
              handleQualtricsCompletion(data);
              if (data.responseId) {
                setLastResponse(data.responseId);
              }
            }
          }
        }
      } catch (error) {
        if (typeof event.data !== 'string' || event.data.startsWith('{')) {
          console.error('Error processing Qualtrics message:', error);
        }
      }
    };

    console.log('Survey: Setting up Qualtrics message listener');
    window.addEventListener('message', handleMessage);
    
    return () => {
      console.log('Survey: Cleaning up Qualtrics message listener');
      window.removeEventListener('message', handleMessage);
    };
  }, [showingDemographics, handleDemographicsCompletion, currentImageIndex, images]);

  // Handle main survey Qualtrics completion and automatic progression
  const handleQualtricsCompletion = async (responseData) => {
    try {
      console.log('Survey: Processing Qualtrics completion for image:', images[currentImageIndex]?.id);
      
      setFormSubmitted(true);
      setCanLoadNextForm(false);
      setIsFormCompleted(true);
      
      const userId = sessionData.userId;
      const currentImage = images[currentImageIndex];
      
      if (!currentImage || !userId) {
        console.error('Survey: Missing required data for completion');
        return;
      }

      const newCompletedImages = new Set(completedImages);
      newCompletedImages.add(currentImage.id);
      setCompletedImages(newCompletedImages);
      
      const userRef = doc(db, 'loginIDs', userId);
      const newCompletedCount = newCompletedImages.size;
      
      await updateDoc(userRef, {
        completedImages: newCompletedCount,
        completedImageIds: Array.from(newCompletedImages),
        lastImageCompleted: currentImage.id,
        lastCompletionTime: serverTimestamp(),
        [`imageCompletion_${currentImage.id}`]: {
          completedAt: serverTimestamp(),
          responseData: responseData,
          imageIndex: currentImageIndex
        }
      });
      
      console.log(`Survey: Updated user progress: ${newCompletedCount}/${images.length} images completed`);
      
      toast({
        title: 'Response Saved',
        description: `Image ${currentImageIndex + 1} evaluation completed`,
        status: 'success',
        duration: 2000,
      });
      
      // UPDATED: Check if all images are completed
      if (newCompletedCount >= images.length) {
        // Mark main survey as completed, but NOT the full study yet
        await updateDoc(userRef, {
          mainSurveyCompleted: true,
          mainSurveyCompletedAt: serverTimestamp()
        });
        
        toast({
          title: 'Image Evaluation Complete!',
          description: 'Now proceeding to demographics survey...',
          status: 'success',
          duration: 3000,
        });
        
        // Switch to demographics survey
        setTimeout(() => {
          setShowingDemographics(true);
          // Don't clear images array - keep it for reference
          // setImages([]); // ← Removed this line
        }, 2000);
      } else {
        toast({
          title: 'Moving to Next Image',
          description: `Loading image ${currentImageIndex + 2} of ${images.length}`,
          status: 'info',
          duration: 1500,
        });
        
        setTimeout(() => {
          const nextIndex = currentImageIndex + 1;
          if (nextIndex < images.length) {
            setCurrentImageIndex(nextIndex);
            setFormSubmitted(false);
            setCanLoadNextForm(true);
            setIsFormCompleted(false);
            setQualtricsReady(false);
            setSurveyLoading(true);
            setLastResponse(null);
          }
        }, 1000);
      }
      
    } catch (error) {
      console.error('Survey: Error handling Qualtrics completion:', error);
      toast({
        title: 'Error Saving Response',
        description: 'Please try again or contact support',
        status: 'error',
        duration: 5000,
      });
    }
  };

  // Reset form states when image changes
  useEffect(() => {
    if (!showingDemographics) {
      setFormSubmitted(false);
      setCanLoadNextForm(true);
      setIsFormCompleted(false);
      setQualtricsReady(false);
      setSurveyLoading(true);
      setLastResponse(null);
    }
  }, [currentImageIndex, showingDemographics]);

  // Manual next button for main survey (fallback)
  const handleManualNext = async () => {
    if (!formSubmitted) {
      toast({
        title: 'Survey Incomplete',
        description: 'Please complete all survey questions before proceeding to the next image.',
        status: 'warning',
        duration: 4000,
      });
      return;
    }

    console.log('Manual next triggered');
  };

  // Generate URLs for both demographics and main survey with Prolific integration
  const generateQualtricsUrl = (isDemographics = false) => {
    if (isDemographics) {
      // DEMOGRAPHICS SURVEY - NOW AT THE END - Capture Prolific data here
      const baseUrl = 'https://georgetown.az1.qualtrics.com/jfe/form/SV_0lcUfUbcn7vo7qe';
      const userId = sessionStorage.getItem('userLoginId') || 'unknown';
      const prolificPid = sessionStorage.getItem('prolificPid') || 'TEST_USER';
      const studyId = sessionStorage.getItem('studyId') || 'unknown';
      const sessionId = sessionStorage.getItem('sessionId') || 'unknown';
      const isTestMode = sessionStorage.getItem('testMode') === 'true';
      
      const params = new URLSearchParams({
        // PROLIFIC DATA - Only captured once here (at the end now)
        PROLIFIC_PID: prolificPid,
        STUDY_ID: studyId,
        SESSION_ID: sessionId,
        
        // LINKING DATA
        loginID: userId,
        survey_type: 'demographics_final', // Updated to indicate this is at the end
        is_test_mode: isTestMode ? 'true' : 'false',
        entry_timestamp: new Date().toISOString(),
        
        // CONTROL PARAMETERS
        embedded: 'true',
        source: 'react_app',
        completion_redirect: 'false'
      });
      
      console.log('Demographics: Capturing Prolific data (at end of study):', {
        PROLIFIC_PID: prolificPid,
        loginID: userId,
        survey_type: 'demographics_final'
      });
      
      return `${baseUrl}?${params.toString()}`;
      
    } else {
      // MAIN SURVEY - No Prolific data, just image data
      const currentImage = images[currentImageIndex];
      if (!currentImage) return '';
      
      const baseUrl = process.env.REACT_APP_QUALTRICS_SURVEY_URL;
      if (!baseUrl) {
        console.error('Survey: Qualtrics survey URL not configured');
        return '';
      }
      
      const userId = sessionData.userId || 'unknown';
      const isTestMode = sessionStorage.getItem('testMode') === 'true';
      
      // Extract image number
      let imageNumber = '';
      if (currentImage.number) {
        imageNumber = currentImage.number.toString();
      } else if (currentImage.name) {
        const numberMatch = currentImage.name.match(/(\d+)/);
        imageNumber = numberMatch ? numberMatch[1] : '';
      } else if (currentImage.id) {
        const numberMatch = currentImage.id.match(/(\d+)/);
        imageNumber = numberMatch ? numberMatch[1] : '';
      }
      
      const params = new URLSearchParams({
        // LINKING DATA - Connect back to user via loginID
        loginID: userId,
        
        // IMAGE/EVALUATION DATA
        ImageID: currentImage.id || 'unknown',
        ImageNumber: imageNumber || 'unknown',
        ImageName: currentImage.name || 'unknown',
        ImageSet: currentImage.set || 'unknown',
        ImageIndex: currentImageIndex.toString(),
        TotalImages: images.length.toString(),
        
        // STUDY METADATA
        survey_type: 'image_evaluation',
        is_test_mode: isTestMode ? 'true' : 'false',
        evaluation_timestamp: new Date().toISOString(),
        
        // TECHNICAL PARAMETERS
        embedded: 'true',
        source: 'react_app',
        preventAutoAdvance: 'true'
      });
      
      console.log('Main Survey: Image evaluation data:', {
        loginID: userId,
        ImageID: currentImage.id,
        ImageNumber: imageNumber
      });
      
      return `${baseUrl}?${params.toString()}`;
    }
  };

  const handleIframeLoad = () => {
    if (showingDemographics) {
      console.log('Demographics: Iframe loaded');
      setSurveyLoading(false);
      setDemographicsLoaded(true);
    } else {
      console.log('Survey: Survey iframe loaded for image:', images[currentImageIndex]?.id);
      setSurveyLoading(false);
      setQualtricsReady(true);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minH="100vh" bg="gray.50">
        <VStack spacing={4}>
          <Spinner size="xl" color="blue.500" />
          <Text>Loading study...</Text>
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
            <AlertTitle>Error Loading Study</AlertTitle>
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

  // Show completion screen if study is being completed
  if (isCompletingStudy) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minH="100vh" bg="gray.50">
        <VStack spacing={4}>
          <Spinner size="xl" color="green.500" />
          <Text fontSize="lg" fontWeight="bold" color="green.600">
            Study Completed! 🎉
          </Text>
          <Text color="gray.600">
            Thank you for your participation. Redirecting to completion page...
          </Text>
        </VStack>
      </Box>
    );
  }

  // DEMOGRAPHICS SURVEY RENDER - NOW AT THE END
  if (showingDemographics) {
    return (
      <Box minH="100vh" bg="gray.50">
        <Box bg="white" borderBottom="1px solid" borderColor="gray.200" py={4}>
          <Container maxW="4xl">
            <VStack spacing={2}>
              <Heading>Demographics Survey</Heading>
              <HStack spacing={2}>
                <Badge colorScheme="blue">Final Step</Badge>
                <Badge colorScheme="gray">Consent → Main Study → Demographics → Complete</Badge>
                {sessionData.isTestMode && (
                  <Badge colorScheme="orange">Test Mode</Badge>
                )}
              </HStack>
            </VStack>
          </Container>
        </Box>

        <Container maxW="4xl" py={6}>
          <VStack spacing={6}>
            <Alert status="success" borderRadius="md">
              <AlertIcon />
              <Box>
                <AlertTitle>Image Evaluation Complete! 🎉</AlertTitle>
                <AlertDescription>
                  You've successfully evaluated all assigned images. 
                  Please complete this final demographics survey to finish the study.
                </AlertDescription>
              </Box>
            </Alert>

            <Card h="600px">
              <CardHeader>
                <HStack justify="space-between">
                  <Text fontSize="lg" fontWeight="bold">📊 Final Demographics Survey</Text>
                  {surveyLoading && <Spinner size="sm" />}
                  {demographicsLoaded && !surveyLoading && (
                    <Badge colorScheme="green">Survey Loaded</Badge>
                  )}
                  {lastQuestionReached && (
                    <Badge colorScheme="orange">Final Question</Badge>
                  )}
                </HStack>
              </CardHeader>
              <CardBody p={0}>
                <Box position="relative" h="full">
                  {surveyLoading && (
                    <Flex position="absolute" inset="0" bg="white" zIndex={10} align="center" justify="center">
                      <VStack spacing={3}>
                        <Spinner size="lg" color="blue.500" />
                        <Text>Loading final demographics survey...</Text>
                      </VStack>
                    </Flex>
                  )}
                  <iframe
                    ref={iframeRef}
                    src={generateQualtricsUrl(true)}
                    width="100%"
                    height="100%"
                    frameBorder="0"
                    onLoad={handleIframeLoad}
                    title="Demographics Survey"
                    style={{ 
                      border: 0, 
                      borderRadius: '0 0 8px 8px',
                      backgroundColor: 'white'
                    }}
                  />
                </Box>
              </CardBody>
            </Card>

            <Card>
              <CardBody>
                <VStack spacing={4}>
                  {demographicsCompleted ? (
                    <VStack spacing={3}>
                      <Alert status="success">
                        <AlertIcon />
                        Study completed successfully! Redirecting to completion page...
                      </Alert>
                      <Text color="gray.600">Thank you for your participation!</Text>
                      <Spinner />
                    </VStack>
                  ) : (
                    <VStack spacing={4}>
                      {lastQuestionReached ? (
                        <VStack spacing={3}>
                          <Alert status="info">
                            <AlertIcon />
                            You've reached the final question! The survey will automatically advance when you make your selection.
                          </Alert>
                          <Button 
                            colorScheme="blue" 
                            size="lg" 
                            onClick={() => handleDemographicsCompletion({ type: 'manual_next_button' })}
                            isLoading={processingDemographics}
                          >
                            Complete Study →
                          </Button>
                        </VStack>
                      ) : (
                        <Alert status="info">
                          <AlertIcon />
                          Please complete the final demographics survey to finish the study.
                        </Alert>
                      )}
                    </VStack>
                  )}
                </VStack>
              </CardBody>
            </Card>
          </VStack>
        </Container>
      </Box>
    );
  }

  // MAIN SURVEY RENDER (your existing layout)
  const currentImage = images[currentImageIndex];
  
  // If no current image and not showing demographics, show appropriate message
  if (!currentImage && !showingDemographics) {
    // If demographics is completed, show completion message instead of error
    if (demographicsCompleted) {
      return (
        <Box display="flex" justifyContent="center" alignItems="center" minH="100vh" bg="gray.50">
          <VStack spacing={4}>
            <Spinner size="xl" color="green.500" />
            <Text fontSize="lg" fontWeight="bold" color="green.600">
              Study Completed! 🎉
            </Text>
            <Text color="gray.600">
              Thank you for your participation. Redirecting to completion page...
            </Text>
          </VStack>
        </Box>
      );
    }
    
    // Otherwise show the regular no image error
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minH="100vh" bg="gray.50">
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

  const progressPercentage = images.length > 0 ? Math.round((completedImages.size / images.length) * 100) : 0;
  const isLastImage = currentImageIndex >= images.length - 1;

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
                <Badge colorScheme="purple">Step 2 of 3</Badge>
                <Badge colorScheme="gray">Consent → Main Study → Demographics</Badge>
                {sessionData.isTestMode && (
                  <Badge colorScheme="orange">Test Mode</Badge>
                )}
                {formSubmitted && (
                  <Badge colorScheme="purple">Form Completed</Badge>
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
                      <Badge colorScheme="green">
                        ✅ Completed
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
                        console.error('Survey: Image failed to load:', currentImage);
                        e.target.style.display = 'none';
                      }}
                    />
                  </Box>
                  
                  {/* Status Messages and Navigation */}
                  <VStack spacing={3} w="full">
                    <Text fontSize="sm" color="gray.600" textAlign="center">
                      {currentImageIndex + 1} of {images.length}
                    </Text>
                    
                    {/* Survey completion status */}
                    {isFormCompleted && (
                      <Alert status="success" size="sm">
                        <AlertIcon />
                        <Text fontSize="sm">
                          Survey completed! {isLastImage ? 'Moving to demographics...' : 'Moving to next image...'}
                        </Text>
                      </Alert>
                    )}
                    
                    {/* Progress status */}
                    {!formSubmitted && !isFormCompleted && (
                      <Alert status="info" size="sm">
                        <AlertIcon />
                        <Text fontSize="sm">
                          Complete the survey to automatically continue to the next image
                        </Text>
                      </Alert>
                    )}
                    
                    {/* Manual Next button (fallback) - only show if form is completed */}
                    {formSubmitted && !processingNext && (
                      <Button
                        colorScheme="blue"
                        size="lg"
                        onClick={handleManualNext}
                        isLoading={processingNext}
                        loadingText={isLastImage ? "Moving to Demographics..." : "Saving..."}
                        w="full"
                        variant="outline"
                      >
                        {isLastImage ? "Continue to Demographics" : "Next Image →"}
                      </Button>
                    )}
                  </VStack>
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
                    <Text fontSize="lg">👁️</Text>
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
                  
                  {/* Show iframe only if we can load the next form */}
                  {canLoadNextForm && (
                    <iframe
                      ref={iframeRef}
                      key={`${currentImageIndex}-${currentImage.id}-${sessionData.userId}`}
                      src={generateQualtricsUrl(false)}
                      width="100%"
                      height="100%"
                      frameBorder="0"
                      onLoad={handleIframeLoad}
                      style={{
                        border: 'none',
                        borderRadius: '0 0 8px 8px',
                        display: surveyLoading ? 'none' : 'block'
                      }}
                      title={`Survey for image ${currentImageIndex + 1}`}
                    />
                  )}
                  
                  {/* Show completion message when form is completed */}
                  {isFormCompleted && !canLoadNextForm && (
                    <Flex h="full" align="center" justify="center" p={8}>
                      <VStack spacing={4}>
                        <Text fontSize="lg" color="gray.700" textAlign="center" fontWeight="bold">
                          ✅ Form Completed Successfully
                        </Text>
                        <Text fontSize="md" color="gray.600" textAlign="center">
                          {isLastImage 
                            ? 'Preparing demographics survey...' 
                            : 'Preparing next image...'}
                        </Text>
                        {!isLastImage && (
                          <Spinner size="md" />
                        )}
                      </VStack>
                    </Flex>
                  )}
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
                  Image Evaluation Progress
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
                  <Text>🕒</Text>
                  <Text>Estimated time remaining: {Math.max(0, (images.length - completedImages.size) * 2)} minutes</Text>
                </HStack>
                <HStack>
                  <Text>✅</Text>
                  <Text>{progressPercentage}% complete</Text>
                </HStack>
                <HStack>
                  <Text>🚀</Text>
                  <Text>Auto-advance enabled</Text>
                </HStack>
              </HStack>
              
              {completedImages.size === images.length && (
                <Alert status="success" borderRadius="md">
                  <AlertIcon />
                  <Box>
                    <AlertTitle>Image Evaluation Complete!</AlertTitle>
                    <AlertDescription>
                      You have successfully evaluated all assigned images. 
                      Please proceed to the final demographics survey.
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