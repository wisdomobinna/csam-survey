// src/utils/concurrentSafeAssignment.js - Concurrency-Safe Enhanced Assignment System
import { 
  doc, 
  runTransaction, 
  collection, 
  getDocs, 
  query, 
  where,
  writeBatch,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../firebase/config';

// Configuration
const MAX_ASSIGNMENTS_PER_IMAGE = 5;
const IMAGES_PER_SET = 5;
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 500;

/**
 * CONCURRENCY-SAFE: Get balanced image assignment with proper locking
 * Uses Firebase transactions to prevent race conditions
 */
export const getConcurrentSafeImageAssignment = async (userId, totalImages = 10) => {
  let attempts = 0;
  
  while (attempts < MAX_RETRY_ATTEMPTS) {
    try {
      attempts++;
      console.log(`🔄 Assignment attempt ${attempts} for user ${userId}`);
      
      const result = await runTransaction(db, async (transaction) => {
        // 1. Get current assignment counts atomically
        const assignmentCountsRef = doc(db, 'systemData', 'assignmentCounts');
        const countsDoc = await transaction.get(assignmentCountsRef);
        
        let assignmentCounts = {};
        if (countsDoc.exists()) {
          assignmentCounts = countsDoc.data();
        } else {
          // Initialize if doesn't exist
          assignmentCounts = initializeAssignmentCounts();
          transaction.set(assignmentCountsRef, assignmentCounts);
        }
        
        // 2. Calculate available images for each set
        const set1Available = getAvailableImagesFromSet(assignmentCounts, 'set1');
        const set2Available = getAvailableImagesFromSet(assignmentCounts, 'set2');
        
        // 3. Check capacity constraints
        if (set1Available.length < IMAGES_PER_SET || set2Available.length < IMAGES_PER_SET) {
          throw new Error(`Insufficient images available. Set1: ${set1Available.length}/${IMAGES_PER_SET}, Set2: ${set2Available.length}/${IMAGES_PER_SET}`);
        }
        
        // 4. Select images (prioritize least assigned)
        const selectedSet1 = selectLeastAssignedImages(set1Available, assignmentCounts, IMAGES_PER_SET);
        const selectedSet2 = selectLeastAssignedImages(set2Available, assignmentCounts, IMAGES_PER_SET);
        
        // 5. Update assignment counts atomically
        const updatedCounts = { ...assignmentCounts };
        
        [...selectedSet1, ...selectedSet2].forEach(imageId => {
          if (!updatedCounts[imageId]) {
            updatedCounts[imageId] = 0;
          }
          updatedCounts[imageId] += 1;
          
          // Safety check - should never happen but prevents corruption
          if (updatedCounts[imageId] > MAX_ASSIGNMENTS_PER_IMAGE) {
            throw new Error(`Image ${imageId} would exceed assignment limit`);
          }
        });
        
        // 6. Write updated counts back atomically
        transaction.update(assignmentCountsRef, updatedCounts);
        
        // 7. Create final assignment array with mixed order
        const finalAssignment = createMixedAssignmentArray(selectedSet1, selectedSet2);
        
        // 8. Log assignment for tracking
        const assignmentLogRef = doc(collection(db, 'assignmentLogs'));
        transaction.set(assignmentLogRef, {
          userId,
          assignedImages: finalAssignment.map(img => img.id),
          timestamp: serverTimestamp(),
          set1Count: selectedSet1.length,
          set2Count: selectedSet2.length,
          attemptNumber: attempts,
          assignmentMethod: 'concurrent_safe_transaction'
        });
        
        console.log(`✅ Successfully assigned ${finalAssignment.length} images to ${userId}`);
        console.log(`📊 Set1: ${selectedSet1.length}, Set2: ${selectedSet2.length}`);
        console.log(`🔀 Mixed order: ${finalAssignment.map(img => img.set).join(' → ')}`);
        
        return finalAssignment;
      });
      
      return result;
      
    } catch (error) {
      console.warn(`⚠️ Assignment attempt ${attempts} failed:`, error.message);
      
      if (attempts >= MAX_RETRY_ATTEMPTS) {
        console.error(`❌ All ${MAX_RETRY_ATTEMPTS} assignment attempts failed for ${userId}`);
        throw new Error(`Assignment failed after ${MAX_RETRY_ATTEMPTS} attempts: ${error.message}`);
      }
      
      // Wait before retry with exponential backoff
      const delay = RETRY_DELAY_MS * Math.pow(2, attempts - 1);
      console.log(`⏳ Waiting ${delay}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

/**
 * Initialize assignment counts for all images
 */
function initializeAssignmentCounts() {
  const counts = {};
  
  // Set 1: images 1-1200 (stored as set1/1.png to set1/1200.png)
  for (let i = 1; i <= 1200; i++) {
    counts[`set1_${i}`] = 0;
  }
  
  // Set 2: images 1201-2400 (stored as set2/1201.png to set2/2400.png)
  for (let i = 1201; i <= 2400; i++) {
    counts[`set2_${i}`] = 0;
  }
  
  console.log('🔧 Initialized assignment counts for 2400 images');
  return counts;
}

/**
 * Get available images from a specific set (under assignment limit)
 */
function getAvailableImagesFromSet(assignmentCounts, setName) {
  const available = [];
  const setPrefix = setName;
  const startNum = setName === 'set1' ? 1 : 1201;
  const endNum = setName === 'set1' ? 1200 : 2400;
  
  for (let i = startNum; i <= endNum; i++) {
    const imageId = `${setPrefix}_${i}`;
    const assignmentCount = assignmentCounts[imageId] || 0;
    
    if (assignmentCount < MAX_ASSIGNMENTS_PER_IMAGE) {
      available.push({
        id: imageId,
        assignmentCount,
        set: setName,
        imageNumber: i,
        path: `${setName}/${i}.png`
      });
    }
  }
  
  return available;
}

/**
 * Select least assigned images from available pool
 */
function selectLeastAssignedImages(availableImages, assignmentCounts, count) {
  // Sort by assignment count (least assigned first), then by random
  const sorted = availableImages
    .sort((a, b) => {
      const countA = assignmentCounts[a.id] || 0;
      const countB = assignmentCounts[b.id] || 0;
      
      if (countA !== countB) {
        return countA - countB; // Least assigned first
      }
      
      return Math.random() - 0.5; // Random tiebreaker
    });
  
  return sorted.slice(0, count).map(img => img.id);
}

/**
 * Create mixed assignment array from both sets
 */
function createMixedAssignmentArray(set1Images, set2Images) {
  const allImages = [
    ...set1Images.map(id => {
      const imageNum = id.split('_')[1];
      return {
        id,
        set: 'set1',
        name: id,
        path: `set1/${imageNum}.png`
      };
    }),
    ...set2Images.map(id => {
      const imageNum = id.split('_')[1];
      return {
        id,
        set: 'set2', 
        name: id,
        path: `set2/${imageNum}.png`
      };
    })
  ];
  
  // Shuffle for mixed presentation order
  for (let i = allImages.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allImages[i], allImages[j]] = [allImages[j], allImages[i]];
  }
  
  return allImages;
}

/**
 * CONCURRENCY-SAFE: Check system capacity
 */
export const checkConcurrentSafeCapacity = async () => {
  try {
    const result = await runTransaction(db, async (transaction) => {
      const assignmentCountsRef = doc(db, 'systemData', 'assignmentCounts');
      const countsDoc = await transaction.get(assignmentCountsRef);
      
      if (!countsDoc.exists()) {
        return {
          canAssign: true,
          estimatedCapacity: 1200, // Full capacity
          message: 'System ready - no assignments yet'
        };
      }
      
      const assignmentCounts = countsDoc.data();
      
      // Calculate available images for each set
      const set1Available = getAvailableImagesFromSet(assignmentCounts, 'set1');
      const set2Available = getAvailableImagesFromSet(assignmentCounts, 'set2');
      
      const canAssignSet1 = set1Available.length >= IMAGES_PER_SET;
      const canAssignSet2 = set2Available.length >= IMAGES_PER_SET;
      
      if (canAssignSet1 && canAssignSet2) {
        const estimatedCapacity = Math.min(
          Math.floor(set1Available.length / IMAGES_PER_SET),
          Math.floor(set2Available.length / IMAGES_PER_SET)
        );
        
        return {
          canAssign: true,
          estimatedCapacity,
          set1Available: set1Available.length,
          set2Available: set2Available.length,
          message: `Can accommodate approximately ${estimatedCapacity} more users`
        };
      } else {
        return {
          canAssign: false,
          reason: `Insufficient images. Set1: ${set1Available.length}/${IMAGES_PER_SET}, Set2: ${set2Available.length}/${IMAGES_PER_SET}`,
          set1Available: set1Available.length,
          set2Available: set2Available.length
        };
      }
    });
    
    return result;
  } catch (error) {
    console.error('Error checking concurrent-safe capacity:', error);
    return { canAssign: false, reason: 'Error checking capacity' };
  }
};

/**
 * CONCURRENCY-SAFE: Get assignment statistics
 */
export const getConcurrentSafeAssignmentStats = async () => {
  try {
    const assignmentCountsRef = doc(db, 'systemData', 'assignmentCounts');
    const countsDoc = await getDocs(query(collection(db, 'systemData'), where('__name__', '==', 'assignmentCounts')));
    
    if (countsDoc.empty) {
      return {
        set1: { available: 1200, fullyAssigned: 0, nearLimit: 0 },
        set2: { available: 1200, fullyAssigned: 0, nearLimit: 0 },
        totalCapacity: 1200
      };
    }
    
    const assignmentCounts = countsDoc.docs[0].data();
    
    // Analyze Set 1
    const set1Stats = analyzeSetStats(assignmentCounts, 'set1', 1, 1200);
    const set2Stats = analyzeSetStats(assignmentCounts, 'set2', 1201, 2400);
    
    return {
      set1: set1Stats,
      set2: set2Stats,
      totalCapacity: Math.min(
        Math.floor(set1Stats.available / IMAGES_PER_SET),
        Math.floor(set2Stats.available / IMAGES_PER_SET)
      )
    };
  } catch (error) {
    console.error('Error getting concurrent-safe assignment stats:', error);
    throw error;
  }
};

function analyzeSetStats(assignmentCounts, setName, startNum, endNum) {
  let available = 0;
  let fullyAssigned = 0;
  let nearLimit = 0;
  const breakdown = {};
  
  for (let i = startNum; i <= endNum; i++) {
    const imageId = `${setName}_${i}`;
    const count = assignmentCounts[imageId] || 0;
    
    breakdown[count] = (breakdown[count] || 0) + 1;
    
    if (count >= MAX_ASSIGNMENTS_PER_IMAGE) {
      fullyAssigned++;
    } else {
      available++;
      if (count >= 4) {
        nearLimit++;
      }
    }
  }
  
  return {
    available,
    fullyAssigned,
    nearLimit,
    ...breakdown
  };
}

/**
 * CONCURRENCY-SAFE: Reset assignment counts (admin function)
 */
export const resetConcurrentSafeAssignmentCounts = async () => {
  try {
    await runTransaction(db, async (transaction) => {
      const assignmentCountsRef = doc(db, 'systemData', 'assignmentCounts');
      const newCounts = initializeAssignmentCounts();
      
      transaction.set(assignmentCountsRef, {
        ...newCounts,
        lastReset: serverTimestamp(),
        resetBy: 'admin'
      });
    });
    
    console.log('✅ Assignment counts reset successfully with concurrency safety');
  } catch (error) {
    console.error('❌ Error resetting assignment counts:', error);
    throw error;
  }
};

/**
 * CONCURRENCY-SAFE: Emergency capacity check (lightweight)
 */
export const quickCapacityCheck = async () => {
  try {
    // Quick check without full statistics
    const assignmentCountsRef = doc(db, 'systemData', 'assignmentCounts');
    const countsDoc = await getDocs(query(collection(db, 'systemData'), where('__name__', '==', 'assignmentCounts')));
    
    if (countsDoc.empty) {
      return { canAssign: true, estimatedCapacity: 1200 };
    }
    
    // Quick sample check - check first 100 images from each set
    const assignmentCounts = countsDoc.docs[0].data();
    let set1Available = 0;
    let set2Available = 0;
    
    // Sample Set 1 (first 100 images)
    for (let i = 1; i <= 100; i++) {
      const count = assignmentCounts[`set1_${i}`] || 0;
      if (count < MAX_ASSIGNMENTS_PER_IMAGE) set1Available++;
    }
    
    // Sample Set 2 (first 100 images)  
    for (let i = 1201; i <= 1300; i++) {
      const count = assignmentCounts[`set2_${i}`] || 0;
      if (count < MAX_ASSIGNMENTS_PER_IMAGE) set2Available++;
    }
    
    // Extrapolate
    const set1EstimatedAvailable = (set1Available / 100) * 1200;
    const set2EstimatedAvailable = (set2Available / 100) * 1200;
    
    const canAssign = set1EstimatedAvailable >= IMAGES_PER_SET && set2EstimatedAvailable >= IMAGES_PER_SET;
    const estimatedCapacity = Math.min(
      Math.floor(set1EstimatedAvailable / IMAGES_PER_SET),
      Math.floor(set2EstimatedAvailable / IMAGES_PER_SET)
    );
    
    return { canAssign, estimatedCapacity };
  } catch (error) {
    console.error('Error in quick capacity check:', error);
    return { canAssign: false, estimatedCapacity: 0 };
  }
};