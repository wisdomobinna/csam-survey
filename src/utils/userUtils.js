// src/utils/userUtils.js - Complete user utilities with optimized image assignment

import { doc, setDoc, getDoc, serverTimestamp, collection, getDocs, writeBatch, query, where } from 'firebase/firestore';
import { db } from '../firebase/config';

// Folder configuration for your exact naming convention
const FOLDER_CONFIG = {
  'cc3m_filtered': {
    name: 'CC3M Filtered',
    color: 'blue',
    storagePrefix: 'cc3m_filtered/',
    startNumber: 1,
    endNumber: 1200,
    totalImages: 1200
  },
  'cc3m_unfiltered': {
    name: 'CC3M Unfiltered', 
    color: 'green',
    storagePrefix: 'cc3m_unfiltered/',
    startNumber: 1201,
    endNumber: 2400,
    totalImages: 1200
  }
};

const ACTIVE_FOLDERS = ['cc3m_filtered', 'cc3m_unfiltered'];

// Generate internal user ID from Prolific PID
export const generateInternalUserId = (prolificPid) => {
  const timestamp = Date.now().toString().slice(-8);
  const pidHash = prolificPid.substring(0, 12);
  const randomSuffix = Math.random().toString(36).substring(2, 6);
  return `P${timestamp}_${pidHash}_${randomSuffix}`;
};

// Smart image assignment function
export const assignImagesToUser = async (userId, imageCount = 5) => {
  console.log(`Assigning ${imageCount} images to user: ${userId}`);
  
  try {
    // Get all available images from both folders
    const imagesSnapshot = await getDocs(collection(db, 'images'));
    const allImages = imagesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })).filter(img => ACTIVE_FOLDERS.includes(img.folder));
    
    if (allImages.length === 0) {
      throw new Error('No images available for assignment. Please load images to database first.');
    }
    
    // Separate by folder
    const folderImages = {
      cc3m_filtered: allImages.filter(img => img.folder === 'cc3m_filtered'),
      cc3m_unfiltered: allImages.filter(img => img.folder === 'cc3m_unfiltered')
    };
    
    console.log('Available images by folder:', {
      cc3m_filtered: folderImages.cc3m_filtered.length,
      cc3m_unfiltered: folderImages.cc3m_unfiltered.length,
      total: allImages.length
    });
    
    if (folderImages.cc3m_filtered.length === 0 || folderImages.cc3m_unfiltered.length === 0) {
      throw new Error('Both image folders must have images available for assignment');
    }
    
    // Smart assignment strategy - balanced across folders
    const assignedImages = [];
    const imagesPerFolder = Math.floor(imageCount / 2);
    const remainder = imageCount % 2;
    
    // Assign from cc3m_filtered (prioritize least assigned)
    const filteredSorted = folderImages.cc3m_filtered.sort((a, b) => {
      const aCount = a.assignedCount || 0;
      const bCount = b.assignedCount || 0;
      if (aCount !== bCount) return aCount - bCount;
      // If assignment counts are equal, randomize
      return Math.random() - 0.5;
    });
    
    const filteredCount = imagesPerFolder + (remainder > 0 ? 1 : 0);
    assignedImages.push(...filteredSorted.slice(0, filteredCount));
    
    // Assign from cc3m_unfiltered (prioritize least assigned)
    const unfilteredSorted = folderImages.cc3m_unfiltered.sort((a, b) => {
      const aCount = a.assignedCount || 0;
      const bCount = b.assignedCount || 0;
      if (aCount !== bCount) return aCount - bCount;
      // If assignment counts are equal, randomize
      return Math.random() - 0.5;
    });
    
    assignedImages.push(...unfilteredSorted.slice(0, imagesPerFolder));
    
    // Shuffle the final assignment for random presentation order
    const shuffledImages = assignedImages.sort(() => Math.random() - 0.5);
    const finalAssignment = shuffledImages.slice(0, imageCount);
    
    console.log(`Final assignment for ${userId}:`, {
      total: finalAssignment.length,
      cc3m_filtered: finalAssignment.filter(img => img.folder === 'cc3m_filtered').length,
      cc3m_unfiltered: finalAssignment.filter(img => img.folder === 'cc3m_unfiltered').length,
      imageIds: finalAssignment.map(img => img.id),
      imageNumbers: finalAssignment.map(img => img.imageNumber)
    });
    
    // Update assignment counts in batch
    const batch = writeBatch(db);
    for (const image of finalAssignment) {
      const imageRef = doc(db, 'images', image.id);
      batch.update(imageRef, {
        assignedCount: (image.assignedCount || 0) + 1,
        lastAssigned: serverTimestamp(),
        lastAssignedTo: userId
      });
    }
    await batch.commit();
    
    console.log('Assignment counts updated successfully');
    
    return finalAssignment.map(img => img.id);
    
  } catch (error) {
    console.error('Error in assignImagesToUser:', error);
    throw new Error(`Failed to assign images: ${error.message}`);
  }
};

// Create new user with Prolific data
export const createNewUser = async (prolificPid, prolificData = null) => {
  console.log('Creating new user with Prolific PID:', prolificPid);
  console.log('Prolific data:', prolificData);
  
  try {
    // Generate internal user ID
    const internalUserId = generateInternalUserId(prolificPid);
    console.log('Generated internal user ID:', internalUserId);
    
    // Check if this internal ID already exists (very unlikely but safety check)
    const existingDoc = await getDoc(doc(db, 'loginIDs', internalUserId));
    if (existingDoc.exists()) {
      // Add random suffix if ID collision
      const randomSuffix = Math.random().toString(36).substring(2, 5);
      const finalInternalId = `${internalUserId}_${randomSuffix}`;
      console.log('ID collision detected, using:', finalInternalId);
      internalUserId = finalInternalId;
    }
    
    // Assign images (4-5 images from 2 folders)
    const imageCount = Math.floor(Math.random() * 2) + 4; // 4 or 5 images randomly
    console.log(`Assigning ${imageCount} images to new user`);
    
    const assignedImages = await assignImagesToUser(internalUserId, imageCount);
    
    if (!assignedImages || assignedImages.length === 0) {
      throw new Error('Failed to assign any images to user. Database may be empty.');
    }
    
    // Count images by folder for metadata
    const folderBreakdown = {
      cc3m_filtered: assignedImages.filter(id => id.startsWith('cc3m_filtered')).length,
      cc3m_unfiltered: assignedImages.filter(id => id.startsWith('cc3m_unfiltered')).length
    };
    
    // Create comprehensive user document
    const userData = {
      // Core identification
      internalUserId: internalUserId,
      displayId: prolificPid,
      
      // Prolific information
      prolificData: {
        prolificPid: prolificPid,
        studyId: prolificData?.studyId || null,
        sessionId: prolificData?.sessionId || null,
        detectedAt: prolificData?.detectedAt || new Date().toISOString(),
        qualtricsUserId: prolificPid // For Qualtrics integration if needed
      },
      
      // Image assignment details
      assignedImages: assignedImages,
      totalAssignedImages: assignedImages.length,
      completedImages: 0,
      imageAssignmentDetails: {
        assignedAt: serverTimestamp(),
        totalAssigned: assignedImages.length,
        folderBreakdown: folderBreakdown,
        assignmentStrategy: 'balanced_least_assigned'
      },
      
      // Survey progress
      hasConsented: false,
      surveyCompleted: false,
      completedAt: null,
      
      // Metadata
      source: 'prolific',
      createdAt: serverTimestamp(),
      lastLogin: serverTimestamp(),
      lastUpdated: serverTimestamp(),
      isActive: true,
      
      // Session info
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      timezone: typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : null
    };
    
    // Save user document
    const userRef = doc(db, 'loginIDs', internalUserId);
    await setDoc(userRef, userData);
    
    console.log('User document created successfully:', {
      userId: internalUserId,
      prolificPid: prolificPid,
      assignedImages: assignedImages.length,
      folderBreakdown: folderBreakdown
    });
    
    return {
      success: true,
      userId: internalUserId,
      userData: userData,
      assignedImages: assignedImages
    };
    
  } catch (error) {
    console.error('Error creating new user:', error);
    throw new Error(`Failed to create user account: ${error.message}`);
  }
};

// Check if user exists by Prolific PID
export const findUserByProlificPid = async (prolificPid) => {
  try {
    console.log('Searching for existing user with Prolific PID:', prolificPid);
    
    // Query users by Prolific PID
    const usersRef = collection(db, 'loginIDs');
    const q = query(usersRef, where('prolificData.prolificPid', '==', prolificPid));
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const userDoc = querySnapshot.docs[0];
      const userData = userDoc.data();
      
      console.log('Found existing user:', {
        userId: userDoc.id,
        prolificPid: userData.prolificData?.prolificPid,
        hasConsented: userData.hasConsented,
        surveyCompleted: userData.surveyCompleted,
        assignedImages: userData.assignedImages?.length
      });
      
      return {
        exists: true,
        userId: userDoc.id,
        userData: userData
      };
    }
    
    console.log('No existing user found for Prolific PID:', prolificPid);
    return { exists: false };
    
  } catch (error) {
    console.error('Error searching for user by Prolific PID:', error);
    throw error;
  }
};

// Update user login timestamp
export const updateUserLogin = async (userId) => {
  try {
    const userRef = doc(db, 'loginIDs', userId);
    await setDoc(userRef, {
      lastLogin: serverTimestamp(),
      lastUpdated: serverTimestamp()
    }, { merge: true });
    
    console.log('User login timestamp updated:', userId);
  } catch (error) {
    console.error('Error updating user login:', error);
    throw error;
  }
};

// Get assignment statistics
export const getAssignmentStats = async () => {
  try {
    console.log('Calculating assignment statistics...');
    
    const imagesSnapshot = await getDocs(collection(db, 'images'));
    const usersSnapshot = await getDocs(collection(db, 'loginIDs'));
    
    const stats = {
      totalImages: imagesSnapshot.docs.length,
      totalUsers: usersSnapshot.docs.filter(doc => doc.id !== 'ADMIN').length,
      folderStats: {},
      assignmentDistribution: {
        unassigned: 0,
        lowAssigned: 0,    // 1-3 assignments
        mediumAssigned: 0, // 4-7 assignments
        highAssigned: 0,   // 8-10 assignments
        overAssigned: 0    // 10+ assignments
      },
      userStats: {
        withImages: 0,
        withoutImages: 0,
        averageImagesPerUser: 0
      }
    };
    
    // Initialize folder stats
    Object.keys(FOLDER_CONFIG).forEach(folder => {
      stats.folderStats[folder] = {
        name: FOLDER_CONFIG[folder].name,
        total: 0,
        totalAssignments: 0,
        minAssignments: Infinity,
        maxAssignments: 0,
        avgAssignments: 0,
        expectedImages: FOLDER_CONFIG[folder].totalImages
      };
    });
    
    // Process images
    let totalUserImages = 0;
    imagesSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const folder = data.folder;
      const assignedCount = data.assignedCount || 0;
      
      if (stats.folderStats[folder]) {
        stats.folderStats[folder].total++;
        stats.folderStats[folder].totalAssignments += assignedCount;
        stats.folderStats[folder].minAssignments = Math.min(stats.folderStats[folder].minAssignments, assignedCount);
        stats.folderStats[folder].maxAssignments = Math.max(stats.folderStats[folder].maxAssignments, assignedCount);
      }
      
      // Assignment distribution
      if (assignedCount === 0) stats.assignmentDistribution.unassigned++;
      else if (assignedCount <= 3) stats.assignmentDistribution.lowAssigned++;
      else if (assignedCount <= 7) stats.assignmentDistribution.mediumAssigned++;
      else if (assignedCount <= 10) stats.assignmentDistribution.highAssigned++;
      else stats.assignmentDistribution.overAssigned++;
    });
    
    // Process users
    usersSnapshot.docs.forEach(doc => {
      if (doc.id === 'ADMIN') return;
      
      const userData = doc.data();
      const assignedImages = userData.assignedImages || [];
      
      if (assignedImages.length > 0) {
        stats.userStats.withImages++;
        totalUserImages += assignedImages.length;
      } else {
        stats.userStats.withoutImages++;
      }
    });
    
    // Calculate averages
    Object.keys(stats.folderStats).forEach(folder => {
      const folderData = stats.folderStats[folder];
      if (folderData.total > 0) {
        folderData.avgAssignments = (folderData.totalAssignments / folderData.total).toFixed(2);
        if (folderData.minAssignments === Infinity) folderData.minAssignments = 0;
      }
    });
    
    if (stats.userStats.withImages > 0) {
      stats.userStats.averageImagesPerUser = (totalUserImages / stats.userStats.withImages).toFixed(1);
    }
    
    console.log('Assignment statistics calculated:', stats);
    return stats;
    
  } catch (error) {
    console.error('Error calculating assignment statistics:', error);
    throw error;
  }
};

// Check survey completion status
export const checkSurveyCompletion = async (userId) => {
  try {
    const userRef = doc(db, 'loginIDs', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      return false;
    }
    
    const userData = userDoc.data();
    return userData.surveyCompleted === true;
    
  } catch (error) {
    console.error('Error checking survey completion:', error);
    return false;
  }
};

// Mark survey as completed
export const markSurveyCompleted = async (userId) => {
  try {
    const userRef = doc(db, 'loginIDs', userId);
    await setDoc(userRef, {
      surveyCompleted: true,
      completedAt: serverTimestamp(),
      lastUpdated: serverTimestamp()
    }, { merge: true });
    
    console.log('Survey marked as completed for user:', userId);
    return true;
    
  } catch (error) {
    console.error('Error marking survey as completed:', error);
    throw error;
  }
};

// Get user progress
export const getUserProgress = async (userId) => {
  try {
    const userRef = doc(db, 'loginIDs', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      throw new Error('User not found');
    }
    
    const userData = userDoc.data();
    const assignedImages = userData.assignedImages || [];
    const completedImages = userData.completedImages || 0;
    
    return {
      totalImages: assignedImages.length,
      completedImages: completedImages,
      remainingImages: assignedImages.length - completedImages,
      progressPercentage: assignedImages.length > 0 
        ? Math.round((completedImages / assignedImages.length) * 100) 
        : 0,
      hasConsented: userData.hasConsented || false,
      surveyCompleted: userData.surveyCompleted || false
    };
    
  } catch (error) {
    console.error('Error getting user progress:', error);
    throw error;
  }
};

// Update user progress
export const updateUserProgress = async (userId, completedImageCount) => {
  try {
    const userRef = doc(db, 'loginIDs', userId);
    await setDoc(userRef, {
      completedImages: completedImageCount,
      lastUpdated: serverTimestamp()
    }, { merge: true });
    
    console.log(`User progress updated: ${userId} - ${completedImageCount} images completed`);
    return true;
    
  } catch (error) {
    console.error('Error updating user progress:', error);
    throw error;
  }
};

export default {
  generateInternalUserId,
  assignImagesToUser,
  createNewUser,
  findUserByProlificPid,
  updateUserLogin,
  getAssignmentStats,
  checkSurveyCompletion,
  markSurveyCompleted,
  getUserProgress,
  updateUserProgress,
  FOLDER_CONFIG,
  ACTIVE_FOLDERS
};