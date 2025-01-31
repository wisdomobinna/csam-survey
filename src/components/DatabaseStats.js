// src/components/DatabaseStats.js
import React, { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import {
  Box,
  Stat,
  StatLabel,
  StatNumber,
  StatGroup,
  Spinner,
  Text,
  Alert,
  AlertIcon,
  Card,
  CardHeader,
  CardBody,
  Heading,
} from '@chakra-ui/react';

const DatabaseStats = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        
        // Get images collection stats
        const imagesSnapshot = await getDocs(collection(db, 'images'));
        const totalImages = imagesSnapshot.size;
        
        // Get assigned images stats
        const assignedImages = imagesSnapshot.docs.filter(doc => 
          doc.data().assignedEvaluators?.length > 0
        ).length;
        
        // Get user progress stats
        const userProgressSnapshot = await getDocs(collection(db, 'userProgress'));
        const totalUsers = userProgressSnapshot.size;
        
        // Get completed evaluations
        const completedEvaluations = userProgressSnapshot.docs.reduce((acc, doc) => {
          const completedImages = doc.data().completedImages || {};
          return acc + Object.keys(completedImages).length;
        }, 0);

        setStats({
          totalImages,
          assignedImages,
          totalUsers,
          completedEvaluations
        });
        
        setLoading(false);
      } catch (error) {
        console.error('Error fetching stats:', error);
        setError('Failed to load database statistics');
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" p={4}>
        <Spinner />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert status="error">
        <AlertIcon />
        {error}
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <Heading size="md">Database Statistics</Heading>
      </CardHeader>
      <CardBody>
        <StatGroup>
          <Stat>
            <StatLabel>Total Images</StatLabel>
            <StatNumber>{stats?.totalImages}</StatNumber>
            <Text fontSize="sm" color="gray.500">Available in database</Text>
          </Stat>

          <Stat>
            <StatLabel>Assigned Images</StatLabel>
            <StatNumber>{stats?.assignedImages}</StatNumber>
            <Text fontSize="sm" color="gray.500">Currently in evaluation</Text>
          </Stat>

          <Stat>
            <StatLabel>Total Users</StatLabel>
            <StatNumber>{stats?.totalUsers}</StatNumber>
            <Text fontSize="sm" color="gray.500">Registered evaluators</Text>
          </Stat>

          <Stat>
            <StatLabel>Completed Evaluations</StatLabel>
            <StatNumber>{stats?.completedEvaluations}</StatNumber>
            <Text fontSize="sm" color="gray.500">Total responses</Text>
          </Stat>
        </StatGroup>
      </CardBody>
    </Card>
  );
};

export default DatabaseStats;