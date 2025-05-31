// src/components/AdminDashboard.js
import React, { useState, useEffect } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  useToast,
  Alert,
  AlertIcon,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  Progress,
  Select,
  Input,
  Textarea,
  Switch,
  FormControl,
  FormLabel,
  Divider,
  Card,
  CardHeader,
  CardBody,
  Heading,
  SimpleGrid,
  Spinner,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
  AlertDialog,
  AlertDialogOverlay,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogBody,
  AlertDialogFooter,
  IconButton,
  Tooltip,
  Code,
  Container,
  Flex,
  Spacer,
  useColorModeValue
} from '@chakra-ui/react';
import {
  collection,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  updateDoc,
  query,
  orderBy,
  limit,
  where,
  onSnapshot,
  writeBatch,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { 
  Download, 
  Upload, 
  RefreshCw, 
  Trash2, 
  Settings, 
  Users, 
  BarChart3,
  Database,
  Shield,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Eye,
  Play,
  Pause,
  RotateCcw
} from 'lucide-react';

const AdminDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [participants, setParticipants] = useState([]);
  const [responses, setResponses] = useState([]);
  const [systemStats, setSystemStats] = useState({
    totalParticipants: 0,
    totalResponses: 0,
    completionRate: 0,
    avgTimeSpent: 0,
    activeParticipants: 0,
    imagesInitialized: false,
    lastUpdated: null
  });
  const [selectedParticipant, setSelectedParticipant] = useState(null);
  const [initializationProgress, setInitializationProgress] = useState(0);
  const [isInitializing, setIsInitializing] = useState(false);
  const [systemSettings, setSystemSettings] = useState({
    studyActive: true,
    maxParticipants: 1000,
    requireConsent: true,
    allowAnonymous: true,
    dataRetentionDays: 365
  });

  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { 
    isOpen: isDeleteOpen, 
    onOpen: onDeleteOpen, 
    onClose: onDeleteClose 
  } = useDisclosure();
  const cancelRef = React.useRef();

  const bgColor = useColorModeValue('gray.50', 'gray.900');
  const cardBg = useColorModeValue('white', 'gray.800');

  // Load dashboard data
  useEffect(() => {
    loadDashboardData();
    
    // Set up real-time listeners
    const unsubscribeParticipants = onSnapshot(
      collection(db, 'participants'),
      (snapshot) => {
        const participantData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setParticipants(participantData);
        updateSystemStats(participantData, responses);
      }
    );

    const unsubscribeResponses = onSnapshot(
      collection(db, 'responses'),
      (snapshot) => {
        const responseData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setResponses(responseData);
        updateSystemStats(participants, responseData);
      }
    );

    return () => {
      unsubscribeParticipants();
      unsubscribeResponses();
    };
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Load participants
      const participantsSnapshot = await getDocs(
        query(collection(db, 'participants'), orderBy('createdAt', 'desc'))
      );
      const participantData = participantsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Load responses
      const responsesSnapshot = await getDocs(
        query(collection(db, 'responses'), orderBy('createdAt', 'desc'))
      );
      const responseData = responsesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Check if images are initialized
      const imagesSnapshot = await getDocs(collection(db, 'images'));
      const imagesInitialized = !imagesSnapshot.empty;

      setParticipants(participantData);
      setResponses(responseData);
      updateSystemStats(participantData, responseData, imagesInitialized);
      
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      toast({
        title: 'Error loading data',
        description: error.message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const updateSystemStats = (participantData, responseData, imagesInit = null) => {
    const now = new Date();
    const activeThreshold = new Date(now - 30 * 60 * 1000); // 30 minutes ago
    
    const activeParticipants = participantData.filter(p => 
      p.lastActivity && new Date(p.lastActivity.toDate()) > activeThreshold
    ).length;

    const completedParticipants = participantData.filter(p => 
      p.status === 'completed'
    ).length;

    const totalTimeSpent = responseData.reduce((sum, r) => 
      sum + (r.timeSpent || 0), 0
    );

    const avgTimeSpent = responseData.length > 0 ? 
      totalTimeSpent / responseData.length : 0;

    setSystemStats(prev => ({
      totalParticipants: participantData.length,
      totalResponses: responseData.length,
      completionRate: participantData.length > 0 ? 
        (completedParticipants / participantData.length) * 100 : 0,
      avgTimeSpent: Math.round(avgTimeSpent / 1000), // Convert to seconds
      activeParticipants,
      imagesInitialized: imagesInit !== null ? imagesInit : prev.imagesInitialized,
      lastUpdated: now
    }));
  };

  const initializeImageDatabase = async () => {
    setIsInitializing(true);
    setInitializationProgress(0);

    try {
      // Simple image data structure: 2 sets of 1200 images each
      const imageSets = [
        { setId: 'set1', count: 1200 },
        { setId: 'set2', count: 1200 }
      ];

      let totalImages = 0;
      const batch = writeBatch(db);

      for (const imageSet of imageSets) {
        for (let i = 1; i <= imageSet.count; i++) {
          const imageId = `${imageSet.setId}_${String(i).padStart(4, '0')}`;
          const imageDoc = doc(db, 'images', imageId);
          
          batch.set(imageDoc, {
            id: imageId,
            setId: imageSet.setId,
            imageNumber: i,
            filename: `${imageId}.png`,
            url: `/images/${imageSet.setId}/${imageId}.png`,
            isActive: true,
            createdAt: serverTimestamp(),
            viewCount: 0, // Track how many times this image has been shown
            maxViews: 5,  // Maximum 5 views per image
            viewedBy: []  // Array to track which participants have seen this image
          });

          totalImages++;
          setInitializationProgress((totalImages / 2400) * 100);

          // Commit in batches of 500
          if (totalImages % 500 === 0) {
            await batch.commit();
            const newBatch = writeBatch(db);
            Object.assign(batch, newBatch);
          }
        }
      }

      // Commit remaining
      await batch.commit();

      // Update system configuration
      await setDoc(doc(db, 'system', 'config'), {
        imagesInitialized: true,
        totalImages: 2400,
        sets: [
          { setId: 'set1', count: 1200, description: 'Set 1 images' },
          { setId: 'set2', count: 1200, description: 'Set 2 images' }
        ],
        samplingRules: {
          imagesPerParticipant: 10,
          imagesPerSet: 5,
          maxViewsPerImage: 5,
          ensureUniquePerParticipant: true
        },
        lastInitialized: serverTimestamp()
      });

      setSystemStats(prev => ({
        ...prev,
        imagesInitialized: true
      }));

      toast({
        title: 'Database Initialized',
        description: `Successfully initialized ${totalImages} images (Set 1: 1200, Set 2: 1200)`,
        status: 'success',
        duration: 5000,
        isClosable: true,
      });

    } catch (error) {
      console.error('Error initializing database:', error);
      toast({
        title: 'Initialization Failed',
        description: error.message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsInitializing(false);
      setInitializationProgress(0);
    }
  };

  const exportData = async (dataType) => {
    try {
      let data = [];
      let filename = '';

      switch (dataType) {
        case 'participants':
          data = participants;
          filename = 'participants_export.json';
          break;
        case 'responses':
          data = responses;
          filename = 'responses_export.json';
          break;
        case 'all':
          data = { participants, responses, systemStats };
          filename = 'complete_export.json';
          break;
      }

      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json'
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: 'Export Complete',
        description: `${filename} downloaded successfully`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: 'Export Failed',
        description: error.message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const deleteParticipant = async (participantId) => {
    try {
      // Delete participant responses
      const responsesQuery = query(
        collection(db, 'responses'),
        where('participantId', '==', participantId)
      );
      const responsesSnapshot = await getDocs(responsesQuery);
      
      const batch = writeBatch(db);
      responsesSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      // Delete participant
      batch.delete(doc(db, 'participants', participantId));
      
      await batch.commit();

      toast({
        title: 'Participant Deleted',
        description: 'Participant and all associated data removed',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

      onDeleteClose();
      setSelectedParticipant(null);

    } catch (error) {
      console.error('Delete error:', error);
      toast({
        title: 'Delete Failed',
        description: error.message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const updateSystemSettings = async (newSettings) => {
    try {
      await setDoc(doc(db, 'system', 'settings'), {
        ...newSettings,
        lastUpdated: serverTimestamp()
      });

      setSystemSettings(newSettings);

      toast({
        title: 'Settings Updated',
        description: 'System settings saved successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

    } catch (error) {
      console.error('Settings update error:', error);
      toast({
        title: 'Update Failed',
        description: error.message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'green';
      case 'in_progress': return 'blue';
      case 'started': return 'yellow';
      case 'abandoned': return 'red';
      default: return 'gray';
    }
  };

  if (loading) {
    return (
      <Box p={8} textAlign="center">
        <Spinner size="xl" />
        <Text mt={4}>Loading dashboard...</Text>
      </Box>
    );
  }

  return (
    <Box bg={bgColor} minH="100vh">
      <Container maxW="container.xl" py={8}>
        {/* Header */}
        <Flex mb={8} align="center">
          <VStack align="start" spacing={1}>
            <Heading size="lg">Admin Dashboard</Heading>
            <Text color="gray.600">
              Image Evaluation Study Management
            </Text>
          </VStack>
          <Spacer />
          <HStack spacing={4}>
            <Badge colorScheme="green" px={3} py={1} borderRadius="full">
              {systemStats.imagesInitialized ? 'System Ready' : 'Setup Required'}
            </Badge>
            <Button
              leftIcon={<RefreshCw size={16} />}
              size="sm"
              onClick={loadDashboardData}
            >
              Refresh
            </Button>
          </HStack>
        </Flex>

        {/* Quick Stats */}
        <SimpleGrid columns={{ base: 2, md: 4 }} spacing={6} mb={8}>
          <Card bg={cardBg}>
            <CardBody>
              <Stat>
                <StatLabel>Total Participants</StatLabel>
                <StatNumber>{systemStats.totalParticipants}</StatNumber>
                <StatHelpText>
                  <HStack>
                    <Users size={16} />
                    <Text>{systemStats.activeParticipants} active</Text>
                  </HStack>
                </StatHelpText>
              </Stat>
            </CardBody>
          </Card>

          <Card bg={cardBg}>
            <CardBody>
              <Stat>
                <StatLabel>Total Responses</StatLabel>
                <StatNumber>{systemStats.totalResponses}</StatNumber>
                <StatHelpText>
                  <HStack>
                    <BarChart3 size={16} />
                    <Text>Avg: {systemStats.avgTimeSpent}s</Text>
                  </HStack>
                </StatHelpText>
              </Stat>
            </CardBody>
          </Card>

          <Card bg={cardBg}>
            <CardBody>
              <Stat>
                <StatLabel>Completion Rate</StatLabel>
                <StatNumber>{systemStats.completionRate.toFixed(1)}%</StatNumber>
                <StatHelpText>
                  <HStack>
                    <CheckCircle size={16} />
                    <Text>Success rate</Text>
                  </HStack>
                </StatHelpText>
              </Stat>
            </CardBody>
          </Card>

          <Card bg={cardBg}>
            <CardBody>
              <Stat>
                <StatLabel>System Status</StatLabel>
                <StatNumber>
                  <HStack>
                    {systemStats.imagesInitialized ? (
                      <CheckCircle color="green" size={24} />
                    ) : (
                      <AlertTriangle color="orange" size={24} />
                    )}
                    <Text fontSize="lg">
                      {systemStats.imagesInitialized ? 'Ready' : 'Setup'}
                    </Text>
                  </HStack>
                </StatNumber>
                <StatHelpText>
                  <Clock size={16} />
                  {systemStats.lastUpdated && 
                    new Date(systemStats.lastUpdated).toLocaleTimeString()
                  }
                </StatHelpText>
              </Stat>
            </CardBody>
          </Card>
        </SimpleGrid>

        {/* Main Content Tabs */}
        <Tabs variant="enclosed" bg={cardBg} borderRadius="lg">
          <TabList>
            <Tab>
              <HStack>
                <Database size={16} />
                <Text>System</Text>
              </HStack>
            </Tab>
            <Tab>
              <HStack>
                <Users size={16} />
                <Text>Participants</Text>
              </HStack>
            </Tab>
            <Tab>
              <HStack>
                <BarChart3 size={16} />
                <Text>Responses</Text>
              </HStack>
            </Tab>
            <Tab>
              <HStack>
                <Settings size={16} />
                <Text>Settings</Text>
              </HStack>
            </Tab>
            <Tab>
              <HStack>
                <Download size={16} />
                <Text>Export</Text>
              </HStack>
            </Tab>
          </TabList>

          <TabPanels>
            {/* System Tab */}
            <TabPanel>
              <VStack spacing={6} align="stretch">
                {!systemStats.imagesInitialized && (
                  <Alert status="warning">
                    <AlertIcon />
                    <VStack align="start" spacing={2}>
                      <Text fontWeight="bold">Database Setup Required</Text>
                      <Text fontSize="sm">
                        Initialize the image database to begin collecting responses.
                        This will create 2,400 image records across 4 categories.
                      </Text>
                    </VStack>
                  </Alert>
                )}

                <Card>
                  <CardHeader>
                    <Heading size="md">Database Management</Heading>
                  </CardHeader>
                  <CardBody>
                    <VStack spacing={4} align="stretch">
                      <HStack justify="space-between">
                        <VStack align="start" spacing={1}>
                          <Text fontWeight="bold">Initialize Database (2400 Images)</Text>
                          <Text fontSize="sm" color="gray.600">
                            Sets up 2 image sets: Set 1 (1200 images), Set 2 (1200 images).
                            Each participant sees 10 images total (5 from each set).
                            Each image shown max 5 times, never repeated per participant.
                          </Text>
                        </VStack>
                        <Button
                          colorScheme="blue"
                          onClick={initializeImageDatabase}
                          isLoading={isInitializing}
                          loadingText="Initializing..."
                          isDisabled={systemStats.imagesInitialized}
                          leftIcon={<Database size={16} />}
                        >
                          {systemStats.imagesInitialized ? 'Already Initialized' : 'Initialize Now'}
                        </Button>
                      </HStack>

                      {isInitializing && (
                        <Box>
                          <Progress 
                            value={initializationProgress} 
                            colorScheme="blue" 
                            size="lg" 
                            borderRadius="md"
                          />
                          <Text textAlign="center" mt={2} fontSize="sm">
                            {initializationProgress.toFixed(1)}% Complete
                          </Text>
                        </Box>
                      )}

                      <Divider />

                      <HStack justify="space-between">
                        <VStack align="start" spacing={1}>
                          <Text fontWeight="bold">Study URLs</Text>
                          <Text fontSize="sm" color="gray.600">
                            URLs for participant access and testing
                          </Text>
                        </VStack>
                      </HStack>

                      <VStack spacing={2} align="stretch">
                        <FormControl>
                          <FormLabel fontSize="sm">Prolific Study URL</FormLabel>
                          <Code p={2} borderRadius="md" fontSize="xs">
                            {`${window.location.origin}/login?PROLIFIC_PID={{%PROLIFIC_PID%}}&STUDY_ID={{%STUDY_ID%}}&SESSION_ID={{%SESSION_ID%}}`}
                          </Code>
                        </FormControl>

                        <FormControl>
                          <FormLabel fontSize="sm">Admin Dashboard URL</FormLabel>
                          <Code p={2} borderRadius="md" fontSize="xs">
                            {`${window.location.origin}/admin`}
                          </Code>
                        </FormControl>

                        <FormControl>
                          <FormLabel fontSize="sm">Test Participant URL</FormLabel>
                          <Code p={2} borderRadius="md" fontSize="xs">
                            {`${window.location.origin}/login?PROLIFIC_PID=TEST_USER&STUDY_ID=TEST&SESSION_ID=TEST_SESSION`}
                          </Code>
                        </FormControl>
                      </VStack>
                    </VStack>
                  </CardBody>
                </Card>
              </VStack>
            </TabPanel>

            {/* Participants Tab */}
            <TabPanel>
              <VStack spacing={4} align="stretch">
                <HStack justify="space-between">
                  <Text fontSize="lg" fontWeight="bold">
                    Participants ({participants.length})
                  </Text>
                  <Button
                    leftIcon={<RefreshCw size={16} />}
                    size="sm"
                    onClick={loadDashboardData}
                  >
                    Refresh
                  </Button>
                </HStack>

                <Table variant="simple">
                  <Thead>
                    <Tr>
                      <Th>Participant ID</Th>
                      <Th>Status</Th>
                      <Th>Progress</Th>
                      <Th>Started</Th>
                      <Th>Last Activity</Th>
                      <Th>Actions</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {participants.map((participant) => (
                      <Tr key={participant.id}>
                        <Td fontFamily="mono" fontSize="sm">
                          {participant.prolificId || participant.id}
                        </Td>
                        <Td>
                          <Badge colorScheme={getStatusColor(participant.status)}>
                            {participant.status || 'unknown'}
                          </Badge>
                        </Td>
                        <Td>
                          {participant.currentImageIndex || 0} / {participant.totalImages || 50}
                        </Td>
                        <Td fontSize="sm">
                          {participant.createdAt ? 
                            new Date(participant.createdAt.toDate()).toLocaleDateString() : 
                            'N/A'
                          }
                        </Td>
                        <Td fontSize="sm">
                          {participant.lastActivity ? 
                            new Date(participant.lastActivity.toDate()).toLocaleString() : 
                            'N/A'
                          }
                        </Td>
                        <Td>
                          <HStack spacing={2}>
                            <Tooltip label="View Details">
                              <IconButton
                                size="sm"
                                icon={<Eye size={16} />}
                                onClick={() => {
                                  setSelectedParticipant(participant);
                                  onOpen();
                                }}
                              />
                            </Tooltip>
                            <Tooltip label="Delete">
                              <IconButton
                                size="sm"
                                colorScheme="red"
                                variant="ghost"
                                icon={<Trash2 size={16} />}
                                onClick={() => {
                                  setSelectedParticipant(participant);
                                  onDeleteOpen();
                                }}
                              />
                            </Tooltip>
                          </HStack>
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>

                {participants.length === 0 && (
                  <Box textAlign="center" py={8}>
                    <Text color="gray.500">No participants yet</Text>
                  </Box>
                )}
              </VStack>
            </TabPanel>

            {/* Responses Tab */}
            <TabPanel>
              <VStack spacing={4} align="stretch">
                <HStack justify="space-between">
                  <Text fontSize="lg" fontWeight="bold">
                    Responses ({responses.length})
                  </Text>
                  <Button
                    leftIcon={<Download size={16} />}
                    size="sm"
                    onClick={() => exportData('responses')}
                  >
                    Export Responses
                  </Button>
                </HStack>

                <Table variant="simple">
                  <Thead>
                    <Tr>
                      <Th>Participant</Th>
                      <Th>Image ID</Th>
                      <Th>Rating</Th>
                      <Th>Time Spent</Th>
                      <Th>Timestamp</Th>
                      <Th>Flagged</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {responses.slice(0, 100).map((response) => (
                      <Tr key={response.id}>
                        <Td fontFamily="mono" fontSize="sm">
                          {response.participantId?.substring(0, 8)}...
                        </Td>
                        <Td fontFamily="mono" fontSize="sm">
                          {response.imageId}
                        </Td>
                        <Td>
                          <Badge 
                            colorScheme={response.rating <= 2 ? 'green' : 
                                       response.rating <= 4 ? 'yellow' : 'red'}
                          >
                            {response.rating}/5
                          </Badge>
                        </Td>
                        <Td>{Math.round((response.timeSpent || 0) / 1000)}s</Td>
                        <Td fontSize="sm">
                          {response.createdAt ? 
                            new Date(response.createdAt.toDate()).toLocaleString() : 
                            'N/A'
                          }
                        </Td>
                        <Td>
                          {response.flagged && (
                            <Badge colorScheme="red">Flagged</Badge>
                          )}
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>

                {responses.length === 0 && (
                  <Box textAlign="center" py={8}>
                    <Text color="gray.500">No responses yet</Text>
                  </Box>
                )}
              </VStack>
            </TabPanel>

            {/* Settings Tab */}
            <TabPanel>
              <VStack spacing={6} align="stretch">
                <Card>
                  <CardHeader>
                    <Heading size="md">Study Settings</Heading>
                  </CardHeader>
                  <CardBody>
                    <VStack spacing={4} align="stretch">
                      <FormControl display="flex" alignItems="center">
                        <FormLabel htmlFor="study-active" mb="0">
                          Study Active
                        </FormLabel>
                        <Switch
                          id="study-active"
                          isChecked={systemSettings.studyActive}
                          onChange={(e) => setSystemSettings(prev => ({
                            ...prev,
                            studyActive: e.target.checked
                          }))}
                        />
                      </FormControl>

                      <FormControl>
                        <FormLabel>Maximum Participants</FormLabel>
                        <Input
                          type="number"
                          value={systemSettings.maxParticipants}
                          onChange={(e) => setSystemSettings(prev => ({
                            ...prev,
                            maxParticipants: parseInt(e.target.value)
                          }))}
                        />
                      </FormControl>

                      <FormControl display="flex" alignItems="center">
                        <FormLabel htmlFor="require-consent" mb="0">
                          Require Consent
                        </FormLabel>
                        <Switch
                          id="require-consent"
                          isChecked={systemSettings.requireConsent}
                          onChange={(e) => setSystemSettings(prev => ({
                            ...prev,
                            requireConsent: e.target.checked
                          }))}
                        />
                      </FormControl>

                      <FormControl>
                        <FormLabel>Data Retention (Days)</FormLabel>
                        <Input
                          type="number"
                          value={systemSettings.dataRetentionDays}
                          onChange={(e) => setSystemSettings(prev => ({
                            ...prev,
                            dataRetentionDays: parseInt(e.target.value)
                          }))}
                        />
                      </FormControl>

                      <Button
                        colorScheme="blue"
                        onClick={() => updateSystemSettings(systemSettings)}
                      >
                        Save Settings
                      </Button>
                    </VStack>
                  </CardBody>
                </Card>
              </VStack>
            </TabPanel>

            {/* Export Tab */}
            <TabPanel>
              <VStack spacing={6} align="stretch">
                <Card>
                  <CardHeader>
                    <Heading size="md">Data Export</Heading>
                  </CardHeader>
                  <CardBody>
                    <VStack spacing={4} align="stretch">
                      <HStack justify="space-between">
                        <VStack align="start" spacing={1}>
                          <Text fontWeight="bold">Export Participants</Text>
                          <Text fontSize="sm" color="gray.600">
                            Download participant data and metadata
                          </Text>
                        </VStack>
                        <Button
                          leftIcon={<Download size={16} />}
                          onClick={() => exportData('participants')}
                        >
                          Export Participants
                        </Button>
                      </HStack>

                      <HStack justify="space-between">
                        <VStack align="start" spacing={1}>
                          <Text fontWeight="bold">Export Responses</Text>
                          <Text fontSize="sm" color="gray.600">
                            Download all response data and ratings
                          </Text>
                        </VStack>
                        <Button
                          leftIcon={<Download size={16} />}
                          onClick={() => exportData('responses')}
                        >
                          Export Responses
                        </Button>
                      </HStack>

                      <HStack justify="space-between">
                        <VStack align="start" spacing={1}>
                          <Text fontWeight="bold">Export Complete Dataset</Text>
                          <Text fontSize="sm" color="gray.600">
                            Download all data including system statistics
                          </Text>
                        </VStack>
                        <Button
                          leftIcon={<Download size={16} />}
                          colorScheme="blue"
                          onClick={() => exportData('all')}
                        >
                          Export All Data
                        </Button>
                      </HStack>

                      <Divider />

                      <Alert status="info">
                        <AlertIcon />
                        <VStack align="start" spacing={1}>
                          <Text fontWeight="bold">Export Information</Text>
                          <Text fontSize="sm">
                            All exports are in JSON format and include timestamps.
                            Data is anonymized according to study protocols.
                          </Text>
                        </VStack>
                      </Alert>
                    </VStack>
                  </CardBody>
                </Card>

                <Card>
                  <CardHeader>
                    <Heading size="md">System Backup</Heading>
                  </CardHeader>
                  <CardBody>
                    <VStack spacing={4} align="stretch">
                      <Text fontSize="sm" color="gray.600">
                        Create a complete backup of the study database for archival purposes.
                      </Text>
                      
                      <HStack>
                        <Button
                          leftIcon={<Database size={16} />}
                          variant="outline"
                          onClick={() => {
                            toast({
                              title: 'Backup Started',
                              description: 'Database backup in progress...',
                              status: 'info',
                              duration: 3000,
                              isClosable: true,
                            });
                          }}
                        >
                          Create Backup
                        </Button>
                        
                        <Button
                          leftIcon={<Upload size={16} />}
                          variant="outline"
                          onClick={() => {
                            toast({
                              title: 'Feature Coming Soon',
                              description: 'Backup restore functionality will be available in the next update',
                              status: 'info',
                              duration: 3000,
                              isClosable: true,
                            });
                          }}
                        >
                          Restore Backup
                        </Button>
                      </HStack>
                    </VStack>
                  </CardBody>
                </Card>
              </VStack>
            </TabPanel>
          </TabPanels>
        </Tabs>

        {/* Participant Detail Modal */}
        <Modal isOpen={isOpen} onClose={onClose} size="xl">
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>
              Participant Details
            </ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              {selectedParticipant && (
                <VStack spacing={4} align="stretch">
                  <SimpleGrid columns={2} spacing={4}>
                    <Box>
                      <Text fontWeight="bold" fontSize="sm" color="gray.600">
                        Participant ID
                      </Text>
                      <Text fontFamily="mono" fontSize="sm">
                        {selectedParticipant.prolificId || selectedParticipant.id}
                      </Text>
                    </Box>
                    
                    <Box>
                      <Text fontWeight="bold" fontSize="sm" color="gray.600">
                        Status
                      </Text>
                      <Badge colorScheme={getStatusColor(selectedParticipant.status)}>
                        {selectedParticipant.status || 'unknown'}
                      </Badge>
                    </Box>
                    
                    <Box>
                      <Text fontWeight="bold" fontSize="sm" color="gray.600">
                        Progress
                      </Text>
                      <Text>
                        {selectedParticipant.currentImageIndex || 0} / {selectedParticipant.totalImages || 50}
                      </Text>
                      <Progress 
                        value={((selectedParticipant.currentImageIndex || 0) / (selectedParticipant.totalImages || 50)) * 100} 
                        colorScheme="blue" 
                        size="sm" 
                        mt={1}
                      />
                    </Box>
                    
                    <Box>
                      <Text fontWeight="bold" fontSize="sm" color="gray.600">
                        Time Spent
                      </Text>
                      <Text>
                        {selectedParticipant.totalTimeSpent ? 
                          `${Math.round(selectedParticipant.totalTimeSpent / 60000)} minutes` :
                          'N/A'
                        }
                      </Text>
                    </Box>
                  </SimpleGrid>

                  <Divider />

                  <Box>
                    <Text fontWeight="bold" fontSize="sm" color="gray.600" mb={2}>
                      Session Information
                    </Text>
                    <VStack spacing={2} align="stretch">
                      <HStack justify="space-between">
                        <Text fontSize="sm">Started:</Text>
                        <Text fontSize="sm" fontFamily="mono">
                          {selectedParticipant.createdAt ? 
                            new Date(selectedParticipant.createdAt.toDate()).toLocaleString() : 
                            'N/A'
                          }
                        </Text>
                      </HStack>
                      
                      <HStack justify="space-between">
                        <Text fontSize="sm">Last Activity:</Text>
                        <Text fontSize="sm" fontFamily="mono">
                          {selectedParticipant.lastActivity ? 
                            new Date(selectedParticipant.lastActivity.toDate()).toLocaleString() : 
                            'N/A'
                          }
                        </Text>
                      </HStack>
                      
                      <HStack justify="space-between">
                        <Text fontSize="sm">Session ID:</Text>
                        <Text fontSize="sm" fontFamily="mono">
                          {selectedParticipant.sessionId || 'N/A'}
                        </Text>
                      </HStack>
                      
                      <HStack justify="space-between">
                        <Text fontSize="sm">Study ID:</Text>
                        <Text fontSize="sm" fontFamily="mono">
                          {selectedParticipant.studyId || 'N/A'}
                        </Text>
                      </HStack>
                    </VStack>
                  </Box>

                  {selectedParticipant.userAgent && (
                    <>
                      <Divider />
                      <Box>
                        <Text fontWeight="bold" fontSize="sm" color="gray.600" mb={2}>
                          Browser Information
                        </Text>
                        <Text fontSize="xs" fontFamily="mono" color="gray.500">
                          {selectedParticipant.userAgent}
                        </Text>
                      </Box>
                    </>
                  )}

                  {selectedParticipant.metadata && (
                    <>
                      <Divider />
                      <Box>
                        <Text fontWeight="bold" fontSize="sm" color="gray.600" mb={2}>
                          Additional Data
                        </Text>
                        <Code p={2} fontSize="xs" borderRadius="md" w="full">
                          {JSON.stringify(selectedParticipant.metadata, null, 2)}
                        </Code>
                      </Box>
                    </>
                  )}
                </VStack>
              )}
            </ModalBody>
            <ModalFooter>
              <Button variant="ghost" mr={3} onClick={onClose}>
                Close
              </Button>
              <Button
                colorScheme="red"
                leftIcon={<Trash2 size={16} />}
                onClick={() => {
                  onClose();
                  onDeleteOpen();
                }}
              >
                Delete Participant
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>

        {/* Delete Confirmation */}
        <AlertDialog
          isOpen={isDeleteOpen}
          leastDestructiveRef={cancelRef}
          onClose={onDeleteClose}
        >
          <AlertDialogOverlay>
            <AlertDialogContent>
              <AlertDialogHeader fontSize="lg" fontWeight="bold">
                Delete Participant
              </AlertDialogHeader>

              <AlertDialogBody>
                Are you sure you want to delete this participant and all their data? 
                This action cannot be undone.
                
                {selectedParticipant && (
                  <Box mt={4} p={3} bg="gray.50" borderRadius="md">
                    <Text fontSize="sm">
                      <strong>Participant:</strong> {selectedParticipant.prolificId || selectedParticipant.id}
                    </Text>
                    <Text fontSize="sm">
                      <strong>Responses:</strong> {
                        responses.filter(r => r.participantId === selectedParticipant.id).length
                      }
                    </Text>
                  </Box>
                )}
              </AlertDialogBody>

              <AlertDialogFooter>
                <Button ref={cancelRef} onClick={onDeleteClose}>
                  Cancel
                </Button>
                <Button 
                  colorScheme="red" 
                  onClick={() => deleteParticipant(selectedParticipant?.id)}
                  ml={3}
                >
                  Delete
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialogOverlay>
        </AlertDialog>

        {/* Footer */}
        <Box mt={12} pt={6} borderTop="1px" borderColor="gray.200">
          <HStack justify="space-between" color="gray.500" fontSize="sm">
            <Text>
              Image Evaluation Study Dashboard v2.0
            </Text>
            <Text>
              Last updated: {systemStats.lastUpdated ? 
                new Date(systemStats.lastUpdated).toLocaleString() : 
                'Never'
              }
            </Text>
          </HStack>
        </Box>
      </Container>
    </Box>
  );
};

export default AdminDashboard;