// src/components/AdminDashboard.js - Updated for pre-assigned login system
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import {
  createPreAssignments,
  getSystemStats,
  resetPreAssignedSystem,
  getAvailableLoginIdsList
} from '../utils/preAssignedSystem';
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
  Code
} from '@chakra-ui/react';

const AdminDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [systemStats, setSystemStats] = useState(null);
  const [activeSessions, setActiveSessions] = useState([]);
  const [availableIds, setAvailableIds] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [selectedSession, setSelectedSession] = useState(null);

  const { isOpen: isSessionModalOpen, onOpen: onSessionModalOpen, onClose: onSessionModalClose } = useDisclosure();
  const { isOpen: isStatsModalOpen, onOpen: onStatsModalOpen, onClose: onStatsModalClose } = useDisclosure();
  const { isOpen: isSetupModalOpen, onOpen: onSetupModalOpen, onClose: onSetupModalClose } = useDisclosure();

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
  }, [navigate, toast]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      console.log('Loading admin dashboard data...');
      
      // Load system statistics
      const stats = await getSystemStats();
      setSystemStats(stats);
      
      // Load active sessions
      const sessionsRef = collection(db, 'loginIDs');
      const sessionsSnapshot = await getDocs(sessionsRef);
      
      const sessions = [];
      sessionsSnapshot.forEach(doc => {
        if (doc.id === 'ADMIN') return;
        
        const sessionData = doc.data();
        sessions.push({
          loginId: doc.id,
          prolificPid: sessionData.prolificPid || 'N/A',
          hasConsented: sessionData.hasConsented || false,
          surveyCompleted: sessionData.surveyCompleted || false,
          completedImages: sessionData.completedImages || 0,
          totalImages: sessionData.totalImages || 0,
          createdAt: sessionData.createdAt,
          lastLogin: sessionData.lastLogin,
          source: sessionData.source || 'unknown'
        });
      });
      
      // Sort sessions by creation date (newest first)
      sessions.sort((a, b) => {
        const dateA = a.createdAt?.toDate?.() || new Date(0);
        const dateB = b.createdAt?.toDate?.() || new Date(0);
        return dateB - dateA;
      });
      
      setActiveSessions(sessions);
      
      // Load some available login IDs for monitoring
      const available = await getAvailableLoginIdsList(20);
      setAvailableIds(available);
      
      console.log('Dashboard data loaded:', {
        stats,
        activeSessions: sessions.length,
        availableIds: available.length
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

  const handleCreatePreAssignments = async () => {
    if (!window.confirm('Create pre-assignments for all 1100 login IDs? This will overwrite any existing assignments.')) {
      return;
    }
    
    try {
      setLoading(true);
      
      toast({
        title: 'Creating Pre-assignments',
        description: 'This will take several minutes...',
        status: 'info',
        duration: 5000,
      });
      
      const result = await createPreAssignments();
      
      toast({
        title: 'Pre-assignments Created',
        description: `Successfully created assignments for ${result.totalIds} login IDs`,
        status: 'success',
        duration: 5000,
      });
      
      // Reload data
      loadDashboardData();
    } catch (error) {
      console.error('Error creating pre-assignments:', error);
      toast({
        title: 'Creation Failed',
        description: error.message,
        status: 'error',
        duration: 5000,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResetSystem = async () => {
    if (!window.confirm('WARNING: This will delete ALL assignments and sessions. This cannot be undone! Type "RESET" to confirm.')) {
      return;
    }
    
    const confirmation = prompt('Type "RESET" to confirm:');
    if (confirmation !== 'RESET') {
      return;
    }
    
    try {
      setLoading(true);
      
      await resetPreAssignedSystem();
      
      toast({
        title: 'System Reset',
        description: 'All assignments and sessions have been cleared',
        status: 'success',
        duration: 3000,
      });
      
      loadDashboardData();
    } catch (error) {
      console.error('Error resetting system:', error);
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

  const filteredSessions = activeSessions.filter(session => {
    const matchesSearch = searchTerm === '' || 
      session.loginId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      session.prolificPid.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = filterType === 'all' ||
      (filterType === 'completed' && session.surveyCompleted) ||
      (filterType === 'active' && !session.surveyCompleted && session.hasConsented) ||
      (filterType === 'consented' && session.hasConsented) ||
      (filterType === 'not-consented' && !session.hasConsented);
    
    return matchesSearch && matchesFilter;
  });

  const openSessionDetails = (session) => {
    setSelectedSession(session);
    onSessionModalOpen();
  };

  const generateProlificUrl = () => {
    const baseUrl = window.location.origin;
    const prolificParams = new URLSearchParams({
      PROLIFIC_PID: '{{%PROLIFIC_PID%}}',
      STUDY_ID: '{{%STUDY_ID%}}',
      SESSION_ID: '{{%SESSION_ID%}}'
    });
    
    return `${baseUrl}/login?${prolificParams.toString()}`;
  };

  if (loading && !systemStats) {
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
                  Pre-assigned Login ID System
                </Text>
              </VStack>
            </HStack>
            
            <HStack spacing={3}>
              <Button
                colorScheme="blue"
                variant="outline"
                onClick={onSetupModalOpen}
              >
                🔧 System Setup
              </Button>
              <Button
                colorScheme="green"
                variant="outline"
                onClick={() => copyToClipboard(generateProlificUrl())}
              >
                🔗 Copy Prolific URL
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

        {/* System Statistics */}
        <SimpleGrid columns={{ base: 1, md: 2, lg: 5 }} spacing={6} mb={8}>
          <Card>
            <CardBody>
              <Stat>
                <StatLabel>Total Login IDs</StatLabel>
                <StatNumber>{systemStats?.totalLoginIds || 0}</StatNumber>
                <StatHelpText>Available slots (0001-1100)</StatHelpText>
              </Stat>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <Stat>
                <StatLabel>Available IDs</StatLabel>
                <StatNumber>{systemStats?.availableIds || 0}</StatNumber>
                <StatHelpText>Ready for assignment</StatHelpText>
              </Stat>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <Stat>
                <StatLabel>Assigned IDs</StatLabel>
                <StatNumber>{systemStats?.assignedIds || 0}</StatNumber>
                <StatHelpText>Taken by participants</StatHelpText>
              </Stat>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <Stat>
                <StatLabel>Active Sessions</StatLabel>
                <StatNumber>{systemStats?.activeSessions || 0}</StatNumber>
                <StatHelpText>Currently participating</StatHelpText>
              </Stat>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <Stat>
                <StatLabel>Completed</StatLabel>
                <StatNumber>{systemStats?.completedSessions || 0}</StatNumber>
                <StatHelpText>{systemStats?.conversionRate || 0}% completion rate</StatHelpText>
              </Stat>
            </CardBody>
          </Card>
        </SimpleGrid>

        {/* System Status */}
        <Card mb={6}>
          <CardHeader>
            <Heading size="md">System Status</Heading>
          </CardHeader>
          <CardBody>
            <HStack spacing={6} wrap="wrap">
              <VStack align="start">
                <Text fontSize="sm" fontWeight="bold">Login ID Pool</Text>
                <Progress 
                  value={systemStats ? (systemStats.assignedIds / systemStats.totalLoginIds) * 100 : 0}
                  size="lg" 
                  colorScheme="blue" 
                  w="200px"
                />
                <Text fontSize="xs" color="gray.600">
                  {systemStats?.assignedIds || 0} / {systemStats?.totalLoginIds || 0} assigned
                </Text>
              </VStack>
              
              <VStack align="start">
                <Text fontSize="sm" fontWeight="bold">Completion Rate</Text>
                <Progress 
                  value={systemStats?.conversionRate || 0}
                  size="lg" 
                  colorScheme="green" 
                  w="200px"
                />
                <Text fontSize="xs" color="gray.600">
                  {systemStats?.conversionRate || 0}% of assigned participants completed
                </Text>
              </VStack>
            </HStack>
          </CardBody>
        </Card>

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
                colorScheme="green"
                onClick={handleCreatePreAssignments}
                isDisabled={systemStats?.totalLoginIds > 0}
              >
                🎯 Create Pre-assignments
              </Button>
              
              <Button
                colorScheme="purple"
                variant="outline"
                onClick={onStatsModalOpen}
              >
                📊 Detailed Statistics
              </Button>
              
              <Button
                colorScheme="red"
                variant="outline"
                onClick={handleResetSystem}
              >
                🗑️ Reset System
              </Button>
            </HStack>
            
            {systemStats?.totalLoginIds === 0 && (
              <Alert status="warning" mt={4}>
                <AlertIcon />
                <Box>
                  <AlertTitle>System Not Initialized</AlertTitle>
                  <AlertDescription>
                    Click "Create Pre-assignments" to set up the login ID system with 1100 pre-assigned IDs.
                  </AlertDescription>
                </Box>
              </Alert>
            )}
          </CardBody>
        </Card>

        {/* Active Sessions */}
        <Card>
          <CardHeader>
            <HStack justify="space-between">
              <Heading size="md">Active Sessions</Heading>
              <HStack spacing={3}>
                <InputGroup maxW="300px">
                  <InputLeftElement>
                    <Text>🔍</Text>
                  </InputLeftElement>
                  <Input
                    placeholder="Search sessions..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </InputGroup>
                
                <Select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  maxW="150px"
                >
                  <option value="all">All Sessions</option>
                  <option value="completed">Completed</option>
                  <option value="active">Active</option>
                  <option value="consented">Consented</option>
                  <option value="not-consented">Not Consented</option>
                </Select>
              </HStack>
            </HStack>
          </CardHeader>
          <CardBody>
            <TableContainer>
              <Table variant="simple" size="sm">
                <Thead>
                  <Tr>
                    <Th>Login ID</Th>
                    <Th>Prolific PID</Th>
                    <Th>Progress</Th>
                    <Th>Status</Th>
                    <Th>Created</Th>
                    <Th>Actions</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {filteredSessions.map(session => (
                    <Tr key={session.loginId}>
                      <Td>
                        <Text fontFamily="mono" fontWeight="bold" color="blue.600">
                          {session.loginId}
                        </Text>
                      </Td>
                      <Td>
                        <Text fontSize="xs" fontFamily="mono">
                          {session.prolificPid.length > 16 
                            ? `${session.prolificPid.substring(0, 16)}...` 
                            : session.prolificPid
                          }
                        </Text>
                      </Td>
                      <Td>
                        <VStack align="start" spacing={1}>
                          <Text fontSize="sm">
                            {session.completedImages}/{session.totalImages} images
                          </Text>
                          <Progress
                            value={session.totalImages > 0 ? (session.completedImages / session.totalImages) * 100 : 0}
                            size="sm"
                            colorScheme={session.surveyCompleted ? "green" : "blue"}
                            w="100px"
                          />
                        </VStack>
                      </Td>
                      <Td>
                        <VStack align="start" spacing={0}>
                          {session.surveyCompleted ? (
                            <Badge colorScheme="green">✅ Completed</Badge>
                          ) : session.hasConsented ? (
                            <Badge colorScheme="blue">🔄 Active</Badge>
                          ) : (
                            <Badge colorScheme="orange">⏳ Not Consented</Badge>
                          )}
                        </VStack>
                      </Td>
                      <Td>
                        <Text fontSize="xs" color="gray.600">
                          {session.createdAt?.toDate?.()?.toLocaleDateString() || 'Unknown'}
                        </Text>
                      </Td>
                      <Td>
                        <Button
                          size="xs"
                          onClick={() => openSessionDetails(session)}
                        >
                          👁️ View
                        </Button>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </TableContainer>
            
            {filteredSessions.length === 0 && (
              <Text textAlign="center" py={8} color="gray.500">
                No sessions found matching your criteria
              </Text>
            )}
          </CardBody>
        </Card>
      </Container>

      {/* Session Details Modal */}
      <Modal isOpen={isSessionModalOpen} onClose={onSessionModalClose} size="xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Session Details</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            {selectedSession && (
              <VStack spacing={4} align="start">
                <SimpleGrid columns={2} spacing={4} w="full">
                  <Box>
                    <Text fontWeight="bold" mb={1}>Login ID:</Text>
                    <Code fontSize="lg" colorScheme="blue">{selectedSession.loginId}</Code>
                  </Box>
                  <Box>
                    <Text fontWeight="bold" mb={1}>Prolific PID:</Text>
                    <Code fontSize="xs">{selectedSession.prolificPid}</Code>
                  </Box>
                  <Box>
                    <Text fontWeight="bold" mb={1}>Progress:</Text>
                    <Text>{selectedSession.completedImages}/{selectedSession.totalImages} images completed</Text>
                  </Box>
                  <Box>
                    <Text fontWeight="bold" mb={1}>Status:</Text>
                    <Badge colorScheme={selectedSession.surveyCompleted ? "green" : "blue"}>
                      {selectedSession.surveyCompleted ? "Completed" : "In Progress"}
                    </Badge>
                  </Box>
                </SimpleGrid>
                
                <Box w="full">
                  <Text fontWeight="bold" mb={2}>Session Timeline:</Text>
                  <VStack align="start" spacing={2}>
                    <HStack>
                      <Badge>Created:</Badge>
                      <Text fontSize="sm">{selectedSession.createdAt?.toDate?.()?.toLocaleString() || 'Unknown'}</Text>
                    </HStack>
                    <HStack>
                      <Badge>Last Login:</Badge>
                      <Text fontSize="sm">{selectedSession.lastLogin?.toDate?.()?.toLocaleString() || 'Unknown'}</Text>
                    </HStack>
                    <HStack>
                      <Badge>Consented:</Badge>
                      <Text fontSize="sm">{selectedSession.hasConsented ? '✅ Yes' : '❌ No'}</Text>
                    </HStack>
                  </VStack>
                </Box>
              </VStack>
            )}
          </ModalBody>
          <ModalFooter>
            <Button onClick={onSessionModalClose}>Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* System Setup Modal */}
      <Modal isOpen={isSetupModalOpen} onClose={onSetupModalClose} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>System Setup & Information</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <VStack spacing={6}>
              <Alert status="info">
                <AlertIcon />
                <Box>
                  <AlertTitle>Pre-assigned Login ID System</AlertTitle>
                  <AlertDescription>
                    This system uses 1100 pre-assigned login IDs (0001-1100), each with 10 pre-assigned images.
                  </AlertDescription>
                </Box>
              </Alert>
              
              <Box w="full">
                <Text fontWeight="bold" mb={3}>System Features:</Text>
                <UnorderedList spacing={2}>
                  <ListItem>1100 unique login IDs (0001 to 1100)</ListItem>
                  <ListItem>Each ID has 10 pre-assigned images (5 from set1, 5 from set2)</ListItem>
                  <ListItem>Automatic assignment to Prolific participants</ListItem>
                  <ListItem>No image collision or assignment conflicts</ListItem>
                  <ListItem>Clear tracking of ID usage and completion</ListItem>
                </UnorderedList>
              </Box>
              
              <Box w="full">
                <Text fontWeight="bold" mb={2}>Prolific Integration:</Text>
                <Code p={2} display="block" fontSize="xs" bg="gray.100">
                  {generateProlificUrl()}
                </Code>
                <Button 
                  size="sm" 
                  mt={2} 
                  onClick={() => copyToClipboard(generateProlificUrl())}
                >
                  Copy Prolific URL
                </Button>
              </Box>
              
              {availableIds.length > 0 && (
                <Box w="full">
                  <Text fontWeight="bold" mb={2}>Sample Available IDs:</Text>
                  <HStack wrap="wrap" spacing={2}>
                    {availableIds.slice(0, 10).map(id => (
                      <Badge key={id.loginId} colorScheme="green">{id.loginId}</Badge>
                    ))}
                    {availableIds.length > 10 && (
                      <Text fontSize="sm" color="gray.600">...and {availableIds.length - 10} more</Text>
                    )}
                  </HStack>
                </Box>
              )}
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button onClick={onSetupModalClose}>Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Statistics Modal */}
      <Modal isOpen={isStatsModalOpen} onClose={onStatsModalClose} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Detailed Statistics</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            {systemStats && (
              <SimpleGrid columns={2} spacing={6}>
                <Card>
                  <CardHeader>
                    <Heading size="sm">Login ID Usage</Heading>
                  </CardHeader>
                  <CardBody>
                    <VStack spacing={2} align="start">
                      <HStack justify="space-between" w="full">
                        <Text fontSize="sm">Total IDs:</Text>
                        <Badge>{systemStats.totalLoginIds}</Badge>
                      </HStack>
                      <HStack justify="space-between" w="full">
                        <Text fontSize="sm">Available:</Text>
                        <Badge colorScheme="green">{systemStats.availableIds}</Badge>
                      </HStack>
                      <HStack justify="space-between" w="full">
                        <Text fontSize="sm">Assigned:</Text>
                        <Badge colorScheme="blue">{systemStats.assignedIds}</Badge>
                      </HStack>
                      <HStack justify="space-between" w="full">
                        <Text fontSize="sm">Usage Rate:</Text>
                        <Badge colorScheme="purple">
                          {systemStats.totalLoginIds > 0 
                            ? Math.round((systemStats.assignedIds / systemStats.totalLoginIds) * 100)
                            : 0}%
                        </Badge>
                      </HStack>
                    </VStack>
                  </CardBody>
                </Card>
                
                <Card>
                  <CardHeader>
                    <Heading size="sm">Participant Activity</Heading>
                  </CardHeader>
                  <CardBody>
                    <VStack spacing={2} align="start">
                      <HStack justify="space-between" w="full">
                        <Text fontSize="sm">Active Sessions:</Text>
                        <Badge colorScheme="blue">{systemStats.activeSessions}</Badge>
                      </HStack>
                      <HStack justify="space-between" w="full">
                        <Text fontSize="sm">Completed:</Text>
                        <Badge colorScheme="green">{systemStats.completedSessions}</Badge>
                      </HStack>
                      <HStack justify="space-between" w="full">
                        <Text fontSize="sm">Completion Rate:</Text>
                        <Badge colorScheme="orange">{systemStats.conversionRate}%</Badge>
                      </HStack>
                      <HStack justify="space-between" w="full">
                        <Text fontSize="sm">Remaining Slots:</Text>
                        <Badge colorScheme="gray">{systemStats.availableIds}</Badge>
                      </HStack>
                    </VStack>
                  </CardBody>
                </Card>
              </SimpleGrid>
            )}
          </ModalBody>
          <ModalFooter>
            <Button onClick={onStatsModalClose}>Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default AdminDashboard;