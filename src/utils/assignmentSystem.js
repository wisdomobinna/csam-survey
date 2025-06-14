// src/utils/balancedImageAssignment.js - Enhanced with 4-5 assignment limit
import { doc, getDoc, setDoc, updateDoc, increment, writeBatch, serverTimestamp } from 'firebase/firestore';
import { ref, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase/config';

/**
 * Enhanced Balanced Image Assignment System
 * - Ensures each image is assigned maximum 4-5 times
 * - Balances assignment across both sets (5 from each set)
 * - Tracks assignment counts in Firebase
 * - Prioritizes least-assigned images
 * - Mixed assignment ensuring diversity
 */

// Initialize or get assignment tracking document
const initializeAssignmentTracking = async () => {
  try {
    const trackingRef = doc(db, 'system', 'imageAssignments');
    const trackingDoc = await getDoc(trackingRef);
    
    if (!trackingDoc.exists()) {
      console.log('Creating initial assignment tracking document...');
      
      // Create initial tracking structure
      const initialTracking = {
        set1: {}, // Will store image_id: assignment_count
        set2: {},
        totalAssignments: 0,
        lastUpdated: serverTimestamp(),
        maxAssignmentsPerImage: 5, // Maximum 5 assignments per image
        imagesPerUser: 10, // 5 from each set
        imagesPerSet: 5
      };
      
      // Initialize all images with 0 assignments
      for (let i = 1; i <= 1200; i++) {
        initialTracking.set1[`set1_${i}`] = 0;
      }
      
      for (let i = 1201; i <= 2400; i++) {
        initialTracking.set2[`set2_${i}`] = 0;
      }
      
      await setDoc(trackingRef, initialTracking);
      console.log('✓ Assignment tracking initialized with 5-assignment limit');
      
      return initialTracking;
    } else {
      return trackingDoc.data();
    }
  } catch (error) {
    console.error('Error initializing assignment tracking:', error);
    throw error;
  }
};

// Get available images that haven't reached the 5-assignment limit
const getAvailableImagesForBalancedAssignment = async () => {
  try {
    console.log('Getting available images with 5-assignment limit...');
    
    // Get current assignment tracking
    const tracking = await initializeAssignmentTracking();
    const maxAssignments = tracking.maxAssignmentsPerImage || 5;
    
    // Test storage availability (verify images exist)
    const testImages = [
      { path: 'set1/1.png', set: 'set1' },
      { path: 'set1/100.png', set: 'set1' },
      { path: 'set2/1201.png', set: 'set2' },
      { path: 'set2/1300.png', set: 'set2' }
    ];
    
    let set1Exists = false;
    let set2Exists = false;
    
    for (const testImg of testImages) {
      try {
        const imageRef = ref(storage, testImg.path);
        await getDownloadURL(imageRef);
        if (testImg.set === 'set1') set1Exists = true;
        else set2Exists = true;
      } catch (error) {
        console.warn(`Test image ${testImg.path} not found`);
      }
    }
    
    if (!set1Exists && !set2Exists) {
      throw new Error('No image sets found in Firebase Storage. Please upload images first.');
    }
    
    // Get available images from each set (under assignment limit)
    const availableSet1 = [];
    const availableSet2 = [];
    
    if (set1Exists) {
      console.log('Checking set1 availability...');
      for (let i = 1; i <= 1200; i++) {
        const imageId = `set1_${i}`;
        const assignmentCount = tracking.set1[imageId] || 0;
        
        if (assignmentCount < maxAssignments) {
          availableSet1.push({
            id: imageId,
            name: `${i}.png`,
            set: 'set1',
            path: `set1/${i}.png`,
            storageRef: `set1/${i}.png`,
            assignmentCount,
            priority: maxAssignments - assignmentCount // Higher priority for less-assigned images
          });
        }
      }
    }
    
    if (set2Exists) {
      console.log('Checking set2 availability...');
      for (let i = 1201; i <= 2400; i++) {
        const imageId = `set2_${i}`;
        const assignmentCount = tracking.set2[imageId] || 0;
        
        if (assignmentCount < maxAssignments) {
          availableSet2.push({
            id: imageId,
            name: `${i}.png`,
            set: 'set2',
            path: `set2/${i}.png`,
            storageRef: `set2/${i}.png`,
            assignmentCount,
            priority: maxAssignments - assignmentCount
          });
        }
      }
    }
    
    console.log(`✓ Available images: Set1=${availableSet1.length}, Set2=${availableSet2.length}`);
    console.log(`✓ Assignment limit: ${maxAssignments} per image`);
    
    return {
      set1: availableSet1,
      set2: availableSet2,
      tracking,
      maxAssignments
    };
    
  } catch (error) {
    console.error('Error getting available images:', error);
    throw error;
  }
};

// Mixed balanced assignment algorithm - prioritizes least-assigned images
const assignImagesBalanced = async (imagesPerUser = 10) => {
  try {
    console.log(`Starting mixed balanced assignment for ${imagesPerUser} images...`);
    
    const { set1, set2, tracking, maxAssignments } = await getAvailableImagesForBalancedAssignment();
    const imagesPerSet = Math.floor(imagesPerUser / 2); // 5 from each set
    
    // Check if we have enough available images
    if (set1.length < imagesPerSet || set2.length < imagesPerSet) {
      throw new Error(
        `Not enough images available. Need ${imagesPerSet} from each set, but have Set1: ${set1.length}, Set2: ${set2.length}. ` +
        `Some images may have reached the ${maxAssignments}-assignment limit.`
      );
    }
    
    const assignedImages = [];
    
    // Sort images by priority (least assigned first) then randomly within same priority
    const sortByPriorityThenRandom = (images) => {
      return images.sort((a, b) => {
        if (b.priority === a.priority) {
          return Math.random() - 0.5; // Random within same priority
        }
        return b.priority - a.priority; // Higher priority first (fewer assignments)
      });
    };
    
    const sortedSet1 = sortByPriorityThenRandom([...set1]);
    const sortedSet2 = sortByPriorityThenRandom([...set2]);
    
    // Assign from set1 (prioritizing least-assigned)
    for (let i = 0; i < imagesPerSet; i++) {
      assignedImages.push(sortedSet1[i]);
    }
    
    // Assign from set2 (prioritizing least-assigned)
    for (let i = 0; i < imagesPerSet; i++) {
      assignedImages.push(sortedSet2[i]);
    }
    
    // Final shuffle to randomize order for presentation (mixed assignment)
    const shuffledAssigned = assignedImages.sort(() => Math.random() - 0.5);
    
    console.log(`✓ Mixed balanced assignment complete:`);
    console.log(`  - Total assigned: ${shuffledAssigned.length}`);
    console.log(`  - From Set1: ${shuffledAssigned.filter(img => img.set === 'set1').length}`);
    console.log(`  - From Set2: ${shuffledAssigned.filter(img => img.set === 'set2').length}`);
    console.log(`  - Assignment counts: ${shuffledAssigned.map(img => img.assignmentCount).join(', ')}`);
    console.log(`  - Mixed order: ${shuffledAssigned.map(img => img.set).join(', ')}`);
    
    return shuffledAssigned;
    
  } catch (error) {
    console.error('Error in mixed balanced assignment:', error);
    throw error;
  }
};

// Update assignment counts in Firebase after successful assignment
const updateAssignmentCounts = async (assignedImages, userId) => {
  try {
    console.log(`Updating assignment counts for ${assignedImages.length} images...`);
    
    const batch = writeBatch(db);
    const trackingRef = doc(db, 'system', 'imageAssignments');
    
    // Update each image's assignment count
    const updates = {
      totalAssignments: increment(assignedImages.length),
      lastUpdated: serverTimestamp(),
      lastAssignedTo: userId,
      lastAssignmentTimestamp: serverTimestamp()
    };
    
    // Increment count for each assigned image
    assignedImages.forEach(image => {
      const setField = `${image.set}.${image.id}`;
      updates[setField] = increment(1);
    });
    
    batch.update(trackingRef, updates);
    
    // Also log the assignment for tracking
    const assignmentLogRef = doc(db, 'assignmentLogs', `${userId}_${Date.now()}`);
    batch.set(assignmentLogRef, {
      userId,
      assignedImages: assignedImages.map(img => ({
        id: img.id,
        set: img.set,
        previousCount: img.assignmentCount,
        newCount: img.assignmentCount + 1
      })),
      assignmentTimestamp: serverTimestamp(),
      totalImagesAssigned: assignedImages.length,
      assignmentType: 'mixed_balanced_5_limit'
    });
    
    await batch.commit();
    
    console.log('✓ Assignment counts updated successfully');
    
    // Log if any images are approaching the limit
    assignedImages.forEach(img => {
      const newCount = img.assignmentCount + 1;
      if (newCount >= 4) {
        console.log(`⚠️ Image ${img.id} now assigned ${newCount}/5 times`);
      }
    });
    
  } catch (error) {
    console.error('Error updating assignment counts:', error);
    throw error;
  }
};

// Main function: Get mixed balanced assignment and update counts
export const getBalancedImageAssignment = async (userId, imagesPerUser = 10) => {
  try {
    console.log(`=== Starting Mixed Balanced Image Assignment for ${userId} ===`);
    console.log(`Target: ${imagesPerUser} images (${imagesPerUser/2} from each set, mixed order)`);
    
    // Get mixed balanced assignment (5 from each set, least-assigned first)
    const assignedImages = await assignImagesBalanced(imagesPerUser);
    
    // Update assignment counts
    await updateAssignmentCounts(assignedImages, userId);
    
    console.log(`=== Assignment Complete for ${userId} ===`);
    console.log(`✓ Assigned ${assignedImages.length} images with mixed balanced distribution`);
    console.log(`✓ Assignment order: ${assignedImages.map(img => img.set).join(' → ')}`);
    
    return assignedImages;
    
  } catch (error) {
    console.error('Error in balanced image assignment:', error);
    throw error;
  }
};

// Get assignment statistics for admin dashboard
export const getAssignmentStatistics = async () => {
  try {
    const trackingRef = doc(db, 'system', 'imageAssignments');
    const trackingDoc = await getDoc(trackingRef);
    
    if (!trackingDoc.exists()) {
      return null;
    }
    
    const data = trackingDoc.data();
    const maxAssignments = data.maxAssignmentsPerImage || 5;
    
    // Calculate statistics for each set
    const calculateSetStats = (setData) => {
      const counts = Object.values(setData || {});
      const stats = {};
      
      for (let i = 0; i <= maxAssignments; i++) {
        stats[i] = counts.filter(count => count === i).length;
      }
      
      stats.total = counts.length;
      stats.fullyAssigned = counts.filter(count => count >= maxAssignments).length;
      stats.available = counts.filter(count => count < maxAssignments).length;
      stats.nearLimit = counts.filter(count => count >= maxAssignments - 1).length; // 4+ assignments
      
      return stats;
    };
    
    return {
      set1: calculateSetStats(data.set1),
      set2: calculateSetStats(data.set2),
      totalAssignments: data.totalAssignments || 0,
      lastUpdated: data.lastUpdated,
      maxAssignmentsPerImage: maxAssignments,
      imagesPerUser: data.imagesPerUser || 10,
      imagesPerSet: data.imagesPerSet || 5
    };
    
  } catch (error) {
    console.error('Error getting assignment statistics:', error);
    return null;
  }
};

// Check if system can accommodate more users
export const checkAssignmentCapacity = async () => {
  try {
    const stats = await getAssignmentStatistics();
    if (!stats) return { canAssign: false, reason: 'No assignment data found' };
    
    const set1Available = stats.set1.available || 0;
    const set2Available = stats.set2.available || 0;
    const imagesPerSet = stats.imagesPerSet || 5;
    
    const canAssignSet1 = set1Available >= imagesPerSet;
    const canAssignSet2 = set2Available >= imagesPerSet;
    
    if (canAssignSet1 && canAssignSet2) {
      // Estimate how many more users can be assigned
      const maxUsersSet1 = Math.floor(set1Available / imagesPerSet);
      const maxUsersSet2 = Math.floor(set2Available / imagesPerSet);
      const estimatedCapacity = Math.min(maxUsersSet1, maxUsersSet2);
      
      return {
        canAssign: true,
        estimatedCapacity,
        set1Available,
        set2Available,
        message: `Can assign approximately ${estimatedCapacity} more users`
      };
    } else {
      return {
        canAssign: false,
        reason: `Insufficient images available. Set1: ${set1Available}/${imagesPerSet}, Set2: ${set2Available}/${imagesPerSet}`,
        set1Available,
        set2Available
      };
    }
  } catch (error) {
    console.error('Error checking assignment capacity:', error);
    return { canAssign: false, reason: 'Error checking capacity' };
  }
};

// Reset assignment counts (admin function)
export const resetAssignmentCounts = async () => {
  try {
    console.log('Resetting all assignment counts...');
    
    const trackingRef = doc(db, 'system', 'imageAssignments');
    const resetData = {
      set1: {},
      set2: {},
      totalAssignments: 0,
      lastUpdated: serverTimestamp(),
      maxAssignmentsPerImage: 5, // Keep the 5-assignment limit
      imagesPerUser: 10,
      imagesPerSet: 5,
      resetAt: serverTimestamp()
    };
    
    // Reset all counts to 0
    for (let i = 1; i <= 1200; i++) {
      resetData.set1[`set1_${i}`] = 0;
    }
    
    for (let i = 1201; i <= 2400; i++) {
      resetData.set2[`set2_${i}`] = 0;
    }
    
    await setDoc(trackingRef, resetData);
    
    console.log('✓ Assignment counts reset successfully with 5-assignment limit');
    
  } catch (error) {
    console.error('Error resetting assignment counts:', error);
    throw error;
  }
};