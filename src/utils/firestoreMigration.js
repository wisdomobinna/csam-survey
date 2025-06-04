// src/utils/firestoreMigration.js - Complete system migration utility
import { 
  collection, 
  getDocs, 
  doc, 
  getDoc,
  setDoc, 
  writeBatch,
  serverTimestamp 
} from 'firebase/firestore';
import { ref, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase/config';

// Configuration for the new system
const SYSTEM_CONFIG = {
  totalLoginIds: 1100,
  imagesPerParticipant: 10,
  imagesPerSet: 5,
  maxEvaluationsPerImage: 5,
  set1Range: { start: 1, end: 1200 },
  set2Range: { start: 1201, end: 2400 }
};

/**
 * STEP 1: Clear all old Firestore collections
 */
export const clearOldFirestoreData = async () => {
  console.log('🗑️ Starting cleanup of old Firestore data...');
  
  const collectionsToDelete = [
    'imageAssignments',
    'images', 
    'loginIDs',
    'userProgress',
    'system',
    'test'
  ];
  
  const results = {
    deleted: [],
    errors: [],
    totalDeleted: 0
  };
  
  for (const collectionName of collectionsToDelete) {
    try {
      console.log(`Deleting collection: ${collectionName}`);
      const collectionRef = collection(db, collectionName);
      const snapshot = await getDocs(collectionRef);
      
      if (snapshot.empty) {
        console.log(`Collection ${collectionName} is already empty`);
        continue;
      }
      
      console.log(`Found ${snapshot.size} documents in ${collectionName}`);
      
      // Delete in batches to avoid Firebase limits
      const batches = [];
      let batch = writeBatch(db);
      let batchCount = 0;
      
      snapshot.docs.forEach((document) => {
        batch.delete(document.ref);
        batchCount++;
        
        // Firestore batch limit is 500 operations
        if (batchCount === 450) {
          batches.push(batch);
          batch = writeBatch(db);
          batchCount = 0;
        }
      });
      
      // Add remaining operations
      if (batchCount > 0) {
        batches.push(batch);
      }
      
      // Execute all batches
      for (let i = 0; i < batches.length; i++) {
        await batches[i].commit();
        console.log(`Batch ${i + 1}/${batches.length} deleted for ${collectionName}`);
      }
      
      results.deleted.push(collectionName);
      results.totalDeleted += snapshot.size;
      console.log(`✅ Successfully deleted ${snapshot.size} documents from ${collectionName}`);
      
    } catch (error) {
      console.error(`❌ Error deleting collection ${collectionName}:`, error);
      results.errors.push({
        collection: collectionName,
        error: error.message
      });
    }
  }
  
  console.log(`🎉 Cleanup complete! Deleted ${results.totalDeleted} documents from ${results.deleted.length} collections`);
  return results;
};

/**
 * STEP 2: Create balanced image assignments for all login IDs
 */
const createBalancedImageAssignments = async () => {
  console.log('🎯 Creating balanced image assignments...');
  
  // Create pools for each set
  const set1Pool = [];
  const set2Pool = [];
  
  // Initialize image pools with assignment tracking
  for (let i = SYSTEM_CONFIG.set1Range.start; i <= SYSTEM_CONFIG.set1Range.end; i++) {
    set1Pool.push({
      id: `set1_${i}`,
      name: `${i}.png`,
      set: 'set1',
      path: `set1/${i}.png`,
      number: i,
      assignmentCount: 0
    });
  }
  
  for (let i = SYSTEM_CONFIG.set2Range.start; i <= SYSTEM_CONFIG.set2Range.end; i++) {
    set2Pool.push({
      id: `set2_${i}`,
      name: `${i}.png`, 
      set: 'set2',
      path: `set2/${i}.png`,
      number: i,
      assignmentCount: 0
    });
  }
  
  console.log(`Created pools: Set1=${set1Pool.length}, Set2=${set2Pool.length}`);
  
  // Function to select images with balanced assignment
  const selectImagesFromPool = (pool, count) => {
    const selected = [];
    const availableImages = [...pool]; // Copy to avoid modifying original
    
    for (let i = 0; i < count && availableImages.length > 0; i++) {
      // Sort by assignment count (ascending) then randomly
      availableImages.sort((a, b) => {
        if (a.assignmentCount !== b.assignmentCount) {
          return a.assignmentCount - b.assignmentCount;
        }
        return Math.random() - 0.5;
      });
      
      // Take the first (least assigned) image
      const selectedImage = availableImages.shift();
      selectedImage.assignmentCount++; // Increment count
      selected.push(selectedImage);
      
      // Update the count in the original pool
      const originalIndex = pool.findIndex(img => img.id === selectedImage.id);
      if (originalIndex !== -1) {
        pool[originalIndex].assignmentCount++;
      }
    }
    
    return selected;
  };
  
  // Create assignments for all login IDs
  const allAssignments = [];
  
  for (let loginNumber = 1; loginNumber <= SYSTEM_CONFIG.totalLoginIds; loginNumber++) {
    const loginId = loginNumber.toString().padStart(4, '0'); // 0001, 0002, etc.
    
    // Select 5 images from each set
    const set1Images = selectImagesFromPool(set1Pool, SYSTEM_CONFIG.imagesPerSet);
    const set2Images = selectImagesFromPool(set2Pool, SYSTEM_CONFIG.imagesPerSet);
    
    const assignedImages = [...set1Images, ...set2Images];
    
    allAssignments.push({
      loginId,
      assignedImages,
      assignmentBalance: {
        set1Count: set1Images.length,
        set2Count: set2Images.length,
        totalImages: assignedImages.length
      }
    });
    
    if (loginNumber % 100 === 0) {
      console.log(`Created assignments for ${loginNumber}/${SYSTEM_CONFIG.totalLoginIds} login IDs`);
    }
  }
  
  // Log assignment statistics
  const set1Stats = {
    min: Math.min(...set1Pool.map(img => img.assignmentCount)),
    max: Math.max(...set1Pool.map(img => img.assignmentCount)),
    avg: set1Pool.reduce((sum, img) => sum + img.assignmentCount, 0) / set1Pool.length
  };
  
  const set2Stats = {
    min: Math.min(...set2Pool.map(img => img.assignmentCount)),
    max: Math.max(...set2Pool.map(img => img.assignmentCount)),
    avg: set2Pool.reduce((sum, img) => sum + img.assignmentCount, 0) / set2Pool.length
  };
  
  console.log('Assignment balance:');
  console.log(`Set1 - Min: ${set1Stats.min}, Max: ${set1Stats.max}, Avg: ${set1Stats.avg.toFixed(2)}`);
  console.log(`Set2 - Min: ${set2Stats.min}, Max: ${set2Stats.max}, Avg: ${set2Stats.avg.toFixed(2)}`);
  
  return { allAssignments, set1Pool, set2Pool };
};

/**
 * STEP 3: Verify image URLs and create pre-assigned login documents
 */
export const createPreAssignedLogins = async (progressCallback = null) => {
  console.log('🔄 Starting pre-assigned login creation...');
  
  try {
    // Create balanced assignments
    const { allAssignments, set1Pool, set2Pool } = await createBalancedImageAssignments();
    
    console.log(`📝 Creating ${allAssignments.length} pre-assigned login documents...`);
    
    let successCount = 0;
    let errorCount = 0;
    const errors = [];
    
    // Process in batches to avoid Firebase limits
    const batchSize = 50;
    const totalBatches = Math.ceil(allAssignments.length / batchSize);
    
    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const batch = writeBatch(db);
      const startIndex = batchIndex * batchSize;
      const endIndex = Math.min(startIndex + batchSize, allAssignments.length);
      const batchAssignments = allAssignments.slice(startIndex, endIndex);
      
      console.log(`Processing batch ${batchIndex + 1}/${totalBatches} (${batchAssignments.length} login IDs)`);
      
      for (const assignment of batchAssignments) {
        try {
          // Get download URLs for assigned images
          const imagesWithUrls = await Promise.all(
            assignment.assignedImages.map(async (image) => {
              try {
                const imageRef = ref(storage, image.path);
                const downloadURL = await getDownloadURL(imageRef);
                
                return {
                  ...image,
                  url: downloadURL
                };
              } catch (urlError) {
                console.warn(`Could not get URL for ${image.path}:`, urlError.message);
                return {
                  ...image,
                  url: null,
                  urlError: urlError.message
                };
              }
            })
          );
          
          // Create login document
          const loginDoc = {
            loginId: assignment.loginId,
            assignedImages: imagesWithUrls,
            totalImages: imagesWithUrls.length,
            assignmentBalance: assignment.assignmentBalance,
            
            // Status tracking
            isAssigned: false,
            assignedTo: null,
            assignedAt: null,
            status: 'available',
            
            // Creation metadata
            createdAt: serverTimestamp(),
            systemVersion: '2.0_preassigned'
          };
          
          const loginRef = doc(db, 'preAssignedLogins', assignment.loginId);
          batch.set(loginRef, loginDoc);
          
          successCount++;
          
        } catch (error) {
          console.error(`Error creating login ${assignment.loginId}:`, error);
          errorCount++;
          errors.push({
            loginId: assignment.loginId,
            error: error.message
          });
        }
      }
      
      // Commit the batch
      await batch.commit();
      console.log(`✅ Batch ${batchIndex + 1} committed successfully`);
      
      // Update progress if callback provided
      if (progressCallback) {
        const progress = ((batchIndex + 1) / totalBatches) * 100;
        progressCallback(Math.round(progress));
      }
    }
    
    console.log(`🎉 Login creation complete! Success: ${successCount}, Errors: ${errorCount}`);
    
    // Create image assignment tracking documents
    await createImageAssignmentTracking(set1Pool, set2Pool);
    
    // Create system configuration document
    await createSystemConfig(successCount, errorCount);
    
    return {
      success: true,
      totalCreated: successCount,
      errors: errorCount,
      errorDetails: errors
    };
    
  } catch (error) {
    console.error('Error in createPreAssignedLogins:', error);
    throw error;
  }
};

/**
 * STEP 4: Create image assignment tracking documents
 */
const createImageAssignmentTracking = async (set1Pool, set2Pool) => {
  console.log('📊 Creating image assignment tracking...');
  
  // Create set1 tracking document
  const set1Assignments = {};
  const set1Stats = { totalImages: 0, totalAssignments: 0, imagesAtMax: 0 };
  
  set1Pool.forEach(image => {
    set1Assignments[image.name] = {
      assignedCount: image.assignmentCount,
      maxAssignments: SYSTEM_CONFIG.maxEvaluationsPerImage,
      available: image.assignmentCount < SYSTEM_CONFIG.maxEvaluationsPerImage
    };
    set1Stats.totalImages++;
    set1Stats.totalAssignments += image.assignmentCount;
    if (image.assignmentCount >= SYSTEM_CONFIG.maxEvaluationsPerImage) {
      set1Stats.imagesAtMax++;
    }
  });
  
  // Create set2 tracking document
  const set2Assignments = {};
  const set2Stats = { totalImages: 0, totalAssignments: 0, imagesAtMax: 0 };
  
  set2Pool.forEach(image => {
    set2Assignments[image.name] = {
      assignedCount: image.assignmentCount,
      maxAssignments: SYSTEM_CONFIG.maxEvaluationsPerImage,
      available: image.assignmentCount < SYSTEM_CONFIG.maxEvaluationsPerImage
    };
    set2Stats.totalImages++;
    set2Stats.totalAssignments += image.assignmentCount;
    if (image.assignmentCount >= SYSTEM_CONFIG.maxEvaluationsPerImage) {
      set2Stats.imagesAtMax++;
    }
  });
  
  // Save tracking documents
  await Promise.all([
    setDoc(doc(db, 'imageMetadata', 'set1'), {
      assignments: set1Assignments,
      setStats: {
        ...set1Stats,
        averageAssignmentsPerImage: set1Stats.totalAssignments / set1Stats.totalImages,
        lastUpdated: serverTimestamp()
      }
    }),
    setDoc(doc(db, 'imageMetadata', 'set2'), {
      assignments: set2Assignments,
      setStats: {
        ...set2Stats,
        averageAssignmentsPerImage: set2Stats.totalAssignments / set2Stats.totalImages,
        lastUpdated: serverTimestamp()
      }
    })
  ]);
  
  console.log('✅ Image assignment tracking created');
  console.log(`Set1: ${set1Stats.totalAssignments} total assignments, ${set1Stats.imagesAtMax} at max`);
  console.log(`Set2: ${set2Stats.totalAssignments} total assignments, ${set2Stats.imagesAtMax} at max`);
};

/**
 * STEP 5: Create system configuration document
 */
const createSystemConfig = async (successCount, errorCount) => {
  console.log('⚙️ Creating system configuration...');
  
  const systemConfig = {
    // System status
    systemInitialized: true,
    systemVersion: '2.0_preassigned',
    totalLoginIds: SYSTEM_CONFIG.totalLoginIds,
    maxParticipants: SYSTEM_CONFIG.totalLoginIds,
    imagesPerParticipant: SYSTEM_CONFIG.imagesPerParticipant,
    maxEvaluationsPerImage: SYSTEM_CONFIG.maxEvaluationsPerImage,
    
    // Study configuration
    studyActive: false, // Set to true when ready to launch
    studyStartDate: null,
    studyEndDate: null,
    
    // Assignment strategy
    assignmentStrategy: 'balanced_preassigned',
    lastAssignmentDate: serverTimestamp(),
    
    // Initialization results
    initializationResults: {
      successfulLogins: successCount,
      failedLogins: errorCount,
      initializationDate: serverTimestamp()
    },
    
    // Statistics cache (will be updated by admin dashboard)
    stats: {
      availableLoginIds: successCount,
      assignedLoginIds: 0,
      activeParticipants: 0,
      completedParticipants: 0,
      totalEvaluations: 0,
      lastUpdated: serverTimestamp()
    },
    
    // System metadata
    createdAt: serverTimestamp(),
    lastUpdated: serverTimestamp()
  };
  
  await setDoc(doc(db, 'systemConfig', 'main'), systemConfig);
  console.log('✅ System configuration created');
};

/**
 * MAIN MIGRATION FUNCTION
 */
export const runCompleteMigration = async (progressCallback = null) => {
  console.log('🚀 Starting complete Firestore migration...');
  
  try {
    const startTime = Date.now();
    
    // Step 1: Clear old data
    console.log('\n=== STEP 1: Clearing old data ===');
    if (progressCallback) progressCallback(5, 'Clearing old Firestore collections...');
    const clearResults = await clearOldFirestoreData();
    
    // Step 2: Create new pre-assigned system
    console.log('\n=== STEP 2: Creating pre-assigned login system ===');
    if (progressCallback) progressCallback(20, 'Creating pre-assigned login IDs...');
    
    const createResults = await createPreAssignedLogins((progress) => {
      if (progressCallback) {
        const overallProgress = 20 + (progress * 0.75); // 20-95%
        progressCallback(Math.round(overallProgress), `Creating login IDs... ${progress}%`);
      }
    });
    
    if (progressCallback) progressCallback(100, 'Migration complete!');
    
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    
    console.log('\n🎉 MIGRATION COMPLETE!');
    console.log(`Duration: ${duration} seconds`);
    console.log(`Old collections deleted: ${clearResults.deleted.length}`);
    console.log(`Documents deleted: ${clearResults.totalDeleted}`);
    console.log(`Login IDs created: ${createResults.totalCreated}`);
    console.log(`Creation errors: ${createResults.errors}`);
    
    return {
      success: true,
      duration,
      clearResults,
      createResults
    };
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    if (progressCallback) progressCallback(0, `Migration failed: ${error.message}`);
    throw error;
  }
};

/**
 * UTILITY: Verify storage access before migration
 */
export const verifyStorageAccess = async () => {
  console.log('🔍 Verifying Firebase Storage access...');
  
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
      results.push({ 
        path: imagePath, 
        status: 'success', 
        accessible: true 
      });
      console.log(`✅ ${imagePath} - accessible`);
    } catch (error) {
      results.push({ 
        path: imagePath, 
        status: 'error', 
        accessible: false, 
        error: error.message 
      });
      console.log(`❌ ${imagePath} - ${error.message}`);
    }
  }
  
  const accessible = results.filter(r => r.accessible).length;
  const total = results.length;
  
  console.log(`Storage verification: ${accessible}/${total} test images accessible`);
  
  return {
    allAccessible: accessible === total,
    accessibleCount: accessible,
    totalTested: total,
    results
  };
};

/**
 * UTILITY: Get current system status
 */
export const getCurrentSystemStatus = async () => {
  try {
    // Check if system is initialized
    const systemConfigRef = doc(db, 'systemConfig', 'main');
    const systemConfigDoc = await getDoc(systemConfigRef);
    
    if (!systemConfigDoc.exists()) {
      return { initialized: false, message: 'System not initialized' };
    }
    
    const systemConfig = systemConfigDoc.data();
    
    // Check pre-assigned logins
    const preAssignedRef = collection(db, 'preAssignedLogins');
    const preAssignedSnapshot = await getDocs(preAssignedRef);
    
    return {
      initialized: systemConfig.systemInitialized,
      systemVersion: systemConfig.systemVersion,
      totalLoginIds: preAssignedSnapshot.size,
      expectedLoginIds: systemConfig.totalLoginIds,
      systemConfig
    };
    
  } catch (error) {
    console.error('Error checking system status:', error);
    return { 
      initialized: false, 
      error: error.message 
    };
  }
};