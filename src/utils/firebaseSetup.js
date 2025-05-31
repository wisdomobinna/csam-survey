// src/utils/firebaseSetup.js - Updated for 2400 images in 2 sets
import { collection, doc, writeBatch, getDocs, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { assignImagesToUser as simpleAssignImagesToUser } from './simpleImageAssignment';

// Define the new folder structure with 2 sets
const IMAGE_SETS = {
  'set1': { start: 1, end: 1200, folder: 'set1', description: 'CC3M Filtered Images' },
  'set2': { start: 1201, end: 2400, folder: 'set2', description: 'CC3M Unfiltered Images' }
};

const TOTAL_IMAGES = 2400;
const IMAGES_PER_USER = 10; // Each participant sees 10 images
const VIEWS_PER_IMAGE = 5; // Each image seen 5 times
const TOTAL_USERS_NEEDED = Math.ceil((TOTAL_IMAGES * VIEWS_PER_IMAGE) / IMAGES_PER_USER);

export const initializeFirestore = async () => {
  try {
    // Check if already initialized
    const imagesSnapshot = await getDocs(collection(db, 'images'));
    const metadataRef = doc(db, 'systemMetadata', 'config');
    const metadataDoc = await getDoc(metadataRef);
    
    if (imagesSnapshot.size > 0 || metadataDoc.exists()) {
      console.log('Database already initialized');
      console.log(`Found ${imagesSnapshot.size} images in database`);
      return false;
    }

    console.log('Starting Firestore initialization...');
    console.log(`Creating ${TOTAL_IMAGES} images and preparing for ${TOTAL_USERS_NEEDED} users`);
    
    // Initialize in batches to avoid Firestore limits (500 operations per batch)
    let batch = writeBatch(db);
    let operationCount = 0;
    let totalImagesCreated = 0;
    
    // Create images for each set
    for (const [setKey, setInfo] of Object.entries(IMAGE_SETS)) {
      console.log(`Processing ${setKey}: images ${setInfo.start}-${setInfo.end}`);
      
      for (let i = setInfo.start; i <= setInfo.end; i++) {
        // Commit batch if approaching limit
        if (operationCount >= 400) {
          await batch.commit();
          console.log(`Committed batch, processed ${totalImagesCreated} images so far...`);
          batch = writeBatch(db);
          operationCount = 0;
        }
        
        const imageId = `${i}`;
        const docRef = doc(db, 'images', imageId);
        
        batch.set(docRef, {
          id: imageId,
          imageNumber: i,
          set: setInfo.folder, // 'set1' or 'set2'
          storagePath: `images/${setInfo.folder}/${i}.png`,
          category: setKey,
          viewCount: 0,
          assignedCount: 0,
          assignedUsers: [],
          createdAt: new Date(),
          fileExtension: '.png',
          isActive: true,
          description: setInfo.description
        });
        
        operationCount++;
        totalImagesCreated++;
      }
    }
    
    // Create system metadata
    if (operationCount >= 400) {
      await batch.commit();
      batch = writeBatch(db);
      operationCount = 0;
    }
    
    const metadataRef2 = doc(db, 'systemMetadata', 'config');
    batch.set(metadataRef2, {
      totalImages: TOTAL_IMAGES,
      imagesPerUser: IMAGES_PER_USER,
      viewsPerImage: VIEWS_PER_IMAGE,
      totalUsersNeeded: TOTAL_USERS_NEEDED,
      sets: IMAGE_SETS,
      lastUpdated: new Date(),
      initialized: true,
      version: '2.0',
      structure: '2_sets_2400_images'
    });
    
    operationCount++;
    
    // Commit final operations
    await batch.commit();
    
    console.log('Firestore initialization complete');
    console.log(`✅ Created ${totalImagesCreated} images across ${Object.keys(IMAGE_SETS).length} sets`);
    console.log(`✅ System ready for ${TOTAL_USERS_NEEDED} participants`);
    console.log(`✅ Each participant will see ${IMAGES_PER_USER} images`);
    console.log(`✅ Each image will be seen ${VIEWS_PER_IMAGE} times`);
    
    return true;
  } catch (error) {
    console.error('Error initializing system:', error);
    throw error;
  }
};

// Smart assignment algorithm for balanced distribution
export const assignImagesToUser = async (userId) => {
  try {
    console.log(`🎯 Assigning ${IMAGES_PER_USER} images to user: ${userId}`);
    
    // Get all images and sort by assignment count (least assigned first)
    const imagesRef = collection(db, 'images');
    const imagesSnapshot = await getDocs(imagesRef);
    
    if (imagesSnapshot.empty) {
      throw new Error('No images found in database. Please initialize the system first.');
    }
    
    // Collect all images with their assignment counts
    const allImages = [];
    imagesSnapshot.docs.forEach(doc => {
      const data = doc.data();
      allImages.push({
        id: doc.id,
        imageNumber: data.imageNumber,
        set: data.set,
        assignedCount: data.assignedCount || 0,
        assignedUsers: data.assignedUsers || []
      });
    });
    
    // Filter available images (not at max assignments and not assigned to this user)
    const availableImages = allImages.filter(img => 
      img.assignedCount < VIEWS_PER_IMAGE && 
      !img.assignedUsers.includes(userId)
    );
    
    if (availableImages.length < IMAGES_PER_USER) {
      throw new Error(`Not enough available images. Need ${IMAGES_PER_USER}, but only ${availableImages.length} available.`);
    }
    
    // Sort by assignment count (least assigned first), then by image number for consistency
    availableImages.sort((a, b) => {
      if (a.assignedCount !== b.assignedCount) {
        return a.assignedCount - b.assignedCount;
      }
      return a.imageNumber - b.imageNumber;
    });
    
    // Try to get balanced selection from both sets
    const set1Images = availableImages.filter(img => img.set === 'set1');
    const set2Images = availableImages.filter(img => img.set === 'set2');
    
    let selectedImages = [];
    
    // Aim for 5 from each set if possible, otherwise take what's available
    const targetPerSet = Math.floor(IMAGES_PER_USER / 2); // 5 each
    
    // Take from set1
    const set1Selection = set1Images.slice(0, Math.min(targetPerSet, set1Images.length));
    selectedImages.push(...set1Selection);
    
    // Take from set2
    const set2Selection = set2Images.slice(0, Math.min(targetPerSet, set2Images.length));
    selectedImages.push(...set2Selection);
    
    // If we don't have enough from balanced selection, fill from remaining
    if (selectedImages.length < IMAGES_PER_USER) {
      const remaining = availableImages.filter(img => 
        !selectedImages.some(selected => selected.id === img.id)
      );
      const needed = IMAGES_PER_USER - selectedImages.length;
      selectedImages.push(...remaining.slice(0, needed));
    }
    
    if (selectedImages.length < IMAGES_PER_USER) {
      throw new Error(`Could not assign enough images. Got ${selectedImages.length}, need ${IMAGES_PER_USER}`);
    }
    
    // Shuffle the selected images for random presentation order
    for (let i = selectedImages.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [selectedImages[i], selectedImages[j]] = [selectedImages[j], selectedImages[i]];
    }
    
    const assignedImageIds = selectedImages.slice(0, IMAGES_PER_USER).map(img => img.id);
    
    console.log(`✅ Selected ${assignedImageIds.length} images for assignment`);
    
    // Log distribution
    const set1Count = selectedImages.slice(0, IMAGES_PER_USER).filter(img => img.set === 'set1').length;
    const set2Count = selectedImages.slice(0, IMAGES_PER_USER).filter(img => img.set === 'set2').length;
    console.log(`📊 Distribution: Set1: ${set1Count}, Set2: ${set2Count}`);
    
    // Update database with assignments
    const batch = writeBatch(db);
    let operationCount = 0;
    
    // Update each assigned image
    for (const imageId of assignedImageIds) {
      const imageRef = doc(db, 'images', imageId);
      const currentImage = selectedImages.find(img => img.id === imageId);
      
      batch.update(imageRef, {
        assignedCount: (currentImage.assignedCount || 0) + 1,
        assignedUsers: [...(currentImage.assignedUsers || []), userId],
        lastAssignedAt: new Date()
      });
      operationCount++;
    }
    
    // Create user progress document
    const userProgressRef = doc(db, 'userProgress', userId);
    batch.set(userProgressRef, {
      assignedImages: assignedImageIds,
      completedImages: 0,
      surveyCompleted: false,
      assignedAt: new Date(),
      lastUpdated: new Date(),
      imageDistribution: {
        set1: set1Count,
        set2: set2Count,
        total: assignedImageIds.length
      }
    });
    operationCount++;
    
    // Commit all updates
    await batch.commit();
    
    console.log(`🎉 Successfully assigned images to ${userId}:`, assignedImageIds);
    
    return assignedImageIds;
    
  } catch (error) {
    console.error('❌ Error assigning images to user:', error);
    throw error;
  }
};

export const checkInitializationStatus = async () => {
  try {
    const imagesRef = collection(db, 'images');
    const metadataRef = doc(db, 'systemMetadata', 'config');
    
    const imagesSnapshot = await getDocs(imagesRef);
    const metadataDoc = await getDoc(metadataRef);
    
    // Calculate set distribution
    let setCounts = {};
    if (imagesSnapshot.size > 0) {
      imagesSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const set = data.set || 'unknown';
        setCounts[set] = (setCounts[set] || 0) + 1;
      });
    }
    
    // Calculate assignment statistics
    let totalAssignments = 0;
    let averageAssignments = 0;
    if (imagesSnapshot.size > 0) {
      const assignmentCounts = imagesSnapshot.docs.map(doc => doc.data().assignedCount || 0);
      totalAssignments = assignmentCounts.reduce((sum, count) => sum + count, 0);
      averageAssignments = totalAssignments / imagesSnapshot.size;
    }
    
    return {
      initialized: imagesSnapshot.size > 0 && metadataDoc.exists(),
      imageCount: imagesSnapshot.size,
      expectedImages: TOTAL_IMAGES,
      setCounts: setCounts,
      metadata: metadataDoc.exists() ? metadataDoc.data() : null,
      assignmentStats: {
        totalAssignments,
        averageAssignments: Math.round(averageAssignments * 100) / 100,
        maxPossibleAssignments: TOTAL_IMAGES * VIEWS_PER_IMAGE,
        utilizationPercentage: Math.round((totalAssignments / (TOTAL_IMAGES * VIEWS_PER_IMAGE)) * 100)
      }
    };
  } catch (error) {
    console.error('Error checking initialization:', error);
    return {
      initialized: false,
      error: error.message
    };
  }
};

export const verifySetup = async () => {
  try {
    const status = await checkInitializationStatus();
    
    if (!status.initialized) {
      return { success: false, message: 'System not initialized' };
    }
    
    // Verify set distribution
    const expectedSets = Object.keys(IMAGE_SETS);
    const actualSets = Object.keys(status.setCounts);
    
    const missingSets = expectedSets.filter(set => !actualSets.includes(set));
    
    if (missingSets.length > 0) {
      return { 
        success: false, 
        message: `Missing sets: ${missingSets.join(', ')}` 
      };
    }
    
    // Check if set counts are correct
    let setVerification = {};
    let allSetsCorrect = true;
    
    for (const [setKey, setInfo] of Object.entries(IMAGE_SETS)) {
      const expectedCount = setInfo.end - setInfo.start + 1;
      const actualCount = status.setCounts[setInfo.folder] || 0;
      const isCorrect = expectedCount === actualCount;
      
      setVerification[setKey] = {
        expected: expectedCount,
        actual: actualCount,
        correct: isCorrect,
        range: `${setInfo.start}-${setInfo.end}`
      };
      
      if (!isCorrect) {
        allSetsCorrect = false;
      }
    }
    
    // Test assignment system
    let assignmentTest = { success: true, message: 'Assignment system operational' };
    try {
      // Verify we can find assignable images
      for (const [setKey, setInfo] of Object.entries(IMAGE_SETS)) {
        const sampleImageId = `${setInfo.start}`;
        const imageRef = doc(db, 'images', sampleImageId);
        const imageDoc = await getDoc(imageRef);
        
        if (!imageDoc.exists()) {
          throw new Error(`Sample image ${sampleImageId} not found in ${setKey}`);
        }
      }
    } catch (assignmentError) {
      assignmentTest = { success: false, error: assignmentError.message };
    }
    
    return {
      success: allSetsCorrect && assignmentTest.success,
      status: status,
      setVerification: setVerification,
      assignmentTest: assignmentTest,
      systemReady: allSetsCorrect && assignmentTest.success,
      summary: {
        totalImages: status.imageCount,
        expectedImages: TOTAL_IMAGES,
        setsCorrect: allSetsCorrect,
        assignmentSystemWorking: assignmentTest.success,
        capacityInfo: {
          maxParticipants: TOTAL_USERS_NEEDED,
          imagesPerParticipant: IMAGES_PER_USER,
          viewsPerImage: VIEWS_PER_IMAGE
        }
      }
    };
  } catch (error) {
    console.error('Error verifying setup:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

export const clearAllData = async () => {
  console.log('🧹 Starting complete data clearance...');
  let batch = writeBatch(db);
  let operationCount = 0;
  let totalDeleted = 0;
  
  try {
    // Collections to clear
    const collections = [
      'images', 
      'loginIDs', 
      'userProgress', 
      'systemMetadata', 
      'completedAssessments',
      'imageCompletions',
      'assessmentTracking',
      'prolificBlacklist'
    ];
    
    for (const collectionName of collections) {
      console.log(`📁 Clearing collection: ${collectionName}`);
      const snapshot = await getDocs(collection(db, collectionName));
      console.log(`   Found ${snapshot.size} documents`);
      
      for (const doc of snapshot.docs) {
        if (operationCount >= 400) {
          await batch.commit();
          console.log(`   Committed batch, deleted ${totalDeleted} documents so far...`);
          batch = writeBatch(db);
          operationCount = 0;
        }
        
        batch.delete(doc.ref);
        operationCount++;
        totalDeleted++;
      }
    }
    
    // Commit any remaining operations
    if (operationCount > 0) {
      await batch.commit();
    }
    
    console.log(`✅ Successfully cleared all data - ${totalDeleted} documents deleted`);
    console.log('🎯 System ready for fresh initialization');
    
    return true;
  } catch (error) {
    console.error('❌ Error clearing data:', error);
    throw error;
  }
};

// Utility function to get system statistics
export const getSystemStats = async () => {
  try {
    const status = await checkInitializationStatus();
    
    // Get user statistics
    const usersSnapshot = await getDocs(collection(db, 'loginIDs'));
    const userCount = usersSnapshot.size;
    
    let completedUsers = 0;
    let prolificUsers = 0;
    
    usersSnapshot.docs.forEach(doc => {
      if (doc.id === 'ADMIN') return;
      
      const userData = doc.data();
      if (userData.surveyCompleted) completedUsers++;
      if (userData.prolificData?.prolificPid) prolificUsers++;
    });
    
    return {
      images: {
        total: status.imageCount,
        expected: TOTAL_IMAGES,
        bySets: status.setCounts,
        assignments: status.assignmentStats
      },
      users: {
        total: userCount,
        completed: completedUsers,
        prolific: prolificUsers,
        completionRate: userCount > 0 ? Math.round((completedUsers / userCount) * 100) : 0
      },
      system: {
        initialized: status.initialized,
        capacity: {
          maxUsers: TOTAL_USERS_NEEDED,
          currentUtilization: Math.round((userCount / TOTAL_USERS_NEEDED) * 100),
          remainingCapacity: TOTAL_USERS_NEEDED - userCount
        }
      }
    };
  } catch (error) {
    console.error('Error getting system stats:', error);
    throw error;
  }
};

// Export system constants for use in other files
export const SYSTEM_CONFIG = {
  TOTAL_IMAGES,
  IMAGES_PER_USER,
  VIEWS_PER_IMAGE,
  TOTAL_USERS_NEEDED,
  IMAGE_SETS
};