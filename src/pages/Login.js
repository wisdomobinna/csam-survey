// src/pages/Login.js - Fixed for pre-assigned login system
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase/config';
import { signInAnonymously } from 'firebase/auth';
import { checkSurveyCompletion } from '../utils/assessment-tracking';
// Remove the deprecated import
// import { assignImagesToUser } from '../utils/firebaseSetup';
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
  Divider,
} from '@chakra-ui/react';
import { Info, Image as ImageIcon, CheckCircle, Users, Shield, ExternalLink, TestTube, Settings } from 'lucide-react';

const Login = () => {
  const [loginId, setLoginId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(1);
  const [prolificMode, setProlificMode] = useState(false);
  const [testMode, setTestMode] = useState(false);
  const [prolificData, setProlificData] = useState(null);
  const [isValidating, setIsValidating] = useState(false);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const navigate = useNavigate();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const totalSteps = 4;

  console.log('Login: Environment check:');
  console.log('API Key from env:', process.env.REACT_APP_FIREBASE_API_KEY);
  console.log('Project ID from env:', process.env.REACT_APP_FIREBASE_PROJECT_ID);

  useEffect(() => {
    // Check for Prolific parameters in URL
    const prolificPid = searchParams.get('PROLIFIC_PID');
    const studyId = searchParams.get('STUDY_ID');
    const sessionId = searchParams.get('SESSION_ID');
    
    console.log('Login: URL Parameters detected:', { prolificPid, studyId, sessionId });
    
    if (prolificPid) {
      // Check if this is a test user
      if (prolificPid === 'TEST_USER' || prolificPid.startsWith('TEST_')) {
        console.log('Login: Test user detected:', prolificPid);
        setTestMode(true);
        setLoginId(prolificPid);
        setProlificData({
          prolificPid,
          studyId: studyId || 'TEST_STUDY',
          sessionId: sessionId || 'TEST_SESSION',
          detectedAt: new Date().toISOString(),
          referrer: 'test',
          userAgent: navigator.userAgent.substring(0, 200)
        });
        return;
      }

      console.log('Login: Prolific participant detected:', { prolificPid, studyId, sessionId });
      
      // Validate Prolific ID format (24 character hex string)
      if (!/^[a-f0-9]{24}$/i.test(prolificPid)) {
        console.warn('Login: Invalid Prolific ID format:', prolificPid);
        setError(`Invalid Prolific ID format: ${prolificPid}. Please access this study through the official Prolific link.`);
        return;
      }
      
      const prolificInfo = {
        prolificPid,
        studyId,
        sessionId,
        detectedAt: new Date().toISOString(),
        referrer: document.referrer || 'direct',
        userAgent: navigator.userAgent.substring(0, 200)
      };
      
      setProlificData(prolificInfo);
      setLoginId(prolificPid);
      setProlificMode(true);
      
      console.log('Login: Prolific mode activated with data:', prolificInfo);
    } else {
      // No Prolific parameters found - allow manual entry for testing
      console.log('Login: No Prolific parameters detected in URL - allowing manual entry');
      setError('');
    }

    // Check existing session - but allow fresh start from login page
    const existingLoginId = sessionStorage.getItem('userLoginId');
    const isAdmin = sessionStorage.getItem('isAdmin');
    
    // Only auto-redirect if user has session AND they haven't manually come to login page
    if (existingLoginId && isAdmin === 'true' && !window.location.pathname.includes('/login')) {
      console.log('Login: Existing admin session found, redirecting to admin dashboard');
      navigate('/admin');
    } else if (existingLoginId && (prolificPid || testMode) && !window.location.pathname.includes('/login')) {
      // User has existing session and came through Prolific or test - check if valid
      console.log('Login: Existing user session found, checking status');
      checkExistingUser(existingLoginId);
    }
  }, [navigate, searchParams]);

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

  // SIMPLIFIED USER CREATION - For pre-assigned system, we just need to create minimal user record
  const createOrUpdateUserRecord = async (userId, prolificData = null, isTest = false) => {
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
        console.log('Login: Creating new user record (assuming pre-assigned images exist)');
        
        // Create basic user document - assuming images are pre-assigned
        const userData = {
          internalUserId: userId,
          displayId: userId,
          // Note: assignedImages should be pre-assigned by admin
          completedImages: 0,
          surveyCompleted: false,
          hasConsented: false,
          createdAt: serverTimestamp(),
          lastLogin: serverTimestamp(),
          isActive: true,
          source: isTest ? 'test' : (prolificData ? 'prolific' : 'direct'),
          userAgent: navigator.userAgent.substring(0, 200),
          ipInfo: {
            timestamp: new Date().toISOString(),
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
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
        }
        
        await setDoc(userRef, userData);
        
        console.log(`Login: User ${userId} record created successfully`);
        
        return { success: true, userId, userData };
      }
    } catch (error) {
      console.error('Login: Error creating/updating user record:', error);
      throw error;
    }
  };

  const handleLogin = async (e) => {
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

    // Handle all other login types (direct IDs, test users, Prolific users)
    try {
      setLoading(true);
      console.log('Login: Processing login for:', userId);
      
      // Determine user type
      const isTestUser = userId === 'TEST' || userId.startsWith('TEST_') || testMode;
      const isProlificUser = prolificMode && !isTestUser;
      
      let finalUserId = userId;
      let userProlificData = prolificData;
      
      // Handle test users
      if (isTestUser) {
        finalUserId = userId === 'TEST' ? 'TEST_USER' : userId;
        userProlificData = {
          prolificPid: finalUserId,
          studyId: 'TEST_STUDY',
          sessionId: 'TEST_SESSION',
          detectedAt: new Date().toISOString(),
          referrer: 'test',
          userAgent: navigator.userAgent.substring(0, 200)
        };
      }
      
      // Create or update user record (no image assignment here)
      const result = await createOrUpdateUserRecord(finalUserId, userProlificData, isTestUser);
      const userData = result.userData;
      
      // Store session data
      sessionStorage.setItem('userLoginId', finalUserId);
      if (userProlificData) {
        sessionStorage.setItem('prolificPid', userProlificData.prolificPid);
        sessionStorage.setItem('displayId', userProlificData.prolificPid);
      }
      if (isTestUser) {
        sessionStorage.setItem('testMode', 'true');
      }
      
      // Sign in anonymously for Firebase auth
      const userCredential = await signInAnonymously(auth);
      console.log('Login: Anonymous auth successful:', userCredential.user.uid);
      
      // Check completion status and navigate
      const isCompleted = await checkSurveyCompletion(finalUserId);
      
      if (isCompleted) {
        console.log('Login: User has completed study, redirecting to completion page');
        navigate('/completion');
      } else if (userData.hasConsented) {
        console.log('Login: User has consented, redirecting to survey');
        navigate('/survey');
      } else {
        console.log('Login: User needs to provide consent, redirecting to consent page');
        navigate('/consent');
      }
      
      toast({
        title: 'Login Successful',
        description: isTestUser ? 'Test session loaded' : 'Welcome to the study!',
        status: 'success',
        duration: 2000,
      });
      
    } catch (error) {
      console.error('Login: Login error:', error);
      
      // Check if this is a "user not pre-assigned" error
      if (error.message && error.message.includes('pre-assigned')) {
        setError(`Participant ID "${userId}" has not been pre-assigned. Please contact the administrator or use a valid participant ID.`);
      } else {
        setError(error.message || 'Failed to log in. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Rest of the component remains the same...
  const renderTutorialStep = () => {
    switch (tutorialStep) {
      case 1:
        return (
          <VStack spacing={4} align="start">
            <Flex align="center" gap={2}>
              <Icon as={Info} color="blue.500" />
              <Text fontSize="lg" fontWeight="bold">Welcome to the Image Evaluation Study</Text>
            </Flex>
            <Text>
              Thank you for participating in our research study on image perception and evaluation.
              Your contribution is valuable to our understanding of visual content assessment.
            </Text>
            <Box p={4} bg="blue.50" borderRadius="md">
              <Text fontWeight="medium" mb={2}>What you'll be doing:</Text>
              <OrderedList spacing={2}>
                <ListItem>Viewing 10 carefully selected images (5 from Set 1, 5 from Set 2)</ListItem>
                <ListItem>Evaluating each image using provided rating scales</ListItem>
                <ListItem>Providing your honest impressions and assessments</ListItem>
                <ListItem>Taking approximately 15-20 minutes total</ListItem>
              </OrderedList>
            </Box>
            <Alert status="info" size="sm">
              <AlertIcon />
              <Text fontSize="sm">All responses are anonymous and will be used solely for research purposes.</Text>
            </Alert>
          </VStack>
        );

      case 2:
        return (
          <VStack spacing={4} align="start">
            <Flex align="center" gap={2}>
              <Icon as={ImageIcon} color="green.500" />
              <Text fontSize="lg" fontWeight="bold">Image Sets</Text>
            </Flex>
            <Text>
              You will see images from two different sets, each representing different approaches 
              to image collection and curation:
            </Text>
            <VStack spacing={3} align="start" w="full">
              <HStack w="full">
                <Badge colorScheme="blue" minW="80px" textAlign="center">Set 1</Badge>
                <Text>1200 images - You'll see 5 randomly selected images</Text>
              </HStack>
              <HStack w="full">
                <Badge colorScheme="green" minW="80px" textAlign="center">Set 2</Badge>
                <Text>1200 images - You'll see 5 randomly selected images</Text>
              </HStack>
            </VStack>
            <Box p={4} bg="yellow.50" borderRadius="md">
              <Text color="yellow.800" fontSize="sm">
                <strong>Note:</strong> Each image is shown to a maximum of 5 participants total, 
                and you will never see the same image twice. This ensures balanced evaluation 
                across our entire image dataset.
              </Text>
            </Box>
          </VStack>
        );

      case 3:
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
            <Box p={4} bg="green.50" borderRadius="md">
              <Text color="green.800" fontSize="sm">
                <strong>Privacy:</strong> Your responses are completely anonymous. We only track 
                completion status to ensure proper compensation through Prolific.
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
                <Text fontSize="sm"><strong>✓</strong> Your progress is saved automatically</Text>
                <Text fontSize="sm"><strong>✓</strong> Estimated time: 15-20 minutes</Text>
                <Text fontSize="sm"><strong>✓</strong> You can take breaks between images</Text>
                <Text fontSize="sm"><strong>✓</strong> Your responses contribute to important research</Text>
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
                        ? 'This is a test session for system validation'
                        : 'Your participation will be tracked for proper compensation'
                      }
                    </Text>
                  </VStack>
                </HStack>
              </Box>
            )}
            <Text fontSize="sm" color="gray.600" fontStyle="italic">
              Click "Start Study" below to begin your evaluation, or use the "Previous" button 
              to review any information above.
            </Text>
          </VStack>
        );

      default:
        return null;
    }
  };

  // Show validation spinner if checking existing user
  if (isValidating) {
    return (
      <Flex minH="100vh" align="center" justify="center" bg="gray.50">
        <VStack spacing={4}>
          <Spinner size="xl" color="blue.500" />
          <Text>Validating your session...</Text>
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
                Image Evaluation Study
              </Heading>
              <Text fontSize="sm" color="gray.600" textAlign="center">
                Research Study on Visual Content Assessment
              </Text>
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
            <form onSubmit={handleLogin}>
              <VStack spacing={6}>
                {!prolificMode && !testMode && (
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
                )}

                {(prolificMode || testMode) && (
                  <Box w="full">
                    <Text mb={2} fontWeight="medium">
                      {testMode ? 'Test User ID' : 'Prolific Participant ID'}
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
                        ? 'Test ID automatically detected or entered'
                        : 'ID automatically detected from Prolific redirect'
                      }
                    </Text>
                  </Box>
                )}

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
                    (loginId.startsWith('TEST') || testMode) ? "orange" : 
                    "blue"
                  }
                  width="full"
                  isLoading={loading}
                  loadingText="Signing in..."
                  size="lg"
                >
                  {loginId === 'ADMIN' ? 'Access Admin Dashboard' : 
                   (loginId.startsWith('TEST') || testMode) ? 'Begin Test Session' :
                   'Begin Study'}
                </Button>

                {(prolificMode || testMode) && (
                  <Button
                    leftIcon={<Info />}
                    colorScheme="teal"
                    variant="outline"
                    onClick={onOpen}
                    width="full"
                  >
                    Study Information & Tutorial
                  </Button>
                )}

                {/* Instructions for direct entry */}
                {!prolificMode && !testMode && (
                  <Box p={4} bg="gray.50" borderRadius="md" w="full">
                    <VStack spacing={2}>
                      <Text fontSize="sm" fontWeight="medium" color="gray.700">
                        Pre-Assigned Participant System
                      </Text>
                      <Text fontSize="xs" color="gray.600" textAlign="center">
                        Only use participant IDs that have been pre-assigned by the administrator.
                        Contact support if you don't have a valid participant ID.
                      </Text>
                    </VStack>
                  </Box>
                )}

                {/* Study Status Information */}
                {prolificMode && prolificData && !testMode && (
                  <Box p={3} bg="green.50" borderRadius="md" w="full">
                    <VStack spacing={1}>
                      <Text fontSize="sm" fontWeight="medium" color="green.800">
                        ✓ Study Link Validated
                      </Text>
                      <HStack fontSize="xs" color="green.600" spacing={4}>
                        <Text>Study: {prolificData.studyId?.substring(0, 8) || 'N/A'}</Text>
                        <Text>Session: {prolificData.sessionId?.substring(0, 8) || 'N/A'}</Text>
                      </HStack>
                    </VStack>
                  </Box>
                )}

                {/* Test Mode Information */}
                {testMode && (
                  <Box p={3} bg="orange.50" borderRadius="md" w="full">
                    <VStack spacing={1}>
                      <Text fontSize="sm" fontWeight="medium" color="orange.800">
                        🧪 Test Mode Active
                      </Text>
                      <Text fontSize="xs" color="orange.600">
                        This session will be marked as test data and can be easily identified in analytics
                      </Text>
                    </VStack>
                  </Box>
                )}
              </VStack>
            </form>
          </CardBody>
        </Card>

        {/* Additional Information Card */}
        {(prolificMode || testMode) && (
          <Card mt={6} bg="gray.50" borderColor="gray.200">
            <CardBody py={4}>
              <VStack spacing={3}>
                <Text fontSize="sm" fontWeight="medium" color="gray.700">
                  {testMode ? 'Test Session Information' : 'Study Information'}
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
                  <Text>Compensation:</Text>
                  <Text fontWeight="medium">
                    {testMode ? 'Test session (no compensation)' : 'As specified in Prolific'}
                  </Text>
                </HStack>
                {testMode && (
                  <HStack justify="space-between" w="full" fontSize="xs" color="orange.600">
                    <Text>Test Mode:</Text>
                    <Text fontWeight="medium">Data marked for testing purposes</Text>
                  </HStack>
                )}
              </VStack>
            </CardBody>
          </Card>
        )}
      </Container>

      {/* Tutorial Modal */}
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
              <Text>Study Information & Tutorial</Text>
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
                Ready to Start
              </Button>
            )}
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default Login;