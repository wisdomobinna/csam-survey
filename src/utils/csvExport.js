// src/utils/csvExport.js - CSV export utilities
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';

// Function to convert Firestore timestamp to readable date
const formatTimestamp = (timestamp) => {
  if (!timestamp) return '';
  try {
    if (timestamp.toDate) {
      return timestamp.toDate().toISOString();
    }
    return new Date(timestamp).toISOString();
  } catch {
    return '';
  }
};

// Function to convert array to string
const formatArray = (arr) => {
  if (!Array.isArray(arr)) return '';
  return arr.join('; ');
};

// Main export function for survey responses
export const exportSurveyResponses = async () => {
  try {
    console.log('Starting CSV export...');
    
    // Get all survey responses
    const responsesQuery = query(
      collection(db, 'surveyResponses'),
      orderBy('submittedAt', 'asc')
    );
    const responsesSnapshot = await getDocs(responsesQuery);
    
    // Get all user data for additional context
    const usersSnapshot = await getDocs(collection(db, 'loginIDs'));
    const userMap = new Map();
    usersSnapshot.docs.forEach(doc => {
      userMap.set(doc.id, doc.data());
    });
    
    // Process responses
    const csvData = [];
    const headers = [
      // Identifiers
      'response_id',
      'participant_id',
      'prolific_pid',
      'study_id',
      'session_id',
      'submitted_at',
      
      // Image information
      'image_id',
      'image_number',
      'image_category',
      'image_folder',
      'total_images',
      
      // Demographics
      'age',
      'gender',
      'race',
      'income',
      'ai_experience',
      'ai_generated_experience',
      
      // Image evaluation responses
      'image_description',
      'eyewear_present',
      'eyewear_confidence',
      'age_confidence',
      'ordinary_creepy_scale',
      'crude_polished_scale',
      'synthetic_real_scale',
      
      // Technical metadata
      'user_agent',
      'screen_resolution',
      'timezone',
      'participant_created_at',
      'participant_source'
    ];
    
    csvData.push(headers);
    
    responsesSnapshot.docs.forEach(doc => {
      const response = doc.data();
      const userData = userMap.get(response.participantId) || {};
      
      const row = [
        // Identifiers
        doc.id,
        response.participantId || '',
        response.prolificPid || '',
        userData.prolificData?.studyId || '',
        userData.prolificData?.sessionId || '',
        formatTimestamp(response.submittedAt),
        
        // Image information
        response.imageId || '',
        response.imageNumber || '',
        response.imageCategory || '',
        response.imageFolder || '',
        response.totalImages || '',
        
        // Demographics
        response.age || '',
        response.gender || '',
        formatArray(response.race),
        response.income || '',
        response.aiExperience || '',
        response.aiGenerated || '',
        
        // Image evaluation responses
        response.imageDescription || '',
        response.eyewearPresent || '',
        response.eyewearConfidence || '',
        response.ageConfidence || '',
        response.ordinaryCreepy || '',
        response.crudePolished || '',
        response.syntheticReal || '',
        
        // Technical metadata
        response.sessionInfo?.userAgent || '',
        response.sessionInfo?.screenResolution || '',
        response.sessionInfo?.timezone || '',
        formatTimestamp(userData.createdAt),
        userData.source || ''
      ];
      
      csvData.push(row);
    });
    
    console.log(`Exported ${csvData.length - 1} responses`);
    return csvData;
    
  } catch (error) {
    console.error('Error exporting survey responses:', error);
    throw error;
  }
};

// Function to export participant summary
export const exportParticipantSummary = async () => {
  try {
    console.log('Starting participant summary export...');
    
    const usersSnapshot = await getDocs(collection(db, 'loginIDs'));
    const responsesSnapshot = await getDocs(collection(db, 'surveyResponses'));
    
    // Create response count map
    const responseCountMap = new Map();
    responsesSnapshot.docs.forEach(doc => {
      const response = doc.data();
      const participantId = response.participantId;
      responseCountMap.set(participantId, (responseCountMap.get(participantId) || 0) + 1);
    });
    
    const csvData = [];
    const headers = [
      'participant_id',
      'prolific_pid',
      'study_id',
      'session_id',
      'source',
      'assigned_images',
      'completed_images',
      'survey_completed',
      'has_consented',
      'created_at',
      'last_login',
      'responses_submitted'
    ];
    
    csvData.push(headers);
    
    usersSnapshot.docs.forEach(doc => {
      if (doc.id === 'ADMIN') return;
      
      const userData = doc.data();
      const responseCount = responseCountMap.get(doc.id) || 0;
      
      const row = [
        doc.id,
        userData.prolificData?.prolificPid || '',
        userData.prolificData?.studyId || '',
        userData.prolificData?.sessionId || '',
        userData.source || '',
        userData.assignedImages?.length || 0,
        userData.completedImages || 0,
        userData.surveyCompleted || false,
        userData.hasConsented || false,
        formatTimestamp(userData.createdAt),
        formatTimestamp(userData.lastLogin),
        responseCount
      ];
      
      csvData.push(row);
    });
    
    console.log(`Exported ${csvData.length - 1} participants`);
    return csvData;
    
  } catch (error) {
    console.error('Error exporting participant summary:', error);
    throw error;
  }
};

// Function to convert CSV data to downloadable file
export const downloadCSV = (csvData, filename) => {
  try {
    // Convert array to CSV string
    const csvContent = csvData
      .map(row => 
        row.map(field => {
          // Escape quotes and wrap in quotes if contains comma, quote, or newline
          const stringField = String(field || '');
          if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
            return `"${stringField.replace(/"/g, '""')}"`;
          }
          return stringField;
        }).join(',')
      )
      .join('\n');
    
    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    console.log(`Downloaded: ${filename}`);
  } catch (error) {
    console.error('Error downloading CSV:', error);
    throw error;
  }
};

// Function to generate filename with timestamp
export const generateFileName = (baseName) => {
  const now = new Date();
  const timestamp = now.toISOString().split('T')[0]; // YYYY-MM-DD format
  return `${baseName}_${timestamp}.csv`;
};