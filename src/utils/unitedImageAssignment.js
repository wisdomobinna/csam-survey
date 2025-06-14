// src/utils/unifiedImageAssignment.js - Centralized algorithm ensuring 4-5 max assignments per image

import { doc, getDoc, setDoc, updateDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { ref, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase/config';

// Configuration
const ASSIGNMENT_CONFIG = {
  maxAssignmentsPerImage: 5,
  imagesPerUser: 10,
  targetImagesPerSet: 5, // 5 from each set ideally
  set1Range: { start: 1, end: 1200 },
  set2Range: { start: 1201, end: 2400 }
};

/**
 * Initialize or get the global assignment tracking document
 */
const initializeGlobalAssignmentTracking = async () => {
  try {
    const trackingRef = doc(db, 'system', 'globalImageAssignments');
    const trackingDoc = await getDoc(trackingRef);
    
    if (!trackingDoc.exists()) {
      console.log('Creating global assignment tracking...');
      
      // Initialize tracking for all images
      const tracking = {
        set1: {},
        set2: {},
        metadata: {
          maxAssignmentsPerImage: ASSIGNMENT_CONFIG.maxAssignmentsPerImage,
          totalSet1Images: ASSIGNMENT_CONFIG.set1Range.end - ASSIGNMENT_CONFIG.set1Range.start + 1,
          totalSet2Images: ASSIGNMENT_CONFIG.set2Range.end - ASSIGNMENT_CONFIG.set2Range.start + 1,
          lastUpdated: serverTimestamp(),
          totalAssignments: 0
        }
      };
      
      // Initialize set1 (1-1200)
      for (let i = ASSIGNMENT_CONFIG.set1Range.start; i <= ASSIGNMENT_CONFIG.set1Range.end; i++) {
        tracking.set1[`${i}.png`] = {
          assignmentCount: 0,
          imageNumber: i,
          lastAssignedTo: null,
          lastAssignedAt: null
        };
      }
      
      // Initialize set2 (1201-2400)
      for (let i = ASSIGNMENT_CONFIG.set2Range.start; i <= ASSIGNMENT_CONFIG.set2Range.end; i++) {
        tracking.set2[`${i}.png`] = {
          assignmentCount: 0,
          imageNumber: i,
          lastAssignedTo: null,
          lastAssignedAt: null
        };
      }
      
      await setDoc(trackingRef, tracking);
      console.log('✓ Global assignment tracking initialized');
      return tracking;
    }
    
    return trackingDoc.data();
  } catch (error) {
    console.error('Error initializing global assignment tracking:', error);
    throw error;
  }
};

/**
 * Get available images that haven't reached the assignment limit
 */
const getAvailableImages = async () => {
  try {
    const tracking = await initializeGlobalAssignmentTracking();
    const maxAssignments = tracking.metadata.maxAssignmentsPerImage;
    
    const availableSet1 = [];
    const availableSet2 = [];
    
    // Process set1
    for (const [imageName, imageData] of Object.entries(tracking.set1)) {
      if (imageData.assignmentCount < maxAssignments) {
        availableSet1.push({
          id: `set1_${imageData.imageNumber}`,
          name: imageName,
          set: 'set1',
          path: `set1/${imageName}`,
          number: imageData.imageNumber,
          assignmentCount: imageData.assignmentCount,
          priority: maxAssignments - imageData.assignmentCount // Higher priority for less assigned
        });
      }
    }
    
    // Process set2
    for (const [imageName, imageData] of Object.entries(tracking.set2)) {
      if (imageData.assignmentCount < maxAssignments) {
        availableSet2.push({
          id: `set2_${imageData.imageNumber}`,
          name: imageName,
          set: 'set2',
          path: `set2/${imageName}`,
          number: imageData.imageNumber,
          assignmentCount: imageData.assignmentCount,
          priority: maxAssignments - imageData.assignmentCount
        });
      }
    }
    
    console.log(`Available images: Set1=${availableSet1.length}, Set2=${availableSet2.length}`);
    
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

/**
 * Unified assignment algorithm - prioritizes least assigned images
 */
export const assignImagesWithBalancing = async (userId, imagesPerUser = ASSIGNMENT_CONFIG.imagesPerUser) => {
  try {
    console.log(`=== Starting Unified Assignment for ${userId} ===`);
    
    const { set1, set2, tracking, maxAssignments } = await getAvailableImages();
    
    // Check if we have enough available images
    const totalAvailable = set1.length + set2.length;
    if (totalAvailable < imagesPerUser) {
      throw new Error(
        `Insufficient images available. Need ${imagesPerUser}, but only ${totalAvailable} images haven't reached the ${maxAssignments} assignment limit.`
      );
    }
    
    // Sort by priority (least assigned first), then randomly within same priority
    const sortByPriorityThenRandom = (images) => {
      return images.sort((a, b) => {
        if (b.priority === a.priority) {
          return Math.random() - 0.5; // Random for same priority
        }
        return b.priority - a.priority; // Higher priority (less assigned) first
      });
    };
    
    const sortedSet1 = sortByPriorityThenRandom([...set1]);
    const sortedSet2 = sortByPriorityThenRandom([...set2]);
    
    const assignedImages = [];
    const targetPerSet = Math.floor(imagesPerUser / 2); // Usually 5 from each set
    
    // Assign from set1 (prioritizing least assigned)
    let set1Assigned = 0;
    const maxFromSet1 = Math.min(targetPerSet, sortedSet1.length);
    for (let i = 0; i < maxFromSet1; i++) {
      assignedImages.push(sortedSet1[i]);
      set1Assigned++;
    }
    
    // Assign from set2 (prioritizing least assigned)
    let set2Assigned = 0;
    const maxFromSet2 = Math.min(targetPerSet, sortedSet2.length);
    for (let i = 0; i < maxFromSet2; i++) {
      assignedImages.push(sortedSet2[i]);
      set2Assigned++;
    }
    
    // If we need more images to reach target, fill from whichever set has availability
    const remaining = imagesPerUser - assignedImages.length;
    if (remaining > 0) {
      console.log(`Need ${remaining} more images, filling from available sets...`);
      
      // Combine remaining images from both sets and sort by priority
      const remainingSet1 = sortedSet1.slice(set1Assigned);
      const remainingSet2 = sortedSet2.slice(set2Assigned);
      const allRemaining = [...remainingSet1, ...remainingSet2].sort((a, b) => {
        if (b.priority === a.priority) {
          return Math.random() - 0.5;
        }
        return b.priority - a.priority;
      });
      
      for (let i = 0; i < remaining && i < allRemaining.length; i++) {
        assignedImages.push(allRemaining[i]);
      }
    }
    
    // Final shuffle for presentation order
    const finalAssignment = assignedImages.sort(() => Math.random() - 0.5);
    
    console.log(`✓ Assignment complete:`, {
      total: finalAssignment.length,
      set1Count: finalAssignment.filter(img => img.set === 'set1').length,
      set2Count: finalAssignment.filter(img => img.set === 'set2').length,
      assignmentCounts: finalAssignment.map(img => img.assignmentCount).join(', ')
    });
    
    // Update global tracking
    await updateGlobalAssignmentCounts(finalAssignment, userId);
    
    return finalAssignment;
    
  } catch (error) {
    console.error('Error in unified assignment:', error);
    throw error;
  }
};

/**
 * Update global assignment counts after successful assignment
 */
const updateGlobalAssignmentCounts = async (assignedImages, userId) => {
  try {
    console.log(`Updating global assignment counts for ${assignedImages.length} images...`);
    
    const trackingRef = doc(db, 'system', 'globalImageAssignments');
    const batch = writeBatch(db);
    
    // Build update object
    const updates = {
      'metadata.totalAssignments': tracking.metadata.totalAssignments + assignedImages.length,
      'metadata.lastUpdated': serverTimestamp(),
      'metadata.lastAssignedTo': userId
    };
    
    // Update each assigned image
    assignedImages.forEach(image => {
      const setKey = image.set;
      const imageName = image.name;
      const fieldPath = `${setKey}.${imageName}`;
      
      updates[`${fieldPath}.assignmentCount`] = image.assignmentCount + 1;
      updates[`${fieldPath}.lastAssignedTo`] = userId;
      updates[`${fieldPath}.lastAssignedAt`] = serverTimestamp();
    });
    
    batch.update(trackingRef, updates);
    
    // Log the assignment
    const assignmentLogRef = doc(db, 'assignmentLogs', `${userId}_${Date.now()}`);
    batch.set(assignmentLogRef, {
      userId,
      assignedImages: assignedImages.map(img => ({
        id: img.id,
        name: img.name,
        set: img.set,
        previousCount: img.assignmentCount,
        newCount: img.assignmentCount + 1
      })),
      assignmentTimestamp: serverTimestamp(),
      totalImagesAssigned: assignedImages.length,
      algorithm: 'unified_balanced'
    });
    
    await batch.commit();
    console.log('✓ Global assignment counts updated');
    
  } catch (error) {
    console.error('Error updating global assignment counts:', error);
    throw error;
  }
};

/**
 * Get assignment statistics for admin dashboard
 */
export const getGlobalAssignmentStats = async () => {
  try {
    const trackingRef = doc(db, 'system', 'globalImageAssignments');
    const trackingDoc = await getDoc(trackingRef);
    
    if (!trackingDoc.exists()) {
      return null;
    }
    
    const data = trackingDoc.data();
    const maxAssignments = data.metadata.maxAssignmentsPerImage;
    
    const calculateSetStats = (setData) => {
      const assignments = Object.values(setData);
      const stats = {
        totalImages: assignments.length,
        unassigned: 0,
        fullyAssigned: 0,
        partiallyAssigned: 0,
        totalAssignments: 0,
        averageAssignments: 0
      };
      
      // Count by assignment level
      const countsByLevel = {};
      for (let i = 0; i <= maxAssignments; i++) {
        countsByLevel[i] = 0;
      }
      
      assignments.forEach(imageData => {
        const count = imageData.assignmentCount;
        stats.totalAssignments += count;
        
        if (count === 0) stats.unassigned++;
        else if (count >= maxAssignments) stats.fullyAssigned++;
        else stats.partiallyAssigned++;
        
        countsByLevel[count]++;
      });
      
      stats.averageAssignments = assignments.length > 0 
        ? (stats.totalAssignments / assignments.length).toFixed(2) 
        : 0;
      
      stats.distributionByCount = countsByLevel;
      stats.availableForAssignment = stats.unassigned + stats.partiallyAssigned;
      
      return stats;
    };
    
    return {
      set1: calculateSetStats(data.set1),
      set2: calculateSetStats(data.set2),
      metadata: data.metadata,
      maxAssignmentsPerImage: maxAssignments,
      lastUpdated: data.metadata.lastUpdated
    };
    
  } catch (error) {
    console.error('Error getting global assignment stats:', error);
    return null;
  }
};

/**
 * Reset all assignment counts (admin function)
 */
export const resetGlobalAssignmentCounts = async () => {
  try {
    console.log('Resetting all global assignment counts...');
    
    const trackingRef = doc(db, 'system', 'globalImageAssignments');
    
    // Reinitialize with zero counts
    const resetData = {
      set1: {},
      set2: {},
      metadata: {
        maxAssignmentsPerImage: ASSIGNMENT_CONFIG.maxAssignmentsPerImage,
        totalSet1Images: ASSIGNMENT_CONFIG.set1Range.end - ASSIGNMENT_CONFIG.set1Range.start + 1,
        totalSet2Images: ASSIGNMENT_CONFIG.set2Range.end - ASSIGNMENT_CONFIG.set2Range.start + 1,
        lastUpdated: serverTimestamp(),
        totalAssignments: 0,
        resetAt: serverTimestamp()
      }
    };
    
    // Reset set1
    for (let i = ASSIGNMENT_CONFIG.set1Range.start; i <= ASSIGNMENT_CONFIG.set1Range.end; i++) {
      resetData.set1[`${i}.png`] = {
        assignmentCount: 0,
        imageNumber: i,
        lastAssignedTo: null,
        lastAssignedAt: null
      };
    }
    
    // Reset set2
    for (let i = ASSIGNMENT_CONFIG.set2Range.start; i <= ASSIGNMENT_CONFIG.set2Range.end; i++) {
      resetData.set2[`${i}.png`] = {
        assignmentCount: 0,
        imageNumber: i,
        lastAssignedTo: null,
        lastAssignedAt: null
      };
    }
    
    await setDoc(trackingRef, resetData);
    console.log('✓ Global assignment counts reset successfully');
    
  } catch (error) {
    console.error('Error resetting global assignment counts:', error);
    throw error;
  }
};

/**
 * Verify image storage accessibility
 */
export const verifyImageStorage = async () => {
  try {
    console.log('Verifying image storage accessibility...');
    
    const testImages = [
      'set1/1.png',
      'set1/600.png', 
      'set1/1200.png',
      'set2/1201.png',
      'set2/1800.png',
      'set2/2400.png'
    ];
    
    const results = [];
    
    for (const imagePath of testImages) {
      try {
        const imageRef = ref(storage, imagePath);
        await getDownloadURL(imageRef);
        results.push({ path: imagePath, accessible: true });
      } catch (error) {
        results.push({ path: imagePath, accessible: false, error: error.message });
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
    
  } catch (error) {
    console.error('Error verifying image storage:', error);
    throw error;
  }
};

/**
 * Get assignment capacity information
 */
export const getAssignmentCapacity = async () => {
  try {
    const stats = await getGlobalAssignmentStats();
    if (!stats) return null;
    
    const totalImages = stats.set1.totalImages + stats.set2.totalImages;
    const maxPossibleAssignments = totalImages * stats.maxAssignmentsPerImage;
    const currentAssignments = stats.set1.totalAssignments + stats.set2.totalAssignments;
    const remainingCapacity = maxPossibleAssignments - currentAssignments;
    
    const availableImages = stats.set1.availableForAssignment + stats.set2.availableForAssignment;
    const maxPossibleUsers = Math.floor(remainingCapacity / ASSIGNMENT_CONFIG.imagesPerUser);
    
    return {
      totalImages,
      maxAssignmentsPerImage: stats.maxAssignmentsPerImage,
      maxPossibleAssignments,
      currentAssignments,
      remainingCapacity,
      capacityUsedPercentage: Math.round((currentAssignments / maxPossibleAssignments) * 100),
      availableImages,
      maxAdditionalUsers: maxPossibleUsers,
      imagesPerUser: ASSIGNMENT_CONFIG.imagesPerUser,
      canAssignMoreUsers: maxPossibleUsers > 0
    };
    
  } catch (error) {
    console.error('Error getting assignment capacity:', error);
    throw error;
  }
};

export default {
  assignImagesWithBalancing,
  getGlobalAssignmentStats,
  resetGlobalAssignmentCounts,
  verifyImageStorage,
  getAssignmentCapacity,
  ASSIGNMENT_CONFIG
};