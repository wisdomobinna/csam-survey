// src/utils/firebaseSetup.js
import { collection, doc, writeBatch, getDocs, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

export const initializeFirestore = async () => {
  try {
    // Check if already initialized
    const imagesSnapshot = await getDocs(collection(db, 'images'));
    const usersSnapshot = await getDocs(collection(db, 'loginIDs'));
    
    if (imagesSnapshot.size > 0 || usersSnapshot.size > 0) {
      console.log('Database already initialized');
      return false;
    }

    console.log('Starting Firestore initialization...');
    
    // Initialize in batches to avoid Firestore limits
    let batch = writeBatch(db);
    let operationCount = 0;
    
    // Create 1000 images
    for (let i = 1; i <= 1000; i++) {
      if (operationCount >= 400) {
        await batch.commit();
        batch = writeBatch(db);
        operationCount = 0;
      }
      
      const imageId = `img_${i.toString().padStart(4, '0')}`;
      const docRef = doc(db, 'images', imageId);
      
      // Create reference for Firebase Storage with the correct path format
      batch.set(docRef, {
        id: imageId,
        storagePath: `images/img_${i.toString().padStart(4, '0')}.jpeg`,  // Updated with folder
        url: `/images/img_${i.toString().padStart(4, '0')}.jpeg`,  // Update URL format to match
        index: i,
        createdAt: new Date(),
        fileExtension: '.jpeg'
      });
      
      operationCount++;
    }
    
    // Create 200 users with assigned images
    const alphabet = 'abcdefghijklmnopqrstuvwxyz';
    
    for (let i = 1; i <= 200; i++) {
      if (operationCount >= 400) {
        await batch.commit();
        batch = writeBatch(db);
        operationCount = 0;
      }
      
      const loginId = i.toString().padStart(4, '0');
      const password = alphabet[(i - 1) % 26] + loginId;
      
      // Calculate which 5 images this user should see
      const startIndex = (i - 1) * 5 + 1;
      const assignedImages = [];
      
      for (let j = 0; j < 5; j++) {
        const imageIndex = startIndex + j;
        if (imageIndex <= 1000) {  // Make sure we don't go over 1000
          assignedImages.push(`img_${imageIndex.toString().padStart(4, '0')}`);
        }
      }
      
      const userRef = doc(db, 'loginIDs', loginId);
      batch.set(userRef, {
        loginId: loginId,
        password: password,  // Note: In production, you should hash passwords
        assignedImages: assignedImages,
        completedImages: 0,
        surveyCompleted: false,
        createdAt: new Date()
      });
      
      operationCount++;
    }
    
    // Commit any remaining operations
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
    const usersRef = collection(db, 'loginIDs');
    
    const imagesSnapshot = await getDocs(imagesRef);
    const usersSnapshot = await getDocs(usersRef);
    
    return {
      initialized: imagesSnapshot.size > 0 && usersSnapshot.size > 0,
      imageCount: imagesSnapshot.size,
      userCount: usersSnapshot.size,
      expectedImages: 1000,
      expectedUsers: 200
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
    
    // Verify a sample user
    const userRef = doc(db, 'loginIDs', '0001');
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      return { success: false, message: 'Sample user not found' };
    }
    
    const userData = userDoc.data();
    const expectedPassword = 'a0001';
    
    return {
      success: true,
      status: status,
      sampleUser: {
        loginId: userData.loginId,
        assignedImages: userData.assignedImages,
        passwordCorrect: userData.password === expectedPassword
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
  console.log('Starting data clearance...');
  let batch = writeBatch(db);
  let operationCount = 0;
  
  try {
    // Clear images collection
    const imagesSnapshot = await getDocs(collection(db, 'images'));
    for (const doc of imagesSnapshot.docs) {
      if (operationCount >= 400) {
        await batch.commit();
        batch = writeBatch(db);
        operationCount = 0;
      }
      batch.delete(doc.ref);
      operationCount++;
    }
    
    // Clear loginIDs collection
    const usersSnapshot = await getDocs(collection(db, 'loginIDs'));
    for (const doc of usersSnapshot.docs) {
      if (operationCount >= 400) {
        await batch.commit();
        batch = writeBatch(db);
        operationCount = 0;
      }
      batch.delete(doc.ref);
      operationCount++;
    }
    
    // Clear assessments collection if it exists
    const assessmentsSnapshot = await getDocs(collection(db, 'assessments'));
    for (const doc of assessmentsSnapshot.docs) {
      if (operationCount >= 400) {
        await batch.commit();
        batch = writeBatch(db);
        operationCount = 0;
      }
      batch.delete(doc.ref);
      operationCount++;
    }
    
    await batch.commit();
    console.log('Successfully cleared all data');
    return true;
  } catch (error) {
    console.error('Error clearing data:', error);
    throw error;
  }
};