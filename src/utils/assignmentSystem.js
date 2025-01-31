// src/utils/assignmentSystem.js
import { collection, getDocs, doc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase/config';

export const createBalancedAssignments = async () => {
  try {
    // Get all evaluators
    const evaluatorsSnapshot = await getDocs(collection(db, 'loginIDs'));
    const totalEvaluators = evaluatorsSnapshot.size;

    // Get all images
    const imagesSnapshot = await getDocs(collection(db, 'images'));
    const totalImages = imagesSnapshot.size;
    
    console.log(`Creating assignments for ${totalEvaluators} evaluators and ${totalImages} images`);

    if (totalImages * 12 < totalEvaluators * 12) {
      throw new Error(`Not enough image slots available. Need ${totalEvaluators * 12} slots but only have ${totalImages * 12} slots.`);
    }

    const batch = writeBatch(db);
    const evaluators = evaluatorsSnapshot.docs.map(doc => doc.id);
    const images = imagesSnapshot.docs.map(doc => doc.id);

    // Create an array of all available slots
    let availableSlots = [];
    for (let img of images) {
      for (let i = 0; i < 12; i++) { // Each image can be evaluated 12 times
        availableSlots.push(img);
      }
    }

    // Shuffle the slots randomly
    availableSlots = availableSlots.sort(() => Math.random() - 0.5);

    // Assign 12 unique images to each evaluator
    for (let evaluator of evaluators) {
      const evaluatorImages = new Set();
      let attempts = 0;
      const maxAttempts = 1000; // Prevent infinite loops

      while (evaluatorImages.size < 12 && attempts < maxAttempts && availableSlots.length > 0) {
        const randomIndex = Math.floor(Math.random() * availableSlots.length);
        const image = availableSlots[randomIndex];

        if (!evaluatorImages.has(image)) {
          evaluatorImages.add(image);
          availableSlots.splice(randomIndex, 1);
        }
        attempts++;
      }

      if (evaluatorImages.size < 12) {
        throw new Error(`Could not assign enough unique images to evaluator ${evaluator}`);
      }

      // Update user progress document
      const progressRef = doc(db, 'userProgress', evaluator);
      batch.set(progressRef, {
        assignedBatch: Array.from(evaluatorImages),
        progress: 0,
        completedImages: {}
      }, { merge: true });

      // Update image documents to record assignments
      for (const imageId of evaluatorImages) {
        const imageRef = doc(db, 'images', imageId);
        batch.update(imageRef, {
          assignedEvaluators: evaluator
        });
      }
    }

    await batch.commit();
    console.log('Successfully created balanced assignments');
    return true;
  } catch (error) {
    console.error('Error creating balanced assignments:', error);
    throw error;
  }
};

// In assignmentSystem.js
export const clearAllAssignments = async () => {
  console.log('Starting assignment clearance...');
  let batch = writeBatch(db);
  let operationCount = 0;
  
  try {
    // Clear userProgress collection
    const userProgressSnapshot = await getDocs(collection(db, 'userProgress'));
    for (const doc of userProgressSnapshot.docs) {
      if (operationCount >= 400) {
        await batch.commit();
        batch = writeBatch(db);
        operationCount = 0;
      }
      
      batch.delete(doc.ref);
      operationCount++;
    }

    // Reset image assignments and counters
    const imagesSnapshot = await getDocs(collection(db, 'images'));
    for (const doc of imagesSnapshot.docs) {
      if (operationCount >= 400) {
        await batch.commit();
        batch = writeBatch(db);
        operationCount = 0;
      }
      
      batch.update(doc.ref, {
        totalAssessments: 0,
        assignedEvaluators: [],
        assignedCount: 0
      });
      operationCount++;
    }

    // Clear assessment history
    const historySnapshot = await getDocs(collection(db, 'assessmentHistory'));
    for (const doc of historySnapshot.docs) {
      if (operationCount >= 400) {
        await batch.commit();
        batch = writeBatch(db);
        operationCount = 0;
      }
      
      batch.delete(doc.ref);
      operationCount++;
    }
    
    // Reset user progress in users collection
    const usersSnapshot = await getDocs(collection(db, 'users'));
    for (const doc of usersSnapshot.docs) {
      if (operationCount >= 400) {
        await batch.commit();
        batch = writeBatch(db);
        operationCount = 0;
      }
      
      if (doc.id !== 'ADMIN') {
        batch.update(doc.ref, {
          progress: 0,
          completedImages: {}
        });
        operationCount++;
      }
    }
    
    // Commit any remaining operations
    if (operationCount > 0) {
      await batch.commit();
    }
    
    console.log('Successfully cleared all assignments');
    return true;
  } catch (error) {
    console.error('Error in clearAllAssignments:', error);
    throw error;
  }
};