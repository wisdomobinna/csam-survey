// src/pages/Login.js - Updated with Enhanced Assignment System Integration (Cleaned)
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase/config';
import { signInAnonymously } from 'firebase/auth';
import { checkSurveyCompletion } from '../utils/assessment-tracking';
import { getSimpleConcurrentAssignment, getSimpleConcurrentCapacity, getFallbackAssignment } from '../utils/simpleConcurrentAssignment';
import {
  Box,
  Button,
  Container,
  Input,
  Text,
  VStack,
  Alert,
  AlertIcon,
  Card,
  CardBody,
  CardHeader,
  Heading,
  useToast,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  OrderedList,
  ListItem,
  useDisclosure,
  Icon,
  Flex,
  Badge,
  HStack,
  Spinner,
  Progress,
} from '@chakra-ui/react';
import { Info, Image as ImageIcon, CheckCircle, Users, Shield, TestTube } from 'lucide-react';

const Login = () => {
  const [loginId, setLoginId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(1);
  const [prolificMode, setProlificMode] = useState(false);
  const [testMode, setTestMode] = useState(false);
  const [prolificData, setProlificData] = useState(null);
  const [isValidating, setIsValidating] = useState(false);
  const [autoLoginInProgress, setAutoLoginInProgress] = useState(false);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const navigate = useNavigate();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const totalSteps = 4;

  // ENHANCED: Check assignment capacity and display warnings
  const checkAndDisplayCapacity = useCallback(async () => {
    try {
      const capacity = await getSimpleConcurrentCapacity();
      
      if (!capacity.canAssign) {
        toast({
          title: 'Study Capacity Warning',
          description: capacity.reason,
          status: 'warning',
          duration: 10000,
        });
        return false;
      }
      
      if (capacity.estimatedCapacity < 50) {
        toast({
          title: 'Study Nearing Capacity',
          description: `Approximately ${capacity.estimatedCapacity} participant slots remaining`,
          status: 'info',
          duration: 5000,
        });
      }
      
      return true;
    } catch (error) {
      console.error('Error checking capacity:', error);
      return true; // Allow to proceed if check fails
    }
  }, [toast]);

  // ENHANCED: Use balanced assignment system with simple concurrency protection
  const assignImagesToUser = useCallback(async (userId, imagesPerUser = 10) => {
    try {
      console.log(`Login: Starting concurrent-safe assignment for ${userId}...`);
      
      // Try the concurrent system first
      try {
        const assignedImages = await getSimpleConcurrentAssignment(userId, imagesPerUser);
        console.log(`Login: ✅ Concurrent assignment successful: ${assignedImages.length} images`);
        return assignedImages;
      } catch (concurrentError) {
        console.warn(`Login: Concurrent assignment failed, using fallback:`, concurrentError.message);
        
        // Fallback to direct assignment
        const assignedImages = await getFallbackAssignment(userId, imagesPerUser);
        console.log(`Login: ✅ Fallback assignment successful: ${assignedImages.length} images`);
        return assignedImages;
      }
      
    } catch (error) {
      console.error('Login: Error in assignment:', error);
      throw error;
    }
  }, []);

  // ENHANCED: Create or update user record with enhanced assignment system
  const createOrUpdateUserRecord = useCallback(async (userId, prolificData = null, isTest = false) => {
    try {
      console.log('Login: Creating/updating user record for ID:', userId, { isTest });
      
      const userRef = doc(db, 'loginIDs', userId);
      
      // Check if user already exists
      const existingDoc = await getDoc(userRef);
      
      if (existingDoc.exists()) {
        console.log('Login: User already exists, updating login time');
        const existingData = existingDoc.data();
        
        // Update last login time
        await setDoc(userRef, {
          ...existingData,
          lastLogin: serverTimestamp(),
          lastReturnVisit: serverTimestamp(),
          returnCount: (existingData.returnCount || 0) + 1
        }, { merge: true });
        
        return { success: true, userId, userData: existingData };
      } else {
        console.log('Login: Creating new user record with enhanced balanced assignment');
        
        // ENHANCED: Check assignment capacity before proceeding
        let assignedImages = [];
        try {
          const capacity = await getSimpleConcurrentCapacity();
          
          if (!capacity.canAssign) {
            // Return error but don't fail completely - let them proceed without images
            console.warn('Login: Assignment capacity exceeded, creating user without images');
            toast({
              title: 'Study at Capacity',
              description: 'This study has reached its participant limit. Please contact the researchers.',
              status: 'warning',
              duration: 8000,
            });
            assignedImages = []; // Empty assignment
          } else {
            // Assign images using enhanced system
            assignedImages = await assignImagesToUser(userId, 10);
            console.log(`Login: Successfully assigned ${assignedImages.length} images to new user`);
          }
        } catch (imageError) {
          console.error('Login: Error assigning images:', imageError);
          // Continue without images but show warning
          assignedImages = [];
          toast({
            title: 'Image Assignment Warning',
            description: 'Could not assign images. Please contact support if this continues.',
            status: 'warning',
            duration: 5000,
          });
        }
        
        // Create user document with assigned images (or empty if assignment failed)
        const userData = {
          internalUserId: userId,
          displayId: userId,
          assignedImages: assignedImages, // May be empty if capacity exceeded
          completedImages: 0,
          completedImageIds: [],
          totalImages: assignedImages.length,
          surveyCompleted: false,
          hasConsented: false,
          demographicsCompleted: false,
          createdAt: serverTimestamp(),
          lastLogin: serverTimestamp(),
          isActive: true,
          source: isTest ? 'test' : (prolificData ? 'prolific' : 'direct'),
          userAgent: navigator.userAgent.substring(0, 200),
          ipInfo: {
            timestamp: new Date().toISOString(),
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
          },
          // ENHANCED: Assignment details
          imageAssignmentStatus: assignedImages.length > 0 ? 'assigned' : 'failed',
          autoAssignedAt: serverTimestamp(),
          autoAssignmentDetails: {
            imagesAssigned: assignedImages.length,
            set1Count: assignedImages.filter(img => img.set === 'set1').length,
            set2Count: assignedImages.filter(img => img.set === 'set2').length,
            assignedDuringLogin: true,
            assignmentTimestamp: new Date().toISOString(),
            assignmentSystem: 'enhanced_balanced_5_limit',
            mixedOrder: assignedImages.length > 0 ? assignedImages.map(img => img.set).join(' → ') : 'none'
          }
        };
        
        // Add Prolific data if available
        if (prolificData) {
          userData.prolificData = {
            prolificPid: prolificData.prolificPid,
            studyId: prolificData.studyId,
            sessionId: prolificData.sessionId,
            detectedAt: prolificData.detectedAt,
            referrer: prolificData.referrer,
            userAgent: prolificData.userAgent,
            qualtricsUserId: prolificData.prolificPid,
            validated: true,
            source: isTest ? 'test_redirect' : 'prolific_redirect',
            isTestUser: isTest
          };
          
          // Store the Prolific PID at the top level for easy access
          userData.prolificPid = prolificData.prolificPid;
        }
        
        await setDoc(userRef, userData);
        
        console.log(`Login: User ${userId} record created successfully with ${assignedImages.length} assigned images`);
        
        return { success: true, userId, userData };
      }
    } catch (error) {
      console.error('Login: Error creating/updating user record:', error);
      throw error;
    }
  }, [assignImagesToUser, toast]);

  const handleProlificEntry = useCallback(async () => {
    try {
      // Check for Prolific parameters in URL
      const prolificPid = searchParams.get('PROLIFIC_PID');
      const studyId = searchParams.get('STUDY_ID');
      const sessionId = searchParams.get('SESSION_ID');
      
      console.log('Login: URL Parameters detected:', { prolificPid, studyId, sessionId });
      
      if (prolificPid) {
        // Determine if this is test mode
        const isTestUser = prolificPid === 'TEST_USER' || prolificPid.startsWith('TEST_');
        const finalProlificPid = prolificPid;
        
        console.log('Login: Prolific participant detected:', { 
          prolificPid: finalProlificPid, 
          studyId, 
          sessionId, 
          isTestUser 
        });
        
        // Validate Prolific ID format (24 character hex string) unless it's a test
        if (!isTestUser && !/^[a-f0-9]{24}$/i.test(prolificPid)) {
          console.warn('Login: Invalid Prolific ID format:', prolificPid);
          setError(`Invalid Prolific ID format: ${prolificPid}. Please access this study through the official Prolific link.`);
          return;
        }
        
        const prolificInfo = {
          prolificPid: finalProlificPid,
          studyId: studyId || 'unknown',
          sessionId: sessionId || 'unknown',
          detectedAt: new Date().toISOString(),
          referrer: document.referrer || 'direct',
          userAgent: navigator.userAgent.substring(0, 200),
          isTestUser
        };
        
        setProlificData(prolificInfo);
        setProlificMode(true);
        setTestMode(isTestUser);
        
        // Store Prolific data in sessionStorage immediately
        sessionStorage.setItem('prolificPid', finalProlificPid);
        sessionStorage.setItem('studyId', studyId || 'unknown');
        sessionStorage.setItem('sessionId', sessionId || 'unknown');
        sessionStorage.setItem('testMode', isTestUser.toString());
        
        console.log('Login: Prolific mode activated, proceeding with auto-login');
        
        // ENHANCED: Check capacity before proceeding with auto-login
        console.log('Login: Checking study capacity for Prolific user...');
        await checkAndDisplayCapacity();
        
        // Proceed with automatic login for Prolific users
        await handleAutomaticProlificLogin(prolificInfo);
        
      } else {
        // No Prolific parameters found - allow manual entry for testing/admin
        console.log('Login: No Prolific parameters detected - allowing manual entry');
        setError('');
        
        // Check existing session for manual users
        const existingLoginId = sessionStorage.getItem('userLoginId');
        const isAdmin = sessionStorage.getItem('isAdmin');
        
        if (existingLoginId && isAdmin === 'true') {
          console.log('Login: Existing admin session found, redirecting to admin dashboard');
          navigate('/admin');
        } else if (existingLoginId) {
          console.log('Login: Existing user session found, checking status');
          checkExistingUser(existingLoginId);
        }
      }
    } catch (error) {
      console.error('Login: Error handling Prolific entry:', error);
      setError('Error processing your entry. Please refresh and try again.');
    }
  }, [searchParams, checkAndDisplayCapacity, navigate]);

  useEffect(() => {
    handleProlificEntry();
  }, [handleProlificEntry]);

  const handleAutomaticProlificLogin = async (prolificInfo) => {
    try {
      setAutoLoginInProgress(true);
      setLoading(true);
      
      // Generate automatic login ID
      const loginId = `login_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      console.log('Login: Auto-generating login ID for Prolific user:', {
        prolificPid: prolificInfo.prolificPid,
        loginId,
        isTestUser: prolificInfo.isTestUser
      });
      
      // Check if this Prolific user has already participated (only for real users, not test)
      if (!prolificInfo.isTestUser) {
        const existingParticipant = await checkExistingProlificParticipant(prolificInfo.prolificPid);
        if (existingParticipant) {
          setError(`You have already participated in this study. Prolific ID: ${prolificInfo.prolificPid.substring(0, 8)}...`);
          setLoading(false);
          setAutoLoginInProgress(false);
          return;
        }
      }
      
      // ENHANCED: Create user record with automatic image assignment
      const result = await createOrUpdateUserRecord(loginId, prolificInfo, prolificInfo.isTestUser);
      
      // Store session data
      sessionStorage.setItem('userLoginId', loginId);
      sessionStorage.setItem('prolificPid', prolificInfo.prolificPid);
      sessionStorage.setItem('displayId', prolificInfo.prolificPid);
      if (prolificInfo.isTestUser) {
        sessionStorage.setItem('testMode', 'true');
      }
      
      // Sign in anonymously for Firebase auth
      const userCredential = await signInAnonymously(auth);
      console.log('Login: Anonymous auth successful:', userCredential.user.uid);
      
      // Check completion status and navigate
      const isCompleted = await checkSurveyCompletion(loginId);
      
      if (isCompleted) {
        console.log('Login: User has completed study, redirecting to completion page');
        navigate('/completion');
      } else if (result.userData.hasConsented) {
        console.log('Login: User has consented, redirecting to survey');
        navigate('/survey');
      } else {
        console.log('Login: User needs to provide consent, redirecting to consent page');
        navigate('/consent');
      }
      
      toast({
        title: 'Welcome!',
        description: prolificInfo.isTestUser ? 
          `Test session loaded successfully (${result.userData.totalImages} images assigned)` : 
          `Prolific study session loaded successfully (${result.userData.totalImages} images assigned)`,
        status: 'success',
        duration: 2000,
      });
      
    } catch (error) {
      console.error('Login: Automatic Prolific login error:', error);
      setError(`Failed to process your Prolific entry: ${error.message}`);
    } finally {
      setLoading(false);
      setAutoLoginInProgress(false);
    }
  };

  const checkExistingProlificParticipant = async (prolificPid) => {
    try {
      // This is a simplified check - you might want to implement a more sophisticated
      // duplicate detection system based on your needs
      console.log('Login: Checking for existing Prolific participant:', prolificPid);
      
      // For now, we'll allow participation - you can enhance this with a dedicated
      // prolificParticipants collection if needed
      return null;
      
    } catch (error) {
      console.error('Login: Error checking existing Prolific participant:', error);
      return null; // If error, allow them to proceed
    }
  };

  const checkExistingUser = async (userId) => {
    try {
      setIsValidating(true);
      const userRef = doc(db, 'loginIDs', userId);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        
        console.log('Login: Existing user found:', userId, 'Survey completed:', userData.surveyCompleted);
        
        // Check if survey is completed
        const isCompleted = await checkSurveyCompletion(userId);
        if (isCompleted) {
          console.log('Login: User has completed survey, redirecting to completion');
          navigate('/completion');
          return;
        }
        
        // Check consent status and redirect accordingly
        if (userData.hasConsented) {
          console.log('Login: User has consented, redirecting to survey');
          navigate('/survey');
        } else {
          console.log('Login: User has not consented, redirecting to consent page');
          navigate('/consent');
        }
      } else {
        console.log('Login: User document not found, clearing session');
        sessionStorage.removeItem('userLoginId');
      }
    } catch (error) {
      console.error('Login: Error checking existing user:', error);
      sessionStorage.removeItem('userLoginId');
      toast({
        title: 'Session Error',
        description: 'There was an issue with your session. Please try logging in again.',
        status: 'warning',
        duration: 3000,
      });
    } finally {
      setIsValidating(false);
    }
  };

  const handleManualLogin = async (e) => {
    e.preventDefault();
    setError('');
  
    if (!loginId.trim()) {
      setError('Please enter a participant ID');
      return;
    }
  
    const userId = loginId.trim();
  
    // Handle admin login
    if (userId === 'ADMIN') {
      try {
        setLoading(true);
        console.log('Login: Admin login attempt - bypassing Firebase auth');
        
        sessionStorage.setItem('userLoginId', 'ADMIN');
        sessionStorage.setItem('isAdmin', 'true');
        
        console.log('Login: Admin authenticated successfully');
        
        toast({
          title: 'Admin Access Granted',
          description: 'Welcome to the admin dashboard',
          status: 'success',
          duration: 2000,
        });
        
        navigate('/admin');
        return;
      } catch (error) {
        console.error('Login: Admin login error:', error);
        setError('Admin authentication failed. Please try again.');
        return;
      } finally {
        setLoading(false);
      }
    }

    // Handle test users
    if (userId === 'TEST' || userId.startsWith('TEST_')) {
      try {
        setLoading(true);
        console.log('Login: Processing test user login:', userId);
        
        const finalUserId = userId === 'TEST' ? 'TEST_USER' : userId;
        const testProlificData = {
          prolificPid: finalUserId,
          studyId: 'TEST_STUDY',
          sessionId: 'TEST_SESSION',
          detectedAt: new Date().toISOString(),
          referrer: 'test',
          userAgent: navigator.userAgent.substring(0, 200),
          isTestUser: true
        };
        
        // Store test session data
        sessionStorage.setItem('prolificPid', finalUserId);
        sessionStorage.setItem('studyId', 'TEST_STUDY');
        sessionStorage.setItem('sessionId', 'TEST_SESSION');
        sessionStorage.setItem('testMode', 'true');
        
        // Generate login ID for test user
        const loginIdForTest = `login_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // ENHANCED: Create user record with automatic image assignment
        const result = await createOrUpdateUserRecord(loginIdForTest, testProlificData, true);
        
        // Store session data
        sessionStorage.setItem('userLoginId', loginIdForTest);
        
        // Sign in anonymously
        await signInAnonymously(auth);
        
        // Navigate based on status
        const isCompleted = await checkSurveyCompletion(loginIdForTest);
        
        if (isCompleted) {
          navigate('/completion');
        } else if (result.userData.hasConsented) {
          navigate('/survey');
        } else {
          navigate('/consent');
        }
        
        toast({
          title: 'Test Session Loaded',
          description: `Welcome to the test environment! ${result.userData.totalImages} images assigned.`,
          status: 'success',
          duration: 2000,
        });
        
        return;
      } catch (error) {
        console.error('Login: Test user login error:', error);
        setError('Test login failed. Please try again.');
        return;
      } finally {
        setLoading(false);
      }
    }

    // Handle direct participant ID entry (for pre-assigned users)
    try {
      setLoading(true);
      console.log('Login: Processing direct login for:', userId);
      
      // Check if this is a pre-assigned user ID
      const userRef = doc(db, 'loginIDs', userId);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        // User exists - use existing record
        const userData = userDoc.data();
        sessionStorage.setItem('userLoginId', userId);
        
        // Sign in anonymously
        await signInAnonymously(auth);
        
        // Navigate based on status
        const isCompleted = await checkSurveyCompletion(userId);
        
        if (isCompleted) {
          navigate('/completion');
        } else if (userData.hasConsented) {
          navigate('/survey');
        } else {
          navigate('/consent');
        }
        
        toast({
          title: 'Login Successful',
          description: 'Welcome back to the study!',
          status: 'success',
          duration: 2000,
        });
      } else {
        // User doesn't exist - this might be a new direct user, create with images
        const directLoginId = `login_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // ENHANCED: Create user record with automatic image assignment
        const result = await createOrUpdateUserRecord(directLoginId, null, false);
        
        // Store session data
        sessionStorage.setItem('userLoginId', directLoginId);
        
        // Sign in anonymously
        await signInAnonymously(auth);
        
        // Navigate to consent
        navigate('/consent');
        
        toast({
          title: 'Login Successful',
          description: `Welcome to the study! ${result.userData.totalImages} images assigned.`,
          status: 'success',
          duration: 2000,
        });
      }
      
    } catch (error) {
      console.error('Login: Direct login error:', error);
      setError(error.message || 'Failed to log in. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderTutorialStep = () => {
    switch (tutorialStep) {
      case 1:
        return (
          <VStack spacing={4} align="start">
            <Flex align="center" gap={2}>
              <Icon as={CheckCircle} color="purple.500" />
              <Text fontSize="lg" fontWeight="bold">Evaluation Process</Text>
            </Flex>
            <Text>Here's what you can expect during the evaluation:</Text>
            <OrderedList spacing={3}>
              <ListItem>
                <Text fontWeight="medium">Careful Observation</Text>
                <Text>Take your time to examine each image thoroughly. There's no rush!</Text>
              </ListItem>
              <ListItem>
                <Text fontWeight="medium">Complete the Survey Form</Text>
                <Text>Fill out the evaluation questionnaire for each image with your honest assessment</Text>
              </ListItem>
              <ListItem>
                <Text fontWeight="medium">Progress Through All Images</Text>
                <Text>Complete evaluations for all 10 assigned images at your own pace</Text>
              </ListItem>
              <ListItem>
                <Text fontWeight="medium">Automatic Saving</Text>
                <Text>Your progress is saved automatically after each image evaluation</Text>
              </ListItem>
            </OrderedList>
            <Box p={4} bg="purple.50" borderRadius="md">
              <Text color="purple.800" fontSize="sm">
                <strong>Privacy & Quality:</strong> Your responses are completely anonymous. The enhanced 
                assignment system ensures high-quality data by limiting each image to 5 evaluations maximum.
              </Text>
            </Box>
          </VStack>
        );

      case 4:
        return (
          <VStack spacing={4} align="start">
            <Flex align="center" gap={2}>
              <Icon as={Users} color="teal.500" />
              <Text fontSize="lg" fontWeight="bold">Ready to Begin</Text>
            </Flex>
            <Text>
              You're now ready to start the evaluation process. Here's a quick summary:
            </Text>
            <Box p={4} bg="teal.50" borderRadius="md" w="full">
              <VStack align="start" spacing={2}>
                <Text fontSize="sm"><strong>✓</strong> You have 10 unique images to evaluate</Text>
                <Text fontSize="sm"><strong>✓</strong> 5 images from Set 1, 5 images from Set 2</Text>
                <Text fontSize="sm"><strong>✓</strong> Mixed presentation order for unbiased evaluation</Text>
                <Text fontSize="sm"><strong>✓</strong> Your progress is saved automatically</Text>
                <Text fontSize="sm"><strong>✓</strong> Estimated time: 15-20 minutes</Text>
                <Text fontSize="sm"><strong>✓</strong> You can take breaks between images</Text>
                <Text fontSize="sm"><strong>✓</strong> Your responses contribute to important research</Text>
                <Text fontSize="sm"><strong>✨</strong> Enhanced system ensures balanced data collection</Text>
              </VStack>
            </Box>
            {(prolificMode || testMode) && (
              <Box p={3} bg="blue.50" borderRadius="md" w="full">
                <HStack>
                  <Icon as={testMode ? TestTube : Shield} color="blue.500" />
                  <VStack align="start" spacing={0}>
                    <Text fontSize="sm" fontWeight="medium">
                      {testMode ? 'Test Mode Active' : 'Prolific Integration Active'}
                    </Text>
                    <Text fontSize="xs" color="gray.600">
                      {testMode 
                        ? 'This is a test session with enhanced assignment system'
                        : 'Your participation will be tracked for proper compensation using enhanced assignment'
                      }
                    </Text>
                  </VStack>
                </HStack>
              </Box>
            )}
            <Text fontSize="sm" color="gray.600" fontStyle="italic">
              {prolificMode 
                ? 'The study will begin automatically with enhanced image assignment, or use the "Start Study" button below.'
                : 'Click "Start Study" below to begin your evaluation, or use the "Previous" button to review any information above.'
              }
            </Text>
          </VStack>
        );

      default:
        return null;
    }
  };

  // Show validation spinner if checking existing user or auto-login in progress
  if (isValidating || autoLoginInProgress) {
    return (
      <Flex minH="100vh" align="center" justify="center" bg="gray.50">
        <VStack spacing={4}>
          <Spinner size="xl" color="blue.500" />
          <Text>
            {autoLoginInProgress 
              ? 'Setting up your enhanced Prolific study session...' 
              : 'Validating your session...'
            }
          </Text>
          {prolificData && (
            <Text fontSize="sm" color="gray.600">
              Participant ID: {prolificData.prolificPid?.substring(0, 8)}...
            </Text>
          )}
          {autoLoginInProgress && (
            <Text fontSize="xs" color="blue.600">
              Enhanced assignment system: Assigning balanced image set...
            </Text>
          )}
        </VStack>
      </Flex>
    );
  }

  return (
    <Box minH="100vh" bg="gray.50">
      <Container maxW="md" pt={20}>
        <Card boxShadow="xl">
          <CardHeader>
            <VStack spacing={2}>
              <Heading size="lg" textAlign="center">
                Enhanced Image Evaluation Study
              </Heading>
              <Text fontSize="sm" color="gray.600" textAlign="center">
                Research Study on Visual Content Assessment
              </Text>
              <Badge colorScheme="green" px={2} py={1}>
                ✨ Enhanced Assignment System
              </Badge>
              {prolificMode && !testMode && (
                <VStack spacing={1}>
                  <Badge colorScheme="blue" px={3} py={1}>
                    <HStack spacing={1}>
                      <Shield size={12} />
                      <Text>Prolific Study Participant</Text>
                    </HStack>
                  </Badge>
                  <Text fontSize="xs" color="gray.600" fontFamily="mono">
                    ID: {prolificData?.prolificPid?.substring(0, 8)}...
                  </Text>
                </VStack>
              )}
              {testMode && (
                <VStack spacing={1}>
                  <Badge colorScheme="orange" px={3} py={1}>
                    <HStack spacing={1}>
                      <TestTube size={12} />
                      <Text>Test Mode</Text>
                    </HStack>
                  </Badge>
                  <Text fontSize="xs" color="gray.600" fontFamily="mono">
                    Test User: {prolificData?.prolificPid || loginId}
                  </Text>
                </VStack>
              )}
            </VStack>
          </CardHeader>
          <CardBody>
            {/* Show form only for non-Prolific users or if there's an error */}
            {(!prolificMode || error) && (
              <form onSubmit={handleManualLogin}>
                <VStack spacing={6}>
                  <Box w="full">
                    <Input
                      type="text"
                      placeholder="Enter your assigned participant ID"
                      value={loginId}
                      onChange={(e) => setLoginId(e.target.value)}
                      textAlign="center"
                      bg="white"
                      border="2px solid"
                      borderColor={
                        loginId === 'ADMIN' ? 'green.300' : 
                        loginId.startsWith('TEST') ? 'orange.300' : 
                        'gray.200'
                      }
                      size="lg"
                    />
                  </Box>

                  {error && (
                    <Alert status="error" borderRadius="md">
                      <AlertIcon />
                      <Box>
                        <Text fontSize="sm">{error}</Text>
                      </Box>
                    </Alert>
                  )}

                  <Button
                    type="submit"
                    colorScheme={
                      loginId === 'ADMIN' ? "green" : 
                      loginId.startsWith('TEST') ? "orange" : 
                      "blue"
                    }
                    width="full"
                    isLoading={loading}
                    loadingText="Signing in..."
                    size="lg"
                  >
                    {loginId === 'ADMIN' ? 'Access Admin Dashboard' : 
                     loginId.startsWith('TEST') ? 'Begin Enhanced Test Session' :
                     'Begin Enhanced Study'}
                  </Button>

                  {/* Instructions for direct entry */}
                  <Box p={4} bg="gray.50" borderRadius="md" w="full">
                    <VStack spacing={2}>
                      <Text fontSize="sm" fontWeight="medium" color="gray.700">
                        ✨ Enhanced Automatic Image Assignment
                      </Text>
                      <Text fontSize="xs" color="gray.600" textAlign="center">
                        ✓ New participants automatically receive 10 balanced images (5 from each set)
                      </Text>
                      <Text fontSize="xs" color="gray.600" textAlign="center">
                        ✓ Each image shown to maximum 5 participants for optimal data quality
                      </Text>
                      <Text fontSize="xs" color="gray.600" textAlign="center">
                        ✓ Pre-assigned participant IDs use their existing enhanced assignments
                      </Text>
                    </VStack>
                  </Box>
                </VStack>
              </form>
            )}

            {/* Show Prolific auto-login interface */}
            {prolificMode && !error && (
              <VStack spacing={6}>
                <Box w="full">
                  <Text mb={2} fontWeight="medium">
                    {testMode ? 'Enhanced Test User ID' : 'Prolific Participant ID'}
                  </Text>
                  <Input
                    type="text"
                    value={prolificData?.prolificPid || ''}
                    textAlign="center"
                    fontSize="sm"
                    fontFamily="mono"
                    isReadOnly={true}
                    bg={testMode ? "orange.50" : "gray.50"}
                    color={testMode ? "orange.700" : "gray.700"}
                    border="2px solid"
                    borderColor={testMode ? "orange.200" : "blue.200"}
                  />
                  <Text fontSize="xs" color="gray.500" mt={1} textAlign="center">
                    {testMode 
                      ? 'Test ID detected - Enhanced assignment system will assign 10 balanced images'
                      : 'ID detected from Prolific - Enhanced assignment system will assign 10 balanced images'
                    }
                  </Text>
                </Box>

                <Button
                  leftIcon={<Info />}
                  colorScheme="teal"
                  variant="outline"
                  onClick={onOpen}
                  width="full"
                >
                  Enhanced Study Information & Tutorial
                </Button>

                <Box p={3} bg="green.50" borderRadius="md" w="full">
                  <VStack spacing={1}>
                    <Text fontSize="sm" fontWeight="medium" color="green.800">
                      ✓ {testMode ? 'Enhanced Test Session Ready' : 'Enhanced Study Link Validated'}
                    </Text>
                    <Text fontSize="xs" color="green.600">
                      {testMode 
                        ? 'Enhanced auto-login completed - 10 balanced test images will be assigned'
                        : 'Enhanced auto-login completed - 10 balanced images will be assigned (5 per set)'
                      }
                    </Text>
                    <Text fontSize="xs" color="green.600">
                      ✨ 5-assignment limit per image ensures optimal data quality
                    </Text>
                  </VStack>
                </Box>
              </VStack>
            )}
          </CardBody>
        </Card>

        {/* Additional Information Card */}
        {(prolificMode || testMode) && (
          <Card mt={6} bg="gray.50" borderColor="gray.200">
            <CardBody py={4}>
              <VStack spacing={3}>
                <Text fontSize="sm" fontWeight="medium" color="gray.700">
                  {testMode ? 'Enhanced Test Session Information' : 'Enhanced Study Information'}
                </Text>
                <HStack justify="space-between" w="full" fontSize="xs" color="gray.600">
                  <Text>Expected Duration:</Text>
                  <Text fontWeight="medium">15-20 minutes</Text>
                </HStack>
                <HStack justify="space-between" w="full" fontSize="xs" color="gray.600">
                  <Text>Images to Evaluate:</Text>
                  <Text fontWeight="medium">10 images (5 from each set)</Text>
                </HStack>
                <HStack justify="space-between" w="full" fontSize="xs" color="gray.600">
                  <Text>Image Assignment:</Text>
                  <Text fontWeight="medium">✨ Enhanced balanced selection</Text>
                </HStack>
                <HStack justify="space-between" w="full" fontSize="xs" color="gray.600">
                  <Text>Assignment Limit:</Text>
                  <Text fontWeight="medium">Maximum 5 participants per image</Text>
                </HStack>
                <HStack justify="space-between" w="full" fontSize="xs" color="gray.600">
                  <Text>Presentation Order:</Text>
                  <Text fontWeight="medium">Mixed (randomized from both sets)</Text>
                </HStack>
                <HStack justify="space-between" w="full" fontSize="xs" color="gray.600">
                  <Text>Compensation:</Text>
                  <Text fontWeight="medium">
                    {testMode ? 'Test session (no compensation)' : 'As specified in Prolific'}
                  </Text>
                </HStack>
                {testMode && (
                  <HStack justify="space-between" w="full" fontSize="xs" color="orange.600">
                    <Text>Test Mode:</Text>
                    <Text fontWeight="medium">Enhanced system validation</Text>
                  </HStack>
                )}
              </VStack>
            </CardBody>
          </Card>
        )}
      </Container>

      {/* Enhanced Tutorial Modal */}
      <Modal
        isOpen={isOpen}
        onClose={() => {
          setTutorialStep(1);
          onClose();
        }}
        size="lg"
        scrollBehavior="inside"
      >
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            <VStack align="start" spacing={1}>
              <Text>Enhanced Study Information & Tutorial</Text>
              <HStack>
                <Text fontSize="sm" color="gray.500">
                  Step {tutorialStep} of {totalSteps}
                </Text>
                <Progress 
                  value={(tutorialStep / totalSteps) * 100} 
                  size="sm" 
                  colorScheme="blue"
                  w="100px"
                />
                <Badge colorScheme="green" size="sm">Enhanced System</Badge>
              </HStack>
            </VStack>
          </ModalHeader>
          <ModalCloseButton />
          
          <ModalBody pb={6}>
            {renderTutorialStep()}
          </ModalBody>

          <ModalFooter>
            <Button
              variant="ghost"
              mr={3}
              onClick={() => setTutorialStep(curr => Math.max(1, curr - 1))}
              isDisabled={tutorialStep === 1}
            >
              Previous
            </Button>
            {tutorialStep < totalSteps ? (
              <Button 
                colorScheme="blue" 
                onClick={() => setTutorialStep(curr => Math.min(totalSteps, curr + 1))}
              >
                Next
              </Button>
            ) : (
              <Button 
                colorScheme="green" 
                onClick={() => {
                  setTutorialStep(1);
                  onClose();
                }}
                leftIcon={<CheckCircle />}
              >
                Ready to Start Enhanced Study
              </Button>
            )}
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default Login;