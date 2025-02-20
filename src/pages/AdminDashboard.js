import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, doc, getDoc, writeBatch, serverTimestamp, updateDoc } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, auth, storage } from '../firebase/config';
import { initializeFirestore } from '../utils/firebaseSetup';
import { createBalancedAssignments, clearAllAssignments } from '../utils/assignmentSystem';
import DatabaseStats from '../components/DatabaseStats';

import {
  Container, Heading, Box, Text, Grid,
  Table, Thead, Tbody, Tr, Th, Td,
  Progress, Badge, HStack, Input, Button,
  Stat, StatLabel, StatNumber, StatGroup,
  Tabs, TabList, TabPanels, Tab, TabPanel,
  useToast, Flex, VStack, Spinner,
  AlertDialog, AlertDialogBody, AlertDialogFooter,
  AlertDialogHeader, AlertDialogContent, AlertDialogOverlay,
  Textarea, IconButton, useDisclosure,
} from '@chakra-ui/react';
import { EditIcon, CheckIcon, CloseIcon } from '@chakra-ui/icons';

const AdminDashboard = () => {
  const [imageStats, setImageStats] = useState([]);
  const [summary, setSummary] = useState({
    totalAssessments: 0,
    completedImages: 0,
    inProgressImages: 0
  });
  const [loginId, setLoginId] = useState('');
  const [loginIds, setLoginIds] = useState([]);
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [systemStatus, setSystemStatus] = useState({
    imageCount: 0,
    initialized: false
  });

  // Image management states
  const [editingImageId, setEditingImageId] = useState(null);
  const [editingPrompt, setEditingPrompt] = useState('');
  const [imageList, setImageList] = useState([]);
  const [uploadingImage, setUploadingImage] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const cancelRef = React.useRef();
  const navigate = useNavigate();
  const toast = useToast();

  // Image upload handler
  const handleImageUpload = async (imageId, file) => {
    if (!file || !imageId) return;

    try {
      setUploadingImage(imageId);
      setUploadProgress(0);

      // Validate file
      if (file.size > 5000000) { // 5MB limit
        throw new Error('File size too large. Please upload an image under 5MB.');
      }

      if (!file.type.includes('image/')) {
        throw new Error('Please upload an image file.');
      }

      // Create storage reference
      const imageRef = storageRef(storage, `artwork-images/${imageId}.jpg`);

      // Upload file
      await uploadBytes(imageRef, file);
      
      // Get download URL
      const downloadURL = await getDownloadURL(imageRef);

      // Update Firestore document
      await updateDoc(doc(db, 'images', imageId), {
        imageUrl: downloadURL,
        lastUpdated: serverTimestamp()
      });

      toast({
        title: 'Success',
        description: `Image ${imageId} uploaded successfully`,
        status: 'success',
        duration: 3000,
      });

      // Refresh image list
      await fetchImageData();

    } catch (error) {
      console.error('Error uploading image:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to upload image',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setUploadingImage(null);
      setUploadProgress(0);
    }
  };

  // Fetch image data
  const fetchImageData = async () => {
    try {
      const imagesRef = collection(db, 'images');
      const snapshot = await getDocs(imagesRef);
      const images = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => parseInt(a.id) - parseInt(b.id));
      setImageList(images);
    } catch (error) {
      console.error('Error fetching images:', error);
      toast({
        title: 'Error',
        description: 'Failed to load image data',
        status: 'error',
        duration: 3000,
      });
    }
  };

  // Handle prompt updates
  const handleUpdatePrompt = async (imageId) => {
    try {
      await updateDoc(doc(db, 'images', imageId), {
        prompt: editingPrompt.trim()
      });
      
      toast({
        title: 'Success',
        description: 'Prompt updated successfully',
        status: 'success',
        duration: 3000,
      });
      
      setEditingImageId(null);
      setEditingPrompt('');
      fetchImageData();
    } catch (error) {
      console.error('Error updating prompt:', error);
      toast({
        title: 'Error',
        description: 'Failed to update prompt',
        status: 'error',
        duration: 3000,
      });
    }
  };

  // Load image data on mount
  useEffect(() => {
    fetchImageData();
  }, []);

  // System status check
  const checkSystemStatus = useCallback(async () => {
    try {
      const imagesRef = collection(db, 'images');
      const snapshot = await getDocs(imagesRef);
      setSystemStatus({
        imageCount: snapshot.size,
        initialized: snapshot.size > 0
      });
    } catch (error) {
      console.error('Error checking system status:', error);
      toast({
        title: 'Error',
        description: 'Failed to check system status',
        status: 'error',
        duration: 3000,
      });
    }
  }, [toast]);

  // Fetch statistics
  const fetchStats = useCallback(async () => {
    try {
      const imagesRef = collection(db, 'images');
      const snapshot = await getDocs(imagesRef);
      const stats = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })).sort((a, b) => a.id.localeCompare(b.id, undefined, {numeric: true}));

      const summaryData = stats.reduce((acc, img) => ({
        totalAssessments: acc.totalAssessments + (img.totalAssessments || 0),
        completedImages: acc.completedImages + ((img.totalAssessments || 0) >= 12 ? 1 : 0),
        inProgressImages: acc.inProgressImages + (img.totalAssessments > 0 && img.totalAssessments < 12 ? 1 : 0)
      }), { totalAssessments: 0, completedImages: 0, inProgressImages: 0 });

      setImageStats(stats);
      setSummary(summaryData);
    } catch (error) {
      console.error('Error fetching stats:', error);
      toast({
        title: 'Error',
        description: 'Failed to load image statistics',
        status: 'error',
        duration: 3000,
      });
    }
  }, [toast]);

  // Fetch login IDs
  const fetchLoginIds = useCallback(async () => {
    try {
      const loginSnapshot = await getDocs(collection(db, 'loginIDs'));
      const progressSnapshot = await getDocs(collection(db, 'userProgress'));
      
      const progressMap = new Map();
      progressSnapshot.docs.forEach(doc => {
        progressMap.set(doc.id, doc.data());
      });
      
      const ids = loginSnapshot.docs.map(doc => {
        const loginData = doc.data();
        const progressData = progressMap.get(doc.id) || {};
        
        return {
          id: doc.id,
          loginId: doc.id,
          createdAt: loginData.createdAt,
          lastLogin: loginData.lastLogin,
          progress: progressData.progress || 0,
          completedImages: progressData.completedImages || {},
          isActive: loginData.isActive
        };
      });

      setLoginIds(ids);
    } catch (error) {
      console.error('Error fetching login IDs:', error);
      toast({
        title: 'Error',
        description: 'Failed to load evaluator data',
        status: 'error',
        duration: 3000,
      });
    }
  }, [toast]);

  // Auth check effect
  useEffect(() => {
    const checkAuthAndAdmin = async () => {
      setIsAuthChecking(true);
      try {
        console.log('Starting auth check...');
        
        const unsubscribe = auth.onAuthStateChanged(async (user) => {
          const loginId = sessionStorage.getItem('userLoginId');
          const isAdmin = sessionStorage.getItem('isAdmin');
  
          if (!user || loginId !== 'ADMIN' || !isAdmin) {
            console.log('Invalid admin session, redirecting to login');
            if (!window.location.pathname.includes('/login')) {
              sessionStorage.clear();
              navigate('/login');
            }
            return;
          }
  
          console.log('Admin authentication successful');
          setIsAuthChecking(false);
          setInitializing(false);
          
          try {
            await checkSystemStatus();
            await fetchStats();
            await fetchLoginIds();
            console.log('Dashboard initialization complete');
          } catch (error) {
            console.error('Error during dashboard initialization:', error);
          }
        });
  
        return () => unsubscribe();
      } catch (error) {
        console.error('Auth check error:', error);
        setIsAuthChecking(false);
        setInitializing(false);
        navigate('/login');
      }
    };
  
    checkAuthAndAdmin();
  }, [navigate, checkSystemStatus, fetchStats, fetchLoginIds]);

  // Handler functions
  const handleAddLoginId = async () => {
    if (!loginId.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a login ID',
        status: 'error',
        duration: 3000,
      });
      return;
    }
  
    try {
      const userPattern = /^EV25-\d{3}$/;
      if (!userPattern.test(loginId.trim())) {
        toast({
          title: 'Error',
          description: 'Login ID must be in format EV25-XXX (where X is a number)',
          status: 'error',
          duration: 3000,
        });
        return;
      }
  
      const batch = writeBatch(db);
      const newLoginId = loginId.trim();
  
      const loginRef = doc(db, 'loginIDs', newLoginId);
      const loginDoc = await getDoc(loginRef);
      
      if (loginDoc.exists()) {
        toast({
          title: 'Error',
          description: 'This Login ID already exists',
          status: 'error',
          duration: 3000,
        });
        return;
      }
  
      const timestamp = serverTimestamp();
  
      batch.set(loginRef, {
        createdAt: timestamp,
        lastLogin: null,
        isActive: true
      });
  
      const progressRef = doc(db, 'userProgress', newLoginId);
      batch.set(progressRef, {
        progress: 0,
        completedImages: {},
        assignedBatch: [],
        lastUpdated: timestamp
      });
  
      await batch.commit();
  
      toast({
        title: 'Success',
        description: 'Login ID added successfully',
        status: 'success',
        duration: 3000,
      });
  
      setLoginId('');
      fetchLoginIds();
    } catch (error) {
      console.error('Error adding login ID:', error);
      toast({
        title: 'Error',
        description: 'Failed to add login ID',
        status: 'error',
        duration: 3000,
      });
    }
  };

  const handleDeleteLoginId = async (loginId) => {
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, 'loginIDs', loginId));
      batch.delete(doc(db, 'userProgress', loginId));
      await batch.commit();
      
      toast({
        title: 'Success',
        description: 'Login ID deleted successfully',
        status: 'success',
        duration: 3000,
      });
      
      fetchLoginIds();
    } catch (error) {
      console.error('Error deleting login ID:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete login ID',
        status: 'error',
        duration: 3000,
      });
    }
  };

  const handleInitializeSystem = async () => {
    setIsLoading(true);
    try {
      await initializeFirestore();
      toast({
        title: 'Success',
        description: 'System initialized with 300 images',
        status: 'success',
        duration: 5000,
      });
      await checkSystemStatus();
      await fetchStats();
    } catch (error) {
      toast({
        title: 'Error',
        description: error.message,
        status: 'error',
        duration: 5000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateAssignments = async () => {
    setIsLoading(true);
    try {
      await createBalancedAssignments();
      toast({
        title: 'Success',
        description: 'Created balanced assignments for all users',
        status: 'success',
        duration: 5000,
      });
      await fetchStats();
    } catch (error) {
      toast({
        title: 'Error',
        description: error.message,
        status: 'error',
        duration: 5000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetSystem = async () => {
    setIsLoading(true);
    try {
      await clearAllAssignments();
      toast({
        title: 'Success',
        description: 'System reset successfully',
        status: 'success',
        duration: 5000,
      });
      await fetchStats();
      setIsResetDialogOpen(false);
    } catch (error) {
      toast({
        title: 'Error',
        description: error.message,
        status: 'error',
        duration: 5000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogoutConfirm = () => {
    sessionStorage.clear();
    auth.signOut();
    navigate('/login');
  };

  const getProgressColor = (assessments) => {
    if (assessments >= 12) return "green";
    if (assessments >= 6) return "yellow";
    if (assessments > 0) return "orange";
    return "red";
  };

  // Preview image function (optional)
  const handleImagePreview = async (imageId) => {
    try {
      const imageRef = storageRef(storage, `artwork-images/${imageId}.jpg`);
      const url = await getDownloadURL(imageRef);
      // You could store this URL in state and show it in a modal
      return url;
    } catch (error) {
      console.error('Error getting image URL:', error);
      return null;
    }
  };

  if (isAuthChecking || isLoading || initializing) {
    return (
      <Flex minH="100vh" align="center" justify="center">
        <VStack spacing={4}>
          <Spinner size="xl" />
          <Text>Loading dashboard...</Text>
        </VStack>
      </Flex>
    );
  }


  return (
    <Container maxW="container.xl" py={6}>
      <Flex justifyContent="space-between" alignItems="center" mb={6}>
        <Heading>Admin Dashboard</Heading>
        <Button colorScheme="red" onClick={() => setIsLogoutDialogOpen(true)}>
          Logout
        </Button>
      </Flex>

      <Tabs>
        <TabList>
          <Tab>Image Statistics</Tab>
          <Tab>User Management</Tab>
          <Tab>System Controls</Tab>
          <Tab>Image Management</Tab>
        </TabList>
        
        <TabPanels>
          {/* Image Statistics Panel */}
          <TabPanel>
            <Box mb={8}>
              <DatabaseStats />
            </Box>

            <StatGroup mb={8}>
              <Stat>
                <StatLabel>Total Assessments</StatLabel>
                <StatNumber>{summary.totalAssessments}</StatNumber>
              </Stat>
              <Stat>
                <StatLabel>Completed Images</StatLabel>
                <StatNumber>{summary.completedImages}</StatNumber>
              </Stat>
              <Stat>
                <StatLabel>In Progress</StatLabel>
                <StatNumber>{summary.inProgressImages}</StatNumber>
              </Stat>
            </StatGroup>

            <Box>
              <Heading size="md" mb={4}>Detailed Image Progress</Heading>
              <Grid templateColumns="repeat(auto-fill, minmax(250px, 1fr))" gap={4} mb={8}>
                {imageStats.map(img => (
                  <Box key={img.id} p={4} borderWidth="1px" borderRadius="lg" bg="white">
                    <HStack justify="space-between" mb={2}>
                      <Text fontWeight="bold">Image {img.id}</Text>
                      <Badge colorScheme={getProgressColor(img.totalAssessments || 0)} variant="solid">
                        {img.totalAssessments || 0}/12
                      </Badge>
                    </HStack>
                    <Progress 
                      value={((img.totalAssessments || 0) / 12) * 100}
                      colorScheme={getProgressColor(img.totalAssessments || 0)}
                      size="sm"
                      borderRadius="full"
                    />
                  </Box>
                ))}
              </Grid>
            </Box>
          </TabPanel>

          {/* User Management Panel */}
          <TabPanel>
            <VStack spacing={8} align="stretch">
              <Box p={6} bg="white" rounded="md" shadow="sm">
                <VStack spacing={4}>
                  <Text fontSize="lg" fontWeight="bold">Add New Login ID</Text>
                  <HStack w="full">
                    <Input 
                      placeholder="EV25-XXX"
                      value={loginId}
                      onChange={(e) => setLoginId(e.target.value.toUpperCase())}
                      pattern="EV25-\d{3}"
                    />
                    <Button colorScheme="blue" onClick={handleAddLoginId}>
                      Add
                    </Button>
                  </HStack>
                </VStack>
              </Box>

              <Box p={6} bg="white" rounded="md" shadow="sm">
                <Text fontSize="lg" fontWeight="bold" mb={4}>Existing Login IDs</Text>
                <Table variant="simple">
                  <Thead>
                    <Tr>
                      <Th>Login ID</Th>
                      <Th>Created At</Th>
                      <Th>Last Login</Th>
                      <Th>Progress</Th>
                      <Th>Actions</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {loginIds.map((item) => (
                      <Tr key={item.id}>
                        <Td>{item.loginId}</Td>
                        <Td>
                          {item.createdAt 
                            ? (item.createdAt.toDate 
                                ? item.createdAt.toDate().toLocaleDateString() 
                                : new Date(item.createdAt).toLocaleDateString())
                            : 'N/A'}
                        </Td>
                        <Td>
                          {item.lastLogin 
                            ? (item.lastLogin.toDate 
                                ? item.lastLogin.toDate().toLocaleDateString() 
                                : new Date(item.lastLogin).toLocaleDateString())
                            : 'Never'}
                        </Td>
                        <Td>
                          {item.progress || 0}/12 images
                          {item.progress > 0 && (
                            <Progress
                              value={(item.progress / 12) * 100}
                              size="sm"
                              colorScheme={item.progress === 12 ? "green" : "blue"}
                              mt={1}
                            />
                          )}
                        </Td>
                        <Td>
                          <Button
                            colorScheme="red"
                            size="sm"
                            onClick={() => handleDeleteLoginId(item.id)}
                          >
                            Delete
                          </Button>
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </Box>
            </VStack>
          </TabPanel>

          {/* System Controls Panel */}
          <TabPanel>
            <Box p={6} bg="white" rounded="md" shadow="sm">
              <VStack spacing={6} align="stretch">
                <Heading size="md">System Controls</Heading>
                
                {/* System Status Section */}
                <Box p={4} borderWidth="1px" borderRadius="lg" bg="gray.50">
                  <Text fontWeight="bold" mb={2}>Current System Status:</Text>
                  <HStack spacing={6}>
                    <Stat>
                      <StatLabel>Images in Firestore</StatLabel>
                      <StatNumber>{systemStatus.imageCount}</StatNumber>
                      <StatLabel fontSize="sm" color={systemStatus.imageCount === 300 ? "green.500" : "orange.500"}>
                        {systemStatus.imageCount === 300 
                          ? "✓ Correct number of images" 
                          : systemStatus.imageCount > 0 
                            ? "⚠️ Incomplete image set"
                            : "No images found"}
                      </StatLabel>
                    </Stat>
                    <Stat>
                      <StatLabel>System Status</StatLabel>
                      <StatNumber>{systemStatus.initialized ? "Initialized" : "Not Initialized"}</StatNumber>
                      <StatLabel fontSize="sm" color={systemStatus.initialized ? "green.500" : "red.500"}>
                        {systemStatus.initialized ? "✓ Ready" : "Needs initialization"}
                      </StatLabel>
                    </Stat>
                  </HStack>
                </Box>

                <Box>
                  <Text mb={2} fontWeight="bold">Initialize Image System</Text>
                  <Button
                    colorScheme="blue"
                    onClick={handleInitializeSystem}
                    isLoading={isLoading}
                    isDisabled={systemStatus.imageCount === 300}
                    width="full"
                  >
                    Initialize System with 300 Images
                  </Button>
                  <Text fontSize="sm" color="gray.600" mt={1}>
                    {systemStatus.imageCount === 300 
                      ? "System is fully initialized" 
                      : `Current image count: ${systemStatus.imageCount}/300`}
                  </Text>
                </Box>

                <Box>
                  <Text mb={2} fontWeight="bold">Create Assignments</Text>
                  <Button
                    colorScheme="green"
                    onClick={handleCreateAssignments}
                    isLoading={isLoading}
                    isDisabled={systemStatus.imageCount !== 300}
                    width="full"
                  >
                    Create Balanced Assignments
                  </Button>
                  <Text fontSize="sm" color="gray.600" mt={1}>
                    Assign 12 images to each evaluator ensuring equal distribution
                  </Text>
                </Box>

                <Box>
                  <Text mb={2} fontWeight="bold">Reset System</Text>
                  <Button
                    colorScheme="red"
                    onClick={() => setIsResetDialogOpen(true)}
                    isLoading={isLoading}
                    width="full"
                  >
                    Reset All Assignments
                  </Button>
                  <Text fontSize="sm" color="gray.600" mt={1}>
                    Clear all assignments and progress data
                  </Text>
                </Box>
              </VStack>
            </Box>
          </TabPanel>

          {/* Image Management Panel */}
          <TabPanel>
            <Box p={6} bg="white" rounded="md" shadow="sm">
              <VStack spacing={6} align="stretch">
                <Heading size="md">Image & Prompt Management</Heading>
                
                <Box overflowX="auto">
                  <Table variant="simple">
                    <Thead>
                      <Tr>
                        <Th>Image ID</Th>
                        <Th>Image</Th>
                        <Th>Prompt</Th>
                        <Th width="150px">Actions</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {imageList.map((image) => (
                        <Tr key={image.id}>
                          <Td>Image {image.id}</Td>
                          <Td width="200px">
                            <VStack spacing={2} align="start">
                              <Input
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleImageUpload(image.id, e.target.files[0])}
                                display="none"
                                id={`file-upload-${image.id}`}
                              />
                              <Button
                                as="label"
                                htmlFor={`file-upload-${image.id}`}
                                size="sm"
                                colorScheme="teal"
                                cursor="pointer"
                                isLoading={uploadingImage === image.id}
                                leftIcon={<EditIcon />}
                                width="full"
                              >
                                {image.imageUrl ? 'Replace Image' : 'Upload Image'}
                              </Button>
                              {uploadingImage === image.id && (
                                <Progress 
                                  size="xs" 
                                  isIndeterminate 
                                  width="full" 
                                  colorScheme="teal" 
                                />
                              )}
                            </VStack>
                          </Td>
                          <Td>
                            {editingImageId === image.id ? (
                              <Textarea
                                value={editingPrompt}
                                onChange={(e) => setEditingPrompt(e.target.value)}
                                size="sm"
                                rows={3}
                              />
                            ) : (
                              <Text>{image.prompt || 'No prompt set'}</Text>
                            )}
                          </Td>
                          <Td>
                            {editingImageId === image.id ? (
                              <HStack spacing={2}>
                                <IconButton
                                  icon={<CheckIcon />}
                                  colorScheme="green"
                                  size="sm"
                                  onClick={() => handleUpdatePrompt(image.id)}
                                />
                                <IconButton
                                  icon={<CloseIcon />}
                                  colorScheme="red"
                                  size="sm"
                                  onClick={() => {
                                    setEditingImageId(null);
                                    setEditingPrompt('');
                                  }}
                                />
                              </HStack>
                            ) : (
                              <IconButton
                                icon={<EditIcon />}
                                colorScheme="blue"
                                size="sm"
                                onClick={() => {
                                  setEditingImageId(image.id);
                                  setEditingPrompt(image.prompt || '');
                                }}
                              />
                            )}
                          </Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                </Box>
              </VStack>
            </Box>
          </TabPanel>
        </TabPanels>
      </Tabs>

      {/* Logout Confirmation Dialog */}
      <AlertDialog
        isOpen={isLogoutDialogOpen}
        leastDestructiveRef={cancelRef}
        onClose={() => setIsLogoutDialogOpen(false)}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Confirm Logout
            </AlertDialogHeader>

            <AlertDialogBody>
              Are you sure you want to logout?
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={() => setIsLogoutDialogOpen(false)}>
                Cancel
              </Button>
              <Button colorScheme="red" onClick={handleLogoutConfirm} ml={3}>
                Logout
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>

      {/* Reset System Confirmation Dialog */}
      <AlertDialog
        isOpen={isResetDialogOpen}
        leastDestructiveRef={cancelRef}
        onClose={() => setIsResetDialogOpen(false)}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Reset System
            </AlertDialogHeader>

            <AlertDialogBody>
              Are you sure? This will clear all assignments and progress data.
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={() => setIsResetDialogOpen(false)}>
                Cancel
              </Button>
              <Button colorScheme="red" onClick={handleResetSystem} ml={3}>
                Reset
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </Container>
  );
};

export default AdminDashboard;