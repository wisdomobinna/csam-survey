// src/pages/Completion.js
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import {
  Box,
  Button,
  Container,
  Text,
  VStack,
  Heading,
  Alert,
  AlertIcon,
  Card,
  CardBody,
  CardHeader,
  Icon,
  Flex,
} from '@chakra-ui/react';
import { CheckCircle } from 'lucide-react';

const Completion = () => {
  const navigate = useNavigate();
  const loginId = sessionStorage.getItem('userLoginId');

  useEffect(() => {
    if (!loginId) {
      navigate('/login');
      return;
    }

    // Verify user has completed the survey
    const verifyCompletion = async () => {
      try {
        const userRef = doc(db, 'loginIDs', loginId);
        const userDoc = await getDoc(userRef);
        
        if (!userDoc.exists()) {
          navigate('/login');
          return;
        }
        
        const userData = userDoc.data();
        
        // If not completed, redirect to survey
        if (!userData.surveyCompleted) {
          navigate('/survey');
        }
        
      } catch (error) {
        console.error('Error verifying completion:', error);
      }
    };

    verifyCompletion();
  }, [loginId, navigate]);

  const handleLogout = () => {
    sessionStorage.removeItem('userLoginId');
    sessionStorage.removeItem('isAdmin');
    navigate('/login');
  };

  return (
    <Box minH="100vh" bg="gray.50">
      <Container maxW="lg" pt={20}>
        <Card boxShadow="xl">
          <CardHeader bg="green.50" borderTopRadius="lg">
            <Flex align="center" gap={3}>
              <Icon as={CheckCircle} color="green.500" boxSize={8} />
              <Heading size="lg">Survey Completed</Heading>
            </Flex>
          </CardHeader>
          <CardBody>
            <VStack spacing={6} align="stretch">
              <Alert status="success" borderRadius="md">
                <AlertIcon />
                Thank you for completing the survey! Your responses have been recorded.
              </Alert>

              <Box>
                <Heading size="md" mb={3}>Thank You for Your Participation</Heading>
                <Text>
                  Your contribution to this research is valuable and greatly appreciated. All of your responses
                  have been successfully submitted and saved.
                </Text>
              </Box>

              <Box p={5} bg="blue.50" borderRadius="md">
                <VStack align="start" spacing={3}>
                  <Text fontWeight="medium">What happens next?</Text>
                  <Text>
                    Your participation in this study is now complete. You may close this window or 
                    click the button below to log out.
                  </Text>
                  <Text>
                    If you have any questions about the study or your participation, please contact the research team
                    using the information provided in the consent form.
                  </Text>
                </VStack>
              </Box>

              <Button
                colorScheme="blue"
                width="full"
                onClick={handleLogout}
                size="lg"
                mt={4}
              >
                Log Out
              </Button>
            </VStack>
          </CardBody>
        </Card>
      </Container>
    </Box>
  );
};

export default Completion;