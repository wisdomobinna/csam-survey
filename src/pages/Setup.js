// src/pages/Setup.js - Updated setup page with migration utility
import React, { useState, useEffect, useCallback } from 'react';
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
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  useToast,
  Spinner,
  Badge,
  Icon,
  OrderedList,
  ListItem,
  Progress,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  useDisclosure,
  Code
} from '@chakra-ui/react';
import {
  Database,
  CheckCircle,
  AlertTriangle,
  Settings,
  RefreshCw,
  Trash2,
  Shield,
  Image as ImageIcon,
  Upload,
  Play
} from 'lucide-react';

import { 
  runCompleteMigration,
  clearOldFirestoreData,
  verifyStorageAccess,
  getCurrentSystemStatus
} from '../utils/firestoreMigration';

const Setup = () => {
  const [loading, setLoading] = useState(false);
  const [systemStatus, setSystemStatus] = useState(null);
  const [storageVerification, setStorageVerification] = useState(null);
  const [migrationProgress, setMigrationProgress] = useState(0);
  const [migrationStatus, setMigrationStatus] = useState('');
  const [migrationResults, setMigrationResults] = useState(null);
  const [verifying, setVerifying] = useState(false);

  const { isOpen: isMigrationModalOpen, onOpen: onMigrationModalOpen, onClose: onMigrationModalClose } = useDisclosure();
  
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => {
    // Check if user is admin
    const isAdmin = sessionStorage.getItem('isAdmin');
    if (!isAdmin || isAdmin !== 'true') {
      navigate('/login');
    } else {
      // Load current system status
      loadSystemStatus();
    }
  }, [navigate, loadSystemStatus]);

  const loadSystemStatus = useCallback(async () => {
    try {
      setVerifying(true);
      
      console.log('Loading system status...');
      const status = await getCurrentSystemStatus();
      setSystemStatus(status);
      
      console.log('System status:', status);
      
    } catch (error) {
      console.error('Error loading system status:', error);
      toast({
        title: 'Status Check Failed',
        description: error.message,
        status: 'error',
        duration: 5000,
      });
    } finally {
      setVerifying(false);
    }
  }, [toast]);

  const handleVerifyStorage = async () => {
    try {
      setVerifying(true);
      
      toast({
        title: 'Verifying Storage',
        description: 'Checking access to Firebase Storage images...',
        status: 'info',
        duration: 2000,
      });

      const verification = await verifyStorageAccess();
      setStorageVerification(verification);

      if (verification.allAccessible) {
        toast({
          title: 'Storage Verified',
          description: `All ${verification.totalTested} test images are accessible`,
          status: 'success',
          duration: 3000,
        });
      } else {
        toast({
          title: 'Storage Issues Found',
          description: `Only ${verification.accessibleCount}/${verification.totalTested} images accessible`,
          status: 'warning',
          duration: 5000,
        });
      }
      
    } catch (error) {
      console.error('Storage verification error:', error);
      toast({
        title: 'Verification Failed',
        description: error.message,
        status: 'error',
        duration: 5000,
      });
    } finally {
      setVerifying(false);
    }
  };

  const handleRunMigration = async () => {
    onMigrationModalOpen();
    
    try {
      setLoading(true);
      setMigrationProgress(0);
      setMigrationStatus('Starting migration...');
      setMigrationResults(null);
      
      const results = await runCompleteMigration((progress, status) => {
        setMigrationProgress(progress);
        setMigrationStatus(status);
      });
      
      setMigrationResults(results);
      
      toast({
        title: 'Migration Complete!',
        description: `Successfully created ${results.createResults.totalCreated} login IDs`,
        status: 'success',
        duration: 5000,
      });
      
      // Reload system status
      await loadSystemStatus();
      
    } catch (error) {
      console.error('Migration error:', error);
      setMigrationResults({
        success: false,
        error: error.message
      });
      
      toast({
        title: 'Migration Failed',
        description: error.message,
        status: 'error',
        duration: 5000,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClearOldData = async () => {
    if (!window.confirm('Clear all old Firestore data? This will delete the old system collections but keep any new pre-assigned data.')) {
      return;
    }

    try {
      setLoading(true);
      
      toast({
        title: 'Clearing Old Data',
        description: 'Removing old Firestore collections...',
        status: 'warning',
        duration: 3000,
      });

      const results = await clearOldFirestoreData();

      toast({
        title: 'Old Data Cleared',
        description: `Deleted ${results.totalDeleted} documents from ${results.deleted.length} collections`,
        status: 'success',
        duration: 3000,
      });

      // Reload system status
      await loadSystemStatus();
      
    } catch (error) {
      console.error('Clear data error:', error);
      toast({
        title: 'Clear Failed',
        description: error.message,
        status: 'error',
        duration: 5000,
      });
    } finally {
      setLoading(false);
    }
  };

  const isSystemInitialized = systemStatus && systemStatus.initialized;
  const hasCorrectLoginCount = systemStatus && systemStatus.totalLoginIds === systemStatus.expectedLoginIds;

  return (
    <Box minH="100vh" bg="gray.50">
      <Container maxW="4xl" py={8}>
        <VStack spacing={6}>
          {/* Header */}
          <Card w="full">
            <CardHeader>
              <HStack>
                <Icon as={Settings} color="blue.500" />
                <Heading size="lg">System Migration & Setup</Heading>
              </HStack>
            </CardHeader>
            <CardBody>
              <VStack spacing={4}>
                <Text color="gray.600">
                  Migrate from the old dynamic assignment system to the new pre-assigned login ID system.
                </Text>
                
                <HStack spacing={4} flexWrap="wrap">
                  <Button
                    leftIcon={<Database />}
                    colorScheme="blue"
                    onClick={handleVerifyStorage}
                    isLoading={verifying}
                    loadingText="Verifying..."
                  >
                    Verify Storage Access
                  </Button>
                  
                  <Button
                    leftIcon={<Upload />}
                    colorScheme="green"
                    onClick={handleRunMigration}
                    isLoading={loading}
                    loadingText="Migrating..."
                    isDisabled={isSystemInitialized && hasCorrectLoginCount}
                  >
                    Run Complete Migration
                  </Button>
                  
                  <Button
                    leftIcon={<RefreshCw />}
                    colorScheme="orange"
                    variant="outline"
                    onClick={loadSystemStatus}
                    isLoading={verifying}
                  >
                    Refresh Status
                  </Button>
                  
                  <Button
                    leftIcon={<Trash2 />}
                    colorScheme="red"
                    variant="outline"
                    onClick={handleClearOldData}
                    isLoading={loading}
                  >
                    Clear Old Data Only
                  </Button>
                </HStack>
              </VStack>
            </CardBody>
          </Card>

          {/* Current System Status */}
          {systemStatus && (
            <Card w="full">
              <CardHeader>
                <HStack>
                  <Icon 
                    as={isSystemInitialized ? CheckCircle : AlertTriangle} 
                    color={isSystemInitialized ? "green.500" : "orange.500"} 
                  />
                  <Heading size="md">
                    Current System Status: {isSystemInitialized ? 'Initialized' : 'Not Initialized'}
                  </Heading>
                </HStack>
              </CardHeader>
              <CardBody>
                <VStack spacing={4} align="start">
                  {isSystemInitialized ? (
                    <>
                      <Alert status="success">
                        <AlertIcon />
                        <Box>
                          <AlertTitle>System Initialized!</AlertTitle>
                          <AlertDescription>
                            Pre-assigned login system is operational with {systemStatus.totalLoginIds} login IDs.
                          </AlertDescription>
                        </Box>
                      </Alert>
                      
                      <HStack spacing={8} w="full">
                        <VStack align="start">
                          <Text fontSize="sm" fontWeight="bold">System Details</Text>
                          <HStack spacing={4}>
                            <Badge colorScheme="green">Version: {systemStatus.systemVersion}</Badge>
                            <Badge colorScheme="blue">Login IDs: {systemStatus.totalLoginIds}</Badge>
                            <Badge colorScheme="purple">Expected: {systemStatus.expectedLoginIds}</Badge>
                          </HStack>
                          {hasCorrectLoginCount ? (
                            <Badge colorScheme="green">✅ Correct login count</Badge>
                          ) : (
                            <Badge colorScheme="red">❌ Login count mismatch</Badge>
                          )}
                        </VStack>
                      </HStack>
                    </>
                  ) : (
                    <Alert status="warning">
                      <AlertIcon />
                      <Box>
                        <AlertTitle>System Not Initialized</AlertTitle>
                        <AlertDescription>
                          Run the complete migration to set up the pre-assigned login ID system.
                        </AlertDescription>
                      </Box>
                    </Alert>
                  )}
                </VStack>
              </CardBody>
            </Card>
          )}

          {/* Storage Verification Results */}
          {storageVerification && (
            <Card w="full">
              <CardHeader>
                <HStack>
                  <Icon 
                    as={storageVerification.allAccessible ? CheckCircle : AlertTriangle} 
                    color={storageVerification.allAccessible ? "green.500" : "red.500"} 
                  />
                  <Heading size="md">
                    Storage Access: {storageVerification.allAccessible ? 'All Images Accessible' : 'Issues Found'}
                  </Heading>
                </HStack>
              </CardHeader>
              <CardBody>
                <VStack spacing={4} align="start">
                  {storageVerification.allAccessible ? (
                    <Alert status="success">
                      <AlertIcon />
                      <Box>
                        <AlertTitle>Storage Ready!</AlertTitle>
                        <AlertDescription>
                          All {storageVerification.totalTested} test images are accessible in Firebase Storage.
                        </AlertDescription>
                      </Box>
                    </Alert>
                  ) : (
                    <Alert status="error">
                      <AlertIcon />
                      <Box>
                        <AlertTitle>Storage Issues Detected</AlertTitle>
                        <AlertDescription>
                          Only {storageVerification.accessibleCount}/{storageVerification.totalTested} test images are accessible.
                        </AlertDescription>
                      </Box>
                    </Alert>
                  )}
                  
                  <Box w="full">
                    <Text fontWeight="bold" mb={2}>Test Results:</Text>
                    <VStack spacing={2} align="start">
                      {storageVerification.results.map((result, index) => (
                        <HStack key={index}>
                          <Icon 
                            as={result.accessible ? CheckCircle : AlertTriangle}
                            color={result.accessible ? 'green.500' : 'red.500'}
                            size={16}
                          />
                          <Text fontSize="sm">
                            {result.path}: {result.accessible ? 'Accessible' : result.error}
                          </Text>
                        </HStack>
                      ))}
                    </VStack>
                  </Box>
                </VStack>
              </CardBody>
            </Card>
          )}

          {/* Migration Instructions */}
          <Card w="full">
            <CardHeader>
              <HStack>
                <Icon as={ImageIcon} color="purple.500" />
                <Heading size="md">Migration Instructions</Heading>
              </HStack>
            </CardHeader>
            <CardBody>
              <VStack spacing={4} align="start">
                <Text fontWeight="bold">What the migration does:</Text>
                <OrderedList spacing={2} fontSize="sm">
                  <ListItem>
                    <strong>Clears old collections:</strong> Removes <Code>imageAssignments</Code>, <Code>images</Code>, <Code>loginIDs</Code>, <Code>userProgress</Code>, <Code>system</Code>, and <Code>test</Code>
                  </ListItem>
                  <ListItem>
                    <strong>Creates pre-assigned logins:</strong> Generates 1100 login IDs (0001-1100) with balanced image assignments
                  </ListItem>
                  <ListItem>
                    <strong>Balances assignments:</strong> Each image gets assigned to exactly 5 participants maximum
                  </ListItem>
                  <ListItem>
                    <strong>Verifies image URLs:</strong> Tests access to Firebase Storage images during creation
                  </ListItem>
                  <ListItem>
                    <strong>Creates new collections:</strong> Sets up <Code>preAssignedLogins</Code>, <Code>imageMetadata</Code>, and <Code>systemConfig</Code>
                  </ListItem>
                </OrderedList>
                
                <Alert status="info" size="sm">
                  <AlertIcon />
                  <Text fontSize="sm">
                    <strong>Safe to run:</strong> The migration only affects Firestore collections, not your Firebase Storage images.
                  </Text>
                </Alert>
                
                <Text fontWeight="bold" mt={4}>Required Firebase Storage Structure:</Text>
                <OrderedList spacing={2} fontSize="sm">
                  <ListItem>Folder: <Code>set1/</Code> with images 1.png through 1200.png</ListItem>
                  <ListItem>Folder: <Code>set2/</Code> with images 1201.png through 2400.png</ListItem>
                </OrderedList>
              </VStack>
            </CardBody>
          </Card>

          {/* Navigation */}
          <HStack spacing={4}>
            <Button
              leftIcon={<Shield />}
              colorScheme="green"
              onClick={() => navigate('/admin')}
              variant="outline"
            >
              Back to Admin Dashboard
            </Button>
            
            {isSystemInitialized && hasCorrectLoginCount && (
              <Button
                leftIcon={<Play />}
                colorScheme="blue"
                onClick={() => navigate('/admin')}
              >
                Go to Participant Management
              </Button>
            )}
          </HStack>
        </VStack>
      </Container>

      {/* Migration Progress Modal */}
      <Modal isOpen={isMigrationModalOpen} onClose={onMigrationModalClose} closeOnOverlayClick={false} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>System Migration Progress</ModalHeader>
          {!migrationResults && <ModalCloseButton />}
          <ModalBody pb={6}>
            <VStack spacing={4}>
              <Box w="full">
                <HStack justify="space-between" mb={2}>
                  <Text fontWeight="medium">Migration Progress</Text>
                  <Text fontSize="sm" color="gray.600">{Math.round(migrationProgress)}%</Text>
                </HStack>
                <Progress value={migrationProgress} size="lg" colorScheme="blue" />
              </Box>
              
              <Text fontSize="sm" color="gray.600" textAlign="center">
                {migrationStatus}
              </Text>
              
              {loading && (
                <HStack>
                  <Spinner size="sm" />
                  <Text fontSize="sm">Please wait, this may take several minutes...</Text>
                </HStack>
              )}
              
              {migrationResults && (
                <Box w="full">
                  {migrationResults.success ? (
                    <Alert status="success">
                      <AlertIcon />
                      <Box>
                        <AlertTitle>Migration Successful!</AlertTitle>
                        <AlertDescription>
                          <VStack spacing={2} align="start" mt={2}>
                            <Text fontSize="sm">
                              • Created {migrationResults.createResults.totalCreated} login IDs
                            </Text>
                            <Text fontSize="sm">
                              • Deleted {migrationResults.clearResults.totalDeleted} old documents
                            </Text>
                            <Text fontSize="sm">
                              • Duration: {migrationResults.duration.toFixed(1)} seconds
                            </Text>
                            {migrationResults.createResults.errors > 0 && (
                              <Text fontSize="sm" color="orange.600">
                                • {migrationResults.createResults.errors} creation errors (check console)
                              </Text>
                            )}
                          </VStack>
                        </AlertDescription>
                      </Box>
                    </Alert>
                  ) : (
                    <Alert status="error">
                      <AlertIcon />
                      <Box>
                        <AlertTitle>Migration Failed</AlertTitle>
                        <AlertDescription>{migrationResults.error}</AlertDescription>
                      </Box>
                    </Alert>
                  )}
                </Box>
              )}
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button 
              onClick={onMigrationModalClose} 
              isDisabled={loading}
              colorScheme={migrationResults?.success ? "green" : "blue"}
            >
              {migrationResults?.success ? "Complete" : "Close"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default Setup;