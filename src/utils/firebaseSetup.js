// src/utils/firebaseSetup.js - Updated for pre-assigned login system
import { collection, doc, getDoc, setDoc, updateDoc, getDocs, deleteDoc, query, where } from 'firebase/firestore';
import { ref, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase/config';

/**
 * Get next available login ID and assign to participant
 */
export const assignLoginIdToParticipant = async (prolificPid, prolificData = {}) => {
  try {
    console.log('Assigning login ID to participant:', prolificPid);
    
    // Check if participant already has a login ID
    const existingAssignment = await findExistingParticipant(prolificPid);
    if (existingAssignment.exists) {
      console.log('Participant already has login ID:', existingAssignment.loginId);
      return {
        success: true,
        loginId: existingAssignment.loginId,
        isExisting: true
      };
    }
    
    // Get next available login ID
    const preAssignedRef = collection(db, 'preAssignedLogins');
    const availableQuery = query(preAssignedRef, where('isAssigned', '==', false));
    const availableSnapshot = await getDocs(availableQuery);
    
    if (availableSnapshot.empty) {
      throw new Error('No available login IDs remaining. Study may be full.');
    }
    
    // Get the first available login ID (they're ordered 0001, 0002, etc.)
    const availableDocs = availableSnapshot.docs.sort((a, b) => a.id.localeCompare(b.id));
    const selectedDoc = availableDocs[0];
    const loginId = selectedDoc.id;
    const loginData = selectedDoc.data();
    
    console.log(`Assigning login ID ${loginId} to ${prolificPid}`);
    
    // Update the pre-assigned login document
    await updateDoc(doc(db, 'preAssignedLogins', loginId), {
      isAssigned: true,
      assignedTo: prolificPid,
      assignedAt: new Date(),
      status: 'assigned',
      prolificData: {
        prolificPid,
        studyId: prolificData.studyId || null,
        sessionId: prolificData.sessionId || null,
        detectedAt: prolificData.detectedAt || new Date().toISOString(),
        ...prolificData
      }
    });
    
    // Create active participant session
    await setDoc(doc(db, 'participants', loginId), {
      loginId: loginId,
      prolificPid: prolificPid,
      assignedImages: loginData.assignedImages,
      totalImages: loginData.totalImages,
      
      // Progress tracking
      studyPhase: 'consent',
      hasConsented: false,
      consentedAt: null,
      currentImageIndex: 0,
      completedImageCount: 0,
      completedImageIds: [],
      surveyCompleted: false,
      completedAt: null,
      
      // Session metadata
      createdAt: new Date(),
      firstLoginAt: new Date(),
      lastActiveAt: new Date(),
      totalSessionTime: 0,
      
      // Prolific integration
      prolificData: {
        studyId: prolificData.studyId || null,
        sessionId: prolificData.sessionId || null,
        prolificPid: prolificPid,
        ...prolificData
      },
      
      // Technical metadata
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      timezone: typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : ''
    });
    
    console.log(`Successfully assigned login ID ${loginId} to participant ${prolificPid}`);
    
    return {
      success: true,
      loginId: loginId,
      assignedImages: loginData.assignedImages,
      isExisting: false
    };
    
  } catch (error) {
    console.error('Error assigning login ID to participant:', error);
    throw error;
  }
};

/**
 * Find existing participant by Prolific PID
 */
export const findExistingParticipant = async (prolificPid) => {
  try {
    // Check pre-assigned logins for this Prolific PID
    const preAssignedRef = collection(db, 'preAssignedLogins');
    const assignedQuery = query(preAssignedRef, where('assignedTo', '==', prolificPid));
    const assignedSnapshot = await getDocs(assignedQuery);
    
    if (!assignedSnapshot.empty) {
      const doc = assignedSnapshot.docs[0];
      return {
        exists: true,
        loginId: doc.id,
        assignmentData: doc.data()
      };
    }
    
    return { exists: false };
    
  } catch (error) {
    console.error('Error finding existing participant:', error);
    throw error;
  }
};

/**
 * Get system statistics for admin dashboard
 */
export const getSystemStats = async () => {
  try {
    // Get system config
    const systemConfigRef = doc(db, 'systemConfig', 'main');
    const systemConfigDoc = await getDoc(systemConfigRef);
    
    if (!systemConfigDoc.exists()) {
      return {
        totalLoginIds: 0,
        availableIds: 0,
        assignedIds: 0,
        activeParticipants: 0,
        completedParticipants: 0,
        conversionRate: 0
      };
    }
    
    const systemConfig = systemConfigDoc.data();
    
    // Get pre-assigned login stats
    const preAssignedSnapshot = await getDocs(collection(db, 'preAssignedLogins'));
    let availableCount = 0;
    let assignedCount = 0;
    
    preAssignedSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.isAssigned) {
        assignedCount++;
      } else {
        availableCount++;
      }
    });
    
    // Get active participant stats
    const participantsSnapshot = await getDocs(collection(db, 'participants'));
    let activeCount = 0;
    let completedCount = 0;
    
    participantsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.surveyCompleted) {
        completedCount++;
      } else {
        activeCount++;
      }
    });
    
    const conversionRate = assignedCount > 0 ? Math.round((completedCount / assignedCount) * 100) : 0;
    
    const stats = {
      totalLoginIds: preAssignedSnapshot.size,
      availableIds: availableCount,
      assignedIds: assignedCount,
      activeParticipants: activeCount,
      completedParticipants: completedCount,
      conversionRate: conversionRate
    };
    
    // Update cached stats in system config
    await updateDoc(systemConfigRef, {
      'stats.availableLoginIds': availableCount,
      'stats.assignedLoginIds': assignedCount,
      'stats.activeParticipants': activeCount,
      'stats.completedParticipants': completedCount,
      'stats.lastUpdated': new Date()
    });
    
    return stats;
    
  } catch (error) {
    console.error('Error getting system stats:', error);
    throw error;
  }
};

/**
 * Get assignment statistics for images
 */
export const getAssignmentStats = async () => {
  try {
    const [set1Doc, set2Doc] = await Promise.all([
      getDoc(doc(db, 'imageMetadata', 'set1')),
      getDoc(doc(db, 'imageMetadata', 'set2'))
    ]);
    
    const set1Data = set1Doc.exists() ? set1Doc.data() : { assignments: {}, setStats: {} };
    const set2Data = set2Doc.exists() ? set2Doc.data() : { assignments: {}, setStats: {} };
    
    return {
      set1: set1Data.setStats || {},
      set2: set2Data.setStats || {},
      totalImages: {
        set1: 1200,
        set2: 1200
      }
    };
  } catch (error) {
    console.error('Error getting assignment stats:', error);
    throw error;
  }
};

/**
 * Reset the entire pre-assigned system (admin function)
 */
export const resetPreAssignedSystem = async () => {
  try {
    console.log('Resetting pre-assigned system...');
    
    // Clear pre-assigned logins
    const preAssignedSnapshot = await getDocs(collection(db, 'preAssignedLogins'));
    const deletePromises = [];
    
    preAssignedSnapshot.docs.forEach(doc => {
      deletePromises.push(deleteDoc(doc.ref));
    });
    
    // Clear active participants
    const participantsSnapshot = await getDocs(collection(db, 'participants'));
    participantsSnapshot.docs.forEach(doc => {
      deletePromises.push(deleteDoc(doc.ref));
    });
    
    // Clear image metadata
    deletePromises.push(deleteDoc(doc(db, 'imageMetadata', 'set1')));
    deletePromises.push(deleteDoc(doc(db, 'imageMetadata', 'set2')));
    
    // Clear system config
    deletePromises.push(deleteDoc(doc(db, 'systemConfig', 'main')));
    
    await Promise.all(deletePromises);
    
    console.log('Pre-assigned system reset complete');
    return { success: true };
    
  } catch (error) {
    console.error('Error resetting system:', error);
    throw error;
  }
};

/**
 * Verify Firebase setup and storage structure
 */
export const verifySetup = async () => {
  try {
    console.log('Verifying Firebase setup...');
    
    // Test Firestore connection
    const testRef = doc(db, 'test', 'connection');
    await setDoc(testRef, { timestamp: new Date(), test: true });
    console.log('✓ Firestore connection working');
    
    // Test Storage access by checking sample images
    const testImages = [
      'set1/1.png',
      'set1/100.png', 
      'set1/1200.png',
      'set2/1201.png',
      'set2/1300.png',
      'set2/2400.png'
    ];
    
    const results = [];
    for (const imagePath of testImages) {
      try {
        const imageRef = ref(storage, imagePath);
        const url = await getDownloadURL(imageRef);
        results.push({ path: imagePath, status: 'success', url: url.substring(0, 50) + '...' });
        console.log(`✓ ${imagePath} accessible`);
      } catch (error) {
        results.push({ path: imagePath, status: 'error', error: error.message });
        console.log(`✗ ${imagePath} failed: ${error.message}`);
      }
    }
    
    // Check system configuration
    let systemStatus = 'not_initialized';
    try {
      const systemConfigDoc = await getDoc(doc(db, 'systemConfig', 'main'));
      if (systemConfigDoc.exists()) {
        systemStatus = 'initialized';
      }
    } catch (error) {
      console.warn('Could not check system config:', error);
    }
    
    // Clean up test document
    try {
      await deleteDoc(testRef);
    } catch (error) {
      // Ignore cleanup errors
    }
    
    return {
      success: true,
      firestore: 'connected',
      storage: results,
      systemStatus: systemStatus,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('Setup verification failed:', error);
    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
};

/**
 * Update participant progress
 */
export const updateParticipantProgress = async (loginId, updates) => {
  try {
    const participantRef = doc(db, 'participants', loginId);
    await updateDoc(participantRef, {
      ...updates,
      lastActiveAt: new Date()
    });
    
    console.log(`Updated progress for participant ${loginId}`);
    return { success: true };
    
  } catch (error) {
    console.error('Error updating participant progress:', error);
    throw error;
  }
};

/**
 * Check if participant has completed the survey
 */
export const checkSurveyCompletion = async (loginId) => {
  try {
    const participantRef = doc(db, 'participants', loginId);
    const participantDoc = await getDoc(participantRef);
    
    if (!participantDoc.exists()) {
      return false;
    }
    
    const participantData = participantDoc.data();
    return participantData.surveyCompleted === true;
    
  } catch (error) {
    console.error('Error checking survey completion:', error);
    return false;
  }
};

/**
 * Get participant data by login ID
 */
export const getParticipantData = async (loginId) => {
  try {
    const participantRef = doc(db, 'participants', loginId);
    const participantDoc = await getDoc(participantRef);
    
    if (!participantDoc.exists()) {
      throw new Error(`Participant with login ID ${loginId} not found`);
    }
    
    return participantDoc.data();
    
  } catch (error) {
    console.error('Error getting participant data:', error);
    throw error;
  }
};

/**
 * Clear all participant data (admin function - use with caution)
 */
export const clearAllData = async () => {
  try {
    console.log('Clearing all participant data...');
    
    // Clear active participants (keep pre-assigned logins for reuse)
    const participantsSnapshot = await getDocs(collection(db, 'participants'));
    const deletePromises = [];
    
    participantsSnapshot.docs.forEach(doc => {
      deletePromises.push(deleteDoc(doc.ref));
    });
    
    // Reset assignment status in pre-assigned logins
    const preAssignedSnapshot = await getDocs(collection(db, 'preAssignedLogins'));
    const resetPromises = [];
    
    preAssignedSnapshot.docs.forEach(doc => {
      resetPromises.push(updateDoc(doc.ref, {
        isAssigned: false,
        assignedTo: null,
        assignedAt: null,
        status: 'available',
        prolificData: null
      }));
    });
    
    await Promise.all([...deletePromises, ...resetPromises]);
    
    // Clear any test documents
    try {
      await deleteDoc(doc(db, 'test', 'connection'));
    } catch (error) {
      // Ignore if test doc doesn't exist
    }
    
    console.log('All participant data cleared successfully');
    return { success: true, message: 'All participant data cleared successfully' };
    
  } catch (error) {
    console.error('Error clearing data:', error);
    throw error;
  }
};

// Legacy function compatibility - these now work with the new system
export const assignImagesToUser = async (userId) => {
  console.warn('assignImagesToUser is deprecated. Use assignLoginIdToParticipant instead.');
  throw new Error('This function is no longer supported. Use the pre-assigned login system.');
};

export const resetImageAssignments = async () => {
  console.warn('resetImageAssignments is deprecated. Use resetPreAssignedSystem instead.');
  return await resetPreAssignedSystem();
};