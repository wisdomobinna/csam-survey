// src/utils/simpleImageAssignment.js - Simple image assignment from Firebase Storage
import { getStorage, ref, getDownloadURL } from 'firebase/storage';
import { doc, setDoc, getDoc, updateDoc, arrayUnion, increment } from 'firebase/firestore';
import { db } from '../firebase/config';

const storage = getStorage();

// Get random numbers without replacement
const getRandomNumbers = (min, max, count) => {
  const numbers = [];
  const available = [];
  
  // Create array of available numbers
  for (let i = min; i <= max; i++) {
    available.push(i);
  }
  
  // Randomly select without replacement
  for (let i = 0; i < count && available.length > 0; i++) {
    const randomIndex = Math.floor(Math.random() * available.length);
    numbers.push(available.splice(randomIndex, 1)[0]);
  }
  
  return numbers;
};

// Assign images to a user
export const assignImagesToUser = async (userId) => {
  try {
    console.log('Assigning images to user:', userId);
    
    // Get 5 random images from set1 (1-1200) and 5 from set2 (1201-2400)
    const set1Numbers = getRandomNumbers(1, 1200, 5);
    const set2Numbers = getRandomNumbers(1201, 2400, 5);
    
    const allAssignedImages = [];
    
    // Process set1 images
    for (const num of set1Numbers) {
      const imageName = `${num}.png`;
      const imagePath = `set1/${imageName}`;
      
      try {
        // Get download URL to verify image exists
        const imageRef = ref(storage, imagePath);
        const downloadURL = await getDownloadURL(imageRef);
        
        const imageData = {
          imageId: `set1_${num}`,
          imageName: imageName,
          storagePath: imagePath,
          downloadURL: downloadURL,
          set: 'set1',
          number: num,
          assignedAt: new Date().toISOString(),
          completed: false
        };
        
        allAssignedImages.push(imageData);
        
        // Track image assignment in Firestore
        await trackImageAssignment(imageData.imageId, userId);
        
        console.log(`Assigned set1 image: ${imageName}`);
      } catch (error) {
        console.warn(`Failed to assign set1 image ${imageName}:`, error);
      }
    }
    
    // Process set2 images
    for (const num of set2Numbers) {
      const imageName = `${num}.png`;
      const imagePath = `set2/${imageName}`;
      
      try {
        // Get download URL to verify image exists
        const imageRef = ref(storage, imagePath);
        const downloadURL = await getDownloadURL(imageRef);
        
        const imageData = {
          imageId: `set2_${num}`,
          imageName: imageName,
          storagePath: imagePath,
          downloadURL: downloadURL,
          set: 'set2',
          number: num,
          assignedAt: new Date().toISOString(),
          completed: false
        };
        
        allAssignedImages.push(imageData);
        
        // Track image assignment in Firestore
        await trackImageAssignment(imageData.imageId, userId);
        
        console.log(`Assigned set2 image: ${imageName}`);
      } catch (error) {
        console.warn(`Failed to assign set2 image ${imageName}:`, error);
      }
    }
    
    console.log(`Successfully assigned ${allAssignedImages.length} images to user ${userId}`);
    return allAssignedImages;
    
  } catch (error) {
    console.error('Error in assignImagesToUser:', error);
    throw error;
  }
};

// Track which users have been assigned which images
const trackImageAssignment = async (imageId, userId) => {
  try {
    const imageTrackingRef = doc(db, 'imageTracking', imageId);
    const imageDoc = await getDoc(imageTrackingRef);
    
    if (imageDoc.exists()) {
      // Update existing tracking document
      await updateDoc(imageTrackingRef, {
        assignedUsers: arrayUnion(userId),
        assignmentCount: increment(1),
        lastAssigned: new Date().toISOString()
      });
    } else {
      // Create new tracking document
      await setDoc(imageTrackingRef, {
        imageId: imageId,
        assignedUsers: [userId],
        assignmentCount: 1,
        createdAt: new Date().toISOString(),
        lastAssigned: new Date().toISOString()
      });
    }
    
    console.log(`Tracked assignment of ${imageId} to ${userId}`);
  } catch (error) {
    console.error(`Error tracking image assignment for ${imageId}:`, error);
    // Don't throw - this is just tracking, shouldn't break image assignment
  }
};

// Get image data for display in survey
export const getImageData = async (imageId) => {
  try {
    // Parse imageId to get set and number (e.g., "set1_123" -> set: "set1", number: 123)
    const [set, numberStr] = imageId.split('_');
    const number = parseInt(numberStr);
    
    if (!set || !number) {
      throw new Error(`Invalid image ID format: ${imageId}`);
    }
    
    const imageName = `${number}.png`;
    const storagePath = `${set}/${imageName}`;
    
    // Get download URL
    const imageRef = ref(storage, storagePath);
    const downloadURL = await getDownloadURL(imageRef);
    
    return {
      imageId,
      imageName,
      storagePath,
      downloadURL,
      set,
      number
    };
    
  } catch (error) {
    console.error(`Error getting image data for ${imageId}:`, error);
    throw error;
  }
};

// Get assignment statistics for admin dashboard
export const getImageAssignmentStats = async () => {
  try {
    // This would require listing all documents in imageTracking collection
    // For now, return basic structure - you can enhance this later
    return {
      totalImagesInSet1: 1200,
      totalImagesInSet2: 1200,
      assignedImagesSet1: 0, // Would need to count from Firestore
      assignedImagesSet2: 0, // Would need to count from Firestore
      totalAssignments: 0     // Would need to count from Firestore
    };
  } catch (error) {
    console.error('Error getting image assignment stats:', error);
    throw error;
  }
};