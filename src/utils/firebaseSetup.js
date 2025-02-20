// src/utils/firebaseSetup.js
import { collection, doc, writeBatch, getDocs, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

// Define default prompts
const getDefaultPrompt = (imageId) => {
  // You can modify this to include your actual prompts
  return `Please describe what you observe in Image ${imageId}`;
};

export const initializeFirestore = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'images'));
      if (snapshot.size > 0) {
        console.log('Images already initialized in Firestore');
        return;
      }
  
      const batch = writeBatch(db);
      const totalImages = 300;
      
      console.log('Starting Firestore initialization...');
  
      for (let i = 1; i <= totalImages; i++) {
        const imageId = i.toString().padStart(3, '0');
        
        const docRef = doc(collection(db, 'images'), imageId);
        batch.set(docRef, {
          id: imageId,
          totalAssessments: 0,
          assignedEvaluators: [],
          lastAssessedAt: null,
          fileExtension: '.jpg',
          prompt: getDefaultPrompt(imageId) // Add prompt field
        });
      }
  
      await batch.commit();
      console.log('Firestore initialization complete');
      return true;
    } catch (error) {
      console.error('Error initializing system:', error);
      throw error;
    }
};

export const checkInitializationStatus = async () => {
  try {
    const imagesRef = collection(db, 'images');
    const snapshot = await getDocs(imagesRef);
    
    if (snapshot.empty) {
      return {
        initialized: false,
        imageCount: 0
      };
    }

    // Check a sample image for proper structure
    const sampleDoc = await getDoc(doc(imagesRef, '001'));
    const hasProperStructure = sampleDoc.exists() && 
      Array.isArray(sampleDoc.data()?.assignedEvaluators) &&
      typeof sampleDoc.data()?.totalAssessments === 'number' &&
      typeof sampleDoc.data()?.prompt === 'string'; // Add prompt check

    return {
      initialized: hasProperStructure,
      imageCount: snapshot.size,
      properStructure: hasProperStructure,
      hasPrompts: sampleDoc.exists() && sampleDoc.data()?.prompt ? true : false
    };
  } catch (error) {
    console.error('Error checking initialization:', error);
    return {
      initialized: false,
      error: error.message
    };
  }
};

// Function to update prompts for existing images
export const updateImagePrompts = async () => {
  console.log('Starting prompt update...');
  let batch = writeBatch(db);
  let count = 0;
  
  try {
    const imagesRef = collection(db, 'images');
    const snapshot = await getDocs(imagesRef);
    
    for (const document of snapshot.docs) {
      if (count >= 400) {
        await batch.commit();
        batch = writeBatch(db);
        count = 0;
      }
      
      const imageId = document.id;
      batch.update(doc(imagesRef, imageId), {
        prompt: getDefaultPrompt(imageId)
      });
      
      count++;
    }

    if (count > 0) {
      await batch.commit();
    }
    
    console.log('Successfully updated image prompts');
    return true;
  } catch (error) {
    console.error('Error updating prompts:', error);
    throw error;
  }
};

export const clearAllData = async () => {
  console.log('Starting data clearance...');
  let batch = writeBatch(db);
  
  try {
    const collections = ['images', 'userProgress', 'assessmentHistory'];
    
    for (const collectionName of collections) {
      const collectionRef = collection(db, collectionName);
      const snapshot = await getDocs(collectionRef);
      
      let count = 0;
      for (const doc of snapshot.docs) {
        if (count >= 400) {
          await batch.commit();
          batch = writeBatch(db);
          count = 0;
        }
        
        batch.delete(doc.ref);
        count++;
      }
    }

    await batch.commit();
    console.log('Successfully cleared all data');
    return true;
  } catch (error) {
    console.error('Error clearing data:', error);
    throw error;
  }
};

export const verifyImages = async () => {
    try {
      const imagesRef = collection(db, 'images');
      const snapshot = await getDocs(imagesRef);
      
      console.log('Verifying images collection:', {
        totalCount: snapshot.size,
        isEmpty: snapshot.empty
      });
  
      if (snapshot.empty) {
        return {
          success: false,
          message: 'No images found'
        };
      }
  
      const sampleImages = snapshot.docs.slice(0, 5).map(doc => ({
        id: doc.id,
        data: doc.data()
      }));
  
      console.log('Sample images:', sampleImages);
  
      return {
        success: true,
        totalImages: snapshot.size,
        sampleImages,
        hasPrompts: sampleImages.every(img => typeof img.data.prompt === 'string')
      };
    } catch (error) {
      console.error('Error verifying images:', error);
      return {
        success: false,
        error: error.message
      };
    }
};