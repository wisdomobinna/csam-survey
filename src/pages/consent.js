// src/pages/Consent.js - Replace your existing file with this
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Heading,
  VStack,
  Text,
  Button,
  Card,
  CardBody,
  Alert,
  AlertIcon,
  Checkbox,
  useToast
} from '@chakra-ui/react';

const Consent = () => {
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const navigate = useNavigate();
  const toast = useToast();

  // Get login ID directly from sessionStorage - no useEffect needed
  const loginId = sessionStorage.getItem('userLoginId');

  // Simple redirect if no login ID
  if (!loginId || loginId === 'ADMIN') {
    navigate('/login');
    return null;
  }

  const handleConsent = () => {
    if (!agreed) {
      toast({
        title: 'Consent Required',
        description: 'Please check the consent box to continue',
        status: 'warning',
        duration: 3000,
      });
      return;
    }

    setLoading(true);

    toast({
      title: 'Consent Recorded',
      description: 'Thank you! Proceeding to the survey...',
      status: 'success',
      duration: 1000,
    });

    // Navigate after short delay
    setTimeout(() => {
      navigate('/survey');
    }, 1000);
  };

  return (
    <Box minH="100vh" bg="gray.50" py={8}>
      <Container maxW="4xl">
        <VStack spacing={8}>
          {/* Header */}
          <VStack spacing={4} textAlign="center">
            <Heading size="xl">Informed Consent</Heading>
            <Text color="gray.600">
              Research Study on Visual Content Assessment
            </Text>
            <Text fontSize="sm" color="green.600" fontWeight="bold">
              ✅ Login ID: {loginId} - Ready to proceed
            </Text>
          </VStack>

          {/* Consent Form */}
          <Card w="full">
            <CardBody>
              <VStack spacing={6} align="start">
                <Heading size="md">Study Information</Heading>
                
                <VStack spacing={4} align="start">
                  <Text>
                    <strong>Purpose:</strong> This study investigates how people evaluate visual content. 
                    You will be shown a series of images and asked to provide ratings and feedback.
                  </Text>
                  
                  <Text>
                    <strong>Duration:</strong> Approximately 15-20 minutes.
                  </Text>
                  
                  <Text>
                    <strong>Procedure:</strong> You will view 10 images and answer questions about each one, 
                    followed by a brief demographic survey.
                  </Text>
                  
                  <Text>
                    <strong>Confidentiality:</strong> Your responses will be kept confidential and used only for research purposes.
                  </Text>
                  
                  <Text>
                    <strong>Voluntary Participation:</strong> Your participation is voluntary. You may withdraw at any time.
                  </Text>
                </VStack>

                <Alert status="info">
                  <AlertIcon />
                  <Box>
                    <Text fontWeight="bold">Data Collection Notice</Text>
                    <Text fontSize="sm">
                      This study collects your image ratings and basic demographic information. 
                      No personally identifying information is collected.
                    </Text>
                  </Box>
                </Alert>

                <VStack spacing={4} w="full">
                  <Checkbox
                    isChecked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                    size="lg"
                  >
                    <Text fontSize="md" fontWeight="medium">
                      I have read and understood the above information. I voluntarily agree to participate in this research study.
                    </Text>
                  </Checkbox>

                  <Button
                    colorScheme="blue"
                    size="lg"
                    w="full"
                    onClick={handleConsent}
                    isLoading={loading}
                    loadingText="Processing..."
                    isDisabled={!agreed}
                  >
                    I Consent - Begin Study
                  </Button>

                  <Button
                    variant="outline"
                    size="md"
                    onClick={() => navigate('/login')}
                  >
                    Decline - Return to Login
                  </Button>
                </VStack>
              </VStack>
            </CardBody>
          </Card>
        </VStack>
      </Container>
    </Box>
  );
};

export default Consent;