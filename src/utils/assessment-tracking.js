// src/utils/assessment-tracking.js - Updated for new system
import { increment, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { collection, doc, getDoc, getDocs, writeBatch, setDoc, updateDoc } from 'firebase/firestore';

export const trackAssessment = async (imageId, userId, metadata = {}) => {
  try {
    console.log('Tracking assessment for image:', imageId, 'by user:', userId, 'with metadata:', metadata);
    
    const batch = writeBatch(db);
    
    // Update image document with view tracking
    const imageRef = doc(db, 'images', imageId);
    batch.update(imageRef, {
      viewCount: increment(1),
      lastViewedAt: serverTimestamp(),
      [`viewers.${userId}`]: {  
        viewedAt: serverTimestamp(),
        responseId: metadata.responseId,
        imageNumber: metadata.imageNumber
      }
    });
    
    // Update user progress document
    const userProgressRef = doc(db, 'userProgress', userId);
    batch.update(userProgressRef, {
      [`completedImages.${imageId}`]: {
        completedAt: serverTimestamp(),
        responseId: metadata.responseId,
        imageNumber: metadata.imageNumber
      },
      lastUpdated: serverTimestamp()
    });

    // Add detailed tracking record
    const trackingRef = doc(collection(db, 'assessmentTracking'));
    batch.set(trackingRef, {
      imageId,
      userId,
      completedAt: serverTimestamp(),
      responseId: metadata.responseId,
      imageNumber: metadata.imageNumber,
      category: metadata.category,
      folder: metadata.folder
    });
    
    await batch.commit();
    console.log('Successfully tracked assessment');
    
    return true;
  } catch (error) {
    console.error('Error tracking assessment:', error);
    throw error;
  }
};

export const getUserProgress = async (userId) => {
  try {
    // Get user's login data to find assigned images
    const userRef = doc(db, 'loginIDs', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      return {
        completedCount: 0,
        totalAssigned: 0,
        completedImages: {},
        assignedImages: []
      };
    }

    const userData = userDoc.data();
    const assignedImages = userData.assignedImages || [];
    const completedImages = userData.completedImages || 0;
    
    return {
      completedCount: completedImages,
      totalAssigned: assignedImages.length,
      completedImages: {},
      assignedImages: assignedImages
    };
  } catch (error) {
    console.error('Error getting user progress:', error);
    throw error;
  }
};

// Helper function to check if a user has completed all assigned images
export const checkSurveyCompletion = async (userId) => {
  try {
    const userRef = doc(db, 'loginIDs', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      return false;
    }
    
    const userData = userDoc.data();
    
    // Check if explicitly marked as completed
    if (userData.surveyCompleted) {
      return true;
    }
    
    // Check if they've completed all assigned images
    const assignedImages = userData.assignedImages || [];
    const completedImages = userData.completedImages || 0;
    
    return completedImages >= assignedImages.length && assignedImages.length > 0;
  } catch (error) {
    console.error('Error checking survey completion:', error);
    throw error;
  }
};

// Function to get detailed statistics for admin dashboard
export const getDetailedStats = async () => {
  try {
    // Get all images
    const imagesSnapshot = await getDocs(collection(db, 'images'));
    const imageStats = {};
    let totalViews = 0;
    
    imagesSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const folder = data.folder || 'unknown';
      
      if (!imageStats[folder]) {
        imageStats[folder] = {
          totalImages: 0,
          totalViews: 0,
          assignedCount: 0
        };
      }
      
      imageStats[folder].totalImages++;
      imageStats[folder].totalViews += (data.viewCount || 0);
      imageStats[folder].assignedCount += (data.assignedCount || 0);
      totalViews += (data.viewCount || 0);
    });
    
    // Get all users
    const usersSnapshot = await getDocs(collection(db, 'loginIDs'));
    let completedUsers = 0;
    let totalUsers = 0;
    
    usersSnapshot.docs.forEach(doc => {
      if (doc.id === 'ADMIN') return;
      
      totalUsers++;
      const userData = doc.data();
      if (userData.surveyCompleted) {
        completedUsers++;
      }
    });
    
    return {
      imageStats,
      totalViews,
      completedUsers,
      totalUsers,
      completionRate: totalUsers > 0 ? (completedUsers / totalUsers) * 100 : 0
    };
  } catch (error) {
    console.error('Error getting detailed stats:', error);
    throw error;
  }
};

// Function to export data for analysis
export const exportSurveyData = async () => {
  try {
    const results = {
      users: [],
      images: [],
      assessments: []
    };
    
    // Export user data
    const usersSnapshot = await getDocs(collection(db, 'loginIDs'));
    usersSnapshot.docs.forEach(doc => {
      if (doc.id === 'ADMIN') return;
      
      const userData = doc.data();
      results.users.push({
        userId: doc.id,
        prolificId: userData.prolificData?.prolificPid || null,
        assignedImages: userData.assignedImages || [],
        completedImages: userData.completedImages || 0,
        surveyCompleted: userData.surveyCompleted || false,
        hasConsented: userData.hasConsented || false,
        createdAt: userData.createdAt,
        lastLogin: userData.lastLogin
      });
    });
    
    // Export image data
    const imagesSnapshot = await getDocs(collection(db, 'images'));
    imagesSnapshot.docs.forEach(doc => {
      const imageData = doc.data();
      results.images.push({
        imageId: doc.id,
        imageNumber: imageData.imageNumber,
        folder: imageData.folder,
        category: imageData.category,
        viewCount: imageData.viewCount || 0,
        assignedCount: imageData.assignedCount || 0,
        storagePath: imageData.storagePath
      });
    });
    
    // Export assessment tracking data
    const trackingSnapshot = await getDocs(collection(db, 'assessmentTracking'));
    trackingSnapshot.docs.forEach(doc => {
      const trackingData = doc.data();
      results.assessments.push({
        userId: trackingData.userId,
        imageId: trackingData.imageId,
        completedAt: trackingData.completedAt,
        responseId: trackingData.responseId,
        category: trackingData.category,
        folder: trackingData.folder
      });
    });
    
    return results;
  } catch (error) {
    console.error('Error exporting survey data:', error);
    throw error;
  }
};

// Function to validate system integrity
export const validateSystemIntegrity = async () => {
  try {
    const issues = [];
    
    // Check for users with invalid assignments
    const usersSnapshot = await getDocs(collection(db, 'loginIDs'));
    const imagesSnapshot = await getDocs(collection(db, 'images'));
    
    const imageIds = new Set(imagesSnapshot.docs.map(doc => doc.id));
    
    for (const userDoc of usersSnapshot.docs) {
      if (userDoc.id === 'ADMIN') continue;
      
      const userData = userDoc.data();
      const assignedImages = userData.assignedImages || [];
      
      // Check if user has exactly 4 assigned images
      if (assignedImages.length !== 4) {
        issues.push({
          type: 'invalid_assignment_count',
          userId: userDoc.id,
          assignedCount: assignedImages.length,
          expected: 4
        });
      }
      
      // Check if all assigned images exist
      for (const imageId of assignedImages) {
        if (!imageIds.has(imageId)) {
          issues.push({
            type: 'missing_image',
            userId: userDoc.id,
            imageId: imageId
          });
        }
      }
      
      // Check folder distribution (should have one from each folder)
      const folders = new Set();
      for (const imageId of assignedImages) {
        const imageDoc = imagesSnapshot.docs.find(doc => doc.id === imageId);
        if (imageDoc) {
          folders.add(imageDoc.data().folder);
        }
      }
      
      if (folders.size !== 4) {
        issues.push({
          type: 'invalid_folder_distribution',
          userId: userDoc.id,
          folders: Array.from(folders),
          expected: 4
        });
      }
    }
    
    return {
      valid: issues.length === 0,
      issues: issues
    };
  } catch (error) {
    console.error('Error validating system integrity:', error);
    throw error;
  }
};