// src/pages/Login.js (Updated version with consent page flow)
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase/config';
import { signInAnonymously } from 'firebase/auth';
import { checkSurveyCompletion } from '../utils/assessment-tracking';
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
} from '@chakra-ui/react';
import { Info, Image as ImageIcon, CheckCircle, AlertCircle } from 'lucide-react';

const Login = () => {
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(1);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const navigate = useNavigate();
  const toast = useToast();
  const totalSteps = 4;

  useEffect(() => {
    const existingLoginId = sessionStorage.getItem('userLoginId');
    const isAdmin = sessionStorage.getItem('isAdmin');
    if (existingLoginId && isAdmin === 'true') {
      navigate('/admin');
    } else if (existingLoginId) {
      // Check if user has consented
      const checkConsentStatus = async () => {
        try {
          const userRef = doc(db, 'loginIDs', existingLoginId);
          const userDoc = await getDoc(userRef);
          
          if (userDoc.exists()) {
            const userData = userDoc.data();
            
            // Check if survey is completed
            const isCompleted = await checkSurveyCompletion(existingLoginId);
            if (isCompleted) {
              navigate('/completion');
              return;
            }
            
            // Check consent status and redirect accordingly
            if (userData.hasConsented) {
              navigate('/survey');
            } else {
              navigate('/consent');
            }
          }
        } catch (error) {
          console.error('Error checking consent status:', error);
          // If there's an error, clear session and stay on login page
          sessionStorage.removeItem('userLoginId');
        }
      };
      
      checkConsentStatus();
    }
  }, [navigate]);

  const validateCredentials = (id, pwd) => {
    // Admin login check
    if (id === 'ADMIN' && pwd === 'ADMIN') return true;
    
    // Check if login ID is numeric and within range
    const numericId = parseInt(id);
    if (isNaN(numericId) || numericId < 1 || numericId > 1004) {
      return false;
    }
    
    // Calculate expected password
    const expectedPosition = ((numericId - 1) % 26);
    const expectedLetter = String.fromCharCode(97 + expectedPosition); // a=97 in ASCII
    const expectedPassword = expectedLetter + id.padStart(4, '0');
    
    return pwd === expectedPassword;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
  
    if (!loginId || !password) {
      setError('Please enter both login ID and password');
      return;
    }
  
    if (!validateCredentials(loginId, password)) {
      setError('Invalid login credentials');
      return;
    }
  
    try {
      setLoading(true);
  
      if (loginId === 'ADMIN') {
        try {
          // First sign in anonymously
          const userCredential = await signInAnonymously(auth);
          console.log('Anonymous auth successful for admin:', userCredential.user.uid);
          
          // Set session storage for admin
          sessionStorage.setItem('userLoginId', 'ADMIN');
          sessionStorage.setItem('isAdmin', 'true');
          
          toast({
            title: 'Admin login successful',
            status: 'success',
            duration: 2000,
          });
  
          // Navigate to admin dashboard
          navigate('/admin');
          return;
        } catch (adminError) {
          console.error('Admin login error:', adminError);
          setError('Admin authentication failed. Please try again.');
          return;
        }
      }
  
      // For regular users:
      // Format login ID with leading zeros
      const formattedLoginId = loginId.padStart(4, '0');
      
      // First check if login ID exists
      const userDoc = await getDoc(doc(db, 'loginIDs', formattedLoginId));
      
      if (!userDoc.exists()) {
        setError('Invalid login ID');
        return;
      }
  
      // Check if user has completed all surveys
      const isCompleted = await checkSurveyCompletion(formattedLoginId);
      
      // Sign in anonymously
      const userCredential = await signInAnonymously(auth);
      console.log('Anonymous auth successful:', userCredential.user.uid);
  
      // Set session data
      sessionStorage.setItem('userLoginId', formattedLoginId);
      
      // Update user's last login time
      await updateDoc(doc(db, 'loginIDs', formattedLoginId), {
        lastLogin: serverTimestamp()
      });
  
      toast({
        title: 'Login successful',
        status: 'success',
        duration: 2000,
      });
  
      // Navigate based on completion status
      if (isCompleted) {
        navigate('/completion');
      } else {
        // Check if user has previously consented
        const userData = userDoc.data();
        if (userData.hasConsented) {
          navigate('/survey');
        } else {
          // If not consented, go to consent page first
          navigate('/consent');
        }
      }
      
    } catch (error) {
      console.error('Login error:', error);
      setError('Failed to log in. Please try again.');
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
              <Icon as={Info} color="blue.500" />
              <Text fontSize="lg" fontWeight="bold">Welcome</Text>
            </Flex>
            <Text>
            Welcome! Thank you for taking the time to participate in this survey.
            </Text>
            <Box p={4} bg="blue.50" borderRadius="md">
              <Text fontWeight="medium">What you'll be doing:</Text>
              <OrderedList spacing={2} mt={2}>
                <ListItem>Viewing a series of images</ListItem>
                <ListItem>Rating each image based on specific criteria</ListItem>
                <ListItem>Completing evaluations for 5 unique images</ListItem>
              </OrderedList>
            </Box>
          </VStack>
        );

      case 2:
        return (
          <VStack spacing={4} align="start">
            <Flex align="center" gap={2}>
              <Icon as={ImageIcon} color="green.500" />
              <Text fontSize="lg" fontWeight="bold">The Evaluation Process</Text>
            </Flex>
            <Text>
              For each image, you will:
            </Text>
            <OrderedList spacing={3}>
              <ListItem>Take time to observe the image carefully</ListItem>
              <ListItem>Consider your initial response and impression</ListItem>
              <ListItem>Rate various aspects of the image using the provided scales</ListItem>
              <ListItem>Once you've completed the form for a particular image, Proceed to the next image using the "Next Image" button</ListItem>
            </OrderedList>
            <Box p={4} bg="yellow.50" borderRadius="md">
              <Text color="yellow.700">
                Note: Take your time with each evaluation. There's no rush, and your thoughtful 
                consideration is valuable.
              </Text>
            </Box>
          </VStack>
        );

      case 3:
        return (
          <VStack spacing={4} align="start">
            <Flex align="center" gap={2}>
              <Icon as={CheckCircle} color="purple.500" />
              <Text fontSize="lg" fontWeight="bold">Important Guidelines</Text>
            </Flex>
            <OrderedList spacing={3}>
              <ListItem>
                <Text fontWeight="medium">Be Consistent</Text>
                <Text>Try to maintain consistent criteria throughout your evaluations</Text>
              </ListItem>
              <ListItem>
                <Text fontWeight="medium">Complete All Questions</Text>
                <Text>Each rating scale must be completed before moving to the next image</Text>
              </ListItem>
              <ListItem>
                <Text fontWeight="medium">Take Breaks</Text>
                <Text>Feel free to take breaks between images to maintain fresh perspectives</Text>
              </ListItem>
              <ListItem>
                <Text fontWeight="medium">Save Your Progress</Text>
                <Text>Your progress is automatically saved after each image evaluation</Text>
              </ListItem>
            </OrderedList>
          </VStack>
        );

      case 4:
        return (
          <VStack spacing={4} align="start">
            <Flex align="center" gap={2}>
              <Icon as={AlertCircle} color="teal.500" />
              <Text fontSize="lg" fontWeight="bold">Ready to Begin</Text>
            </Flex>
            <Text>
              You're now ready to start your evaluation process. Remember:
            </Text>
            <Box p={4} bg="teal.50" borderRadius="md">
              <VStack align="start" spacing={2}>
                <Text>✓ You have 5 images to evaluate</Text>
                <Text>✓ Your progress is saved automatically</Text>
                <Text>✓ You can return later to complete unfinished evaluations</Text>
                <Text>✓ Your careful consideration is valuable for our research</Text>
              </VStack>
            </Box>
            <Text pt={2}>
              Click "Start Evaluation" to begin, or review previous sections if needed.
            </Text>
          </VStack>
        );

      default:
        return null;
    }
  };

  return (
    <Box minH="100vh" bg="gray.50">
      <Container maxW="md" pt={20}>
        <Card boxShadow="xl">
          <CardHeader>
            <Heading size="lg" textAlign="center">Image Recognition Survey.</Heading>
          </CardHeader>
          <CardBody>
            <form onSubmit={handleLogin}>
              <VStack spacing={6}>
                <Box w="full">
                  <Text mb={2} fontWeight="medium">Login ID</Text>
                  <Input
                    type="text"
                    placeholder="Enter your login ID"
                    value={loginId}
                    onChange={(e) => setLoginId(e.target.value)}
                    textAlign="center"
                    fontSize="lg"
                    autoComplete="off"
                  />
                </Box>

                <Box w="full">
                  <Text mb={2} fontWeight="medium">Password</Text>
                  <Input
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    textAlign="center"
                    fontSize="lg"
                    autoComplete="off"
                  />
                </Box>

                {error && (
                  <Alert status="error" borderRadius="md">
                    <AlertIcon />
                    {error}
                  </Alert>
                )}

                <Button
                  type="submit"
                  colorScheme="blue"
                  width="full"
                  isLoading={loading}
                  loadingText="Logging in..."
                >
                  {loginId === 'ADMIN' ? 'Access Admin Dashboard' : 'Login'}
                </Button>

                {/* Tutorial Button */}
                <Button
                  leftIcon={<Info />}
                  colorScheme="teal"
                  variant="outline"
                  onClick={onOpen}
                  width="full"
                >
                  How It Works - Tutorial
                </Button>
              </VStack>
            </form>
          </CardBody>
        </Card>
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
            <Text>Survey Tutorial</Text>
            <Text fontSize="sm" color="gray.500">
              Step {tutorialStep} of {totalSteps}
            </Text>
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
              >
                Start Evaluation
              </Button>
            )}
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default Login;