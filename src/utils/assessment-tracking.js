// src/utils/assessment-tracking.js
import { increment, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { collection, doc, getDoc, getDocs, writeBatch, setDoc } from 'firebase/firestore';

// In assessment-tracking.js

export const trackAssessment = async (imageId, userId, metadata = {}) => {
  try {
    console.log('Tracking assessment for image:', imageId, 'by user:', userId, 'with metadata:', metadata);
    
    const batch = writeBatch(db);
    
    // Update image document with more detailed tracking
    const imageRef = doc(db, 'images', imageId);
    batch.update(imageRef, {
      totalAssessments: increment(1),
      lastAssessedAt: serverTimestamp(),
      [`assessments.${userId}`]: {
        completedAt: serverTimestamp(),
        assessmentNumber: increment(1),
        responseId: metadata.responseId,
        imageNumber: metadata.imageNumber
      }
    });
    
    // Update user progress document with detailed tracking
    const userProgressRef = doc(db, 'userProgress', userId);
    batch.update(userProgressRef, {
      [`completedImages.${imageId}`]: {
        completedAt: serverTimestamp(),
        responseId: metadata.responseId,
        imageNumber: metadata.imageNumber
      },
      lastUpdated: serverTimestamp()
    });

    // Add a new document in a completedAssessments collection for easier querying
    const completedRef = doc(collection(db, 'completedAssessments'));
    batch.set(completedRef, {
      imageId,
      userId,
      completedAt: serverTimestamp(),
      responseId: metadata.responseId,
      imageNumber: metadata.imageNumber
    });
    
    await batch.commit();
    console.log('Successfully tracked assessment with metadata');
    
    return true;
  } catch (error) {
    console.error('Error tracking assessment:', error);
    throw error;
  }
};


export const assignImageBatch = async (userId) => {
  try {
    console.log('Starting batch assignment for user:', userId);

    const imagesRef = collection(db, 'images');
    console.log('Fetching images from database...');
    const imagesSnapshot = await getDocs(imagesRef);
    
    if (imagesSnapshot.empty) {
      console.error('No images found in database');
      throw new Error('No images found in database');
    }

    console.log('Total images in database:', imagesSnapshot.size);

    // Get all images and their assignments
    const images = imagesSnapshot.docs.map(doc => ({
      id: doc.id,
      assignedCount: (doc.data().assignedEvaluators || []).length,
      totalAssessments: doc.data().totalAssessments || 0
    }));

    // Filter available images (those assigned to less than 12 evaluators)
    const availableImages = images
      .filter(img => img.assignedCount < 12)
      .sort((a, b) => a.assignedCount - b.assignedCount)
      .map(img => img.id);

    console.log('Available images:', availableImages.length);

    if (availableImages.length < 12) {
      console.error('Not enough available images:', {
        available: availableImages.length,
        required: 12,
        totalImages: images.length
      });
      throw new Error(`Not enough available images for assessment (found ${availableImages.length}, need 12)`);
    }

    // Select first 12 least-assigned images
    const selectedImages = availableImages.slice(0, 12);
    console.log('Selected images:', selectedImages);

    // Create a batch write operation
    const batch = writeBatch(db);
    
    // Update user progress document
    const userProgressRef = doc(db, 'userProgress', userId);
    batch.set(userProgressRef, {
      assignedBatch: selectedImages,
      progress: 0,
      completedImages: {},
      lastUpdated: serverTimestamp()
    });

    // Update image documents to record assignments
    for (const imageId of selectedImages) {
      const imageRef = doc(db, 'images', imageId);
      batch.update(imageRef, {
        assignedEvaluators: arrayUnion(userId)
      });
    }

    // Commit all the updates
    await batch.commit();
    console.log('Successfully assigned batch to user:', userId);

    return selectedImages;
  } catch (error) {
    console.error('Error in assignImageBatch:', error);
    throw error;
  }
};

export const getUserProgress = async (userId) => {
  try {
    const userRef = doc(db, 'userProgress', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      return {
        completedCount: 0,
        totalAssigned: 0,
        completedImages: {}
      };
    }

    const data = userDoc.data();
    return {
      completedCount: Object.keys(data.completedImages || {}).length,
      totalAssigned: data.assignedBatch?.length || 0,
      completedImages: data.completedImages || {}
    };
  } catch (error) {
    console.error('Error getting user progress:', error);
    throw error;
  }
};

// Helper function to check if a user has completed all assigned images
export const checkSurveyCompletion = async (userId) => {
  try {
    const progress = await getUserProgress(userId);
    return progress.completedCount === progress.totalAssigned;
  } catch (error) {
    console.error('Error checking survey completion:', error);
    throw error;
  }
};