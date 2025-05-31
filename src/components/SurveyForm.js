// src/components/SurveyForm.js - Complete survey form component
import React, { useState, useEffect } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Radio,
  RadioGroup,
  Checkbox,
  CheckboxGroup,
  Button,
  FormControl,
  FormLabel,
  FormErrorMessage,
  Alert,
  AlertIcon,
  Progress,
  Divider,
  Card,
  CardBody,
  Badge,
  Slider,
  SliderTrack,
  SliderFilledTrack,
  SliderThumb,
  SliderMark,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
  Heading,
} from '@chakra-ui/react';

const SurveyForm = ({ 
  imageData, 
  onSubmit, 
  isLoading = false,
  participantId = ''
}) => {
  // Form state
  const [formData, setFormData] = useState({
    // Demographics (asked once at the beginning)
    age: '',
    gender: '',
    race: [],
    income: '',
    aiExperience: '',
    aiGenerated: '',
    
    // Image evaluation questions
    imageDescription: '',
    eyewearPresent: '',
    eyewearConfidence: 0,
    ageConfidence: 0,
    
    // Semantic differential scales
    ordinaryCreepy: 4,
    crudePolished: 4,
    syntheticReal: 4
  });
  
  const [errors, setErrors] = useState({});
  const [currentSection, setCurrentSection] = useState('demographics');
  const [showEyewearConfidence, setShowEyewearConfidence] = useState(false);
  const [showAgeConfidence, setShowAgeConfidence] = useState(false);

  // Handle form field changes
  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: null
      }));
    }
    
    // Handle conditional questions
    if (field === 'eyewearPresent') {
      setShowEyewearConfidence(value === 'yes');
      if (value !== 'yes') {
        setFormData(prev => ({ ...prev, eyewearConfidence: 0 }));
      }
    }
    
    if (field === 'imageDescription') {
      setShowAgeConfidence(value !== 'not-person');
      if (value === 'not-person') {
        setFormData(prev => ({ ...prev, ageConfidence: 0 }));
      }
    }
  };

  // Validation
  const validateSection = (section) => {
    const newErrors = {};
    
    if (section === 'demographics') {
      if (!formData.age) newErrors.age = 'Age is required';
      if (!formData.gender) newErrors.gender = 'Gender is required';
      if (!formData.race.length) newErrors.race = 'Please select at least one race/ethnicity';
      if (!formData.income) newErrors.income = 'Income is required';
      if (!formData.aiExperience) newErrors.aiExperience = 'AI experience is required';
      if (!formData.aiGenerated) newErrors.aiGenerated = 'AI generation experience is required';
    }
    
    if (section === 'imageEvaluation') {
      if (!formData.imageDescription) newErrors.imageDescription = 'Image description is required';
      if (!formData.eyewearPresent) newErrors.eyewearPresent = 'Eyewear question is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle section navigation
  const handleNext = () => {
    if (validateSection(currentSection)) {
      if (currentSection === 'demographics') {
        setCurrentSection('imageEvaluation');
      }
    }
  };

  const handleBack = () => {
    if (currentSection === 'imageEvaluation') {
      setCurrentSection('demographics');
    }
  };

  // Handle form submission
  const handleSubmit = () => {
    if (validateSection('imageEvaluation')) {
      const submissionData = {
        ...formData,
        imageId: imageData?.id,
        imageCategory: imageData?.category,
        imageFolder: imageData?.folder,
        participantId: participantId,
        timestamp: new Date().toISOString(),
        sessionInfo: {
          userAgent: navigator.userAgent,
          screenResolution: `${window.screen.width}x${window.screen.height}`,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        }
      };
      
      onSubmit(submissionData);
    }
  };

  // Confidence scale labels
  const confidenceLabels = {
    '-3': 'Very confident NO',
    '-2': 'Confident NO',
    '-1': 'Somewhat confident NO',
    '0': 'Cannot say',
    '1': 'Somewhat confident YES',
    '2': 'Confident YES',
    '3': 'Very confident YES'
  };

  // Demographics Section
  const renderDemographics = () => (
    <VStack spacing={6} align="stretch">
      <Box>
        <Heading size="md" mb={4}>General Information</Heading>
        <Text fontSize="sm" color="gray.600" mb={6}>
          Please provide some basic information about yourself.
        </Text>
      </Box>

      {/* Age */}
      <FormControl isInvalid={errors.age}>
        <FormLabel>Age *</FormLabel>
        <NumberInput
          value={formData.age}
          onChange={(value) => handleChange('age', value)}
          min={18}
          max={100}
        >
          <NumberInputField placeholder="Enter your age" />
          <NumberInputStepper>
            <NumberIncrementStepper />
            <NumberDecrementStepper />
          </NumberInputStepper>
        </NumberInput>
        <FormErrorMessage>{errors.age}</FormErrorMessage>
      </FormControl>

      {/* Gender */}
      <FormControl isInvalid={errors.gender}>
        <FormLabel>Gender *</FormLabel>
        <RadioGroup
          value={formData.gender}
          onChange={(value) => handleChange('gender', value)}
        >
          <VStack align="start" spacing={2}>
            <Radio value="man">Man</Radio>
            <Radio value="woman">Woman</Radio>
            <Radio value="non-binary">Non-binary / third gender</Radio>
            <Radio value="prefer-not-to-say">Prefer not to say</Radio>
          </VStack>
        </RadioGroup>
        <FormErrorMessage>{errors.gender}</FormErrorMessage>
      </FormControl>

      {/* Race/Ethnicity */}
      <FormControl isInvalid={errors.race}>
        <FormLabel>Choose one or more races that you consider yourself to be *</FormLabel>
        <CheckboxGroup
          value={formData.race}
          onChange={(value) => handleChange('race', value)}
        >
          <VStack align="start" spacing={2}>
            <Checkbox value="white">White or Caucasian</Checkbox>
            <Checkbox value="black">Black or African American</Checkbox>
            <Checkbox value="native">American Indian/Native American or Alaska Native</Checkbox>
            <Checkbox value="asian">Asian</Checkbox>
            <Checkbox value="pacific">Native Hawaiian or Other Pacific Islander</Checkbox>
            <Checkbox value="other">Other</Checkbox>
            <Checkbox value="prefer-not-to-say">Prefer not to say</Checkbox>
          </VStack>
        </CheckboxGroup>
        <FormErrorMessage>{errors.race}</FormErrorMessage>
      </FormControl>

      {/* Income */}
      <FormControl isInvalid={errors.income}>
        <FormLabel>What was your total household income before taxes during the past 12 months? *</FormLabel>
        <RadioGroup
          value={formData.income}
          onChange={(value) => handleChange('income', value)}
        >
          <VStack align="start" spacing={2}>
            <Radio value="less-25k">Less than $25,000</Radio>
            <Radio value="25k-49k">$25,000-$49,999</Radio>
            <Radio value="50k-74k">$50,000-$74,999</Radio>
            <Radio value="75k-99k">$75,000-$99,999</Radio>
            <Radio value="100k-149k">$100,000-$149,999</Radio>
            <Radio value="150k-more">$150,000 or more</Radio>
            <Radio value="prefer-not-to-say">Prefer not to say</Radio>
          </VStack>
        </RadioGroup>
        <FormErrorMessage>{errors.income}</FormErrorMessage>
      </FormControl>

      {/* AI Experience */}
      <FormControl isInvalid={errors.aiExperience}>
        <FormLabel>How would you rate your knowledge of artificial intelligence? *</FormLabel>
        <RadioGroup
          value={formData.aiExperience}
          onChange={(value) => handleChange('aiExperience', value)}
        >
          <VStack align="start" spacing={2}>
            <Radio value="none">No knowledge</Radio>
            <Radio value="little">A little knowledge</Radio>
            <Radio value="some">Some knowledge</Radio>
            <Radio value="good">Good knowledge</Radio>
            <Radio value="expert">Expert knowledge</Radio>
          </VStack>
        </RadioGroup>
        <FormErrorMessage>{errors.aiExperience}</FormErrorMessage>
      </FormControl>

      {/* AI Generation Experience */}
      <FormControl isInvalid={errors.aiGenerated}>
        <FormLabel>Have you ever generated an image using AI? *</FormLabel>
        <RadioGroup
          value={formData.aiGenerated}
          onChange={(value) => handleChange('aiGenerated', value)}
        >
          <VStack align="start" spacing={2}>
            <Radio value="never">Never</Radio>
            <Radio value="once">Once or twice</Radio>
            <Radio value="few">A few times</Radio>
            <Radio value="many">Many times</Radio>
            <Radio value="regularly">I do this regularly</Radio>
          </VStack>
        </RadioGroup>
        <FormErrorMessage>{errors.aiGenerated}</FormErrorMessage>
      </FormControl>
    </VStack>
  );

  // Image Evaluation Section
  const renderImageEvaluation = () => (
    <VStack spacing={6} align="stretch">
      <Box>
        <Heading size="md" mb={2}>Image Evaluation</Heading>
        <Text fontSize="sm" color="gray.600" mb={6}>
          Please observe the image carefully and answer the following questions.
        </Text>
        {imageData && (
          <Badge colorScheme={imageData.folderInfo?.color || 'gray'} mb={4}>
            {imageData.folderInfo?.name || imageData.category}
          </Badge>
        )}
      </Box>

      {/* Q1: Image Description */}
      <FormControl isInvalid={errors.imageDescription}>
        <FormLabel>Based on your observations of the image, which of the following best describes the image: *</FormLabel>
        <RadioGroup
          value={formData.imageDescription}
          onChange={(value) => handleChange('imageDescription', value)}
        >
          <VStack align="start" spacing={3}>
            <Radio value="photo-person">It looks like a photograph of a person</Radio>
            <Radio value="photo-doll">It looks like a photograph of a doll</Radio>
            <Radio value="artistic-person">
              It looks like an artistic depiction of a person. For example, a drawing, cartoon, sculpture, animation, or avatar of a person.
            </Radio>
            <Radio value="not-person">
              It looks like a photograph or artistic depiction, cartoon, or drawing of something that is not a person (e.g., an object, a landscape)
            </Radio>
            <Radio value="not-sure">I'm not sure</Radio>
          </VStack>
        </RadioGroup>
        <FormErrorMessage>{errors.imageDescription}</FormErrorMessage>
      </FormControl>

      {/* Q2: Eyewear Present */}
      <FormControl isInvalid={errors.eyewearPresent}>
        <FormLabel>Are there any pieces of eyewear (including glasses, sunglasses, monocles, smartglasses, goggles, etc.) anywhere in the image? *</FormLabel>
        <RadioGroup
          value={formData.eyewearPresent}
          onChange={(value) => handleChange('eyewearPresent', value)}
        >
          <VStack align="start" spacing={2}>
            <Radio value="yes">Yes</Radio>
            <Radio value="no">No</Radio>
            <Radio value="not-sure">I'm not sure</Radio>
          </VStack>
        </RadioGroup>
        <FormErrorMessage>{errors.eyewearPresent}</FormErrorMessage>
      </FormControl>

      {/* Q3: Eyewear Confidence (conditional) */}
      {showEyewearConfidence && (
        <FormControl>
          <FormLabel>Based on your observations of this image, how confident are you that the person (or doll) shown in the image is *wearing* the eyewear?</FormLabel>
          <Box px={4} py={6}>
            <Slider
              value={formData.eyewearConfidence}
              onChange={(value) => handleChange('eyewearConfidence', value)}
              min={-3}
              max={3}
              step={1}
              colorScheme="blue"
            >
              <SliderMark value={-3} mt={2} ml={-6} fontSize="sm">
                Very confident NO
              </SliderMark>
              <SliderMark value={0} mt={2} ml={-4} fontSize="sm">
                Cannot say
              </SliderMark>
              <SliderMark value={3} mt={2} ml={-6} fontSize="sm">
                Very confident YES
              </SliderMark>
              <SliderTrack>
                <SliderFilledTrack />
              </SliderTrack>
              <SliderThumb boxSize={6}>
                <Text fontSize="xs" fontWeight="bold">
                  {formData.eyewearConfidence}
                </Text>
              </SliderThumb>
            </Slider>
          </Box>
          <Text fontSize="sm" color="gray.600" mt={4} textAlign="center">
            Current: {confidenceLabels[formData.eyewearConfidence.toString()]}
          </Text>
        </FormControl>
      )}

      {/* Q4: Age Confidence (conditional) */}
      {showAgeConfidence && (
        <FormControl>
          <FormLabel>Based on your observations of this image, how confident are you that the person (or doll) shown in the image is under the age of 18?</FormLabel>
          <Text fontSize="sm" color="gray.600" mb={4}>
            This includes if the person is only partially visible (e.g., you can see body parts like their legs, elbow, etc. but not their face).
          </Text>
          <Box px={4} py={6}>
            <Slider
              value={formData.ageConfidence}
              onChange={(value) => handleChange('ageConfidence', value)}
              min={-3}
              max={3}
              step={1}
              colorScheme="purple"
            >
              <SliderMark value={-3} mt={2} ml={-6} fontSize="sm">
                Very confident NO
              </SliderMark>
              <SliderMark value={0} mt={2} ml={-4} fontSize="sm">
                Cannot say
              </SliderMark>
              <SliderMark value={3} mt={2} ml={-6} fontSize="sm">
                Very confident YES
              </SliderMark>
              <SliderTrack>
                <SliderFilledTrack />
              </SliderTrack>
              <SliderThumb boxSize={6}>
                <Text fontSize="xs" fontWeight="bold">
                  {formData.ageConfidence}
                </Text>
              </SliderThumb>
            </Slider>
          </Box>
          <Text fontSize="sm" color="gray.600" mt={4} textAlign="center">
            Current: {confidenceLabels[formData.ageConfidence.toString()]}
          </Text>
        </FormControl>
      )}

      {/* Q5: Semantic Differential Scales */}
      <Box>
        <FormLabel mb={4}>The image is:</FormLabel>
        
        {/* Ordinary - Creepy */}
        <Box mb={6}>
          <HStack justify="space-between" mb={2}>
            <Text fontSize="sm" fontWeight="medium">Ordinary</Text>
            <Text fontSize="sm" fontWeight="medium">Creepy</Text>
          </HStack>
          <Slider
            value={formData.ordinaryCreepy}
            onChange={(value) => handleChange('ordinaryCreepy', value)}
            min={1}
            max={7}
            step={1}
            colorScheme="red"
          >
            <SliderTrack>
              <SliderFilledTrack />
            </SliderTrack>
            <SliderThumb boxSize={6}>
              <Text fontSize="xs" fontWeight="bold">
                {formData.ordinaryCreepy}
              </Text>
            </SliderThumb>
          </Slider>
        </Box>

        {/* Crude - Polished */}
        <Box mb={6}>
          <HStack justify="space-between" mb={2}>
            <Text fontSize="sm" fontWeight="medium">Crude</Text>
            <Text fontSize="sm" fontWeight="medium">Polished</Text>
          </HStack>
          <Slider
            value={formData.crudePolished}
            onChange={(value) => handleChange('crudePolished', value)}
            min={1}
            max={7}
            step={1}
            colorScheme="green"
          >
            <SliderTrack>
              <SliderFilledTrack />
            </SliderTrack>
            <SliderThumb boxSize={6}>
              <Text fontSize="xs" fontWeight="bold">
                {formData.crudePolished}
              </Text>
            </SliderThumb>
          </Slider>
        </Box>

        {/* Synthetic - Real */}
        <Box mb={6}>
          <HStack justify="space-between" mb={2}>
            <Text fontSize="sm" fontWeight="medium">Synthetic</Text>
            <Text fontSize="sm" fontWeight="medium">Real</Text>
          </HStack>
          <Slider
            value={formData.syntheticReal}
            onChange={(value) => handleChange('syntheticReal', value)}
            min={1}
            max={7}
            step={1}
            colorScheme="blue"
          >
            <SliderTrack>
              <SliderFilledTrack />
            </SliderTrack>
            <SliderThumb boxSize={6}>
              <Text fontSize="xs" fontWeight="bold">
                {formData.syntheticReal}
              </Text>
            </SliderThumb>
          </Slider>
        </Box>
      </Box>
    </VStack>
  );

  return (
    <Card h="full">
      <CardBody>
        <VStack spacing={6} align="stretch" h="full">
          {/* Progress Indicator */}
          <Box>
            <HStack justify="space-between" mb={2}>
              <Text fontSize="sm" fontWeight="medium">
                {currentSection === 'demographics' ? 'Step 1: General Information' : 'Step 2: Image Evaluation'}
              </Text>
              <Text fontSize="sm" color="gray.500">
                {currentSection === 'demographics' ? '1/2' : '2/2'}
              </Text>
            </HStack>
            <Progress value={currentSection === 'demographics' ? 50 : 100} size="sm" colorScheme="blue" />
          </Box>

          {/* Content */}
          <Box flex="1" overflow="auto">
            {currentSection === 'demographics' ? renderDemographics() : renderImageEvaluation()}
          </Box>

          {/* Navigation Buttons */}
          <Divider />
          <HStack justify="space-between">
            <Button
              variant="outline"
              onClick={handleBack}
              isDisabled={currentSection === 'demographics'}
            >
              Back
            </Button>
            
            {currentSection === 'demographics' ? (
              <Button colorScheme="blue" onClick={handleNext}>
                Continue to Image Evaluation
              </Button>
            ) : (
              <Button
                colorScheme="green"
                onClick={handleSubmit}
                isLoading={isLoading}
                loadingText="Submitting..."
              >
                Submit Evaluation
              </Button>
            )}
          </HStack>

          {/* Error Summary */}
          {Object.keys(errors).length > 0 && (
            <Alert status="error" size="sm">
              <AlertIcon />
              Please complete all required fields before proceeding.
            </Alert>
          )}
        </VStack>
      </CardBody>
    </Card>
  );
};

export default SurveyForm;