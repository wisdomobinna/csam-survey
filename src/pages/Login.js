// src/pages/Login.js
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
    if (existingLoginId) {
      navigate('/survey');
    } else if (isAdmin) {
      navigate('/admin');
    }
  }, [navigate]);

  const validateLoginId = (id) => {
    if (id === 'ADMIN') return true;
    const pattern = /^EV25-\d{3}$/;
    return pattern.test(id);
  };

  const handleInputChange = (e) => {
    let value = e.target.value.toUpperCase();
    
    if (value === 'ADMIN') {
      setLoginId(value);
      return;
    }

    // If the input is being deleted, just update the state
    if (value.length < loginId.length) {
      setLoginId(value);
      return;
    }

    // Add hyphen automatically after EV25
    if (value.length === 4 && !value.includes('-')) {
      value = value + '-';
    }
    
    // Only allow numbers after EV25-
    if (value.length > 5) {
      const prefix = value.slice(0, 5);
      const numbers = value.slice(5).replace(/[^0-9]/g, '');
      value = prefix + numbers;
    }

    // Limit to the format EV25-XXX
    if (value.length <= 8) {
      setLoginId(value);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
  
    if (!loginId) {
      setError('Please enter a login ID');
      return;
    }
  
    if (!validateLoginId(loginId)) {
      setError('Invalid login ID format');
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
      // First check if login ID exists
      const userDoc = await getDoc(doc(db, 'loginIDs', loginId));
      
      if (!userDoc.exists()) {
        setError('Invalid login ID');
        return;
      }
  
      // Check if user has completed all surveys
      const isCompleted = await checkSurveyCompletion(loginId);
      
      // Sign in anonymously
      const userCredential = await signInAnonymously(auth);
      console.log('Anonymous auth successful:', userCredential.user.uid);
  
      // Set session data
      sessionStorage.setItem('userLoginId', loginId);
      
      // Update user's last login time
      await updateDoc(doc(db, 'loginIDs', loginId), {
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
        navigate('/survey');
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
              <Text fontSize="lg" fontWeight="bold">Welcome to the Art Survey System</Text>
            </Flex>
            <Text>
              You are participating in an important research study about visual perception in art. 
              Your role as an evaluator is crucial for our research.
            </Text>
            <Box p={4} bg="blue.50" borderRadius="md">
              <Text fontWeight="medium">What you'll be doing:</Text>
              <OrderedList spacing={2} mt={2}>
                <ListItem>Viewing a series of art images</ListItem>
                <ListItem>Rating each image based on specific criteria</ListItem>
                <ListItem>Completing evaluations for 12 unique images</ListItem>
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
                <Text>✓ You have 12 images to evaluate</Text>
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
            <Heading size="lg" textAlign="center">Art Survey Portal</Heading>
          </CardHeader>
          <center>Enter your Login ID</center>
          <CardBody>
            <form onSubmit={handleLogin}>
              <VStack spacing={6}>
                <Box w="full">
                  <Input
                    type="text"
                    placeholder=""
                    value={loginId}
                    onChange={handleInputChange}
                    textAlign="center"
                    fontSize="lg"
                    letterSpacing="wider"
                    maxLength={8}
                    autoComplete="off"
                    autoCapitalize="characters"/>
                  <Text fontSize="sm" color="gray.500" textAlign="center" mt={2}>
                  </Text>
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
                  {loginId === 'ADMIN' ? 'Access Admin Dashboard' : 'Start Survey'}
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
            <Text>Art Survey Tutorial</Text>
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