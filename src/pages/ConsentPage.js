// src/pages/ConsentPage.js - Fixed version
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
      console.log('No login ID found, redirecting to login');
      navigate('/login');
      return;
    }

    // Check if user has already consented
    const checkConsent = async () => {
      try {
        console.log('Checking consent status for user:', loginId);
        
        const userRef = doc(db, 'loginIDs', loginId);
        const userDoc = await getDoc(userRef);
        
        if (!userDoc.exists()) {
          console.error('User document not found:', loginId);
          setError('User not found');
          return;
        }
        
        const userData = userDoc.data();
        console.log('User data loaded:', {
          hasConsented: userData.hasConsented,
          surveyCompleted: userData.surveyCompleted,
          assignedImages: userData.assignedImages?.length
        });
        
        setUserData(userData);
        
        // If user has already consented, redirect to survey
        if (userData.hasConsented) {
          console.log('User has already consented, redirecting to survey');
          navigate('/survey');
          return;
        }
        
        setUserChecked(true);
      } catch (error) {
        console.error('Error checking consent:', error);
        setError('Failed to check consent status: ' + error.message);
      }
    };

    checkConsent();
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
      console.log('Processing consent for user:', loginId);
      
      // Update user record to indicate consent
      const userRef = doc(db, 'loginIDs', loginId);
      const updateData = {
        hasConsented: true,
        consentedAt: serverTimestamp(),
        lastUpdated: serverTimestamp()
      };
      
      console.log('Updating user document with consent...');
      await updateDoc(userRef, updateData);
      
      console.log('Consent saved successfully, navigating to survey...');
      
      toast({
        title: 'Thank you',
        description: 'Your consent has been recorded. Proceeding to study...',
        status: 'success',
        duration: 2000,
      });
      
      // Add a small delay to ensure the toast shows and database update completes
      setTimeout(() => {
        console.log('Navigating to survey page...');
        navigate('/survey');
      }, 1000);
      
    } catch (error) {
      console.error('Error saving consent:', error);
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
    console.log('User cancelled consent, clearing session...');
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
            <Heading size="lg">Research Participant Consent</Heading>
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
                  </VStack>
                </Alert>
              )}

              <Box>
                <Heading size="md" mb={3}>Study Information</Heading>
                <Text mb={2}>
                  You are invited to participate in a research study on visual perception and evaluation.
                  This study involves viewing and rating a series of images based on specific criteria.
                </Text>
                <Text>
                  Your participation will help advance our understanding of how people perceive and evaluate visual content.
                </Text>
              </Box>
              
              <Divider />
              
              <Box>
                <Heading size="md" mb={3}>What You Will Do</Heading>
                <Text mb={2}>As a participant in this study, you will:</Text>
                <OrderedList spacing={2} pl={5}>
                  <ListItem>View a series of {userData?.assignedImages?.length || '10'} images</ListItem>
                  <ListItem>Rate each image based on various criteria using provided rating scales</ListItem>
                  <ListItem>Complete all evaluations at your own pace</ListItem>
                </OrderedList>
              </Box>
              
              <Divider />
              
              <Box>
                <Heading size="md" mb={3}>Time Commitment</Heading>
                <Text>
                  The entire process is expected to take approximately 15-20 minutes, depending on how long you choose
                  to spend viewing each image.
                </Text>
              </Box>
              
              <Divider />
              
              <Box>
                <Heading size="md" mb={3}>Risks and Benefits</Heading>
                <Text mb={2}><strong>Risks:</strong> There are minimal risks associated with this study. The images you will view do not contain graphic or disturbing content.</Text>
                <Text><strong>Benefits:</strong> Your participation contributes to research in visual perception and evaluation. There are no direct benefits to you as a participant.</Text>
              </Box>
              
              <Divider />
              
              <Box>
                <Heading size="md" mb={3}>Confidentiality</Heading>
                <Text mb={2}>
                  Your responses will be recorded and stored securely. All data will be anonymized for analysis and reporting.
                </Text>
                <Text>
                  We will not collect any personally identifiable information beyond your assigned login ID.
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
                  If you have questions about this research study, please contact the research team at:
                </Text>
                <UnorderedList spacing={1} pl={5}>
                  <ListItem>Email: research@example.edu</ListItem>
                  <ListItem>Phone: (123) 456-7890</ListItem>
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
                  I Consent - Proceed to Survey
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