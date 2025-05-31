
// src/pages/AdminDashboard.js - Fixed imports section
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Grid,
  GridItem,
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
  Icon,
  Divider,
  Progress,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
  OrderedList,  // Added this missing import
  ListItem,     // Added this too
  UnorderedList // And this one for good measure
} from '@chakra-ui/react';
import {
  Users,
  Database,
  Image as ImageIcon,
  Download,
  Trash2,
  RefreshCw,
  Settings,
  BarChart3,
  FileText,
  ExternalLink,
  Shield,
  Tool,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';

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
        const dateA = a.createdAt?.seconds || 0;
        const dateB = b.createdAt?.seconds || 0;
        return dateB - dateA;
      });
      
      setUsers(usersData);
      
      // Update stats
      setStats({
        totalUsers: usersData.length,
        completedSurveys: completedCount,
        activeUsers: activeCount,
        testUsers: testCount,
        prolificUsers: prolificCount,
        totalImages: totalAssignedImages,
        assignedImages: totalAssignedImages,
        averageCompletion: usersData.length > 0 ? Math.round(totalCompletedImages / totalAssignedImages * 100) || 0 : 0
      });
      
      // Load image assignment stats
      try {
        const assignmentStats = await getAssignmentStats();
        setImageStats(assignmentStats);
      } catch (error) {
        console.warn('Could not load image assignment stats:', error);
      }
      
      console.log(`Loaded ${usersData.length} users`);
      
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      setError('Failed to load dashboard data: ' + error.message);
      toast({
        title: 'Error Loading Data',
        description: error.message,
        status: 'error',
        duration: 5000,
      });
    } finally {
      setLoading(false);
    }
  };

  const generateProlificUrl = () => {
    const currentDomain = window.location.origin;
    const prolificParams = 'PROLIFIC_PID={{%PROLIFIC_PID%}}&STUDY_ID={{%STUDY_ID%}}&SESSION_ID={{%SESSION_ID%}}';
    const fullUrl = `${currentDomain}/login?${prolificParams}`;
    setProlificUrl(fullUrl);
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

  const handleUserDetails = (user) => {
    setSelectedUser(user);
    onUserModalOpen();
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm(`Are you sure you want to delete user ${userId}? This action cannot be undone.`)) {
      return;
    }
    
    try {
      await deleteDoc(doc(db, 'loginIDs', userId));
      toast({
        title: 'User Deleted',
        description: `User ${userId} has been deleted`,
        status: 'success',
        duration: 3000,
      });
      await loadDashboardData();
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

  const handleResetAssignments = async () => {
    if (!window.confirm('Are you sure you want to reset ALL image assignments? This will clear assignment counts for all images.')) {
      return;
    }
    
    try {
      setLoading(true);
      await resetImageAssignments();
      toast({
        title: 'Assignments Reset',
        description: 'All image assignment counts have been reset',
        status: 'success',
        duration: 3000,
      });
      await loadDashboardData();
    } catch (error) {
      console.error('Error resetting assignments:', error);
      toast({
        title: 'Reset Failed',
        description: error.message,
        status: 'error',
        duration: 5000,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFixAssignments = async () => {
    try {
      setLoading(true);
      
      toast({
        title: 'Starting Fix Process',
        description: 'Fixing user image assignments...',
        status: 'info',
        duration: 3000,
      });
      
      const results = await fixAllUserAssignments();
      
      toast({
        title: 'Fix Completed',
        description: `Fixed ${results.successful}/${results.total} users successfully`,
        status: results.failed > 0 ? 'warning' : 'success',
        duration: 5000,
      });
      
      console.log('Fix results:', results);
      await loadDashboardData();
      
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

  const exportUserData = () => {
    const exportData = users.map(user => ({
      userId: user.id,
      displayId: user.displayId,
      source: user.source,
      isTest: user.isTest,
      isProlific: user.isProlific,
      surveyCompleted: user.isCompleted,
      completedImages: user.completedImages,
      totalImages: user.totalImages,
      completionPercentage: user.completionPercentage,
      createdAt: user.createdAt?.seconds ? new Date(user.createdAt.seconds * 1000).toISOString() : null,
      lastLogin: user.lastLogin?.seconds ? new Date(user.lastLogin.seconds * 1000).toISOString() : null,
      prolificPid: user.prolificData?.prolificPid,
      studyId: user.prolificData?.studyId,
      sessionId: user.prolificData?.sessionId
    }));
    
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `user-data-export-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    
    toast({
      title: 'Data Exported',
      description: 'User data has been exported to JSON file',
      status: 'success',
      duration: 3000,
    });
  };

  const copyProlificUrl = () => {
    navigator.clipboard.writeText(prolificUrl);
    toast({
      title: 'URL Copied',
      description: 'Prolific URL copied to clipboard',
      status: 'success',
      duration: 2000,
    });
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.displayId?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = filterType === 'all' ||
                         (filterType === 'completed' && user.isCompleted) ||
                         (filterType === 'active' && !user.isCompleted && user.isActive) ||
                         (filterType === 'test' && user.isTest) ||
                         (filterType === 'prolific' && user.isProlific);
    
    return matchesSearch && matchesFilter;
  });

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minH="100vh">
        <VStack spacing={4}>
          <Spinner size="xl" color="blue.500" />
          <Text>Loading admin dashboard...</Text>
        </VStack>
      </Box>
    );
  }

  if (error) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minH="100vh">
        <Alert status="error" maxW="md">
          <AlertIcon />
          <Box>
            <Text fontWeight="bold">Dashboard Error</Text>
            <Text>{error}</Text>
          </Box>
        </Alert>
      </Box>
    );
  }

  return (
    <Box minH="100vh" bg="gray.50">
      <Container maxW="7xl" py={8}>
        {/* Header */}
        <Flex justify="space-between" align="center" mb={8}>
          <VStack align="start" spacing={1}>
            <HStack>
              <Icon as={Shield} color="green.500" size={24} />
              <Heading size="lg">Admin Dashboard</Heading>
            </HStack>
            <Text color="gray.600">Image Evaluation Study Management</Text>
          </VStack>
          
          <HStack spacing={4}>
            <Button
              leftIcon={<RefreshCw />}
              onClick={loadDashboardData}
              isLoading={loading}
              variant="outline"
            >
              Refresh
            </Button>
            <Button
              leftIcon={<LogOut />}
              onClick={handleLogout}
              colorScheme="red"
              variant="outline"
            >
              Logout
            </Button>
          </HStack>
        </Flex>

        <Tabs>
          <TabList>
            <Tab>Overview</Tab>
            <Tab>Users</Tab>
            <Tab>Image Management</Tab>
            <Tab>Tools</Tab>
          </TabList>

          <TabPanels>
            {/* Overview Tab */}
            <TabPanel>
              <VStack spacing={6} align="stretch">
                {/* Stats Cards */}
                <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4}>
                  <Card>
                    <CardBody>
                      <Stat>
                        <StatLabel>Total Users</StatLabel>
                        <StatNumber>{stats.totalUsers}</StatNumber>
                        <StatHelpText>
                          <HStack spacing={2}>
                            <Badge colorScheme="blue">{stats.prolificUsers} Prolific</Badge>
                            <Badge colorScheme="orange">{stats.testUsers} Test</Badge>
                          </HStack>
                        </StatHelpText>
                      </Stat>
                    </CardBody>
                  </Card>

                  <Card>
                    <CardBody>
                      <Stat>
                        <StatLabel>Completed Surveys</StatLabel>
                        <StatNumber>{stats.completedSurveys}</StatNumber>
                        <StatHelpText>
                          {stats.totalUsers > 0 ? Math.round(stats.completedSurveys / stats.totalUsers * 100) : 0}% completion rate
                        </StatHelpText>
                      </Stat>
                    </CardBody>
                  </Card>

                  <Card>
                    <CardBody>
                      <Stat>
                        <StatLabel>Active Users</StatLabel>
                        <StatNumber>{stats.activeUsers}</StatNumber>
                        <StatHelpText>
                          Currently in progress
                        </StatHelpText>
                      </Stat>
                    </CardBody>
                  </Card>

                  <Card>
                    <CardBody>
                      <Stat>
                        <StatLabel>Image Progress</StatLabel>
                        <StatNumber>{stats.averageCompletion}%</StatNumber>
                        <StatHelpText>
                          Average completion
                        </StatHelpText>
                      </Stat>
                    </CardBody>
                  </Card>
                </SimpleGrid>

                {/* Quick Actions */}
                <Card>
                  <CardHeader>
                    <Heading size="md">Quick Actions</Heading>
                  </CardHeader>
                  <CardBody>
                    <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
                      <Button
                        leftIcon={<Download />}
                        onClick={exportUserData}
                        colorScheme="blue"
                        variant="outline"
                      >
                        Export User Data
                      </Button>
                      
                      <Button
                        leftIcon={<ExternalLink />}
                        onClick={onProlificModalOpen}
                        colorScheme="green"
                        variant="outline"
                      >
                        Prolific Study URL
                      </Button>
                      
                      <Button
                        leftIcon={<BarChart3 />}
                        onClick={onStatsModalOpen}
                        colorScheme="purple"
                        variant="outline"
                      >
                        Detailed Statistics
                      </Button>
                    </SimpleGrid>
                  </CardBody>
                </Card>

                {/* Recent Activity */}
                <Card>
                  <CardHeader>
                    <Heading size="md">Recent Users</Heading>
                  </CardHeader>
                  <CardBody>
                    <TableContainer>
                      <Table size="sm">
                        <Thead>
                          <Tr>
                            <Th>User ID</Th>
                            <Th>Type</Th>
                            <Th>Progress</Th>
                            <Th>Created</Th>
                            <Th>Status</Th>
                          </Tr>
                        </Thead>
                        <Tbody>
                          {users.slice(0, 5).map(user => (
                            <Tr key={user.id}>
                              <Td fontFamily="mono" fontSize="sm">
                                {user.displayId || user.id}
                              </Td>
                              <Td>
                                <Badge colorScheme={user.isTest ? 'orange' : 'blue'}>
                                  {user.isTest ? 'Test' : 'Prolific'}
                                </Badge>
                              </Td>
                              <Td>
                                <Progress 
                                  value={user.completionPercentage} 
                                  size="sm" 
                                  colorScheme="green"
                                  w="100px"
                                />
                              </Td>
                              <Td fontSize="sm">
                                {user.createdAt?.seconds 
                                  ? new Date(user.createdAt.seconds * 1000).toLocaleDateString()
                                  : 'N/A'
                                }
                              </Td>
                              <Td>
                                <Badge colorScheme={user.isCompleted ? 'green' : 'yellow'}>
                                  {user.isCompleted ? 'Completed' : 'In Progress'}
                                </Badge>
                              </Td>
                            </Tr>
                          ))}
                        </Tbody>
                      </Table>
                    </TableContainer>
                  </CardBody>
                </Card>
              </VStack>
            </TabPanel>

            {/* Users Tab */}
            <TabPanel>
              <VStack spacing={4} align="stretch">
                {/* Filters */}
                <Card>
                  <CardBody>
                    <HStack spacing={4}>
                      <InputGroup maxW="300px">
                        <InputLeftElement>
                          <Search size={16} />
                        </InputLeftElement>
                        <Input
                          placeholder="Search users..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                        />
                      </InputGroup>
                      
                      <Select maxW="200px" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                        <option value="all">All Users</option>
                        <option value="completed">Completed</option>
                        <option value="active">Active</option>
                        <option value="test">Test Users</option>
                        <option value="prolific">Prolific Users</option>
                      </Select>
                      
                      <Text fontSize="sm" color="gray.600">
                        {filteredUsers.length} of {users.length} users
                      </Text>
                    </HStack>
                  </CardBody>
                </Card>

                {/* Users Table */}
                <Card>
                  <CardBody>
                    <TableContainer>
                      <Table>
                        <Thead>
                          <Tr>
                            <Th>User ID</Th>
                            <Th>Type</Th>
                            <Th>Progress</Th>
                            <Th>Completion</Th>
                            <Th>Created</Th>
                            <Th>Last Login</Th>
                            <Th>Actions</Th>
                          </Tr>
                        </Thead>
                        <Tbody>
                          {filteredUsers.map(user => (
                            <Tr key={user.id}>
                              <Td>
                                <VStack align="start" spacing={0}>
                                  <Text fontFamily="mono" fontSize="sm">
                                    {user.displayId || user.id}
                                  </Text>
                                  {user.prolificData?.prolificPid && (
                                    <Text fontSize="xs" color="gray.500">
                                      {user.prolificData.prolificPid.substring(0, 12)}...
                                    </Text>
                                  )}
                                </VStack>
                              </Td>
                              <Td>
                                <Badge colorScheme={user.isTest ? 'orange' : 'blue'}>
                                  {user.isTest ? 'Test' : 'Prolific'}
                                </Badge>
                              </Td>
                              <Td>
                                <VStack align="start" spacing={1}>
                                  <Progress 
                                    value={user.completionPercentage} 
                                    size="sm" 
                                    colorScheme="green"
                                    w="100px"
                                  />
                                  <Text fontSize="xs">
                                    {user.completedImages}/{user.totalImages} images
                                  </Text>
                                </VStack>
                              </Td>
                              <Td>
                                <Badge colorScheme={user.isCompleted ? 'green' : 'yellow'}>
                                  {user.isCompleted ? 'Completed' : 'In Progress'}
                                </Badge>
                              </Td>
                              <Td fontSize="sm">
                                {user.createdAt?.seconds 
                                  ? new Date(user.createdAt.seconds * 1000).toLocaleDateString()
                                  : 'N/A'
                                }
                              </Td>
                              <Td fontSize="sm">
                                {user.lastLogin?.seconds 
                                  ? new Date(user.lastLogin.seconds * 1000).toLocaleDateString()
                                  : 'N/A'
                                }
                              </Td>
                              <Td>
                                <HStack spacing={2}>
                                  <Button
                                    size="sm"
                                    leftIcon={<Eye />}
                                    onClick={() => handleUserDetails(user)}
                                    variant="outline"
                                  >
                                    View
                                  </Button>
                                  <Button
                                    size="sm"
                                    leftIcon={<Trash2 />}
                                    onClick={() => handleDeleteUser(user.id)}
                                    colorScheme="red"
                                    variant="outline"
                                  >
                                    Delete
                                  </Button>
                                </HStack>
                              </Td>
                            </Tr>
                          ))}
                        </Tbody>
                      </Table>
                    </TableContainer>
                  </CardBody>
                </Card>
              </VStack>
            </TabPanel>

            {/* Image Management Tab */}
            <TabPanel>
              <VStack spacing={4} align="stretch">
                <Card>
                  <CardHeader>
                    <Heading size="md">Image Assignment Statistics</Heading>
                  </CardHeader>
                  <CardBody>
                    {imageStats ? (
                      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
                        <Box>
                          <Text fontWeight="bold" mb={2}>Set 1 (1-1200.png)</Text>
                          <VStack align="start" spacing={2}>
                            {Object.entries(imageStats.set1).map(([count, images]) => (
                              <HStack key={count} justify="space-between" w="full">
                                <Text>{count} assignments:</Text>
                                <Badge>{images} images</Badge>
                              </HStack>
                            ))}
                          </VStack>
                        </Box>
                        
                        <Box>
                          <Text fontWeight="bold" mb={2}>Set 2 (1201-2400.png)</Text>
                          <VStack align="start" spacing={2}>
                            {Object.entries(imageStats.set2).map(([count, images]) => (
                              <HStack key={count} justify="space-between" w="full">
                                <Text>{count} assignments:</Text>
                                <Badge>{images} images</Badge>
                              </HStack>
                            ))}
                          </VStack>
                        </Box>
                      </SimpleGrid>
                    ) : (
                      <Text>No image statistics available</Text>
                    )}
                  </CardBody>
                </Card>

                <Card>
                  <CardHeader>
                    <Heading size="md">Image Management Actions</Heading>
                  </CardHeader>
                  <CardBody>
                    <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                      <Button
                        leftIcon={<AlertTriangle />}
                        onClick={handleResetAssignments}
                        colorScheme="red"
                        variant="outline"
                        isLoading={loading}
                      >
                        Reset All Assignments
                      </Button>
                      
                      <Button
                        leftIcon={<BarChart3 />}
                        onClick={onStatsModalOpen}
                        colorScheme="blue"
                        variant="outline"
                      >
                        View Detailed Stats
                      </Button>
                    </SimpleGrid>
                  </CardBody>
                </Card>
              </VStack>
            </TabPanel>

            {/* Tools Tab */}
            <TabPanel>
              <VStack spacing={4} align="stretch">
                <Card>
                  <CardHeader>
                    <Heading size="md">System Tools</Heading>
                  </CardHeader>
                  <CardBody>
                    <VStack spacing={4} align="stretch">
                      <Box p={4} bg="orange.50" borderRadius="md" border="1px" borderColor="orange.200">
                        <VStack spacing={3}>
                          <HStack>
                            <Icon as={Tool} color="orange.500" />
                            <Text fontSize="lg" fontWeight="bold" color="orange.700">
                              Fix User Assignments
                            </Text>
                          </HStack>
                          <Text fontSize="sm" color="gray.600" textAlign="center">
                            Update existing users to use the new image assignment format (set1/set2 structure)
                          </Text>
                          <Button
                            colorScheme="orange"
                            onClick={handleFixAssignments}
                            isLoading={loading}
                            loadingText="Fixing..."
                            leftIcon={<Tool />}
                          >
                            Fix All User Assignments
                          </Button>
                        </VStack>
                      </Box>

                      <Box p={4} bg="blue.50" borderRadius="md" border="1px" borderColor="blue.200">
                        <VStack spacing={3}>
                          <HStack>
                            <Icon as={ExternalLink} color="blue.500" />
                            <Text fontSize="lg" fontWeight="bold" color="blue.700">
                              Prolific Integration
                            </Text>
                          </HStack>
                          <Text fontSize="sm" color="gray.600" textAlign="center">
                            Generate and manage Prolific study URLs with proper parameter forwarding
                          </Text>
                          <Button
                            colorScheme="blue"
                            onClick={onProlificModalOpen}
                            leftIcon={<ExternalLink />}
                          >
                            Manage Prolific URL
                          </Button>
                        </VStack>
                      </Box>

                      <Box p={4} bg="green.50" borderRadius="md" border="1px" borderColor="green.200">
                        <VStack spacing={3}>
                          <HStack>
                            <Icon as={Download} color="green.500" />
                            <Text fontSize="lg" fontWeight="bold" color="green.700">
                              Data Export
                            </Text>
                          </HStack>
                          <Text fontSize="sm" color="gray.600" textAlign="center">
                            Export user data and survey results for analysis and reporting
                          </Text>
                          <Button
                            colorScheme="green"
                            onClick={exportUserData}
                            leftIcon={<Download />}
                          >
                            Export User Data
                          </Button>
                        </VStack>
                      </Box>
                    </VStack>
                  </CardBody>
                </Card>
              </VStack>
            </TabPanel>
          </TabPanels>
        </Tabs>

        {/* User Details Modal */}
        <Modal isOpen={isUserModalOpen} onClose={onUserModalClose} size="xl">
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>User Details</ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              {selectedUser && (
                <VStack spacing={4} align="stretch">
                  <SimpleGrid columns={2} spacing={4}>
                    <Box>
                      <Text fontWeight="bold">User ID:</Text>
                      <Code>{selectedUser.id}</Code>
                    </Box>
                    <Box>
                      <Text fontWeight="bold">Display ID:</Text>
                      <Code>{selectedUser.displayId || 'N/A'}</Code>
                    </Box>
                    <Box>
                      <Text fontWeight="bold">Source:</Text>
                      <Badge colorScheme={selectedUser.isTest ? 'orange' : 'blue'}>
                        {selectedUser.source || 'Unknown'}
                      </Badge>
                    </Box>
                    <Box>
                      <Text fontWeight="bold">Status:</Text>
                      <Badge colorScheme={selectedUser.isCompleted ? 'green' : 'yellow'}>
                        {selectedUser.isCompleted ? 'Completed' : 'In Progress'}
                      </Badge>
                    </Box>
                  </SimpleGrid>

                  <Divider />

                  <Box>
                    <Text fontWeight="bold" mb={2}>Progress:</Text>
                    <Progress 
                      value={selectedUser.completionPercentage} 
                      colorScheme="green"
                      size="lg"
                      mb={2}
                    />
                    <Text fontSize="sm" color="gray.600">
                      {selectedUser.completedImages}/{selectedUser.totalImages} images completed 
                      ({selectedUser.completionPercentage}%)
                    </Text>
                  </Box>

                  {selectedUser.prolificData && (
                    <>
                      <Divider />
                      <Box>
                        <Text fontWeight="bold" mb={2}>Prolific Data:</Text>
                        <VStack align="start" spacing={1}>
                          <Text fontSize="sm">
                            <strong>Prolific PID:</strong> {selectedUser.prolificData.prolificPid}
                          </Text>
                          <Text fontSize="sm">
                            <strong>Study ID:</strong> {selectedUser.prolificData.studyId}
                          </Text>
                          <Text fontSize="sm">
                            <strong>Session ID:</strong> {selectedUser.prolificData.sessionId}
                          </Text>
                        </VStack>
                      </Box>
                    </>
                  )}

                  <Divider />

                  <Box>
                    <Text fontWeight="bold" mb={2}>Timestamps:</Text>
                    <VStack align="start" spacing={1}>
                      <Text fontSize="sm">
                        <strong>Created:</strong> {
                          selectedUser.createdAt?.seconds 
                            ? new Date(selectedUser.createdAt.seconds * 1000).toLocaleString()
                            : 'N/A'
                        }
                      </Text>
                      <Text fontSize="sm">
                        <strong>Last Login:</strong> {
                          selectedUser.lastLogin?.seconds 
                            ? new Date(selectedUser.lastLogin.seconds * 1000).toLocaleString()
                            : 'N/A'
                        }
                      </Text>
                      {selectedUser.lastReturnVisit?.seconds && (
                        <Text fontSize="sm">
                          <strong>Last Return:</strong> {
                            new Date(selectedUser.lastReturnVisit.seconds * 1000).toLocaleString()
                          }
                        </Text>
                      )}
                    </VStack>
                  </Box>

                  {selectedUser.assignedImages && selectedUser.assignedImages.length > 0 && (
                    <>
                      <Divider />
                      <Box>
                        <Text fontWeight="bold" mb={2}>Assigned Images:</Text>
                        <TableContainer maxH="200px" overflowY="auto">
                          <Table size="sm">
                            <Thead>
                              <Tr>
                                <Th>Image</Th>
                                <Th>Set</Th>
                                <Th>Status</Th>
                              </Tr>
                            </Thead>
                            <Tbody>
                              {selectedUser.assignedImages.map((image, index) => (
                                <Tr key={index}>
                                  <Td fontFamily="mono" fontSize="xs">
                                    {image.name || image.id || `Image ${index + 1}`}
                                  </Td>
                                  <Td>
                                    <Badge size="sm" colorScheme={image.set === 'set1' ? 'blue' : 'green'}>
                                      {image.set || 'Unknown'}
                                    </Badge>
                                  </Td>
                                  <Td>
                                    <Badge 
                                      size="sm" 
                                      colorScheme={index < selectedUser.completedImages ? 'green' : 'gray'}
                                    >
                                      {index < selectedUser.completedImages ? 'Completed' : 'Pending'}
                                    </Badge>
                                  </Td>
                                </Tr>
                              ))}
                            </Tbody>
                          </Table>
                        </TableContainer>
                      </Box>
                    </>
                  )}
                </VStack>
              )}
            </ModalBody>
            <ModalFooter>
              <Button onClick={onUserModalClose}>Close</Button>
            </ModalFooter>
          </ModalContent>
        </Modal>

        {/* Statistics Modal */}
        <Modal isOpen={isStatsModalOpen} onClose={onStatsModalClose} size="xl">
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>Detailed Statistics</ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              <VStack spacing={6} align="stretch">
                <SimpleGrid columns={2} spacing={4}>
                  <Box p={4} bg="blue.50" borderRadius="md">
                    <Text fontWeight="bold" color="blue.700">User Statistics</Text>
                    <VStack align="start" mt={2}>
                      <Text fontSize="sm">Total Users: {stats.totalUsers}</Text>
                      <Text fontSize="sm">Prolific Users: {stats.prolificUsers}</Text>
                      <Text fontSize="sm">Test Users: {stats.testUsers}</Text>
                      <Text fontSize="sm">Completed: {stats.completedSurveys}</Text>
                      <Text fontSize="sm">Active: {stats.activeUsers}</Text>
                    </VStack>
                  </Box>

                  <Box p={4} bg="green.50" borderRadius="md">
                    <Text fontWeight="bold" color="green.700">Image Statistics</Text>
                    <VStack align="start" mt={2}>
                      <Text fontSize="sm">Total Images Assigned: {stats.totalImages}</Text>
                      <Text fontSize="sm">Average Completion: {stats.averageCompletion}%</Text>
                      <Text fontSize="sm">Set 1 Images: 1200</Text>
                      <Text fontSize="sm">Set 2 Images: 1200</Text>
                    </VStack>
                  </Box>
                </SimpleGrid>

                {imageStats && (
                  <Box>
                    <Text fontWeight="bold" mb={4}>Image Assignment Distribution</Text>
                    <SimpleGrid columns={2} spacing={4}>
                      <Box p={4} border="1px" borderColor="gray.200" borderRadius="md">
                        <Text fontWeight="medium" mb={2}>Set 1 (Images 1-1200)</Text>
                        <VStack align="start" spacing={1}>
                          {Object.entries(imageStats.set1).map(([assignments, count]) => (
                            <HStack key={assignments} justify="space-between" w="full">
                              <Text fontSize="sm">{assignments} assignments:</Text>
                              <Badge>{count} images</Badge>
                            </HStack>
                          ))}
                        </VStack>
                      </Box>

                      <Box p={4} border="1px" borderColor="gray.200" borderRadius="md">
                        <Text fontWeight="medium" mb={2}>Set 2 (Images 1201-2400)</Text>
                        <VStack align="start" spacing={1}>
                          {Object.entries(imageStats.set2).map(([assignments, count]) => (
                            <HStack key={assignments} justify="space-between" w="full">
                              <Text fontSize="sm">{assignments} assignments:</Text>
                              <Badge>{count} images</Badge>
                            </HStack>
                          ))}
                        </VStack>
                      </Box>
                    </SimpleGrid>
                  </Box>
                )}

                <Box p={4} bg="yellow.50" borderRadius="md">
                  <Text fontWeight="bold" color="yellow.700" mb={2}>System Health</Text>
                  <VStack align="start" spacing={1}>
                    <HStack>
                      <Icon as={CheckCircle} color="green.500" />
                      <Text fontSize="sm">Database: Connected</Text>
                    </HStack>
                    <HStack>
                      <Icon as={CheckCircle} color="green.500" />
                      <Text fontSize="sm">Storage: Accessible</Text>
                    </HStack>
                    <HStack>
                      <Icon as={CheckCircle} color="green.500" />
                      <Text fontSize="sm">Authentication: Active</Text>
                    </HStack>
                    <HStack>
                      <Icon as={Database} color="blue.500" />
                      <Text fontSize="sm">Total Collections: 2 (loginIDs, imageAssignments)</Text>
                    </HStack>
                  </VStack>
                </Box>
              </VStack>
            </ModalBody>
            <ModalFooter>
              <Button onClick={onStatsModalClose}>Close</Button>
            </ModalFooter>
          </ModalContent>
        </Modal>

        {/* Prolific URL Modal */}
        <Modal isOpen={isProlificModalOpen} onClose={onProlificModalClose} size="xl">
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>Prolific Study URL</ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              <VStack spacing={4} align="stretch">
                <Box>
                  <Text fontWeight="bold" mb={2}>Study URL for Prolific:</Text>
                  <Text fontSize="sm" color="gray.600" mb={2}>
                    Copy this URL and paste it into your Prolific study setup. The parameters will be 
                    automatically populated by Prolific.
                  </Text>
                  <Textarea
                    value={prolificUrl}
                    isReadOnly
                    bg="gray.50"
                    fontFamily="mono"
                    fontSize="sm"
                    rows={3}
                  />
                  <Button
                    mt={2}
                    leftIcon={<Copy />}
                    onClick={copyProlificUrl}
                    colorScheme="blue"
                    size="sm"
                  >
                    Copy URL
                  </Button>
                </Box>

                <Divider />

                <Box>
                  <Text fontWeight="bold" mb={2}>Instructions:</Text>
                  <OrderedList spacing={2} fontSize="sm">
                    <li>Log into your Prolific account</li>
                    <li>Create a new study or edit an existing one</li>
                    <li>In the "Study Link" field, paste the URL above</li>
                    <li>Prolific will automatically replace the placeholder parameters</li>
                    <li>Participants will be automatically tracked when they access the study</li>
                  </OrderedList>
                </Box>

                <Box p={4} bg="blue.50" borderRadius="md">
                  <Text fontWeight="medium" color="blue.700" mb={2}>URL Parameters Explained:</Text>
                  <VStack align="start" spacing={1} fontSize="sm">
                    <Text><Code>PROLIFIC_PID</Code> - Unique participant identifier</Text>
                    <Text><Code>STUDY_ID</Code> - Your Prolific study identifier</Text>
                    <Text><Code>SESSION_ID</Code> - Individual session identifier</Text>
                  </VStack>
                </Box>

                <Alert status="info" size="sm">
                  <AlertIcon />
                  <Text fontSize="sm">
                    Test the URL by adding <Code>?PROLIFIC_PID=TEST_USER&STUDY_ID=TEST_STUDY&SESSION_ID=TEST_SESSION</Code> 
                    to test the participant flow.
                  </Text>
                </Alert>
              </VStack>
            </ModalBody>
            <ModalFooter>
              <Button colorScheme="blue" onClick={copyProlificUrl} mr={3}>
                Copy URL
              </Button>
              <Button onClick={onProlificModalClose}>Close</Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      </Container>
    </Box>
  );
};

export default AdminDashboard;