// src/pages/AdminDashboard.js - Fixed version without problematic imports
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import {
  Box,
  Container,
  Heading,
  VStack,
  HStack,
  Text,
  Button,
  Card,
  CardBody,
  CardHeader,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  SimpleGrid,
  Badge,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  TableContainer,
  useToast,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Spinner,
  Flex,
  Progress,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
  UnorderedList,
  ListItem,
  InputGroup,
  InputLeftElement,
  Input,
  Select,
  Textarea,
  Code
} from '@chakra-ui/react';

// Import your utilities
import { fixAllUserAssignments } from '../utils/fixUserAssignments';
import { 
  getAssignmentStats, 
  resetImageAssignments, 
  verifySetup, 
  clearAllData 
} from '../utils/firebaseSetup';

const AdminDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState({
    totalUsers: 0,
    completedSurveys: 0,
    activeUsers: 0,
    testUsers: 0,
    prolificUsers: 0,
    totalImages: 0,
    assignedImages: 0,
    averageCompletion: 0
  });
  const [imageStats, setImageStats] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [prolificUrl, setProlificUrl] = useState('');

  const { isOpen: isUserModalOpen, onOpen: onUserModalOpen, onClose: onUserModalClose } = useDisclosure();
  const { isOpen: isStatsModalOpen, onOpen: onStatsModalOpen, onClose: onStatsModalClose } = useDisclosure();
  const { isOpen: isProlificModalOpen, onOpen: onProlificModalOpen, onClose: onProlificModalClose } = useDisclosure();

  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => {
    const isAdmin = sessionStorage.getItem('isAdmin');
    const loginId = sessionStorage.getItem('userLoginId');
    
    if (!isAdmin || loginId !== 'ADMIN') {
      toast({
        title: 'Access Denied',
        description: 'Admin credentials required',
        status: 'error',
        duration: 3000,
      });
      navigate('/login');
      return;
    }
    
    loadDashboardData();
    generateProlificUrl();
  }, [navigate, toast]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      console.log('Loading admin dashboard data...');
      
      // Load users
      const usersRef = collection(db, 'loginIDs');
      const usersSnapshot = await getDocs(usersRef);
      
      const usersData = [];
      let completedCount = 0;
      let activeCount = 0;
      let testCount = 0;
      let prolificCount = 0;
      let totalAssignedImages = 0;
      let totalCompletedImages = 0;
      
      usersSnapshot.forEach(doc => {
        const userData = doc.data();
        const userId = doc.id;
        
        // Skip admin user
        if (userId === 'ADMIN') return;
        
        const isTest = userData.source === 'test' || userData.prolificData?.isTestUser || userId.includes('TEST');
        const isProlific = userData.source === 'prolific' && !isTest;
        const isCompleted = userData.surveyCompleted || false;
        const isActive = userData.isActive !== false;
        
        usersData.push({
          id: userId,
          displayId: userData.displayId || userId,
          ...userData,
          isTest,
          isProlific,
          isCompleted,
          isActive,
          completedImages: userData.completedImages || 0,
          totalImages: userData.assignedImages?.length || 0,
          completionPercentage: userData.assignedImages?.length > 0 
            ? Math.round((userData.completedImages || 0) / userData.assignedImages.length * 100)
            : 0
        });
        
        if (isCompleted) completedCount++;
        if (isActive) activeCount++;
        if (isTest) testCount++;
        if (isProlific) prolificCount++;
        
        totalAssignedImages += userData.assignedImages?.length || 0;
        totalCompletedImages += userData.completedImages || 0;
      });
      
      // Sort users by creation date (newest first)
      usersData.sort((a, b) => {
        const dateA = a.createdAt?.toDate?.() || new Date(0);
        const dateB = b.createdAt?.toDate?.() || new Date(0);
        return dateB - dateA;
      });
      
      setUsers(usersData);
      
      // Calculate average completion rate
      const averageCompletion = usersData.length > 0 
        ? Math.round(totalCompletedImages / Math.max(totalAssignedImages, 1) * 100)
        : 0;
      
      setStats({
        totalUsers: usersData.length,
        completedSurveys: completedCount,
        activeUsers: activeCount,
        testUsers: testCount,
        prolificUsers: prolificCount,
        totalImages: totalAssignedImages,
        assignedImages: totalAssignedImages,
        averageCompletion
      });
      
      // Load image assignment statistics
      try {
        const assignmentStats = await getAssignmentStats();
        setImageStats(assignmentStats);
      } catch (error) {
        console.warn('Could not load image statistics:', error);
      }
      
      console.log('Dashboard data loaded:', {
        users: usersData.length,
        stats
      });
      
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      setError(error.message);
      toast({
        title: 'Error Loading Dashboard',
        description: error.message,
        status: 'error',
        duration: 5000,
      });
    } finally {
      setLoading(false);
    }
  };

  const generateProlificUrl = () => {
    const baseUrl = window.location.origin;
    const prolificParams = new URLSearchParams({
      PROLIFIC_PID: '{{%PROLIFIC_PID%}}',
      STUDY_ID: '{{%STUDY_ID%}}',
      SESSION_ID: '{{%SESSION_ID%}}'
    });
    
    const fullUrl = `${baseUrl}/login?${prolificParams.toString()}`;
    setProlificUrl(fullUrl);
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm(`Are you sure you want to delete user ${userId}? This cannot be undone.`)) {
      return;
    }
    
    try {
      await deleteDoc(doc(db, 'loginIDs', userId));
      
      toast({
        title: 'User Deleted',
        description: `User ${userId} has been removed`,
        status: 'success',
        duration: 3000,
      });
      
      // Reload data
      loadDashboardData();
    } catch (error) {
      console.error('Error deleting user:', error);
      toast({
        title: 'Delete Failed',
        description: error.message,
        status: 'error',
        duration: 5000,
      });
    }
  };

  const handleFixAssignments = async () => {
    if (!window.confirm('Fix all user image assignments? This will update image paths for users with old format names.')) {
      return;
    }
    
    try {
      setLoading(true);
      
      toast({
        title: 'Fixing Assignments',
        description: 'This may take a few minutes...',
        status: 'info',
        duration: 3000,
      });
      
      const result = await fixAllUserAssignments();
      
      toast({
        title: 'Assignment Fix Complete',
        description: `Fixed ${result.successful}/${result.total} users`,
        status: result.failed > 0 ? 'warning' : 'success',
        duration: 5000,
      });
      
      // Reload data
      loadDashboardData();
    } catch (error) {
      console.error('Error fixing assignments:', error);
      toast({
        title: 'Fix Failed',
        description: error.message,
        status: 'error',
        duration: 5000,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResetAssignments = async () => {
    if (!window.confirm('Reset all image assignment counts? This will reset the tracking of how many times each image has been assigned.')) {
      return;
    }
    
    try {
      await resetImageAssignments();
      
      toast({
        title: 'Assignments Reset',
        description: 'Image assignment counts have been reset',
        status: 'success',
        duration: 3000,
      });
      
      loadDashboardData();
    } catch (error) {
      console.error('Error resetting assignments:', error);
      toast({
        title: 'Reset Failed',
        description: error.message,
        status: 'error',
        duration: 5000,
      });
    }
  };

  const handleClearAllData = async () => {
    if (!window.confirm('WARNING: This will delete ALL user data except admin. This cannot be undone! Type "DELETE" to confirm.')) {
      return;
    }
    
    const confirmation = prompt('Type "DELETE" to confirm:');
    if (confirmation !== 'DELETE') {
      return;
    }
    
    try {
      await clearAllData();
      
      toast({
        title: 'Data Cleared',
        description: 'All user data has been removed',
        status: 'success',
        duration: 3000,
      });
      
      loadDashboardData();
    } catch (error) {
      console.error('Error clearing data:', error);
      toast({
        title: 'Clear Failed',
        description: error.message,
        status: 'error',
        duration: 5000,
      });
    }
  };

  const handleLogout = () => {
    sessionStorage.clear();
    toast({
      title: 'Logged Out',
      description: 'Admin session ended',
      status: 'info',
      duration: 2000,
    });
    navigate('/login');
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied',
      description: 'Text copied to clipboard',
      status: 'success',
      duration: 2000,
    });
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = searchTerm === '' || 
      user.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.displayId && user.displayId.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesFilter = filterType === 'all' ||
      (filterType === 'test' && user.isTest) ||
      (filterType === 'prolific' && user.isProlific) ||
      (filterType === 'completed' && user.isCompleted) ||
      (filterType === 'active' && user.isActive);
    
    return matchesSearch && matchesFilter;
  });

  const openUserDetails = (user) => {
    setSelectedUser(user);
    onUserModalOpen();
  };

  if (loading && users.length === 0) {
    return (
      <Flex minH="100vh" align="center" justify="center">
        <VStack spacing={4}>
          <Spinner size="xl" color="blue.500" />
          <Text>Loading admin dashboard...</Text>
        </VStack>
      </Flex>
    );
  }

  return (
    <Box minH="100vh" bg="gray.50">
      {/* Header */}
      <Box bg="white" borderBottom="1px" borderColor="gray.200" py={4}>
        <Container maxW="7xl">
          <HStack justify="space-between">
            <HStack spacing={3}>
              <Text fontSize="2xl">🛡️</Text>
              <VStack align="start" spacing={0}>
                <Heading size="lg">Admin Dashboard</Heading>
                <Text fontSize="sm" color="gray.600">
                  Image Evaluation Study Management
                </Text>
              </VStack>
            </HStack>
            
            <HStack spacing={3}>
              <Button
                colorScheme="blue"
                variant="outline"
                onClick={() => navigate('/setup')}
              >
                🔧 System Setup
              </Button>
              <Button
                colorScheme="green"
                variant="outline"
                onClick={onProlificModalOpen}
              >
                🔗 Prolific URL
              </Button>
              <Button
                colorScheme="red"
                variant="outline"
                onClick={handleLogout}
              >
                🚪 Logout
              </Button>
            </HStack>
          </HStack>
        </Container>
      </Box>

      <Container maxW="7xl" py={6}>
        {error && (
          <Alert status="error" mb={6}>
            <AlertIcon />
            <AlertTitle>Dashboard Error:</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Statistics Overview */}
        <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={6} mb={8}>
          <Card>
            <CardBody>
              <Stat>
                <StatLabel>Total Participants</StatLabel>
                <StatNumber>{stats.totalUsers}</StatNumber>
                <StatHelpText>
                  <HStack spacing={1}>
                    <Badge colorScheme="blue" size="sm">{stats.prolificUsers} Prolific</Badge>
                    <Badge colorScheme="orange" size="sm">{stats.testUsers} Test</Badge>
                  </HStack>
                </StatHelpText>
              </Stat>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <Stat>
                <StatLabel>Completed Studies</StatLabel>
                <StatNumber>{stats.completedSurveys}</StatNumber>
                <StatHelpText>
                  {stats.totalUsers > 0 ? Math.round((stats.completedSurveys / stats.totalUsers) * 100) : 0}% completion rate
                </StatHelpText>
              </Stat>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <Stat>
                <StatLabel>Image Evaluations</StatLabel>
                <StatNumber>{stats.averageCompletion}%</StatNumber>
                <StatHelpText>Average completion rate</StatHelpText>
              </Stat>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <Stat>
                <StatLabel>Active Users</StatLabel>
                <StatNumber>{stats.activeUsers}</StatNumber>
                <StatHelpText>Currently participating</StatHelpText>
              </Stat>
            </CardBody>
          </Card>
        </SimpleGrid>

        {/* Management Actions */}
        <Card mb={6}>
          <CardHeader>
            <Heading size="md">Management Actions</Heading>
          </CardHeader>
          <CardBody>
            <HStack spacing={4} wrap="wrap">
              <Button
                colorScheme="blue"
                onClick={loadDashboardData}
                isLoading={loading}
              >
                🔄 Refresh Data
              </Button>
              
              <Button
                colorScheme="orange"
                variant="outline"
                onClick={handleFixAssignments}
              >
                🔧 Fix User Assignments
              </Button>
              
              <Button
                colorScheme="purple"
                variant="outline"
                onClick={onStatsModalOpen}
              >
                📊 Image Statistics
              </Button>
              
              <Button
                colorScheme="yellow"
                variant="outline"
                onClick={handleResetAssignments}
              >
                🔄 Reset Assignment Counts
              </Button>
              
              <Button
                colorScheme="red"
                variant="outline"
                onClick={handleClearAllData}
              >
                🗑️ Clear All Data
              </Button>
            </HStack>
          </CardBody>
        </Card>

        {/* User Management */}
        <Card>
          <CardHeader>
            <HStack justify="space-between">
              <Heading size="md">Participant Management</Heading>
              <HStack spacing={3}>
                <InputGroup maxW="300px">
                  <InputLeftElement>
                    <Text>🔍</Text>
                  </InputLeftElement>
                  <Input
                    placeholder="Search users..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </InputGroup>
                
                <Select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  maxW="150px"
                >
                  <option value="all">All Users</option>
                  <option value="prolific">Prolific</option>
                  <option value="test">Test</option>
                  <option value="completed">Completed</option>
                  <option value="active">Active</option>
                </Select>
              </HStack>
            </HStack>
          </CardHeader>
          <CardBody>
            <TableContainer>
              <Table variant="simple" size="sm">
                <Thead>
                  <Tr>
                    <Th>User ID</Th>
                    <Th>Type</Th>
                    <Th>Progress</Th>
                    <Th>Status</Th>
                    <Th>Created</Th>
                    <Th>Actions</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {filteredUsers.map(user => (
                    <Tr key={user.id}>
                      <Td>
                        <VStack align="start" spacing={0}>
                          <Text fontSize="sm" fontFamily="mono">
                            {user.id.length > 20 ? `${user.id.substring(0, 20)}...` : user.id}
                          </Text>
                          {user.displayId && user.displayId !== user.id && (
                            <Text fontSize="xs" color="gray.500" fontFamily="mono">
                              {user.displayId}
                            </Text>
                          )}
                        </VStack>
                      </Td>
                      <Td>
                        <HStack spacing={1}>
                          {user.isTest && <Badge colorScheme="orange" size="sm">Test</Badge>}
                          {user.isProlific && <Badge colorScheme="blue" size="sm">Prolific</Badge>}
                          {!user.isTest && !user.isProlific && <Badge colorScheme="gray" size="sm">Direct</Badge>}
                        </HStack>
                      </Td>
                      <Td>
                        <VStack align="start" spacing={1}>
                          <Text fontSize="sm">
                            {user.completedImages}/{user.totalImages} images
                          </Text>
                          <Progress
                            value={user.completionPercentage}
                            size="sm"
                            colorScheme={user.completionPercentage === 100 ? "green" : "blue"}
                            w="100px"
                          />
                        </VStack>
                      </Td>
                      <Td>
                        <VStack align="start" spacing={0}>
                          {user.isCompleted ? (
                            <Badge colorScheme="green">
                              ✅ Completed
                            </Badge>
                          ) : (
                            <Badge colorScheme={user.isActive ? "blue" : "gray"}>
                              {user.isActive ? "🔄 Active" : "⏸️ Inactive"}
                            </Badge>
                          )}
                        </VStack>
                      </Td>
                      <Td>
                        <Text fontSize="xs" color="gray.600">
                          {user.createdAt?.toDate?.()?.toLocaleDateString() || 'Unknown'}
                        </Text>
                      </Td>
                      <Td>
                        <HStack spacing={1}>
                          <Button
                            size="xs"
                            onClick={() => openUserDetails(user)}
                          >
                            👁️ View
                          </Button>
                          <Button
                            size="xs"
                            colorScheme="red"
                            variant="outline"
                            onClick={() => handleDeleteUser(user.id)}
                          >
                            🗑️ Delete
                          </Button>
                        </HStack>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </TableContainer>
            
            {filteredUsers.length === 0 && (
              <Text textAlign="center" py={8} color="gray.500">
                No users found matching your criteria
              </Text>
            )}
          </CardBody>
        </Card>
      </Container>

      {/* User Details Modal */}
      <Modal isOpen={isUserModalOpen} onClose={onUserModalClose} size="xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>User Details</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            {selectedUser && (
              <VStack spacing={4} align="start">
                <SimpleGrid columns={2} spacing={4} w="full">
                  <Box>
                    <Text fontWeight="bold" mb={1}>Internal ID:</Text>
                    <Code fontSize="xs">{selectedUser.id}</Code>
                  </Box>
                  <Box>
                    <Text fontWeight="bold" mb={1}>Display ID:</Text>
                    <Code fontSize="xs">{selectedUser.displayId || 'N/A'}</Code>
                  </Box>
                  <Box>
                    <Text fontWeight="bold" mb={1}>Progress:</Text>
                    <Text>{selectedUser.completedImages}/{selectedUser.totalImages} images ({selectedUser.completionPercentage}%)</Text>
                  </Box>
                  <Box>
                    <Text fontWeight="bold" mb={1}>Status:</Text>
                    <Badge colorScheme={selectedUser.isCompleted ? "green" : "blue"}>
                      {selectedUser.isCompleted ? "Completed" : "In Progress"}
                    </Badge>
                  </Box>
                </SimpleGrid>
                
                {selectedUser.prolificData && (
                  <Box w="full">
                    <Text fontWeight="bold" mb={2}>Prolific Data:</Text>
                    <Box bg="gray.50" p={3} borderRadius="md">
                      <VStack align="start" spacing={1}>
                        <Text fontSize="sm">PID: <Code fontSize="xs">{selectedUser.prolificData.prolificPid}</Code></Text>
                        <Text fontSize="sm">Study ID: <Code fontSize="xs">{selectedUser.prolificData.studyId}</Code></Text>
                        <Text fontSize="sm">Session ID: <Code fontSize="xs">{selectedUser.prolificData.sessionId}</Code></Text>
                      </VStack>
                    </Box>
                  </Box>
                )}
                
                {selectedUser.assignedImages && (
                  <Box w="full">
                    <Text fontWeight="bold" mb={2}>Assigned Images:</Text>
                    <Box maxH="200px" overflowY="auto">
                      <UnorderedList spacing={1}>
                        {selectedUser.assignedImages.map((img, idx) => (
                          <ListItem key={idx} fontSize="sm">
                            <Code fontSize="xs">{img.id || img.name}</Code> - {img.set}
                            {selectedUser.completedImageIds?.includes(img.id || img.name) && (
                              <Badge ml={2} colorScheme="green" size="sm">Completed</Badge>
                            )}
                          </ListItem>
                        ))}
                      </UnorderedList>
                    </Box>
                  </Box>
                )}
              </VStack>
            )}
          </ModalBody>
          <ModalFooter>
            <Button onClick={onUserModalClose}>Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Image Statistics Modal */}
      <Modal isOpen={isStatsModalOpen} onClose={onStatsModalClose} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Image Assignment Statistics</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            {imageStats ? (
              <VStack spacing={6}>
                <SimpleGrid columns={2} spacing={6} w="full">
                  <Card>
                    <CardHeader>
                      <Heading size="sm">Set 1 (Images 1-1200)</Heading>
                    </CardHeader>
                    <CardBody>
                      <VStack spacing={2} align="start">
                        {Object.entries(imageStats.set1 || {}).map(([assignments, count]) => (
                          <HStack key={assignments} justify="space-between" w="full">
                            <Text fontSize="sm">{assignments} assignments:</Text>
                            <Badge>{count} images</Badge>
                          </HStack>
                        ))}
                      </VStack>
                    </CardBody>
                  </Card>
                  
                  <Card>
                    <CardHeader>
                      <Heading size="sm">Set 2 (Images 1201-2400)</Heading>
                    </CardHeader>
                    <CardBody>
                      <VStack spacing={2} align="start">
                        {Object.entries(imageStats.set2 || {}).map(([assignments, count]) => (
                          <HStack key={assignments} justify="space-between" w="full">
                            <Text fontSize="sm">{assignments} assignments:</Text>
                            <Badge>{count} images</Badge>
                          </HStack>
                        ))}
                      </VStack>
                    </CardBody>
                  </Card>
                </SimpleGrid>
              </VStack>
            ) : (
              <Text>Loading statistics...</Text>
            )}
          </ModalBody>
          <ModalFooter>
            <Button onClick={onStatsModalClose}>Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Prolific URL Modal */}
      <Modal isOpen={isProlificModalOpen} onClose={onProlificModalClose} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Prolific Study URL</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <VStack spacing={4}>
              <Text fontSize="sm" color="gray.600">
                Use this URL as your study link in Prolific. The placeholders will be automatically replaced with participant data.
              </Text>
              
              <Box w="full">
                <HStack mb={2}>
                  <Text fontWeight="bold">Study URL:</Text>
                  <Button size="xs" onClick={() => copyToClipboard(prolificUrl)}>
                    📋 Copy
                  </Button>
                </HStack>
                <Textarea
                  value={prolificUrl}
                  isReadOnly
                  fontFamily="mono"
                  fontSize="sm"
                  rows={4}
                />
              </Box>
              
              <Alert status="info" size="sm">
                <AlertIcon />
                <Text fontSize="sm">
                  Make sure to set the completion URL in Prolific to redirect participants 
                  back after they finish the study.
                </Text>
              </Alert>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button onClick={onProlificModalClose}>Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default AdminDashboard;