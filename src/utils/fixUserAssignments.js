// src/utils/fixUserAssignments.js - Fix existing user assignments with better mapping
import { collection, getDocs, doc, updateDoc, getDoc } from 'firebase/firestore';
import { ref, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase/config';

// Mapping from old format names to new format
const createImageMapping = () => {
  const mapping = {};
  
  // You'll need to create a proper mapping based on your actual data
  // This is a placeholder - adjust according to your actual mapping needs
  
  // Example mapping pattern - adjust this based on your actual image names
  const oldFormatPatterns = [
    'safe_adults_0001', 'safe_adults_0002', 'safe_adults_0003', 'safe_adults_0004', 'safe_adults_0005',
    'safe_adults_0006', 'safe_adults_0007', 'safe_adults_0008', 'safe_adults_0009', 'safe_adults_0010',
    'safe_adults_0011', 'safe_adults_0012', 'safe_adults_0013', 'safe_adults_0014', 'safe_adults_0015',
    'safe_adults_0016', 'safe_adults_0017', 'safe_adults_0018', 'safe_adults_0019', 'safe_adults_0020'
  ];
  
  // Map to new format - this is just an example, adjust based on your needs
  oldFormatPatterns.forEach((oldName, index) => {
    const newImageNumber = index + 1; // Start from 1
    const imageSet = newImageNumber <= 1200 ? 'set1' : 'set2';
    const newImageName = `${newImageNumber}.png`;
    
    mapping[oldName] = {
      set: imageSet,
      name: newImageName,
      path: `${imageSet}/${newImageName}`,
      number: newImageNumber
    };
  });
  
  return mapping;
};

// Fix a single user's assignment data
const fixUserAssignment = async (userId, userData) => {
  try {
    console.log(`Fixing assignments for user: ${userId}`);
    
    const assignedImages = userData.assignedImages || [];
    
    if (assignedImages.length === 0) {
      console.log(`User ${userId} has no assigned images, skipping`);
      return { success: true, message: 'No images to fix' };
    }
    
    // Check if images are already in correct format
    const hasValidUrls = assignedImages.every(img => img.url && img.path && img.name && img.name.match(/^\d+\.png$/));
    if (hasValidUrls) {
      console.log(`User ${userId} already has valid image assignments`);
      return { success: true, message: 'Already fixed' };
    }
    
    console.log(`Fixing ${assignedImages.length} images for user ${userId}`);
    
    // Get the mapping for old format names
    const imageMapping = createImageMapping();
    
    // Fix each image assignment
    const fixedImages = await Promise.all(
      assignedImages.map(async (imageData, index) => {
        try {
          // If already has URL and proper path, keep as is
          if (imageData.url && imageData.path && imageData.name && imageData.name.match(/^\d+\.png$/)) {
            return imageData;
          }
          
          let imagePath;
          let imageName;
          let imageSet;
          let imageNumber;
          
          // Case 1: Old format names like "safe_adults_0019"
          if (imageData.name && imageData.name.includes('_')) {
            console.log(`Processing old format image: ${imageData.name}`);
            
            if (imageMapping[imageData.name]) {
              const mapped = imageMapping[imageData.name];
              imageSet = mapped.set;
              imageName = mapped.name;
              imagePath = mapped.path;
              imageNumber = mapped.number;
            } else {
              // Try to extract number from old format and guess mapping
              const numberMatch = imageData.name.match(/(\d+)$/);
              if (numberMatch) {
                imageNumber = parseInt(numberMatch[1]);
                imageSet = imageNumber <= 1200 ? 'set1' : 'set2';
                imageName = `${imageNumber}.png`;
                imagePath = `${imageSet}/${imageName}`;
                console.log(`Mapped ${imageData.name} to ${imagePath} (guessed)`);
              } else {
                throw new Error(`Cannot map old format image: ${imageData.name}`);
              }
            }
          }
          
          // Case 2: Image has numeric name like "123.png"
          else if (imageData.name && imageData.name.match(/^\d+\.png$/)) {
            imageNumber = parseInt(imageData.name.replace('.png', ''));
            imageSet = imageNumber <= 1200 ? 'set1' : 'set2';
            imageName = imageData.name;
            imagePath = `${imageSet}/${imageName}`;
          }
          
          // Case 3: Image has set and name properties
          else if (imageData.set && imageData.name) {
            imageSet = imageData.set;
            imageName = imageData.name;
            imagePath = `${imageSet}/${imageName}`;
            const nameMatch = imageName.match(/(\d+)/);
            imageNumber = nameMatch ? parseInt(nameMatch[1]) : null;
          }
          
          // Case 4: Image has path property
          else if (imageData.path) {
            imagePath = imageData.path;
            const pathParts = imagePath.split('/');
            imageSet = pathParts[0];
            imageName = pathParts[1];
            const nameMatch = imageName.match(/(\d+)/);
            imageNumber = nameMatch ? parseInt(nameMatch[1]) : null;
          }
          
          // Case 5: Image has ID in format "set1_123"
          else if (imageData.id && imageData.id.includes('_')) {
            const parts = imageData.id.split('_');
            if (parts.length >= 2) {
              imageSet = parts[0];
              imageNumber = parseInt(parts[1]);
              imageName = `${imageNumber}.png`;
              imagePath = `${imageSet}/${imageName}`;
            } else {
              throw new Error(`Invalid image ID format: ${imageData.id}`);
            }
          }
          
          else {
            throw new Error(`Cannot determine path for image: ${JSON.stringify(imageData)}`);
          }
          
          if (!imagePath) {
            throw new Error(`Could not construct image path from: ${JSON.stringify(imageData)}`);
          }
          
          console.log(`Constructed path: ${imagePath} for image:`, imageData);
          
          // Get download URL from Firebase Storage
          const imageRef = ref(storage, imagePath);
          const downloadURL = await getDownloadURL(imageRef);
          
          return {
            id: `${imageSet}_${imageNumber}`,
            name: imageName,
            set: imageSet,
            path: imagePath,
            url: downloadURL,
            index: index,
            assignmentCount: imageData.assignmentCount || 1,
            // Preserve any additional properties
            originalData: imageData
          };
          
        } catch (error) {
          console.error(`Error fixing image ${index} for user ${userId}:`, error);
          console.error('Image data:', imageData);
          return null;
        }
      })
    );
    
    // Filter out failed fixes
    const validFixedImages = fixedImages.filter(img => img !== null);
    
    if (validFixedImages.length === 0) {
      throw new Error('No images could be fixed - all image assignments failed');
    }
    
    if (validFixedImages.length < assignedImages.length) {
      console.warn(`Only ${validFixedImages.length}/${assignedImages.length} images could be fixed for user ${userId}`);
    }
    
    // Update user document
    const userRef = doc(db, 'loginIDs', userId);
    const updateData = {
      assignedImages: validFixedImages,
      lastUpdated: new Date(),
      imagesFix: 'applied',
      totalImages: validFixedImages.length
    };
    
    // If some images were completed, preserve that information
    if (userData.completedImages && userData.completedImageIds) {
      // Map old completed image IDs to new ones if possible
      const newCompletedIds = [];
      userData.completedImageIds.forEach(oldId => {
        const fixedImage = validFixedImages.find(img => 
          img.originalData?.name === oldId || 
          img.originalData?.id === oldId ||
          img.id === oldId ||
          img.name === oldId
        );
        if (fixedImage) {
          newCompletedIds.push(fixedImage.id);
        }
      });
      
      updateData.completedImageIds = newCompletedIds;
      updateData.completedImages = newCompletedIds.length;
    }
    
    await updateDoc(userRef, updateData);
    
    console.log(`Fixed ${validFixedImages.length}/${assignedImages.length} images for user ${userId}`);
    
    return {
      success: true,
      message: `Fixed ${validFixedImages.length}/${assignedImages.length} images`,
      fixedCount: validFixedImages.length,
      totalCount: assignedImages.length,
      failedCount: assignedImages.length - validFixedImages.length
    };
    
  } catch (error) {
    console.error(`Error fixing user ${userId}:`, error);
    return {
      success: false,
      message: error.message,
      error: error
    };
  }
};

// Fix all users in the database
export const fixAllUserAssignments = async () => {
  try {
    console.log('Starting to fix all user assignments...');
    
    const usersRef = collection(db, 'loginIDs');
    const usersSnapshot = await getDocs(usersRef);
    
    console.log(`Found ${usersSnapshot.size} users to check`);
    
    const results = [];
    let processedCount = 0;
    
    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      const userData = userDoc.data();
      
      // Skip admin users
      if (userId === 'ADMIN') {
        continue;
      }
      
      processedCount++;
      console.log(`Processing user ${processedCount}/${usersSnapshot.size - 1}: ${userId}`);
      
      const result = await fixUserAssignment(userId, userData);
      results.push({
        userId,
        ...result
      });
      
      // Add small delay to avoid overwhelming Firebase
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Summary
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    const alreadyFixed = successful.filter(r => r.message === 'Already fixed');
    const actuallyFixed = successful.filter(r => r.message !== 'Already fixed' && r.message !== 'No images to fix');
    
    console.log('Fix completed:');
    console.log(`- Total processed: ${results.length}`);
    console.log(`- Successfully fixed: ${actuallyFixed.length}`);
    console.log(`- Already fixed: ${alreadyFixed.length}`);
    console.log(`- Failed: ${failed.length}`);
    
    if (failed.length > 0) {
      console.log('Failed users:', failed.map(f => ({ userId: f.userId, error: f.message })));
    }
    
    return {
      total: results.length,
      successful: successful.length,
      actuallyFixed: actuallyFixed.length,
      alreadyFixed: alreadyFixed.length,
      failed: failed.length,
      results
    };
    
  } catch (error) {
    console.error('Error in fixAllUserAssignments:', error);
    throw error;
  }
};

// Fix specific user (useful for testing)
export const fixSingleUser = async (userId) => {
  try {
    const userRef = doc(db, 'loginIDs', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      throw new Error(`User ${userId} not found`);
    }
    
    return await fixUserAssignment(userId, userDoc.data());
  } catch (error) {
    console.error(`Error fixing single user ${userId}:`, error);
    throw error;
  }
};

// Helper function to manually create image assignments for problematic users
export const reassignUserImages = async (userId, forceReassign = false) => {
  try {
    const { assignImagesToUser } = await import('./firebaseSetup');
    
    // Get user data
    const userRef = doc(db, 'loginIDs', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      throw new Error(`User ${userId} not found`);
    }
    
    const userData = userDoc.data();
    
    if (!forceReassign && userData.assignedImages && userData.assignedImages.length > 0) {
      throw new Error('User already has assigned images. Use forceReassign=true to override.');
    }
    
    // Assign new images
    const newImages = await assignImagesToUser(userId);
    
    console.log(`Reassigned ${newImages.length} images to user ${userId}`);
    
    return {
      success: true,
      message: `Reassigned ${newImages.length} images`,
      assignedImages: newImages
    };
    
  } catch (error) {
    console.error(`Error reassigning images for user ${userId}:`, error);
    throw error;
  }
};