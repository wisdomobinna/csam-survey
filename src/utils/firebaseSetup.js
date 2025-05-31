// src/utils/firebaseSetup.js - Fixed image assignment for set1/set2 structure
import { collection, doc, getDoc, setDoc, updateDoc, arrayUnion, runTransaction, getDocs, deleteDoc } from 'firebase/firestore';
import { ref, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase/config';

// Track image assignment counts (max 5 per image)
const MAX_ASSIGNMENTS_PER_IMAGE = 5;

// Get available images from a set that haven't reached max assignments
const getAvailableImagesFromSet = async (setName, count) => {
  try {
    console.log(`Getting ${count} available images from ${setName}`);
    
    const availableImages = [];
    const setStart = setName === 'set1' ? 1 : 1201;
    const setEnd = setName === 'set1' ? 1200 : 2400;
    
    // Get current assignment counts
    const assignmentRef = doc(db, 'imageAssignments', setName);
    const assignmentDoc = await getDoc(assignmentRef);
    const assignments = assignmentDoc.exists() ? assignmentDoc.data() : {};
    
    // Create list of available images (those with < 5 assignments)
    const imagePool = [];
    for (let i = setStart; i <= setEnd; i++) {
      const imageName = `${i}.png`;
      const assignmentCount = assignments[imageName] || 0;
      
      if (assignmentCount < MAX_ASSIGNMENTS_PER_IMAGE) {
        imagePool.push({
          name: imageName,
          set: setName,
          path: `${setName}/${imageName}`,
          assignmentCount
        });
      }
    }
    
    console.log(`Found ${imagePool.length} available images in ${setName}`);
    
    if (imagePool.length < count) {
      console.warn(`Only ${imagePool.length} available images in ${setName}, but ${count} requested`);
    }
    
    // Randomly select images, prioritizing those with fewer assignments
    const shuffled = imagePool.sort((a, b) => {
      // First sort by assignment count (ascending), then randomly
      if (a.assignmentCount !== b.assignmentCount) {
        return a.assignmentCount - b.assignmentCount;
      }
      return Math.random() - 0.5;
    });
    
    return shuffled.slice(0, count);
  } catch (error) {
    console.error(`Error getting available images from ${setName}:`, error);
    throw error;
  }
};

// Update assignment counts for selected images
const updateImageAssignments = async (selectedImages, userId) => {
  try {
    // Group images by set
    const imagesBySet = {
      set1: selectedImages.filter(img => img.set === 'set1'),
      set2: selectedImages.filter(img => img.set === 'set2')
    };
    
    // Update assignment counts for each set
    for (const [setName, images] of Object.entries(imagesBySet)) {
      if (images.length === 0) continue;
      
      const assignmentRef = doc(db, 'imageAssignments', setName);
      
      await runTransaction(db, async (transaction) => {
        const assignmentDoc = await transaction.get(assignmentRef);
        const currentAssignments = assignmentDoc.exists() ? assignmentDoc.data() : {};
        
        // Update counts and track user assignments
        const updates = { ...currentAssignments };
        
        images.forEach(image => {
          const imageName = image.name;
          updates[imageName] = (updates[imageName] || 0) + 1;
          
          // Track which users were assigned this image
          const userListKey = `${imageName}_users`;
          if (!updates[userListKey]) {
            updates[userListKey] = [];
          }
          updates[userListKey] = [...(updates[userListKey] || []), userId];
        });
        
        transaction.set(assignmentRef, updates);
      });
      
      console.log(`Updated assignments for ${images.length} images in ${setName}`);
    }
  } catch (error) {
    console.error('Error updating image assignments:', error);
    throw error;
  }
};

// Main function to assign images to a user
export const assignImagesToUser = async (userId) => {
  try {
    console.log(`Assigning images to user: ${userId}`);
    
    // Get 5 images from each set
    const [set1Images, set2Images] = await Promise.all([
      getAvailableImagesFromSet('set1', 5),
      getAvailableImagesFromSet('set2', 5)
    ]);
    
    const allSelectedImages = [...set1Images, ...set2Images];
    
    if (allSelectedImages.length < 10) {
      console.warn(`Only ${allSelectedImages.length} images available, expected 10`);
    }
    
    // Update assignment tracking
    await updateImageAssignments(allSelectedImages, userId);
    
    // Get download URLs for the selected images
    const imagesWithUrls = await Promise.all(
      allSelectedImages.map(async (image, index) => {
        try {
          const imageRef = ref(storage, image.path);
          const downloadURL = await getDownloadURL(imageRef);
          
          return {
            id: `${image.set}_${image.name.replace('.png', '')}`, // e.g., "set1_123"
            name: image.name, // e.g., "123.png"
            set: image.set,
            path: image.path, // e.g., "set1/123.png"
            url: downloadURL,
            index: index,
            assignmentCount: image.assignmentCount + 1 // After this assignment
          };
        } catch (error) {
          console.error(`Error getting URL for ${image.path}:`, error);
          return null;
        }
      })
    );
    
    // Filter out any failed URLs
    const validImages = imagesWithUrls.filter(img => img !== null);
    
    console.log(`Successfully assigned ${validImages.length} images to user ${userId}`);
    console.log('Assigned images:', validImages.map(img => ({ name: img.name, set: img.set, count: img.assignmentCount })));
    
    return validImages;
  } catch (error) {
    console.error('Error in assignImagesToUser:', error);
    throw error;
  }
};

// Get assignment statistics
export const getAssignmentStats = async () => {
  try {
    const [set1Doc, set2Doc] = await Promise.all([
      getDoc(doc(db, 'imageAssignments', 'set1')),
      getDoc(doc(db, 'imageAssignments', 'set2'))
    ]);
    
    const set1Data = set1Doc.exists() ? set1Doc.data() : {};
    const set2Data = set2Doc.exists() ? set2Doc.data() : {};
    
    // Count assignments for each set
    const countAssignments = (data) => {
      const counts = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      
      Object.entries(data).forEach(([key, value]) => {
        if (key.endsWith('.png') && typeof value === 'number') {
          counts[value] = (counts[value] || 0) + 1;
        }
      });
      
      return counts;
    };
    
    return {
      set1: countAssignments(set1Data),
      set2: countAssignments(set2Data),
      totalImages: {
        set1: 1200,
        set2: 1200
      }
    };
  } catch (error) {
    console.error('Error getting assignment stats:', error);
    throw error;
  }
};

// Reset assignments (admin function)
export const resetImageAssignments = async () => {
  try {
    console.log('Resetting all image assignments...');
    
    await Promise.all([
      setDoc(doc(db, 'imageAssignments', 'set1'), {}),
      setDoc(doc(db, 'imageAssignments', 'set2'), {})
    ]);
    
    console.log('Image assignments reset successfully');
  } catch (error) {
    console.error('Error resetting assignments:', error);
    throw error;
  }
};

// Verify Firebase setup and storage structure
export const verifySetup = async () => {
  try {
    console.log('Verifying Firebase setup...');
    
    // Test Firestore connection
    const testRef = doc(db, 'test', 'connection');
    await setDoc(testRef, { timestamp: new Date(), test: true });
    console.log('✓ Firestore connection working');
    
    // Test Storage access by checking a few sample images
    const testImages = [
      'set1/1.png',
      'set1/100.png', 
      'set2/1201.png',
      'set2/1300.png'
    ];
    
    const results = [];
    for (const imagePath of testImages) {
      try {
        const imageRef = ref(storage, imagePath);
        const url = await getDownloadURL(imageRef);
        results.push({ path: imagePath, status: 'success', url: url.substring(0, 50) + '...' });
        console.log(`✓ ${imagePath} accessible`);
      } catch (error) {
        results.push({ path: imagePath, status: 'error', error: error.message });
        console.log(`✗ ${imagePath} failed: ${error.message}`);
      }
    }
    
    // Check assignment collections
    const assignmentStats = await getAssignmentStats();
    
    return {
      success: true,
      firestore: 'connected',
      storage: results,
      assignments: assignmentStats,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('Setup verification failed:', error);
    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
};

// Clear all data (admin function - use with caution)
export const clearAllData = async () => {
  try {
    console.log('Clearing all data...');
    
    // Clear assignment tracking
    await resetImageAssignments();
    
    // Clear user data (except admin)
    const usersRef = collection(db, 'loginIDs');
    const usersSnapshot = await getDocs(usersRef);
    
    const deletePromises = [];
    usersSnapshot.forEach((userDoc) => {
      if (userDoc.id !== 'ADMIN') {
        deletePromises.push(deleteDoc(doc(db, 'loginIDs', userDoc.id)));
      }
    });
    
    await Promise.all(deletePromises);
    
    // Clear any test documents
    try {
      await deleteDoc(doc(db, 'test', 'connection'));
    } catch (error) {
      // Ignore if test doc doesn't exist
    }
    
    console.log('All data cleared successfully');
    return { success: true, message: 'All data cleared successfully' };
    
  } catch (error) {
    console.error('Error clearing data:', error);
    throw error;
  }
};