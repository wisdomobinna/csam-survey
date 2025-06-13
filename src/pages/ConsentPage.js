// src/pages/ConsentPage.js - Updated to redirect directly to main survey
import React, { useState, useEffect } from 'react';
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
  Checkbox,
  Divider,
  OrderedList,
  ListItem,
  UnorderedList,
  Flex,
  Spacer,
  Spinner,
  Badge,
  HStack,
} from '@chakra-ui/react';

const ConsentPage = () => {
  const [isConsented, setIsConsented] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [userChecked, setUserChecked] = useState(false);
  const [userData, setUserData] = useState(null);
  
  const navigate = useNavigate();
  const toast = useToast();
  const loginId = sessionStorage.getItem('userLoginId');

  useEffect(() => {
    if (!loginId) {
      console.log('ConsentPage: No login ID found, redirecting to login');
      navigate('/login');
      return;
    }

    // Check user's current progress and redirect appropriately
    const checkUserProgress = async () => {
      try {
        console.log('ConsentPage: Checking user progress for:', loginId);
        
        const userRef = doc(db, 'loginIDs', loginId);
        const userDoc = await getDoc(userRef);
        
        if (!userDoc.exists()) {
          console.error('ConsentPage: User document not found:', loginId);
          setError('User not found');
          return;
        }
        
        const userData = userDoc.data();
        console.log('ConsentPage: User data loaded:', {
          hasConsented: userData.hasConsented,
          mainSurveyCompleted: userData.mainSurveyCompleted,
          demographicsCompleted: userData.demographicsCompleted,
          surveyCompleted: userData.surveyCompleted,
          assignedImages: userData.assignedImages?.length
        });
        
        setUserData(userData);
        
        // UPDATED FLOW: Redirect based on user's progress through the NEW study flow
        if (userData.surveyCompleted) {
          console.log('ConsentPage: User has completed entire study, redirecting to completion');
          navigate('/completion');
          return;
        }
        
        // Check if user completed main survey but not demographics
        if (userData.mainSurveyCompleted && !userData.demographicsCompleted) {
          console.log('ConsentPage: User completed main survey but not demographics, redirecting to survey (will show demographics)');
          navigate('/survey');
          return;
        }
        
        // Check if user has consented - go directly to main survey now
        if (userData.hasConsented) {
          console.log('ConsentPage: User has consented, redirecting directly to main survey');
          navigate('/survey');
          return;
        }
        
        // If user hasn't consented, stay on this page
        if (!userData.hasConsented) {
          console.log('ConsentPage: User has not consented, showing consent form');
        }
        
        setUserChecked(true);
      } catch (error) {
        console.error('ConsentPage: Error checking user progress:', error);
        setError('Failed to check user status: ' + error.message);
      }
    };

    checkUserProgress();
  }, [loginId, navigate]);

  const handleConsent = async () => {
    if (!isConsented) {
      toast({
        title: 'Consent Required',
        description: 'Please check the box to indicate your consent before proceeding',
        status: 'warning',
        duration: 3000,
      });
      return;
    }

    try {
      setLoading(true);
      console.log('ConsentPage: Processing consent for user:', loginId);
      
      // Update user record to indicate consent
      const userRef = doc(db, 'loginIDs', loginId);
      const updateData = {
        hasConsented: true,
        consentedAt: serverTimestamp(),
        lastUpdated: serverTimestamp()
      };
      
      console.log('ConsentPage: Updating user document with consent...');
      await updateDoc(userRef, updateData);
      
      console.log('ConsentPage: Consent saved successfully, navigating to main survey...');
      
      toast({
        title: 'Thank you',
        description: 'Your consent has been recorded. Proceeding to image evaluation...',
        status: 'success',
        duration: 2000,
      });
      
      // UPDATED: Navigate directly to main survey instead of demographics
      setTimeout(() => {
        console.log('ConsentPage: Navigating to main survey page...');
        navigate('/survey');
      }, 1000);
      
    } catch (error) {
      console.error('ConsentPage: Error saving consent:', error);
      setError('Failed to save your consent: ' + error.message);
      toast({
        title: 'Error',
        description: 'Failed to save consent. Please try again.',
        status: 'error',
        duration: 5000,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    console.log('ConsentPage: User cancelled consent, clearing session...');
    sessionStorage.removeItem('userLoginId');
    sessionStorage.removeItem('isAdmin');
    sessionStorage.removeItem('prolificPid');
    sessionStorage.removeItem('displayId');
    sessionStorage.removeItem('testMode');
    navigate('/login');
  };

  if (!userChecked && !error) {
    return (
      <Flex minH="100vh" align="center" justify="center" bg="gray.50">
        <VStack spacing={4}>
          <Spinner size="xl" color="blue.500" />
          <Text>Checking your status...</Text>
        </VStack>
      </Flex>
    );
  }

  return (
    <Box minH="100vh" bg="gray.50">
      <Container maxW="4xl" pt={10} pb={10}>
        <Card boxShadow="xl">
          <CardHeader bg="blue.50" borderTopRadius="lg">
            <VStack spacing={2}>
              <Heading size="lg">Research Participant Consent</Heading>
              <HStack spacing={2}>
                <Badge colorScheme="blue">Step 1 of 3</Badge>
                <Badge colorScheme="gray">Consent → Main Study → Demographics</Badge>
              </HStack>
            </VStack>
          </CardHeader>
          <CardBody>
            <VStack spacing={6} align="stretch">
              {error && (
                <Alert status="error" borderRadius="md">
                  <AlertIcon />
                  {error}
                </Alert>
              )}

              {userData && (
                <Alert status="info" borderRadius="md">
                  <AlertIcon />
                  <VStack align="start" spacing={1}>
                    <Text fontWeight="medium">Study Information</Text>
                    <Text fontSize="sm">
                      You have been assigned {userData.assignedImages?.length || 0} images to evaluate.
                    </Text>
                    <Text fontSize="sm" color="blue.600">
                      After consent, you'll evaluate the images first, then complete a brief demographics survey.
                    </Text>
                  </VStack>
                </Alert>
              )}

              <Box>
                <Heading size="md" mb={3}>Study Information</Heading>
                <Text mb={2}>
                  This study involves viewing and rating a series of images. We are interested in understanding your perceptions of these images.
                </Text>
                <Text>
                You will be paid at a rate of $15/hr for your participation.
                </Text>
              </Box>
              
              <Divider />
              
              <Box>
                <Heading size="md" mb={3}>Study Process</Heading>
                <Text mb={2}>This study consists of three steps:</Text>
                <OrderedList spacing={2} pl={5}>
                  <ListItem><strong>Consent</strong> - Review and agree to participate (this page)</ListItem>
                  <ListItem><strong>Image Evaluation</strong> - View and evaluate {userData?.assignedImages?.length || '10'} images using provided rating scales (10-15 minutes)</ListItem>
                  <ListItem><strong>Demographics</strong> - Complete a brief demographic questionnaire (2-3 minutes)</ListItem>
                </OrderedList>
              </Box>
              
              <Divider />
              
              <Box>
                <Heading size="md" mb={3}>Risks and Benefits</Heading>
                <Text mb={2}><strong>Risks:</strong> You will be asked questions about the similarity of images, whether they contain particular things or
people like children or products, and other questions about how you perceive the images. We do not
anticipate that you will encounter any risks beyond those you encounter in your regular use of the
internet.</Text>
                <Text><strong>Benefits:</strong> There are no direct personal benefits from participating in this research. However, your participation
will contribute to a better understanding of how to protect people from the generation of synthetic
images that depict them without their consent..</Text>
              </Box>
              
              <Divider />
              
              <Box>
                <Heading size="md" mb={3}>Confidentiality</Heading>
                <Text mb={2}>
                  Your responses will be recorded and stored securely. All data will be anonymized for analysis and reporting.
                </Text>
                <Text>
                  We will collect basic demographic information and your image ratings. No personally identifiable information beyond your assigned login ID will be stored.
                </Text>
              </Box>
              
              <Divider />
              
              <Box>
                <Heading size="md" mb={3}>Voluntary Participation</Heading>
                <Text>
                  Your participation in this study is completely voluntary. You may withdraw at any time by closing your browser window.
                  There will be no penalties for withdrawing from the study.
                </Text>
              </Box>
              
              <Divider />
              
              <Box>
                <Heading size="md" mb={3}>Contact Information</Heading>
                <Text mb={2}>
                  If you have questions about this study, contact the research team at:
                </Text>
                <UnorderedList spacing={1} pl={5}>
                  <ListItem>digitalharmstudies@gmail.com</ListItem>
                </UnorderedList>
              </Box>
              
              <Divider />
              
              <Box pt={2}>
                <Checkbox 
                  colorScheme="blue"
                  size="lg"
                  isChecked={isConsented}
                  onChange={(e) => setIsConsented(e.target.checked)}
                >
                  <Text fontWeight="medium">
                    I have read and understood the information above. I voluntarily agree to participate in this research study.
                  </Text>
                </Checkbox>
              </Box>

              <Flex mt={4}>
                <Button
                  colorScheme="red"
                  variant="outline"
                  onClick={handleCancel}
                  isDisabled={loading}
                >
                  Cancel
                </Button>
                <Spacer />
                <Button
                  colorScheme="blue"
                  onClick={handleConsent}
                  isLoading={loading}
                  loadingText="Processing..."
                  isDisabled={!isConsented}
                  size="lg"
                >
                  I Consent - Begin Image Evaluation
                </Button>
              </Flex>
            </VStack>
          </CardBody>
        </Card>
      </Container>
    </Box>
  );
};

export default ConsentPage;