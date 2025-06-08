// src/pages/Setup.js - Fixed version with 1080+ user support
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  collection, 
  getDocs, 
  writeBatch, 
  doc, 
  query, 
  where, 
  orderBy, 
  limit,
  serverTimestamp 
} from 'firebase/firestore';
import { ref, listAll, getMetadata } from 'firebase/storage';
import { db, storage } from '../firebase/config';
import {
  Box,
  Button,
  Container,
  Text,
  VStack,
  HStack,
  Alert,
  AlertIcon,
  Card,
  CardBody,
  CardHeader,
  Heading,
  useToast,
  Progress,
  Badge,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  SimpleGrid,
  Divider,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
  FormControl,
  FormLabel,
  FormHelperText,
  Select,
  Textarea,
  Switch,
  Spinner,
  Flex,
  Code,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  TableContainer,
} from '@chakra-ui/react';

const Setup = () => {
  const [loading, setLoading] = useState(false);
  const [systemStatus, setSystemStatus] = useState(null);
  const [error, setError] = useState('');
  const [setupProgress, setSetupProgress] = useState(0);
  const [setupLogs, setSetupLogs] = useState([]);
  const [setupConfig, setSetupConfig] = useState({
    numberOfUsers: 1080,
    imagesPerUser: 10,
    useRandomAssignment: true,
    setDistribution: 'balanced', // 'balanced', 'set1_only', 'set2_only'
    testMode: false,
    batchSize: 50 // Process users in batches to avoid timeouts
  });
  const [isGeneratingUsers, setIsGeneratingUsers] = useState(false);
  
  const navigate = useNavigate();
  const toast = useToast();

  // Add log entry
  const addLog = useCallback((message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setSetupLogs(prev => [...prev, {
      id: Date.now(),
      timestamp,
      message,
      type
    }]);
    console.log(`Setup [${timestamp}]:`, message);
  }, []);

  // Load system status - DEFINED BEFORE USE
  const loadSystemStatus = useCallback(async () => {
    try {
      setLoading(true);
      addLog('Loading system status...');
      
      // Check images in storage
      const set1Ref = ref(storage, 'set1');
      const set2Ref = ref(storage, 'set2');
      
      const [set1Files, set2Files] = await Promise.all([
        listAll(set1Ref).catch(() => ({ items: [] })),
        listAll(set2Ref).catch(() => ({ items: [] }))
      ]);
      
      const set1Count = set1Files.items.length;
      const set2Count = set2Files.items.length;
      const totalImages = set1Count + set2Count;
      
      addLog(`Found ${set1Count} images in set1, ${set2Count} images in set2`);
      
      // Check existing users
      const usersRef = collection(db, 'loginIDs');
      const usersSnapshot = await getDocs(usersRef);
      const totalUsers = usersSnapshot.size;
      
      // Count users by status
      let activeUsers = 0;
      let completedUsers = 0;
      let consentedUsers = 0;
      let demographicsCompletedUsers = 0;
      
      usersSnapshot.forEach(doc => {
        const userData = doc.data();
        if (userData.surveyCompleted) completedUsers++;
        else if (userData.hasConsented) {
          activeUsers++;
          consentedUsers++;
        }
        if (userData.demographicsCompleted) demographicsCompletedUsers++;
      });
      
      addLog(`Found ${totalUsers} existing users: ${completedUsers} completed, ${activeUsers} active`);
      
      setSystemStatus({
        images: {
          set1: set1Count,
          set2: set2Count,
          total: totalImages
        },
        users: {
          total: totalUsers,
          active: activeUsers,
          completed: completedUsers,
          consented: consentedUsers,
          demographicsCompleted: demographicsCompletedUsers
        },
        lastUpdated: new Date()
      });
      
      addLog('System status loaded successfully', 'success');
      
    } catch (error) {
      console.error('Setup: Error loading system status:', error);
      setError(`Failed to load system status: ${error.message}`);
      addLog(`Error loading system status: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [addLog]);

  // Initialize component
  useEffect(() => {
    const isAdmin = sessionStorage.getItem('isAdmin');
    const loginId = sessionStorage.getItem('userLoginId');
    
    if (isAdmin !== 'true' || loginId !== 'ADMIN') {
      console.log('Setup: Non-admin access attempt, redirecting...');
      navigate('/login');
      return;
    }
    
    addLog('Setup page initialized by admin');
    loadSystemStatus();
  }, [navigate, loadSystemStatus, addLog]);

  // Generate image assignments for a user
  const generateImageAssignment = useCallback((userIndex, totalUsers, availableImages) => {
    const { imagesPerUser, useRandomAssignment, setDistribution } = setupConfig;
    
    let candidateImages = [...availableImages];
    
    // Filter by set distribution
    if (setDistribution === 'set1_only') {
      candidateImages = candidateImages.filter(img => img.set === 'set1');
    } else if (setDistribution === 'set2_only') {
      candidateImages = candidateImages.filter(img => img.set === 'set2');
    }
    
    if (candidateImages.length < imagesPerUser) {
      throw new Error(`Not enough images available for assignment. Need ${imagesPerUser}, have ${candidateImages.length}`);
    }
    
    let selectedImages;
    
    if (useRandomAssignment) {
      // Random assignment
      const shuffled = [...candidateImages].sort(() => Math.random() - 0.5);
      selectedImages = shuffled.slice(0, imagesPerUser);
    } else {
      // Systematic assignment (ensures even distribution)
      const step = Math.floor(candidateImages.length / imagesPerUser);
      const startIndex = (userIndex * step) % candidateImages.length;
      
      selectedImages = [];
      for (let i = 0; i < imagesPerUser; i++) {
        const index = (startIndex + i * step) % candidateImages.length;
        selectedImages.push(candidateImages[index]);
      }
    }
    
    return selectedImages;
  }, [setupConfig]);

  // Generate all available images list
  const generateAvailableImages = useCallback(async () => {
    addLog('Generating available images list...');
    
    const set1Ref = ref(storage, 'set1');
    const set2Ref = ref(storage, 'set2');
    
    const [set1Files, set2Files] = await Promise.all([
      listAll(set1Ref),
      listAll(set2Ref)
    ]);
    
    const allImages = [];
    
    // Process set1 images
    set1Files.items.forEach(item => {
      const name = item.name;
      if (name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.jpeg')) {
        const numberMatch = name.match(/(\d+)/);
        const imageNumber = numberMatch ? parseInt(numberMatch[1]) : Math.random() * 10000;
        
        allImages.push({
          id: `set1_${imageNumber}`,
          name: name,
          set: 'set1',
          path: `set1/${name}`,
          number: imageNumber
        });
      }
    });
    
    // Process set2 images
    set2Files.items.forEach(item => {
      const name = item.name;
      if (name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.jpeg')) {
        const numberMatch = name.match(/(\d+)/);
        const imageNumber = numberMatch ? parseInt(numberMatch[1]) : Math.random() * 10000;
        
        allImages.push({
          id: `set2_${imageNumber}`,
          name: name,
          set: 'set2',
          path: `set2/${name}`,
          number: imageNumber
        });
      }
    });
    
    // Sort by set and number for consistent ordering
    allImages.sort((a, b) => {
      if (a.set !== b.set) return a.set.localeCompare(b.set);
      return a.number - b.number;
    });
    
    addLog(`Generated ${allImages.length} available images`);
    return allImages;
  }, [addLog]);

  // Generate multiple users in batches
  const generateUsers = useCallback(async () => {
    if (isGeneratingUsers) return;
    
    try {
      setIsGeneratingUsers(true);
      setSetupProgress(0);
      setSetupLogs([]);
      
      const { numberOfUsers, batchSize } = setupConfig;
      
      addLog(`Starting generation of ${numberOfUsers} users in batches of ${batchSize}...`);
      
      // Generate available images
      const availableImages = await generateAvailableImages();
      
      if (availableImages.length === 0) {
        throw new Error('No images found in storage. Please upload images first.');
      }
      
      addLog(`Using ${availableImages.length} available images for assignment`);
      
      // Process users in batches to avoid Firestore limits and timeouts
      const totalBatches = Math.ceil(numberOfUsers / batchSize);
      let totalCreated = 0;
      
      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const batchStart = batchIndex * batchSize;
        const batchEnd = Math.min(batchStart + batchSize, numberOfUsers);
        const batchUsers = batchEnd - batchStart;
        
        addLog(`Processing batch ${batchIndex + 1}/${totalBatches}: users ${batchStart + 1}-${batchEnd}`);
        
        // Create batch
        const batch = writeBatch(db);
        
        for (let userIndex = batchStart; userIndex < batchEnd; userIndex++) {
          // Generate unique user ID
          const userId = `USER_${String(userIndex + 1).padStart(4, '0')}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
          
          // Generate image assignment for this user
          const assignedImages = generateImageAssignment(userIndex, numberOfUsers, availableImages);
          
          // Create user document
          const userDoc = {
            id: userId,
            createdAt: serverTimestamp(),
            isTestUser: setupConfig.testMode,
            hasConsented: false,
            demographicsCompleted: false,
            surveyCompleted: false,
            assignedImages: assignedImages,
            totalImages: assignedImages.length,
            completedImages: 0,
            completedImageIds: [],
            userIndex: userIndex + 1,
            batchIndex: batchIndex + 1,
            setupConfig: {
              imagesPerUser: setupConfig.imagesPerUser,
              setDistribution: setupConfig.setDistribution,
              useRandomAssignment: setupConfig.useRandomAssignment
            }
          };
          
          // Add to batch
          const userRef = doc(db, 'loginIDs', userId);
          batch.set(userRef, userDoc);
        }
        
        // Commit batch
        await batch.commit();
        totalCreated += batchUsers;
        
        // Update progress
        const progress = Math.round((totalCreated / numberOfUsers) * 100);
        setSetupProgress(progress);
        
        addLog(`Batch ${batchIndex + 1} completed: ${batchUsers} users created (${totalCreated}/${numberOfUsers} total)`);
        
        // Brief pause between batches to avoid overwhelming Firestore
        if (batchIndex < totalBatches - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      addLog(`Successfully created ${totalCreated} users!`, 'success');
      
      toast({
        title: 'Users Generated Successfully',
        description: `Created ${totalCreated} users with image assignments`,
        status: 'success',
        duration: 5000,
      });
      
      // Reload system status
      await loadSystemStatus();
      
    } catch (error) {
      console.error('Setup: Error generating users:', error);
      addLog(`Error generating users: ${error.message}`, 'error');
      toast({
        title: 'Error Generating Users',
        description: error.message,
        status: 'error',
        duration: 8000,
      });
    } finally {
      setIsGeneratingUsers(false);
      setSetupProgress(0);
    }
  }, [setupConfig, isGeneratingUsers, generateImageAssignment, generateAvailableImages, addLog, toast, loadSystemStatus]);

  // Clear all users
  const clearAllUsers = useCallback(async () => {
    if (!window.confirm('Are you sure you want to delete ALL users? This cannot be undone!')) {
      return;
    }
    
    try {
      setLoading(true);
      addLog('Clearing all users...');
      
      const usersRef = collection(db, 'loginIDs');
      const snapshot = await getDocs(usersRef);
      
      const batches = [];
      let currentBatch = writeBatch(db);
      let operationCount = 0;
      
      snapshot.forEach((doc) => {
        // Skip admin user
        if (doc.id === 'ADMIN') return;
        
        currentBatch.delete(doc.ref);
        operationCount++;
        
        // Firestore batch limit is 500 operations
        if (operationCount === 450) {
          batches.push(currentBatch);
          currentBatch = writeBatch(db);
          operationCount = 0;
        }
      });
      
      // Add final batch if it has operations
      if (operationCount > 0) {
        batches.push(currentBatch);
      }
      
      // Commit all batches
      for (let i = 0; i < batches.length; i++) {
        await batches[i].commit();
        addLog(`Deleted batch ${i + 1}/${batches.length}`);
      }
      
      addLog(`Successfully deleted ${snapshot.size - 1} users`, 'success');
      
      toast({
        title: 'Users Cleared',
        description: 'All non-admin users have been deleted',
        status: 'success',
        duration: 3000,
      });
      
      await loadSystemStatus();
      
    } catch (error) {
      console.error('Setup: Error clearing users:', error);
      addLog(`Error clearing users: ${error.message}`, 'error');
      toast({
        title: 'Error Clearing Users',
        description: error.message,
        status: 'error',
        duration: 5000,
      });
    } finally {
      setLoading(false);
    }
  }, [addLog, toast, loadSystemStatus]);

  if (loading && !systemStatus) {
    return (
      <Flex minH="100vh" align="center" justify="center" bg="gray.50">
        <VStack spacing={4}>
          <Spinner size="xl" color="blue.500" />
          <Text>Loading system status...</Text>
        </VStack>
      </Flex>
    );
  }

  return (
    <Box minH="100vh" bg="gray.50">
      <Container maxW="6xl" py={6}>
        <VStack spacing={6}>
          {/* Header */}
          <Card w="full">
            <CardHeader>
              <HStack justify="space-between">
                <VStack align="start" spacing={1}>
                  <Heading size="lg">System Setup & Administration</Heading>
                  <HStack spacing={2}>
                    <Badge colorScheme="red">Admin Only</Badge>
                    <Badge colorScheme="blue">1080+ User Support</Badge>
                  </HStack>
                </VStack>
                <Button
                  colorScheme="gray"
                  variant="outline"
                  onClick={() => navigate('/admin')}
                >
                  ← Back to Dashboard
                </Button>
              </HStack>
            </CardHeader>
          </Card>

          {error && (
            <Alert status="error" w="full">
              <AlertIcon />
              {error}
            </Alert>
          )}

          {/* System Status */}
          {systemStatus && (
            <Card w="full">
              <CardHeader>
                <HStack justify="space-between">
                  <Heading size="md">System Status</Heading>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={loadSystemStatus}
                    isLoading={loading}
                  >
                    🔄 Refresh
                  </Button>
                </HStack>
              </CardHeader>
              <CardBody>
                <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={4}>
                  <Stat>
                    <StatLabel>Total Images</StatLabel>
                    <StatNumber>{systemStatus.images.total}</StatNumber>
                    <StatHelpText>
                      Set1: {systemStatus.images.set1} | Set2: {systemStatus.images.set2}
                    </StatHelpText>
                  </Stat>
                  
                  <Stat>
                    <StatLabel>Total Users</StatLabel>
                    <StatNumber>{systemStatus.users.total}</StatNumber>
                    <StatHelpText>
                      Active: {systemStatus.users.active} | Completed: {systemStatus.users.completed}
                    </StatHelpText>
                  </Stat>
                  
                  <Stat>
                    <StatLabel>Consented Users</StatLabel>
                    <StatNumber>{systemStatus.users.consented}</StatNumber>
                    <StatHelpText>
                      Have agreed to participate
                    </StatHelpText>
                  </Stat>
                  
                  <Stat>
                    <StatLabel>Demographics Complete</StatLabel>
                    <StatNumber>{systemStatus.users.demographicsCompleted}</StatNumber>
                    <StatHelpText>
                      Finished demographics survey
                    </StatHelpText>
                  </Stat>
                </SimpleGrid>
              </CardBody>
            </Card>
          )}

          {/* User Generation Configuration */}
          <Card w="full">
            <CardHeader>
              <Heading size="md">Generate Study Participants</Heading>
            </CardHeader>
            <CardBody>
              <VStack spacing={6}>
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6} w="full">
                  {/* Basic Configuration */}
                  <VStack spacing={4} align="stretch">
                    <FormControl>
                      <FormLabel>Number of Users</FormLabel>
                      <NumberInput
                        value={setupConfig.numberOfUsers}
                        onChange={(value) => setSetupConfig(prev => ({ ...prev, numberOfUsers: parseInt(value) || 1080 }))}
                        min={1}
                        max={5000}
                      >
                        <NumberInputField />
                        <NumberInputStepper>
                          <NumberIncrementStepper />
                          <NumberDecrementStepper />
                        </NumberInputStepper>
                      </NumberInput>
                      <FormHelperText>Recommended: 1080 for large-scale studies</FormHelperText>
                    </FormControl>

                    <FormControl>
                      <FormLabel>Images per User</FormLabel>
                      <NumberInput
                        value={setupConfig.imagesPerUser}
                        onChange={(value) => setSetupConfig(prev => ({ ...prev, imagesPerUser: parseInt(value) || 10 }))}
                        min={1}
                        max={50}
                      >
                        <NumberInputField />
                        <NumberInputStepper>
                          <NumberIncrementStepper />
                          <NumberDecrementStepper />
                        </NumberInputStepper>
                      </NumberInput>
                      <FormHelperText>How many images each user will evaluate</FormHelperText>
                    </FormControl>

                    <FormControl>
                      <FormLabel>Batch Size</FormLabel>
                      <NumberInput
                        value={setupConfig.batchSize}
                        onChange={(value) => setSetupConfig(prev => ({ ...prev, batchSize: parseInt(value) || 50 }))}
                        min={10}
                        max={100}
                      >
                        <NumberInputField />
                        <NumberInputStepper>
                          <NumberIncrementStepper />
                          <NumberDecrementStepper />
                        </NumberInputStepper>
                      </NumberInput>
                      <FormHelperText>Users processed per batch (prevents timeouts)</FormHelperText>
                    </FormControl>
                  </VStack>

                  {/* Advanced Configuration */}
                  <VStack spacing={4} align="stretch">
                    <FormControl>
                      <FormLabel>Set Distribution</FormLabel>
                      <Select
                        value={setupConfig.setDistribution}
                        onChange={(e) => setSetupConfig(prev => ({ ...prev, setDistribution: e.target.value }))}
                      >
                        <option value="balanced">Balanced (Both Sets)</option>
                        <option value="set1_only">Set 1 Only</option>
                        <option value="set2_only">Set 2 Only</option>
                      </Select>
                      <FormHelperText>Which image sets to include</FormHelperText>
                    </FormControl>

                    <FormControl display="flex" alignItems="center">
                      <FormLabel mb="0">Random Assignment</FormLabel>
                      <Switch
                        isChecked={setupConfig.useRandomAssignment}
                        onChange={(e) => setSetupConfig(prev => ({ ...prev, useRandomAssignment: e.target.checked }))}
                      />
                      <FormHelperText ml={3}>
                        {setupConfig.useRandomAssignment ? 'Random' : 'Systematic'} image assignment
                      </FormHelperText>
                    </FormControl>

                    <FormControl display="flex" alignItems="center">
                      <FormLabel mb="0">Test Mode</FormLabel>
                      <Switch
                        isChecked={setupConfig.testMode}
                        onChange={(e) => setSetupConfig(prev => ({ ...prev, testMode: e.target.checked }))}
                      />
                      <FormHelperText ml={3}>
                        Mark generated users as test users
                      </FormHelperText>
                    </FormControl>
                  </VStack>
                </SimpleGrid>

                <Divider />

                {/* Generation Summary */}
                <Card w="full" bg="blue.50">
                  <CardBody>
                    <VStack spacing={2}>
                      <Text fontWeight="bold">Generation Summary</Text>
                      <Text fontSize="sm">
                        Will create <strong>{setupConfig.numberOfUsers} users</strong>, each assigned <strong>{setupConfig.imagesPerUser} images</strong>
                      </Text>
                      <Text fontSize="sm">
                        Processing in batches of <strong>{setupConfig.batchSize}</strong> users 
                        ({Math.ceil(setupConfig.numberOfUsers / setupConfig.batchSize)} total batches)
                      </Text>
                      <Text fontSize="sm">
                        Assignment: <strong>{setupConfig.useRandomAssignment ? 'Random' : 'Systematic'}</strong> | 
                        Distribution: <strong>{setupConfig.setDistribution}</strong>
                      </Text>
                    </VStack>
                  </CardBody>
                </Card>

                {/* Action Buttons */}
                <HStack spacing={4} w="full" justify="center">
                  <Button
                    colorScheme="blue"
                    size="lg"
                    onClick={generateUsers}
                    isLoading={isGeneratingUsers}
                    loadingText={`Generating... ${setupProgress}%`}
                    isDisabled={!systemStatus || systemStatus.images.total === 0}
                  >
                    🚀 Generate {setupConfig.numberOfUsers} Users
                  </Button>
                  
                  <Button
                    colorScheme="red"
                    variant="outline"
                    size="lg"
                    onClick={clearAllUsers}
                    isDisabled={isGeneratingUsers || loading}
                  >
                    🗑️ Clear All Users
                  </Button>
                </HStack>

                {/* Progress Bar */}
                {isGeneratingUsers && (
                  <VStack spacing={2} w="full">
                    <Progress value={setupProgress} size="lg" colorScheme="blue" w="full" />
                    <Text fontSize="sm" color="blue.600">
                      {setupProgress}% Complete - Processing users in batches...
                    </Text>
                  </VStack>
                )}
              </VStack>
            </CardBody>
          </Card>

          {/* Setup Logs */}
          {setupLogs.length > 0 && (
            <Card w="full">
              <CardHeader>
                <HStack justify="space-between">
                  <Heading size="md">Setup Logs</Heading>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSetupLogs([])}
                  >
                    Clear Logs
                  </Button>
                </HStack>
              </CardHeader>
              <CardBody>
                <Box
                  maxH="300px"
                  overflowY="auto"
                  border="1px"
                  borderColor="gray.200"
                  borderRadius="md"
                  p={3}
                  bg="gray.50"
                >
                  <VStack spacing={1} align="stretch">
                    {setupLogs.map((log) => (
                      <HStack key={log.id} spacing={2} fontSize="sm">
                        <Text color="gray.500" minW="16">{log.timestamp}</Text>
                        <Badge
                          colorScheme={
                            log.type === 'error' ? 'red' :
                            log.type === 'success' ? 'green' : 'blue'
                          }
                          size="sm"
                        >
                          {log.type}
                        </Badge>
                        <Text>{log.message}</Text>
                      </HStack>
                    ))}
                  </VStack>
                </Box>
              </CardBody>
            </Card>
          )}
        </VStack>
      </Container>
    </Box>
  );
};

export default Setup;