// src/utils/preAssignedSystem.js - Pre-assigned login ID system
import { doc, setDoc, getDoc, updateDoc, serverTimestamp, collection, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../firebase/config';

// Configuration
const TOTAL_LOGIN_IDS = 1100; // 0001 to 1100
const IMAGES_PER_PARTICIPANT = 10; // 5 from set1, 5 from set2

// Generate pre-assigned login IDs (0001-1100)
export const generateLoginIds = () => {
  const ids = [];
  for (let i = 1; i <= TOTAL_LOGIN_IDS; i++) {
    ids.push(i.toString().padStart(4, '0')); // 0001, 0002, etc.
  }
  return ids;
};

// Create balanced image assignments for all login IDs
export const createPreAssignments = async () => {
  try {
    console.log('Creating pre-assignments for all login IDs...');
    
    const loginIds = generateLoginIds();
    let batch = writeBatch(db);
    let batchCount = 0;
    
    // Create assignment pools
    const set1Images = Array.from({length: 1200}, (_, i) => ({
      id: `set1_${i + 1}`,
      name: `${i + 1}.png`,
      set: 'set1',
      path: `set1/${i + 1}.png`,
      number: i + 1
    }));
    
    const set2Images = Array.from({length: 1200}, (_, i) => ({
      id: `set2_${i + 1201}`,
      name: `${i + 1201}.png`, 
      set: 'set2',
      path: `set2/${i + 1201}.png`,
      number: i + 1201
    }));
    
    // Shuffle images for random distribution
    const shuffledSet1 = [...set1Images].sort(() => Math.random() - 0.5);
    const shuffledSet2 = [...set2Images].sort(() => Math.random() - 0.5);
    
    // Track assignment counts (max 5 per image)
    const set1AssignmentCount = new Array(1200).fill(0);
    const set2AssignmentCount = new Array(1200).fill(0);
    
    for (let i = 0; i < loginIds.length; i++) {
      const loginId = loginIds[i];
      
      // Select 5 images from set1 (prioritize least assigned)
      const set1Selected = [];
      let attempts = 0;
      while (set1Selected.length < 5 && attempts < 10000) {
        const randomIndex = Math.floor(Math.random() * 1200);
        if (set1AssignmentCount[randomIndex] < 5) {
          const image = shuffledSet1[randomIndex];
          if (!set1Selected.find(img => img.id === image.id)) {
            set1Selected.push(image);
            set1AssignmentCount[randomIndex]++;
          }
        }
        attempts++;
      }
      
      // Select 5 images from set2 (prioritize least assigned)
      const set2Selected = [];
      attempts = 0;
      while (set2Selected.length < 5 && attempts < 10000) {
        const randomIndex = Math.floor(Math.random() * 1200);
        if (set2AssignmentCount[randomIndex] < 5) {
          const image = shuffledSet2[randomIndex];
          if (!set2Selected.find(img => img.id === image.id)) {
            set2Selected.push(image);
            set2AssignmentCount[randomIndex]++;
          }
        }
        attempts++;
      }
      
      const allAssignedImages = [...set1Selected, ...set2Selected];
      
      // Create login ID document
      const loginRef = doc(db, 'preAssignedLogins', loginId);
      batch.set(loginRef, {
        loginId: loginId,
        assignedImages: allAssignedImages,
        totalImages: allAssignedImages.length,
        isUsed: false,
        assignedAt: serverTimestamp(),
        usedBy: null,
        usedAt: null,
        prolificData: null,
        status: 'available'
      });
      
      batchCount++;
      
      // Commit batch every 450 operations to stay under Firestore limits
      if (batchCount >= 450) {
        await batch.commit();
        console.log(`Committed batch for login IDs 1-${i + 1}`);
        // Create a new batch for the next set of operations
        batch = writeBatch(db);
        batchCount = 0;
      }
    }
    
    // Commit remaining operations
    if (batchCount > 0) {
      await batch.commit();
    }
    
    console.log(`Successfully created pre-assignments for ${loginIds.length} login IDs`);
    
    return {
      success: true,
      totalIds: loginIds.length,
      imagesPerParticipant: IMAGES_PER_PARTICIPANT
    };
    
  } catch (error) {
    console.error('Error creating pre-assignments:', error);
    throw error;
  }
};

// Get next available login ID
export const getNextAvailableLoginId = async () => {
  try {
    const loginCollection = collection(db, 'preAssignedLogins');
    const snapshot = await getDocs(loginCollection);
    
    // Find first unused login ID
    for (const doc of snapshot.docs) {
      const data = doc.data();
      if (!data.isUsed && data.status === 'available') {
        return {
          success: true,
          loginId: data.loginId,
          assignedImages: data.assignedImages
        };
      }
    }
    
    return {
      success: false,
      error: 'No available login IDs remaining'
    };
    
  } catch (error) {
    console.error('Error getting next available login ID:', error);
    throw error;
  }
};

// Assign login ID to Prolific participant
export const assignLoginIdToParticipant = async (prolificPid, prolificData) => {
  try {
    console.log('Assigning login ID to participant:', prolificPid);
    
    // Get next available login ID
    const availableLogin = await getNextAvailableLoginId();
    
    if (!availableLogin.success) {
      throw new Error(availableLogin.error);
    }
    
    const loginId = availableLogin.loginId;
    
    // Mark login ID as used and associate with Prolific participant
    const loginRef = doc(db, 'preAssignedLogins', loginId);
    await updateDoc(loginRef, {
      isUsed: true,
      usedBy: prolificPid,
      usedAt: serverTimestamp(),
      prolificData: {
        prolificPid,
        studyId: prolificData?.studyId,
        sessionId: prolificData?.sessionId,
        detectedAt: prolificData?.detectedAt || new Date().toISOString()
      },
      status: 'assigned'
    });
    
    // Create user session document
    const userRef = doc(db, 'loginIDs', loginId);
    await setDoc(userRef, {
      loginId: loginId,
      prolificPid: prolificPid,
      assignedImages: availableLogin.assignedImages,
      totalImages: availableLogin.assignedImages.length,
      completedImages: 0,
      hasConsented: false,
      surveyCompleted: false,
      createdAt: serverTimestamp(),
      lastLogin: serverTimestamp(),
      source: 'prolific',
      prolificData: {
        prolificPid,
        studyId: prolificData?.studyId,
        sessionId: prolificData?.sessionId,
        detectedAt: prolificData?.detectedAt || new Date().toISOString()
      }
    });
    
    console.log(`Login ID ${loginId} assigned to Prolific participant ${prolificPid}`);
    
    return {
      success: true,
      loginId: loginId,
      assignedImages: availableLogin.assignedImages
    };
    
  } catch (error) {
    console.error('Error assigning login ID to participant:', error);
    throw error;
  }
};

// Get system statistics
export const getSystemStats = async () => {
  try {
    const [preAssignedSnapshot, activeSessionsSnapshot] = await Promise.all([
      getDocs(collection(db, 'preAssignedLogins')),
      getDocs(collection(db, 'loginIDs'))
    ]);
    
    const stats = {
      totalLoginIds: 0,
      availableIds: 0,
      assignedIds: 0,
      completedSessions: 0,
      activeSessions: 0,
      conversionRate: 0
    };
    
    // Count pre-assigned login IDs
    preAssignedSnapshot.forEach(doc => {
      const data = doc.data();
      stats.totalLoginIds++;
      
      if (data.isUsed) {
        stats.assignedIds++;
      } else {
        stats.availableIds++;
      }
    });
    
    // Count active sessions and completed surveys
    activeSessionsSnapshot.forEach(doc => {
      if (doc.id === 'ADMIN') return;
      
      const data = doc.data();
      stats.activeSessions++;
      
      if (data.surveyCompleted) {
        stats.completedSessions++;
      }
    });
    
    // Calculate conversion rate
    if (stats.assignedIds > 0) {
      stats.conversionRate = Math.round((stats.completedSessions / stats.assignedIds) * 100);
    }
    
    return stats;
    
  } catch (error) {
    console.error('Error getting system stats:', error);
    throw error;
  }
};

// Check if participant already has a login ID
export const findExistingParticipant = async (prolificPid) => {
  try {
    const preAssignedSnapshot = await getDocs(collection(db, 'preAssignedLogins'));
    
    for (const doc of preAssignedSnapshot.docs) {
      const data = doc.data();
      if (data.prolificData?.prolificPid === prolificPid) {
        return {
          exists: true,
          loginId: data.loginId,
          assignedImages: data.assignedImages
        };
      }
    }
    
    return { exists: false };
    
  } catch (error) {
    console.error('Error finding existing participant:', error);
    throw error;
  }
};

// Reset system (admin function)
export const resetPreAssignedSystem = async () => {
  try {
    console.log('Resetting pre-assigned system...');
    
    // Clear all pre-assigned logins
    const preAssignedSnapshot = await getDocs(collection(db, 'preAssignedLogins'));
    const batch = writeBatch(db);
    let batchCount = 0;
    
    preAssignedSnapshot.forEach(doc => {
      batch.delete(doc.ref);
      batchCount++;
      
      if (batchCount >= 450) {
        batch.commit();
        batchCount = 0;
      }
    });
    
    if (batchCount > 0) {
      await batch.commit();
    }
    
    // Clear active sessions (except admin)
    const sessionsSnapshot = await getDocs(collection(db, 'loginIDs'));
    const sessionBatch = writeBatch(db);
    let sessionBatchCount = 0;
    
    sessionsSnapshot.forEach(doc => {
      if (doc.id !== 'ADMIN') {
        sessionBatch.delete(doc.ref);
        sessionBatchCount++;
        
        if (sessionBatchCount >= 450) {
          sessionBatch.commit();
          sessionBatchCount = 0;
        }
      }
    });
    
    if (sessionBatchCount > 0) {
      await sessionBatch.commit();
    }
    
    console.log('Pre-assigned system reset complete');
    return { success: true };
    
  } catch (error) {
    console.error('Error resetting system:', error);
    throw error;
  }
};

// Get available login IDs list
export const getAvailableLoginIdsList = async (limit = 50) => {
  try {
    const snapshot = await getDocs(collection(db, 'preAssignedLogins'));
    const available = [];
    
    snapshot.forEach(doc => {
      const data = doc.data();
      if (!data.isUsed && available.length < limit) {
        available.push({
          loginId: data.loginId,
          assignedImages: data.assignedImages?.length || 0,
          status: data.status
        });
      }
    });
    
    return available.sort((a, b) => a.loginId.localeCompare(b.loginId));
    
  } catch (error) {
    console.error('Error getting available login IDs:', error);
    throw error;
  }
};