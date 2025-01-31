// src/pages/Completion.js
import React from 'react';
import { Box, Container, VStack, Heading, Text } from '@chakra-ui/react';

function Completion() {
  return (
    <Container maxW="container.lg" py={20}>
      <VStack spacing={8} textAlign="center">
        <Heading 
          size="2xl" 
          bgGradient="linear(to-r, purple.500, pink.500)"
          bgClip="text"
        >
          🎉 Thank you! 🎉
        </Heading>
        
        <Text fontSize="xl" color="gray.600">
          You have completed your evaluations.
          Your participation in this study is greatly appreciated.
        </Text>
        
        <Box fontSize="6xl">
          🎨 ✨
        </Box>
      </VStack>
    </Container>
  );
}

export default Completion;