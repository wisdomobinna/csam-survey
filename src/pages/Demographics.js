// src/pages/Demographics.js - Updated as final step only (after main survey)

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import {
  Box,
  Button,
  Container,
  Text,
  VStack,
  Alert,
  AlertIcon,
  Card,
  CardBody,
  CardHeader,
  Heading,
  useToast,
  Spinner,
  Flex,
  HStack,
  Badge,
} from '@chakra-ui/react';

const Demographics = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [demographicsCompleted, setDemographicsCompleted] = useState(false);
  const [surveyLoading, setSurveyLoading] = useState(true);
  const [processingCompletion, setProcessingCompletion] = useState(false);
  const [qualtricsLoaded, setQualtricsLoaded] = useState(false);
  const [lastQuestionReached, setLastQuestionReached] = useState(false);

  const navigate = useNavigate();
  const toast = useToast();
  const iframeRef = useRef(null);

  const loadUserData = useCallback(async () => {
    try {
      setLoading(true);
      const userId = sessionStorage.getItem('userLoginId');
      if (!userId) {
        navigate('/login');
        return;
      }

      const userRef = doc(db, 'loginIDs', userId);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        throw new Error('User not found');
      }

      const data = userDoc.data();

      // UPDATED FLOW: Check user's progress
      console.log('Demographics: User data:', {
        hasConsented: data.hasConsented,
        mainSurveyCompleted: data.mainSurveyCompleted,
        demographicsCompleted: data.demographicsCompleted,
        surveyCompleted: data.surveyCompleted
      });

      // If user hasn't consented, redirect to consent
      if (!data.hasConsented) {
        console.log('Demographics: User not consented, redirecting to consent');
        navigate('/consent');
        return;
      }

      // If user hasn't completed main survey, redirect there
      if (!data.mainSurveyCompleted) {
        console.log('Demographics: Main survey not completed, redirecting to survey');
        navigate('/survey');
        return;
      }

      // If demographics already completed, redirect to completion
      if (data.demographicsCompleted || data.surveyCompleted) {
        console.log('Demographics: Already completed, redirecting to completion');
        navigate('/completion');
        return;
      }

      // If we reach here, user should be on demographics (final step)
      console.log('Demographics: Ready for demographics survey (final step)');

    } catch (err) {
      console.error('Error loading user data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    loadUserData();
  }, [loadUserData]);

  const finalizeCompletion = useCallback(async (surveyData = {}) => {
    if (processingCompletion) return;
    
    try {
      setProcessingCompletion(true);
      const userId = sessionStorage.getItem('userLoginId');
      if (!userId) throw new Error('No user session');

      console.log('Demographics: Finalizing FINAL completion for user:', userId);

      const userRef = doc(db, 'loginIDs', userId);
      await updateDoc(userRef, {
        demographicsCompleted: true,
        demographicsCompletedAt: serverTimestamp(),
        surveyCompleted: true, // MARK ENTIRE STUDY AS COMPLETED
        completedAt: serverTimestamp(),
        lastUpdated: serverTimestamp(),
        demographicsData: surveyData,
      });

      console.log('Demographics: STUDY COMPLETED! Redirecting to completion page...');

      toast({
        title: 'Study Completed!',
        description: 'Thank you for your participation. Redirecting to completion page...',
        status: 'success',
        duration: 3000,
      });

      setTimeout(() => navigate('/completion'), 2000);
      
    } catch (err) {
      console.error('Error saving demographics completion:', err);
      setError(err.message);
      toast({
        title: 'Error',
        description: `Failed to save completion: ${err.message}`,
        status: 'error',
        duration: 5000,
      });
    } finally {
      setProcessingCompletion(false);
    }
  }, [navigate, toast, processingCompletion]);

  const handleNextButtonClick = async () => {
    console.log('Demographics: Manual next button clicked - completing entire study');
    setDemographicsCompleted(true);
    await finalizeCompletion({ type: 'manual_next_button' });
  };

  // Enhanced message handler for Qualtrics completion detection
  useEffect(() => {
    const handleMessage = (event) => {
      console.log('Demographics: Received message:', {
        origin: event.origin,
        data: event.data,
        type: typeof event.data
      });

      // Check if message is from Qualtrics
      if (event.origin && event.origin.includes('qualtrics.com')) {
        console.log('Demographics: Message from Qualtrics domain detected');

        const messageData = event.data;
        let isCompletionSignal = false;
        let isLastQuestionSignal = false;

        // Check for object-type messages
        if (typeof messageData === 'object' && messageData !== null) {
          const type = (messageData.type || '').toLowerCase();
          const action = (messageData.action || '').toLowerCase();
          
          // Check for completion signals
          if (type.includes('complete') || 
              type.includes('finished') || 
              type.includes('end') ||
              type.includes('submit') ||
              action.includes('complete') ||
              action.includes('submit') ||
              messageData.demographics_completed ||
              messageData.survey_completed ||
              messageData.endOfSurvey ||
              messageData.surveyComplete) {
            isCompletionSignal = true;
          }

          // Check for last question signals
          if (type.includes('last_question') ||
              messageData.lastQuestion ||
              messageData.final_question ||
              messageData.question_count === messageData.total_questions) {
            isLastQuestionSignal = true;
          }

          // Qualtrics-specific completion events
          if (messageData.QualtricsAction === 'Submit' ||
              messageData.QualtricsAction === 'EndSurvey' ||
              messageData.eventType === 'submit' ||
              messageData.eventType === 'complete') {
            isCompletionSignal = true;
          }
        }

        // Check for string-type messages
        if (typeof messageData === 'string') {
          const lowerMessage = messageData.toLowerCase();
          if (lowerMessage.includes('complete') ||
              lowerMessage.includes('finished') ||
              lowerMessage.includes('end') ||
              lowerMessage.includes('submit') ||
              lowerMessage.includes('demographics_completed') ||
              lowerMessage.includes('survey_complete') ||
              lowerMessage.includes('thank you') ||
              lowerMessage.includes('thankyou')) {
            isCompletionSignal = true;
          }

          if (lowerMessage.includes('last_question') ||
              lowerMessage.includes('final_question')) {
            isLastQuestionSignal = true;
          }
        }

        // Handle last question reached
        if (isLastQuestionSignal) {
          console.log('Demographics: Last question reached - enabling completion');
          setLastQuestionReached(true);
        }

        // Handle completion - FINAL STEP OF ENTIRE STUDY
        if (isCompletionSignal) {
          console.log('Demographics: FINAL completion signal detected from Qualtrics!');
          setDemographicsCompleted(true);
          finalizeCompletion(messageData);
        }

        // Handle survey ready signal
        if ((typeof messageData === 'object' && messageData.type === 'survey_ready') ||
            (typeof messageData === 'string' && messageData.includes('ready'))) {
          console.log('Demographics: Survey ready signal received');
          setQualtricsLoaded(true);
          setSurveyLoading(false);
        }
      }
    };

    console.log('Demographics: Setting up message listener for FINAL step');
    window.addEventListener('message', handleMessage);
    
    return () => {
      console.log('Demographics: Cleaning up message listener');
      window.removeEventListener('message', handleMessage);
    };
  }, [finalizeCompletion]);

  // Monitor iframe for completion and last question detection
  useEffect(() => {
    const checkSurveyProgress = () => {
      try {
        if (iframeRef.current && iframeRef.current.contentWindow) {
          const iframe = iframeRef.current;
          
          try {
            const doc = iframe.contentDocument || iframe.contentWindow.document;
            if (doc) {
              // Check for completion indicators
              const completionElements = doc.querySelectorAll('*');
              for (let element of completionElements) {
                const text = element.textContent?.toLowerCase() || '';
                if ((text.includes('thank you') || 
                     text.includes('complete') || 
                     text.includes('finished') ||
                     text.includes('submission successful')) &&
                    text.length < 200) {
                  console.log('Demographics: FINAL completion detected via thank you message');
                  setDemographicsCompleted(true);
                  finalizeCompletion({ type: 'thank_you_detection', text: text });
                  return;
                }
              }

              // Check for last question indicators
              const preferNotToSayElements = doc.querySelectorAll('*');
              for (let element of preferNotToSayElements) {
                const text = element.textContent?.toLowerCase() || '';
                if (text.includes('prefer not to say') && 
                    (element.type === 'checkbox' || element.type === 'radio')) {
                  console.log('Demographics: Last question detected (prefer not to say option found)');
                  setLastQuestionReached(true);
                  break;
                }
              }

              // Check progress indicators if available
              const progressElements = doc.querySelectorAll('[class*="progress"], [id*="progress"], .ProgressBar, #ProgressBar');
              progressElements.forEach(element => {
                const progressText = element.textContent || element.getAttribute('aria-valuenow') || '';
                if (progressText.includes('100%') || progressText.includes('10/10') || progressText === '100') {
                  console.log('Demographics: Last question detected via progress indicator');
                  setLastQuestionReached(true);
                }
              });

              // Check if this is an income question (which appears to be the last one in your survey)
              const incomeElements = doc.querySelectorAll('*');
              let hasIncomeQuestion = false;
              for (let element of incomeElements) {
                const text = element.textContent?.toLowerCase() || '';
                if (text.includes('income') && text.includes('past 12 months')) {
                  hasIncomeQuestion = true;
                  break;
                }
              }

              if (hasIncomeQuestion) {
                console.log('Demographics: Income question detected - likely last question');
                setLastQuestionReached(true);
              }

              // If we detect any answer selection on what appears to be the last question, enable completion
              if (lastQuestionReached || hasIncomeQuestion) {
                const radioInputs = doc.querySelectorAll('input[type="radio"]:checked, input[type="checkbox"]:checked');
                if (radioInputs.length > 0) {
                  console.log('Demographics: Answer selected on last question - auto-completing FINAL step');
                  // Small delay to ensure the answer is registered
                  setTimeout(() => {
                    setDemographicsCompleted(true);
                    finalizeCompletion({ type: 'last_question_answered' });
                  }, 2000);
                }
              }
            }
          } catch (e) {
            // Cross-origin or other error, ignore
          }
        }
      } catch (error) {
        // Ignore all errors in progress detection
      }
    };

    const interval = setInterval(checkSurveyProgress, 1000);
    return () => clearInterval(interval);
  }, [finalizeCompletion, lastQuestionReached]);

  const generateQualtricsUrl = () => {
    const baseUrl = 'https://georgetown.az1.qualtrics.com/jfe/form/SV_0lcUfUbcn7vo7qe';
    const userId = sessionStorage.getItem('userLoginId') || 'unknown';
    const prolificPid = sessionStorage.getItem('prolificPid') || 'TEST_USER';
    const studyId = sessionStorage.getItem('studyId') || 'unknown';
    const sessionId = sessionStorage.getItem('sessionId') || 'unknown';
    const isTestMode = sessionStorage.getItem('testMode') === 'true';
    
    const params = new URLSearchParams({
      // PROLIFIC DATA - Captured at the end now
      PROLIFIC_PID: prolificPid,
      STUDY_ID: studyId,
      SESSION_ID: sessionId,
      
      // LINKING DATA
      loginID: userId,
      survey_type: 'demographics_final',
      is_test_mode: isTestMode ? 'true' : 'false',
      entry_timestamp: new Date().toISOString(),
      
      // CONTROL PARAMETERS
      embedded: 'true',
      source: 'react_app',
      completion_redirect: 'false',
      hide_images: 'true'
    });
    
    return `${baseUrl}?${params.toString()}`;
  };

  const handleIframeLoad = () => {
    console.log('Demographics: Iframe loaded for FINAL step');
    setSurveyLoading(false);
    setQualtricsLoaded(true);

    // Try to inject completion detection and image hiding script
    try {
      const iframe = iframeRef.current;
      if (iframe && iframe.contentWindow) {
        setTimeout(() => {
          try {
            const doc = iframe.contentDocument || iframe.contentWindow.document;
            if (doc) {
              const script = doc.createElement('script');
              script.textContent = `
                // Hide any images in the survey
                function hideImages() {
                  const images = document.querySelectorAll('img');
                  images.forEach(img => {
                    img.style.display = 'none';
                  });
                  
                  const imageContainers = document.querySelectorAll('[class*="image"], [id*="image"], .ImageContainer, .QuestionBody img');
                  imageContainers.forEach(container => {
                    container.style.display = 'none';
                  });
                }

                // Function to hide the thank you page and trigger FINAL completion
                function handleThankYouPage() {
                  const thankYouMessages = document.querySelectorAll('*');
                  for (let element of thankYouMessages) {
                    const text = element.textContent ? element.textContent.toLowerCase() : '';
                    if (text.includes('we thank you') || 
                        text.includes('your response has been recorded') ||
                        text.includes('thank you for your time')) {
                      
                      console.log('FINAL thank you page detected - hiding and completing ENTIRE STUDY');
                      
                      // Hide the thank you page
                      document.body.style.display = 'none';
                      
                      // Immediately signal FINAL completion to parent
                      parent.postMessage({
                        type: 'demographics_completed',
                        source: 'thank_you_page_bypass',
                        message: 'FINAL demographics completed, entire study done'
                      }, '*');
                      
                      return true;
                    }
                  }
                  return false;
                }

                // Check for last question submission before thank you page
                let lastQuestionAnswered = false;
                let submitButtonClicked = false;

                // Run image hiding immediately and on DOM changes
                hideImages();
                
                const observer = new MutationObserver(function(mutations) {
                  hideImages(); // Hide images on any DOM change
                  
                  // Check for thank you page and handle it
                  if (handleThankYouPage()) {
                    return; // Exit if thank you page was handled
                  }
                  
                  // Check for last question or completion
                  mutations.forEach(function(mutation) {
                    if (mutation.addedNodes) {
                      mutation.addedNodes.forEach(function(node) {
                        if (node.nodeType === Node.TEXT_NODE || node.nodeType === Node.ELEMENT_NODE) {
                          const text = node.textContent ? node.textContent.toLowerCase() : '';
                          
                          // Detect income question (last question)
                          if (text.includes('income') && text.includes('past 12 months')) {
                            console.log('FINAL question (income) detected');
                            lastQuestionAnswered = false; // Reset flag
                            parent.postMessage({
                              type: 'last_question',
                              source: 'income_question'
                            }, '*');
                          }
                        }
                      });
                    }
                  });
                });
                
                observer.observe(document.body, {
                  childList: true,
                  subtree: true,
                  characterData: true
                });

                // Monitor for answer selections on the last question
                document.addEventListener('change', function(e) {
                  const target = e.target;
                  if (target.type === 'radio' || target.type === 'checkbox') {
                    const questionText = document.body.textContent.toLowerCase();
                    if (questionText.includes('income') && questionText.includes('past 12 months')) {
                      console.log('Answer selected on FINAL income question');
                      lastQuestionAnswered = true;
                    }
                  }
                });

                // Intercept form submissions and button clicks to bypass thank you page
                document.addEventListener('click', function(e) {
                  const target = e.target;
                  
                  // Check if this is a submit/next button and we're on the last question
                  if ((target.type === 'submit' || 
                       target.className.includes('NextButton') ||
                       target.className.includes('Submit') ||
                       target.id.includes('NextButton') ||
                       target.textContent.toLowerCase().includes('next') ||
                       target.textContent.toLowerCase().includes('submit')) &&
                      lastQuestionAnswered) {
                    
                    console.log('Submit button clicked on FINAL question - will bypass thank you page');
                    submitButtonClicked = true;
                    
                    // Set a timer to catch the thank you page and bypass it
                    setTimeout(() => {
                      if (handleThankYouPage()) {
                        return;
                      }
                      
                      // If thank you page didn't appear, still complete the FINAL survey
                      console.log('Completing FINAL demographics after submit button click');
                      parent.postMessage({
                        type: 'demographics_completed',
                        source: 'submit_button_click'
                      }, '*');
                    }, 1000);
                  }
                });

                // Form submission detection
                document.addEventListener('submit', function(e) {
                  if (lastQuestionAnswered) {
                    console.log('Form submitted on FINAL question - bypassing thank you page');
                    
                    // Prevent default if possible to avoid thank you page
                    try {
                      e.preventDefault();
                      e.stopPropagation();
                    } catch (err) {
                      console.log('Could not prevent default form submission');
                    }
                    
                    // Complete immediately
                    parent.postMessage({
                      type: 'demographics_completed',
                      source: 'form_submit_bypass'
                    }, '*');
                  }
                });

                // Page visibility change detection (when Qualtrics tries to show thank you page)
                document.addEventListener('visibilitychange', function() {
                  if (submitButtonClicked && document.visibilityState === 'visible') {
                    setTimeout(() => {
                      handleThankYouPage();
                    }, 500);
                  }
                });

                // Initial check for thank you page (in case we loaded directly to it)
                setTimeout(() => {
                  handleThankYouPage();
                }, 1000);
              `;
              doc.head.appendChild(script);
              console.log('Demographics: Enhanced detection script injected for FINAL step');
            }
          } catch (error) {
            console.log('Could not inject script (cross-origin):', error);
          }
        }, 1000);
      }
    } catch (error) {
      console.log('Could not set up enhanced detection (cross-origin)');
    }
  };

  // Auto-complete timer (backup) - shorter for final step
  useEffect(() => {
    if (qualtricsLoaded && !demographicsCompleted) {
      const autoCompleteTimer = setTimeout(() => {
        console.log('Demographics: Auto-completion timer triggered for FINAL step');
        toast({
          title: 'Completing Study',
          description: 'Finalizing your participation...',
          status: 'info',
          duration: 3000,
        });
        setDemographicsCompleted(true);
        finalizeCompletion({ type: 'timeout' });
      }, 10 * 60 * 1000); // 10 minutes for final step

      return () => clearTimeout(autoCompleteTimer);
    }
  }, [qualtricsLoaded, demographicsCompleted, finalizeCompletion, toast]);

  if (loading) {
    return (
      <Flex justify="center" align="center" minH="100vh">
        <VStack spacing={4}>
          <Spinner size="xl" color="blue.500" />
          <Text>Loading final step...</Text>
        </VStack>
      </Flex>
    );
  }

  if (error) {
    return (
      <Flex justify="center" align="center" minH="100vh">
        <Alert status="error">
          <AlertIcon />
          <Text>{error}</Text>
          <Button ml={4} onClick={() => navigate('/login')}>Back to Login</Button>
        </Alert>
      </Flex>
    );
  }

  return (
    <Box minH="100vh" bg="gray.50">
      <Box bg="white" borderBottom="1px solid" borderColor="gray.200" py={4}>
        <Container maxW="4xl">
          <VStack spacing={2}>
            <Heading>Final Demographics Survey</Heading>
            <HStack spacing={2}>
              <Badge colorScheme="green">Final Step</Badge>
              <Badge colorScheme="gray">Consent → Main Study → Demographics</Badge>
            </HStack>
          </VStack>
        </Container>
      </Box>

      <Container maxW="4xl" py={6}>
        <VStack spacing={6}>
          <Alert status="success" borderRadius="md">
            <AlertIcon />
            <Box>
              <Text fontWeight="medium">Image Evaluation Complete! 🎉</Text>
              <Text fontSize="sm">Please complete this final demographics survey to finish the study.</Text>
            </Box>
          </Alert>

          <Card h="600px">
            <CardHeader>
              <HStack justify="space-between">
                <Text fontSize="lg" fontWeight="bold">📊 Final Demographics Survey</Text>
                {surveyLoading && <Spinner size="sm" />}
                {qualtricsLoaded && !surveyLoading && (
                  <Badge colorScheme="green">Survey Loaded</Badge>
                )}
                {lastQuestionReached && (
                  <Badge colorScheme="orange">Final Question</Badge>
                )}
              </HStack>
            </CardHeader>
            <CardBody p={0}>
              <Box position="relative" h="full">
                {surveyLoading && (
                  <Flex position="absolute" inset="0" bg="white" zIndex={10} align="center" justify="center">
                    <VStack spacing={3}>
                      <Spinner size="lg" color="blue.500" />
                      <Text>Loading final survey...</Text>
                      <Text fontSize="sm" color="gray.600">
                        Almost done! Just a few quick questions.
                      </Text>
                    </VStack>
                  </Flex>
                )}
                <iframe
                  ref={iframeRef}
                  src={generateQualtricsUrl()}
                  width="100%"
                  height="100%"
                  frameBorder="0"
                  onLoad={handleIframeLoad}
                  title="Final Demographics Survey"
                  style={{ 
                    border: 0, 
                    borderRadius: '0 0 8px 8px',
                    backgroundColor: 'white'
                  }}
                />
              </Box>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <VStack spacing={4}>
                {demographicsCompleted ? (
                  <VStack spacing={3}>
                    <Alert status="success">
                      <AlertIcon />
                      Study completed successfully! Thank you for your participation.
                    </Alert>
                    <Button
                      colorScheme="green"
                      size="lg"
                      onClick={() => navigate('/completion')}
                      isLoading={processingCompletion}
                      loadingText="Finalizing..."
                    >
                      Continue to Completion →
                    </Button>
                  </VStack>
                ) : (
                  <VStack spacing={4}>
                    {lastQuestionReached ? (
                      <VStack spacing={3}>
                        <Alert status="info">
                          <AlertIcon />
                          You've reached the final question! The study will complete automatically when you make your selection.
                        </Alert>
                        <Button 
                          colorScheme="green" 
                          size="lg" 
                          onClick={handleNextButtonClick}
                          isLoading={processingCompletion}
                          loadingText="Completing..."
                        >
                          Complete Study →
                        </Button>
                      </VStack>
                    ) : (
                      <Alert status="info">
                        <AlertIcon />
                        Please complete the final demographics survey. The study will automatically complete when finished.
                      </Alert>
                    )}
                  </VStack>
                )}
              </VStack>
            </CardBody>
          </Card>
        </VStack>
      </Container>
    </Box>
  );
};

export default Demographics;