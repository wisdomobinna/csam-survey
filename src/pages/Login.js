// src/pages/Login.js - Fixed login page for pre-assigned system
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import {
  Box,
  Container,
  Heading,
  VStack,
  Input,
  Button,
  Alert,
  AlertIcon,
  AlertDescription,
  Text,
  useToast,
  Card,
  CardBody,
  HStack,
  Badge,
  Divider,
  Icon,
  Code
} from '@chakra-ui/react';
import { LogIn, AlertCircle, Users, Settings } from 'lucide-react';
import { db } from '../firebase/config';

// Helper function to assign next available login ID
const assignNextAvailableLoginId = async (prolificPid, prolificData = {}) => {
  try {
    console.log('Assigning login ID to participant:', prolificPid);
    
    // Get next available login ID
    const preAssignedRef = collection(db, 'preAssignedLogins');
    const availableQuery = query(
      preAssignedRef, 
      where('isUsed', '==', false), 
      limit(1)
    );
    const availableSnapshot = await getDocs(availableQuery);
    
    if (availableSnapshot.empty) {
      throw new Error('No available login IDs remaining. Study may be full.');
    }
    
    // Get the first available login ID
    const selectedDoc = availableSnapshot.docs[0];
    const loginId = selectedDoc.id;
    const loginData = selectedDoc.data();
    
    console.log(`Assigning login ID ${loginId} to ${prolificPid}`);
    
    // Update the pre-assigned login document
    await updateDoc(doc(db, 'preAssignedLogins', loginId), {
      isUsed: true,
      usedBy: prolificPid,
      usedAt: new Date(),
      status: 'assigned',
      prolificData: {
        prolificPid,
        studyId: prolificData.studyId || null,
        sessionId: prolificData.sessionId || null,
        detectedAt: prolificData.detectedAt || new Date().toISOString(),
        ...prolificData
      }
    });
    
    // Create active participant session
    await setDoc(doc(db, 'participants', loginId), {
      loginId: loginId,
      prolificPid: prolificPid,
      assignedImages: loginData.assignedImages,
      totalImages: loginData.totalImages,
      
      // Progress tracking
      studyPhase: 'consent',
      hasConsented: false,
      consentedAt: null,
      currentImageIndex: 0,
      completedImageCount: 0,
      completedImageIds: [],
      surveyCompleted: false,
      completedAt: null,
      
      // Session metadata
      createdAt: new Date(),
      firstLoginAt: new Date(),
      lastActiveAt: new Date(),
      totalSessionTime: 0,
      
      // Prolific integration
      prolificData: {
        studyId: prolificData.studyId || null,
        sessionId: prolificData.sessionId || null,
        prolificPid: prolificPid,
        ...prolificData
      },
      
      // Technical metadata
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      timezone: typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : ''
    });
    
    console.log(`Successfully assigned login ID ${loginId} to participant ${prolificPid}`);
    
    return {
      success: true,
      loginId: loginId,
      assignedImages: loginData.assignedImages
    };
    
  } catch (error) {
    console.error('Error assigning login ID to participant:', error);
    throw error;
  }
};

// Helper function to find existing participant
const findExistingParticipant = async (prolificPid) => {
  try {
    // Check pre-assigned logins for this Prolific PID
    const preAssignedRef = collection(db, 'preAssignedLogins');
    const assignedQuery = query(preAssignedRef, where('usedBy', '==', prolificPid));
    const assignedSnapshot = await getDocs(assignedQuery);
    
    if (!assignedSnapshot.empty) {
      const doc = assignedSnapshot.docs[0];
      return {
        exists: true,
        loginId: doc.id,
        assignmentData: doc.data()
      };
    }
    
    return { exists: false };
    
  } catch (error) {
    console.error('Error finding existing participant:', error);
    throw error;
  }
};

const Login = () => {
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [urlParams, setUrlParams] = useState({});
  
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const toast = useToast();

  useEffect(() => {
    // Extract URL parameters for debugging
    const params = {};
    for (const [key, value] of searchParams.entries()) {
      params[key] = value;
    }
    setUrlParams(params);
    
    // Auto-handle Prolific participants
    if (searchParams.get('PROLIFIC_PID') || searchParams.get('prolific_pid')) {
      handleLogin();
    }
  }, [searchParams]);

  const handleLogin = async () => {
    if (!userId.trim() && !searchParams.get('PROLIFIC_PID') && !searchParams.get('prolific_pid')) {
      setError('Please enter a login ID');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Handle admin access
      if (userId.toUpperCase() === 'ADMIN') {
        sessionStorage.setItem('isAdmin', 'true');
        sessionStorage.setItem('userLoginId', 'ADMIN');
        
        toast({
          title: 'Admin Access',
          description: 'Welcome to the admin dashboard',
          status: 'success',
          duration: 3000,
        });
        
        navigate('/admin');
        return;
      }

      // Handle direct login ID entry (for testing or manual access)
      if (userId.match(/^\d{4}$/)) {
        console.log('Direct login ID attempt:', userId);
        
        // Check if this login ID exists in pre-assigned logins
        const preAssignedRef = doc(db, 'preAssignedLogins', userId);
        const preAssignedDoc = await getDoc(preAssignedRef);
        
        if (!preAssignedDoc.exists()) {
          setError(`Login ID ${userId} not found in the system. Please check the ID.`);
          return;
        }

        const preAssignedData = preAssignedDoc.data();
        
        // Check if there's already an active participant session
        const participantRef = doc(db, 'participants', userId);
        const participantDoc = await getDoc(participantRef);
        
        if (participantDoc.exists()) {
          // Existing session - resume
          const participantData = participantDoc.data();
          
          sessionStorage.setItem('userLoginId', userId);
          
          toast({
            title: 'Welcome Back!',
            description: `Resuming session for ID ${userId}`,
            status: 'info',
            duration: 3000,
          });
          
          // Navigate based on progress
          if (participantData.surveyCompleted) {
            navigate('/completion');
          } else if (participantData.hasConsented) {
            navigate('/survey');
          } else {
            navigate('/consent');
          }
          return;
        } else {
          // No active session - create new one
          const participantData = {
            loginId: userId,
            prolificPid: preAssignedData.usedBy || `DIRECT_${userId}`,
            assignedImages: preAssignedData.assignedImages,
            totalImages: preAssignedData.totalImages,
            
            // Progress tracking
            studyPhase: 'consent',
            hasConsented: false,
            consentedAt: null,
            currentImageIndex: 0,
            completedImageCount: 0,
            completedImageIds: [],
            surveyCompleted: false,
            completedAt: null,
            
            // Session metadata
            createdAt: new Date(),
            firstLoginAt: new Date(),
            lastActiveAt: new Date(),
            totalSessionTime: 0,
            
            // Prolific data
            prolificData: preAssignedData.prolificData || { source: 'direct_login' },
            
            // Technical metadata
            userAgent: navigator.userAgent,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
          };

          await setDoc(participantRef, participantData);
          
          // Mark as used in pre-assigned if not already
          if (!preAssignedData.isUsed) {
            await updateDoc(preAssignedRef, {
              isUsed: true,
              usedBy: `DIRECT_${userId}`,
              usedAt: new Date(),
              status: 'assigned'
            });
          }
          
          sessionStorage.setItem('userLoginId', userId);
          
          toast({
            title: 'Login Successful',
            description: `Welcome! Using login ID ${userId}`,
            status: 'success',
            duration: 3000,
          });
          
          navigate('/consent');
          return;
        }
      }

      // Handle Prolific URL parameters (automatic assignment)
      if (searchParams.get('PROLIFIC_PID') || searchParams.get('prolific_pid')) {
        const prolificPid = searchParams.get('PROLIFIC_PID') || searchParams.get('prolific_pid');
        const studyId = searchParams.get('STUDY_ID') || searchParams.get('study_id');
        const sessionId = searchParams.get('SESSION_ID') || searchParams.get('session_id');
        
        console.log('Prolific participant detected:', { prolificPid, studyId, sessionId });
        
        // Check if participant already has a login ID
        const existingParticipant = await findExistingParticipant(prolificPid);
        
        if (existingParticipant.exists) {
          sessionStorage.setItem('userLoginId', existingParticipant.loginId);
          
          toast({
            title: 'Welcome Back!',
            description: `Continuing with your assigned ID: ${existingParticipant.loginId}`,
            status: 'info',
            duration: 3000,
          });
          
          navigate('/consent');
          return;
        }
        
        // Assign new login ID
        try {
          const result = await assignNextAvailableLoginId(prolificPid, {
            studyId,
            sessionId,
            detectedAt: new Date().toISOString()
          });
          
          if (result.success) {
            sessionStorage.setItem('userLoginId', result.loginId);
            
            toast({
              title: 'Welcome to the Study!',
              description: `Your login ID is: ${result.loginId}`,
              status: 'success',
              duration: 3000,
            });
            
            navigate('/consent');
            return;
          } else {
            setError('No login IDs available. Study may be full.');
            return;
          }
        } catch (error) {
          console.error('Prolific assignment error:', error);
          setError('Failed to assign login ID. Please contact support.');
          return;
        }
      }

      // Invalid input
      setError('Please enter a valid 4-digit login ID or use the Prolific study link.');
      
    } catch (error) {
      console.error('Login error:', error);
      setError('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleLogin();
    }
  };

  return (
    <Box minH="100vh" bg="gray.50" py={8}>
      <Container maxW="md" centerContent>
        <VStack spacing={8} w="full">
          {/* Header */}
          <VStack spacing={4}>
            <Icon as={LogIn} size={48} color="blue.500" />
            <Heading size="xl" textAlign="center">
              Image Evaluation Study
            </Heading>
            <Text color="gray.600" textAlign="center">
              Research Study on Visual Content Assessment
            </Text>
          </VStack>

          {/* Login Form */}
          <Card w="full">
            <CardBody>
              <VStack spacing={6}>
                <VStack spacing={4} w="full">
                  <Text textAlign="center" color="gray.700">
                    Enter your 4-digit login ID, "ADMIN" for admin access, or<br />
                    "TEST" for test mode
                  </Text>
                  
                  <Input
                    placeholder="0001"
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                    onKeyPress={handleKeyPress}
                    size="lg"
                    textAlign="center"
                    fontSize="xl"
                    letterSpacing="wider"
                    bg="white"
                    _focus={{ borderColor: 'blue.500', boxShadow: '0 0 0 1px var(--chakra-colors-blue-500)' }}
                  />
                  
                  {error && (
                    <Alert status="error" borderRadius="md">
                      <AlertIcon />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}
                </VStack>

                <Button
                  colorScheme="blue"
                  size="lg"
                  w="full"
                  onClick={handleLogin}
                  isLoading={loading}
                  loadingText="Checking user..."
                  leftIcon={<LogIn size={20} />}
                >
                  Begin Study
                </Button>
              </VStack>
            </CardBody>
          </Card>

          {/* Information */}
          <VStack spacing={4} w="full">
            <Divider />
            
            <VStack spacing={2}>
              <HStack>
                <Icon as={Users} color="blue.500" />
                <Text fontWeight="bold">For Prolific participants:</Text>
              </HStack>
              <Text fontSize="sm" color="gray.600" textAlign="center">
                Use the official study link
              </Text>
            </VStack>
            
            <VStack spacing={2}>
              <HStack>
                <Icon as={Settings} color="green.500" />
                <Text fontWeight="bold">For researchers:</Text>
              </HStack>
              <Text fontSize="sm" color="gray.600" textAlign="center">
                Enter 4-digit login ID (0001-1100)
              </Text>
            </VStack>
            
            <VStack spacing={2}>
              <HStack>
                <Icon as={AlertCircle} color="orange.500" />
                <Text fontWeight="bold">For testing:</Text>
              </HStack>
              <Text fontSize="sm" color="gray.600" textAlign="center">
                Enter "TEST"
              </Text>
            </VStack>
          </VStack>

          {/* URL Parameters Debug (only show if params exist) */}
          {Object.keys(urlParams).length > 0 && (
            <Card w="full" bg="yellow.50" borderColor="yellow.200">
              <CardBody>
                <VStack spacing={2}>
                  <HStack>
                    <Icon as={AlertCircle} color="yellow.500" />
                    <Text fontWeight="bold" fontSize="sm">URL Parameters detected:</Text>
                  </HStack>
                  {Object.entries(urlParams).map(([key, value]) => (
                    <HStack key={key} spacing={2} fontSize="xs" w="full" justify="space-between">
                      <Badge colorScheme="yellow">{key}</Badge>
                      <Code>{value || 'null'}</Code>
                    </HStack>
                  ))}
                </VStack>
              </CardBody>
            </Card>
          )}
        </VStack>
      </Container>
    </Box>
  );
};

export default Login;