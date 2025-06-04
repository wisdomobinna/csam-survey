// src/pages/ConsentPage.js - FIXED VERSION
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
} from '@chakra-ui/react';

const ConsentPage = () => {
  const [isConsented, setIsConsented] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [userChecked, setUserChecked] = useState(false);
  
  const navigate = useNavigate();
  const toast = useToast();
  const loginId = sessionStorage.getItem('userLoginId');

  useEffect(() => {
    if (!loginId) {
      navigate('/login');
      return;
    }

    // Check if user has already consented
    const checkConsent = async () => {
      try {
        // FIXED: Use 'participants' collection instead of 'loginIDs'
        const userRef = doc(db, 'participants', loginId);
        const userDoc = await getDoc(userRef);
        
        if (!userDoc.exists()) {
          setError('User not found');
          return;
        }
        
        const userData = userDoc.data();
        
        // If user has already consented, redirect to survey
        if (userData.hasConsented) {
          navigate('/survey');
        }
        
        setUserChecked(true);
      } catch (error) {
        console.error('Error checking consent:', error);
        setError('Failed to check consent status');
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
      
      // FIXED: Update user record in 'participants' collection
      const userRef = doc(db, 'participants', loginId);
      await updateDoc(userRef, {
        hasConsented: true,
        consentedAt: serverTimestamp(),
        lastActiveAt: serverTimestamp(),
        studyPhase: 'survey' // Update phase to survey
      });
      
      toast({
        title: 'Thank you',
        description: 'Your consent has been recorded',
        status: 'success',
        duration: 2000,
      });
      
      // Navigate to survey
      navigate('/survey');
    } catch (error) {
      console.error('Error saving consent:', error);
      setError('Failed to save your consent. Please try again.');
      setLoading(false);
    }
  };

  const handleCancel = () => {
    sessionStorage.removeItem('userLoginId');
    sessionStorage.removeItem('isAdmin');
    navigate('/login');
  };

  if (!userChecked) {
    return (
      <Flex minH="100vh" align="center" justify="center">
        <Text>Checking user status...</Text>
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
                  <ListItem>View a series of 5 images</ListItem>
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