// src/utils/firebaseSetup.js - Complete version with proper reset functionality

import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  getDocs, 
  deleteDoc, 
  query, 
  where,
  writeBatch,
  serverTimestamp
} from 'firebase/firestore';
import { ref, listAll, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase/config';

/**
 * Initialize the Firebase setup for the image evaluation study
 */
export const initializeFirebaseSetup = async () => {
  try {
    console.log('Initializing Firebase setup...');
    
    // Check if admin user exists
    const adminRef = doc(db, 'loginIDs', 'ADMIN');
    const adminSnapshot = await getDoc(adminRef);
    
    if (!adminSnapshot.exists()) {
      console.log('Creating admin user...');
      await setDoc(adminRef, {
        internalUserId: 'ADMIN',
        displayId: 'ADMIN',
        isAdmin: true,
        createdAt: serverTimestamp(),
        setupVersion: '2.0'
      });
    }
    
    // Initialize system config
    const configRef = doc(db, 'systemConfig', 'main');
    const configSnapshot = await getDoc(configRef);
    
    if (!configSnapshot.exists()) {
      console.log('Creating system config...');
      await setDoc(configRef, {
        setupComplete: true,
        setupDate: serverTimestamp(),
        version: '2.0',
        imageAssignmentStrategy: 'balanced',
        totalImagesSet1: 1200,
        totalImagesSet2: 1200,
        totalImages: 2400
      });
    }
    
    console.log('Firebase setup initialization complete');
    return { success: true };
    
  } catch (error) {
    console.error('Error initializing Firebase setup:', error);
    throw error;
  }
};

/**
 * Verify the current setup and return status
 */
export const verifySetup = async () => {
  try {
    console.log('Verifying Firebase setup...');
    
    const status = {
      adminExists: false,
      configExists: false,
      userCount: 0,
      totalImages: 0,
      errors: []
    };
    
    // Check admin user
    try {
      const adminRef = doc(db, 'loginIDs', 'ADMIN');
      const adminSnapshot = await getDoc(adminRef);
      status.adminExists = adminSnapshot.exists();
    } catch (error) {
      status.errors.push('Could not verify admin user');
    }
    
    // Check system config
    try {
      const configRef = doc(db, 'systemConfig', 'main');
      const configSnapshot = await getDoc(configRef);
      status.configExists = configSnapshot.exists();
    } catch (error) {
      status.errors.push('Could not verify system config');
    }
    
    // Count users
    try {
      const usersRef = collection(db, 'loginIDs');
      const usersSnapshot = await getDocs(usersRef);
      status.userCount = usersSnapshot.size;
    } catch (error) {
      status.errors.push('Could not count users');
    }
    
    // Estimate total images (we know we have 2400 total)
    status.totalImages = 2400;
    
    console.log('Setup verification complete:', status);
    return status;
    
  } catch (error) {
    console.error('Error verifying setup:', error);
    throw error;
  }
};

/**
 * Get assignment statistics for all images
 */
export const getAssignmentStats = async () => {
  try {
    console.log('Calculating assignment statistics...');
    
    const usersRef = collection(db, 'loginIDs');
    const usersSnapshot = await getDocs(usersRef);
    
    const imageAssignmentCounts = {};
    const set1Stats = {};
    const set2Stats = {};
    
    // Count assignments for each image
    usersSnapshot.forEach(doc => {
      const userData = doc.data();
      
      // Skip admin user
      if (doc.id === 'ADMIN') return;
      
      if (userData.assignedImages && Array.isArray(userData.assignedImages)) {
        userData.assignedImages.forEach(image => {
          const imageId = image.id || image.name || `${image.set}_${image.number}`;
          imageAssignmentCounts[imageId] = (imageAssignmentCounts[imageId] || 0) + 1;
        });
      }
    });
    
    // Categorize by assignment count and set
    Object.entries(imageAssignmentCounts).forEach(([imageId, count]) => {
      const isSet1 = imageId.includes('set1') || (imageId.match(/\d+/) && parseInt(imageId.match(/\d+/)[0]) <= 1200);
      
      if (isSet1) {
        set1Stats[count] = (set1Stats[count] || 0) + 1;
      } else {
        set2Stats[count] = (set2Stats[count] || 0) + 1;
      }
    });
    
    // Add unassigned images
    const totalSet1Images = 1200;
    const totalSet2Images = 1200;
    
    const assignedSet1Count = Object.values(set1Stats).reduce((sum, count) => sum + count, 0);
    const assignedSet2Count = Object.values(set2Stats).reduce((sum, count) => sum + count, 0);
    
    if (assignedSet1Count < totalSet1Images) {
      set1Stats[0] = totalSet1Images - assignedSet1Count;
    }
    
    if (assignedSet2Count < totalSet2Images) {
      set2Stats[0] = totalSet2Images - assignedSet2Count;
    }
    
    const stats = {
      set1: set1Stats,
      set2: set2Stats,
      totalAssignments: Object.keys(imageAssignmentCounts).length,
      averageAssignments: Object.keys(imageAssignmentCounts).length > 0 
        ? Object.values(imageAssignmentCounts).reduce((sum, count) => sum + count, 0) / Object.keys(imageAssignmentCounts).length 
        : 0
    };
    
    console.log('Assignment statistics calculated:', stats);
    return stats;
    
  } catch (error) {
    console.error('Error getting assignment statistics:', error);
    throw error;
  }
};

/**
 * Reset the entire pre-assigned system (admin function)
 */
export const resetPreAssignedSystem = async () => {
  try {
    console.log('Clearing all participant data...');
    
    let deletedCount = 0;
    const batchSize = 500; // Firestore batch limit
    
    // Get all users from loginIDs collection (except ADMIN)
    const usersRef = collection(db, 'loginIDs');
    const usersSnapshot = await getDocs(usersRef);
    
    if (usersSnapshot.empty) {
      console.log('No users found to delete');
      return { success: true, deletedCount: 0 };
    }
    
    // Process deletions in batches
    const batches = [];
    let currentBatch = writeBatch(db);
    let operationsInBatch = 0;
    
    usersSnapshot.docs.forEach(doc => {
      // Skip admin user
      if (doc.id === 'ADMIN') {
        console.log('Skipping ADMIN user');
        return;
      }
      
      currentBatch.delete(doc.ref);
      operationsInBatch++;
      deletedCount++;
      
      // If we hit the batch limit, start a new batch
      if (operationsInBatch >= batchSize) {
        batches.push(currentBatch);
        currentBatch = writeBatch(db);
        operationsInBatch = 0;
      }
    });
    
    // Add the final batch if it has operations
    if (operationsInBatch > 0) {
      batches.push(currentBatch);
    }
    
    // Execute all batches
    console.log(`Executing ${batches.length} batch(es) to delete ${deletedCount} users...`);
    
    for (let i = 0; i < batches.length; i++) {
      await batches[i].commit();
      console.log(`Completed batch ${i + 1}/${batches.length}`);
    }
    
    // Also clear other collections if they exist
    try {
      // Clear participants collection
      const participantsSnapshot = await getDocs(collection(db, 'participants'));
      if (!participantsSnapshot.empty) {
        const participantBatches = [];
        let participantBatch = writeBatch(db);
        let participantOps = 0;
        
        participantsSnapshot.docs.forEach(doc => {
          participantBatch.delete(doc.ref);
          participantOps++;
          
          if (participantOps >= batchSize) {
            participantBatches.push(participantBatch);
            participantBatch = writeBatch(db);
            participantOps = 0;
          }
        });
        
        if (participantOps > 0) {
          participantBatches.push(participantBatch);
        }
        
        for (const batch of participantBatches) {
          await batch.commit();
        }
        
        console.log(`Deleted ${participantsSnapshot.size} participants`);
      }
    } catch (error) {
      console.warn('Could not clear participants collection:', error);
    }
    
    try {
      // Clear preAssignedLogins collection if it exists
      const preAssignedSnapshot = await getDocs(collection(db, 'preAssignedLogins'));
      if (!preAssignedSnapshot.empty) {
        const preAssignedBatches = [];
        let preAssignedBatch = writeBatch(db);
        let preAssignedOps = 0;
        
        preAssignedSnapshot.docs.forEach(doc => {
          preAssignedBatch.delete(doc.ref);
          preAssignedOps++;
          
          if (preAssignedOps >= batchSize) {
            preAssignedBatches.push(preAssignedBatch);
            preAssignedBatch = writeBatch(db);
            preAssignedOps = 0;
          }
        });
        
        if (preAssignedOps > 0) {
          preAssignedBatches.push(preAssignedBatch);
        }
        
        for (const batch of preAssignedBatches) {
          await batch.commit();
        }
        
        console.log(`Deleted ${preAssignedSnapshot.size} pre-assigned logins`);
      }
    } catch (error) {
      console.warn('Could not clear preAssignedLogins collection:', error);
    }
    
    // Clear image metadata
    try {
      await deleteDoc(doc(db, 'imageMetadata', 'set1'));
      await deleteDoc(doc(db, 'imageMetadata', 'set2'));
      console.log('Cleared image metadata');
    } catch (error) {
      console.warn('Could not clear image metadata:', error);
    }
    
    // Clear/reset system config
    try {
      await setDoc(doc(db, 'systemConfig', 'main'), {
        resetAt: new Date(),
        resetBy: 'admin',
        participantsDeleted: deletedCount,
        lastResetType: 'full_system_reset'
      }, { merge: true });
      console.log('Updated system config');
    } catch (error) {
      console.warn('Could not update system config:', error);
    }
    
    console.log(`Successfully deleted ${deletedCount} users (kept ADMIN)`);
    return { success: true, deletedCount };
    
  } catch (error) {
    console.error('Error resetting pre-assigned system:', error);
    throw error;
  }
};

/**
 * Enhanced clear all data function - works with your structure
 */
export const clearAllData = async () => {
  try {
    console.log('Clearing all participant data...');
    
    // This is just an alias to resetPreAssignedSystem for your current structure
    const result = await resetPreAssignedSystem();
    
    console.log('All participant data cleared successfully');
    return { 
      success: true, 
      message: `All participant data cleared successfully. Deleted ${result.deletedCount} users.`,
      deletedCount: result.deletedCount
    };
    
  } catch (error) {
    console.error('Error clearing data:', error);
    throw error;
  }
};

/**
 * Create pre-assigned participants for large scale (1080+)
 */
export const createLargeScaleParticipants = async (config = {}) => {
  const {
    count = 1080,
    imagesPerParticipant = 10,
    startingNumber = 1,
    prefix = '',
    onProgress = null
  } = config;
  
  try {
    console.log(`Creating ${count} pre-assigned participants...`);
    
    // Generate available images (using your structure)
    const availableImages = [];
    
    // Generate set1 images (1-1200)
    for (let i = 1; i <= 1200; i++) {
      availableImages.push({
        id: `set1_${i}`,
        name: `${i}.png`,
        set: 'set1',
        path: `set1/${i}.png`,
        number: i
      });
    }
    
    // Generate set2 images (1201-2400)
    for (let i = 1201; i <= 2400; i++) {
      availableImages.push({
        id: `set2_${i}`,
        name: `${i}.png`,
        set: 'set2',
        path: `set2/${i}.png`,
        number: i
      });
    }
    
    // Shuffle for random assignment
    const shuffledImages = [...availableImages].sort(() => Math.random() - 0.5);
    
    console.log(`Generated ${shuffledImages.length} available images`);
    
    const batchSize = 500; // Firestore batch limit
    const totalBatches = Math.ceil(count / batchSize);
    let totalCreated = 0;
    
    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const batchStart = batchIndex * batchSize;
      const batchEnd = Math.min(batchStart + batchSize, count);
      const currentBatchSize = batchEnd - batchStart;
      
      console.log(`Processing batch ${batchIndex + 1}/${totalBatches}: participants ${batchStart + 1}-${batchEnd}`);
      
      const batch = writeBatch(db);
      
      for (let i = batchStart; i < batchEnd; i++) {
        const participantNumber = startingNumber + i;
        const participantId = prefix ? 
          `${prefix}${String(participantNumber).padStart(4, '0')}` : 
          String(participantNumber).padStart(4, '0');
        
        // Assign images
        const startImageIndex = (i * imagesPerParticipant) % shuffledImages.length;
        const assignedImages = [];
        
        for (let j = 0; j < imagesPerParticipant; j++) {
          const imageIndex = (startImageIndex + j) % shuffledImages.length;
          assignedImages.push(shuffledImages[imageIndex]);
        }
        
        const participantData = {
          internalUserId: participantId,
          displayId: participantId,
          assignedImages: assignedImages,
          completedImages: 0,
          totalImages: assignedImages.length,
          surveyCompleted: false,
          hasConsented: false,
          demographicsCompleted: false,
          createdAt: serverTimestamp(),
          isActive: true,
          source: 'pre-assigned',
          preAssigned: true,
          isPreAssigned: true,
          preAssignedAt: serverTimestamp(),
          batchCreated: true,
          batchIndex: batchIndex + 1,
          participantNumber: participantNumber
        };
        
        const userRef = doc(db, 'loginIDs', participantId);
        batch.set(userRef, participantData);
        totalCreated++;
      }
      
      // Commit batch
      await batch.commit();
      
      // Update progress
      if (onProgress) {
        const progressPercent = Math.round((totalCreated / count) * 100);
        onProgress(progressPercent, totalCreated, count);
      }
      
      console.log(`Batch ${batchIndex + 1} completed. Created ${totalCreated}/${count} participants`);
      
      // Small delay between batches
      if (batchIndex < totalBatches - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    console.log(`Successfully created ${totalCreated} pre-assigned participants`);
    return { success: true, createdCount: totalCreated };
    
  } catch (error) {
    console.error('Error creating large scale participants:', error);
    throw error;
  }
};

/**
 * Get available images for assignment
 */
export const getAvailableImagesForAssignment = async () => {
  try {
    const availableImages = [];
    
    // Generate image objects for set1 (1-1200)
    for (let i = 1; i <= 1200; i++) {
      availableImages.push({
        id: `set1_${i}`,
        name: `${i}.png`,
        set: 'set1',
        path: `set1/${i}.png`,
        number: i
      });
    }
    
    // Generate image objects for set2 (1201-2400)
    for (let i = 1201; i <= 2400; i++) {
      availableImages.push({
        id: `set2_${i}`,
        name: `${i}.png`,
        set: 'set2',
        path: `set2/${i}.png`,
        number: i
      });
    }
    
    // Shuffle arrays for random assignment
    const shuffled = availableImages.sort(() => Math.random() - 0.5);
    
    console.log(`Generated ${shuffled.length} available images for assignment`);
    return shuffled;
    
  } catch (error) {
    console.error('Error getting available images:', error);
    throw new Error('Failed to get available images for assignment');
  }
};

/**
 * Legacy function for compatibility - use resetPreAssignedSystem instead
 */
export const resetImageAssignments = async () => {
  console.warn('resetImageAssignments is deprecated. Use resetPreAssignedSystem instead.');
  return await resetPreAssignedSystem();
};

/**
 * Get images from Firebase Storage (if needed)
 */
export const getImagesFromStorage = async () => {
  try {
    console.log('Fetching images from Firebase Storage...');
    
    const images = {
      set1: [],
      set2: []
    };
    
    // Get set1 images
    try {
      const set1Ref = ref(storage, 'set1');
      const set1List = await listAll(set1Ref);
      
      for (const itemRef of set1List.items) {
        const url = await getDownloadURL(itemRef);
        images.set1.push({
          name: itemRef.name,
          url: url,
          path: itemRef.fullPath,
          set: 'set1'
        });
      }
    } catch (error) {
      console.warn('Could not fetch set1 images:', error);
    }
    
    // Get set2 images
    try {
      const set2Ref = ref(storage, 'set2');
      const set2List = await listAll(set2Ref);
      
      for (const itemRef of set2List.items) {
        const url = await getDownloadURL(itemRef);
        images.set2.push({
          name: itemRef.name,
          url: url,
          path: itemRef.fullPath,
          set: 'set2'
        });
      }
    } catch (error) {
      console.warn('Could not fetch set2 images:', error);
    }
    
    console.log(`Fetched ${images.set1.length} set1 images and ${images.set2.length} set2 images`);
    return images;
    
  } catch (error) {
    console.error('Error fetching images from storage:', error);
    throw error;
  }
};

/**
 * Validate system configuration
 */
export const validateSystemConfig = async () => {
  try {
    console.log('Validating system configuration...');
    
    const validation = {
      isValid: true,
      errors: [],
      warnings: [],
      recommendations: []
    };
    
    // Check admin user
    const adminRef = doc(db, 'loginIDs', 'ADMIN');
    const adminSnapshot = await getDoc(adminRef);
    
    if (!adminSnapshot.exists()) {
      validation.isValid = false;
      validation.errors.push('Admin user not found');
    }
    
    // Check system config
    const configRef = doc(db, 'systemConfig', 'main');
    const configSnapshot = await getDoc(configRef);
    
    if (!configSnapshot.exists()) {
      validation.warnings.push('System config not found');
    }
    
    // Check user count
    const usersRef = collection(db, 'loginIDs');
    const usersSnapshot = await getDocs(usersRef);
    const userCount = usersSnapshot.size;
    
    if (userCount < 2) { // Should have at least ADMIN + 1 user
      validation.warnings.push('Very few users in system');
    }
    
    // Check for storage access
    try {
      await getImagesFromStorage();
    } catch (error) {
      validation.warnings.push('Could not access Firebase Storage');
    }
    
    console.log('System validation complete:', validation);
    return validation;
    
  } catch (error) {
    console.error('Error validating system config:', error);
    throw error;
  }
};