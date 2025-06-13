// src/utils/assessment-tracking.js - Updated for new flow: Consent → Main Survey → Demographics → Completion
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
        assignedImages: [],
        mainSurveyCompleted: false,
        demographicsCompleted: false,
        surveyCompleted: false
      };
    }

    const userData = userDoc.data();
    const assignedImages = userData.assignedImages || [];
    const completedImages = userData.completedImages || 0;
    
    return {
      completedCount: completedImages,
      totalAssigned: assignedImages.length,
      completedImages: {},
      assignedImages: assignedImages,
      mainSurveyCompleted: userData.mainSurveyCompleted || false,
      demographicsCompleted: userData.demographicsCompleted || false,
      surveyCompleted: userData.surveyCompleted || false
    };
  } catch (error) {
    console.error('Error getting user progress:', error);
    throw error;
  }
};

// UPDATED: Helper function to check if a user has completed the ENTIRE study (new flow)
export const checkSurveyCompletion = async (userId) => {
  try {
    const userRef = doc(db, 'loginIDs', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      return false;
    }
    
    const userData = userDoc.data();
    
    // NEW FLOW: Check if ENTIRE study is completed (main survey + demographics)
    if (userData.surveyCompleted) {
      console.log('Assessment-tracking: User has completed entire study (surveyCompleted = true)');
      return true;
    }
    
    // ALSO check if both main survey and demographics are completed
    if (userData.mainSurveyCompleted && userData.demographicsCompleted) {
      console.log('Assessment-tracking: User has completed both main survey and demographics');
      return true;
    }
    
    // Legacy check: if they've completed all assigned images AND demographics
    const assignedImages = userData.assignedImages || [];
    const completedImages = userData.completedImages || 0;
    
    const mainSurveyComplete = completedImages >= assignedImages.length && assignedImages.length > 0;
    const demographicsComplete = userData.demographicsCompleted || false;
    
    if (mainSurveyComplete && demographicsComplete) {
      console.log('Assessment-tracking: User has completed all images and demographics (legacy check)');
      return true;
    }
    
    console.log('Assessment-tracking: User has not completed entire study yet', {
      mainSurveyCompleted: userData.mainSurveyCompleted,
      demographicsCompleted: userData.demographicsCompleted,
      surveyCompleted: userData.surveyCompleted,
      completedImages: completedImages,
      totalImages: assignedImages.length
    });
    
    return false;
  } catch (error) {
    console.error('Error checking survey completion:', error);
    throw error;
  }
};

// NEW: Helper function to check if main survey (images) is completed
export const checkMainSurveyCompletion = async (userId) => {
  try {
    const userRef = doc(db, 'loginIDs', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      return false;
    }
    
    const userData = userDoc.data();
    
    // Check explicit flag first
    if (userData.mainSurveyCompleted) {
      return true;
    }
    
    // Check if they've completed all assigned images
    const assignedImages = userData.assignedImages || [];
    const completedImages = userData.completedImages || 0;
    
    return completedImages >= assignedImages.length && assignedImages.length > 0;
  } catch (error) {
    console.error('Error checking main survey completion:', error);
    throw error;
  }
};

// NEW: Helper function to check if demographics is completed
export const checkDemographicsCompletion = async (userId) => {
  try {
    const userRef = doc(db, 'loginIDs', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      return false;
    }
    
    const userData = userDoc.data();
    return userData.demographicsCompleted || false;
  } catch (error) {
    console.error('Error checking demographics completion:', error);
    throw error;
  }
};

// NEW: Mark main survey as completed
export const markMainSurveyCompleted = async (userId) => {
  try {
    const userRef = doc(db, 'loginIDs', userId);
    await updateDoc(userRef, {
      mainSurveyCompleted: true,
      mainSurveyCompletedAt: serverTimestamp(),
      lastUpdated: serverTimestamp()
    });
    
    console.log('Main survey marked as completed for user:', userId);
    return true;
  } catch (error) {
    console.error('Error marking main survey as completed:', error);
    throw error;
  }
};

// NEW: Mark demographics as completed (and entire study)
export const markDemographicsCompleted = async (userId, demographicsData = {}) => {
  try {
    const userRef = doc(db, 'loginIDs', userId);
    await updateDoc(userRef, {
      demographicsCompleted: true,
      demographicsCompletedAt: serverTimestamp(),
      surveyCompleted: true, // Mark entire study as completed
      completedAt: serverTimestamp(),
      lastUpdated: serverTimestamp(),
      demographicsData: demographicsData
    });
    
    console.log('Demographics and entire study marked as completed for user:', userId);
    return true;
  } catch (error) {
    console.error('Error marking demographics as completed:', error);
    throw error;
  }
};

// Function to get detailed statistics for admin dashboard - UPDATED for new flow
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
    
    // Get all users - UPDATED stats for new flow
    const usersSnapshot = await getDocs(collection(db, 'loginIDs'));
    let completedUsers = 0;
    let mainSurveyCompletedUsers = 0;
    let demographicsCompletedUsers = 0;
    let consentedUsers = 0;
    let totalUsers = 0;
    
    usersSnapshot.docs.forEach(doc => {
      if (doc.id === 'ADMIN') return;
      
      totalUsers++;
      const userData = doc.data();
      
      if (userData.hasConsented) consentedUsers++;
      if (userData.mainSurveyCompleted) mainSurveyCompletedUsers++;
      if (userData.demographicsCompleted) demographicsCompletedUsers++;
      if (userData.surveyCompleted) completedUsers++;
    });
    
    return {
      imageStats,
      totalViews,
      totalUsers,
      consentedUsers,
      mainSurveyCompletedUsers,
      demographicsCompletedUsers,
      completedUsers, // Entire study completed
      completionRate: totalUsers > 0 ? (completedUsers / totalUsers) * 100 : 0,
      mainSurveyCompletionRate: totalUsers > 0 ? (mainSurveyCompletedUsers / totalUsers) * 100 : 0,
      demographicsCompletionRate: totalUsers > 0 ? (demographicsCompletedUsers / totalUsers) * 100 : 0
    };
  } catch (error) {
    console.error('Error getting detailed stats:', error);
    throw error;
  }
};

// Function to export data for analysis - UPDATED for new flow
export const exportSurveyData = async () => {
  try {
    const results = {
      users: [],
      images: [],
      assessments: []
    };
    
    // Export user data - UPDATED with new flow fields
    const usersSnapshot = await getDocs(collection(db, 'loginIDs'));
    usersSnapshot.docs.forEach(doc => {
      if (doc.id === 'ADMIN') return;
      
      const userData = doc.data();
      results.users.push({
        userId: doc.id,
        prolificId: userData.prolificData?.prolificPid || null,
        assignedImages: userData.assignedImages || [],
        completedImages: userData.completedImages || 0,
        hasConsented: userData.hasConsented || false,
        mainSurveyCompleted: userData.mainSurveyCompleted || false,
        demographicsCompleted: userData.demographicsCompleted || false,
        surveyCompleted: userData.surveyCompleted || false, // Entire study
        createdAt: userData.createdAt,
        lastLogin: userData.lastLogin,
        mainSurveyCompletedAt: userData.mainSurveyCompletedAt,
        demographicsCompletedAt: userData.demographicsCompletedAt,
        completedAt: userData.completedAt
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

// Function to validate system integrity - UPDATED for new flow
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
      
      // Check if user has assigned images
      if (assignedImages.length === 0) {
        issues.push({
          type: 'no_assigned_images',
          userId: userDoc.id,
          message: 'User has no assigned images'
        });
      }
      
      // Check if all assigned images exist
      for (const imageData of assignedImages) {
        const imageId = imageData.id || imageData.name || 'unknown';
        if (!imageIds.has(imageId)) {
          issues.push({
            type: 'missing_image',
            userId: userDoc.id,
            imageId: imageId
          });
        }
      }
      
      // Check flow consistency - NEW FLOW VALIDATION
      if (userData.demographicsCompleted && !userData.mainSurveyCompleted) {
        issues.push({
          type: 'invalid_flow_state',
          userId: userDoc.id,
          message: 'Demographics completed but main survey not completed (invalid in new flow)'
        });
      }
      
      if (userData.surveyCompleted && (!userData.mainSurveyCompleted || !userData.demographicsCompleted)) {
        issues.push({
          type: 'inconsistent_completion_state',
          userId: userDoc.id,
          message: 'Survey marked complete but main survey or demographics not completed'
        });
      }
      
      // Check if main survey completion is consistent with image completion
      const completedImages = userData.completedImages || 0;
      const totalImages = assignedImages.length;
      
      if (userData.mainSurveyCompleted && completedImages < totalImages) {
        issues.push({
          type: 'main_survey_inconsistency',
          userId: userDoc.id,
          message: `Main survey marked complete but only ${completedImages}/${totalImages} images completed`
        });
      }
      
      if (!userData.mainSurveyCompleted && completedImages >= totalImages && totalImages > 0) {
        issues.push({
          type: 'main_survey_not_marked',
          userId: userDoc.id,
          message: `All images completed but main survey not marked as complete`
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

// NEW: Get user's current step in the study flow
export const getUserStudyStep = async (userId) => {
  try {
    const userRef = doc(db, 'loginIDs', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      return 'not_found';
    }
    
    const userData = userDoc.data();
    
    // Check completion status in order
    if (userData.surveyCompleted) {
      return 'completed';
    }
    
    if (userData.mainSurveyCompleted && userData.demographicsCompleted) {
      return 'completed'; // Both done = completed
    }
    
    if (userData.mainSurveyCompleted && !userData.demographicsCompleted) {
      return 'demographics'; // Main done, need demographics
    }
    
    if (userData.hasConsented && !userData.mainSurveyCompleted) {
      return 'main_survey'; // Consented, need to do main survey
    }
    
    if (!userData.hasConsented) {
      return 'consent'; // Need to consent
    }
    
    return 'unknown';
  } catch (error) {
    console.error('Error getting user study step:', error);
    return 'error';
  }
};

// NEW: Get study flow progress statistics
export const getStudyFlowStats = async () => {
  try {
    const usersSnapshot = await getDocs(collection(db, 'loginIDs'));
    
    const stats = {
      total: 0,
      atConsent: 0,
      atMainSurvey: 0,
      atDemographics: 0,
      completed: 0,
      unknown: 0
    };
    
    for (const userDoc of usersSnapshot.docs) {
      if (userDoc.id === 'ADMIN') continue;
      
      stats.total++;
      const step = await getUserStudyStep(userDoc.id);
      
      switch (step) {
        case 'consent':
          stats.atConsent++;
          break;
        case 'main_survey':
          stats.atMainSurvey++;
          break;
        case 'demographics':
          stats.atDemographics++;
          break;
        case 'completed':
          stats.completed++;
          break;
        default:
          stats.unknown++;
      }
    }
    
    return stats;
  } catch (error) {
    console.error('Error getting study flow stats:', error);
    throw error;
  }
};

// NEW: Migrate users from old flow to new flow (admin utility)
export const migrateUsersToNewFlow = async () => {
  try {
    console.log('Starting migration to new flow...');
    
    const usersSnapshot = await getDocs(collection(db, 'loginIDs'));
    const batch = writeBatch(db);
    let migratedCount = 0;
    let batchCount = 0;
    
    for (const userDoc of usersSnapshot.docs) {
      if (userDoc.id === 'ADMIN') continue;
      
      const userData = userDoc.data();
      const updates = {};
      let needsUpdate = false;
      
      // If user has completed all images but mainSurveyCompleted is not set
      const assignedImages = userData.assignedImages || [];
      const completedImages = userData.completedImages || 0;
      
      if (completedImages >= assignedImages.length && assignedImages.length > 0 && !userData.mainSurveyCompleted) {
        updates.mainSurveyCompleted = true;
        updates.mainSurveyCompletedAt = userData.completedAt || serverTimestamp();
        needsUpdate = true;
        console.log(`Migrating user ${userDoc.id}: marking main survey as completed`);
      }
      
      // If user has both main survey and demographics done but surveyCompleted is not set
      const mainComplete = userData.mainSurveyCompleted || (completedImages >= assignedImages.length && assignedImages.length > 0);
      const demoComplete = userData.demographicsCompleted;
      
      if (mainComplete && demoComplete && !userData.surveyCompleted) {
        updates.surveyCompleted = true;
        updates.completedAt = userData.demographicsCompletedAt || userData.completedAt || serverTimestamp();
        needsUpdate = true;
        console.log(`Migrating user ${userDoc.id}: marking entire survey as completed`);
      }
      
      if (needsUpdate) {
        updates.lastUpdated = serverTimestamp();
        updates.migratedToNewFlow = true;
        updates.migrationDate = serverTimestamp();
        
        batch.update(userDoc.ref, updates);
        migratedCount++;
        batchCount++;
        
        // Commit batch if we're approaching the limit
        if (batchCount >= 450) {
          await batch.commit();
          console.log(`Committed batch of ${batchCount} user updates`);
          batchCount = 0;
          // Create new batch for remaining operations
        }
      }
    }
    
    // Commit any remaining operations
    if (batchCount > 0) {
      await batch.commit();
      console.log(`Committed final batch of ${batchCount} user updates`);
    }
    
    if (migratedCount > 0) {
      console.log(`Successfully migrated ${migratedCount} users to new flow`);
    } else {
      console.log('No users needed migration');
    }
    
    return {
      success: true,
      migratedCount: migratedCount,
      totalUsers: usersSnapshot.size - 1 // Exclude admin
    };
  } catch (error) {
    console.error('Error migrating users to new flow:', error);
    throw error;
  }
};

// NEW: Force complete main survey for a user (admin utility)
export const forceCompleteMainSurvey = async (userId) => {
  try {
    const userRef = doc(db, 'loginIDs', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      throw new Error('User not found');
    }
    
    const userData = userDoc.data();
    const assignedImages = userData.assignedImages || [];
    
    await updateDoc(userRef, {
      mainSurveyCompleted: true,
      mainSurveyCompletedAt: serverTimestamp(),
      completedImages: assignedImages.length, // Mark all images as completed
      lastUpdated: serverTimestamp(),
      forceCompleted: true,
      forceCompletedAt: serverTimestamp()
    });
    
    console.log(`Force completed main survey for user: ${userId}`);
    return true;
  } catch (error) {
    console.error('Error force completing main survey:', error);
    throw error;
  }
};

// NEW: Reset user progress (admin utility)
export const resetUserProgress = async (userId, resetLevel = 'partial') => {
  try {
    const userRef = doc(db, 'loginIDs', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      throw new Error('User not found');
    }
    
    const updates = {
      lastUpdated: serverTimestamp(),
      resetAt: serverTimestamp(),
      resetLevel: resetLevel
    };
    
    if (resetLevel === 'full') {
      // Reset everything except assignment
      updates.hasConsented = false;
      updates.mainSurveyCompleted = false;
      updates.demographicsCompleted = false;
      updates.surveyCompleted = false;
      updates.completedImages = 0;
      updates.completedImageIds = [];
    } else if (resetLevel === 'demographics') {
      // Reset only demographics
      updates.demographicsCompleted = false;
      updates.surveyCompleted = false;
    } else if (resetLevel === 'main_survey') {
      // Reset main survey and everything after
      updates.mainSurveyCompleted = false;
      updates.demographicsCompleted = false;
      updates.surveyCompleted = false;
      updates.completedImages = 0;
      updates.completedImageIds = [];
    }
    
    await updateDoc(userRef, updates);
    
    console.log(`Reset user progress for ${userId} at level: ${resetLevel}`);
    return true;
  } catch (error) {
    console.error('Error resetting user progress:', error);
    throw error;
  }
};

// NEW: Get completion timeline for a user
export const getUserCompletionTimeline = async (userId) => {
  try {
    const userRef = doc(db, 'loginIDs', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      return null;
    }
    
    const userData = userDoc.data();
    
    const timeline = {
      userId: userId,
      created: userData.createdAt,
      consented: userData.consentedAt,
      mainSurveyCompleted: userData.mainSurveyCompletedAt,
      demographicsCompleted: userData.demographicsCompletedAt,
      studyCompleted: userData.completedAt,
      totalTimeSpent: null,
      mainSurveyTimeSpent: null,
      demographicsTimeSpent: null
    };
    
    // Calculate time spent if timestamps are available
    if (timeline.consented && timeline.mainSurveyCompleted) {
      timeline.mainSurveyTimeSpent = timeline.mainSurveyCompleted.toDate() - timeline.consented.toDate();
    }
    
    if (timeline.mainSurveyCompleted && timeline.demographicsCompleted) {
      timeline.demographicsTimeSpent = timeline.demographicsCompleted.toDate() - timeline.mainSurveyCompleted.toDate();
    }
    
    if (timeline.consented && timeline.studyCompleted) {
      timeline.totalTimeSpent = timeline.studyCompleted.toDate() - timeline.consented.toDate();
    }
    
    return timeline;
  } catch (error) {
    console.error('Error getting user completion timeline:', error);
    throw error;
  }
};