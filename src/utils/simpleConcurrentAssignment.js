// src/utils/simpleConcurrentAssignment.js - Simple fix using existing working system with basic locking
import { 
    doc, 
    runTransaction, 
    serverTimestamp 
  } from 'firebase/firestore';
  import { db } from '../firebase/config';
  import { getBalancedImageAssignment } from './balancedImageAssignment';
  
  // Simple retry logic with your existing working assignment system
  export const getSimpleConcurrentAssignment = async (userId, totalImages = 10) => {
    const MAX_RETRIES = 3;
    let attempts = 0;
    
    while (attempts < MAX_RETRIES) {
      try {
        attempts++;
        console.log(`🔄 Assignment attempt ${attempts} for user ${userId}`);
        
        // Use a simple lock mechanism
        const lockResult = await attemptAssignmentWithLock(userId, totalImages);
        
        if (lockResult) {
          console.log(`✅ Successfully assigned images to ${userId} on attempt ${attempts}`);
          return lockResult;
        }
        
        // If lock failed, wait and retry
        const delay = 500 * attempts; // Increasing delay
        console.log(`⏳ Assignment locked, waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        
      } catch (error) {
        console.warn(`⚠️ Assignment attempt ${attempts} failed:`, error.message);
        
        if (attempts >= MAX_RETRIES) {
          console.error(`❌ All ${MAX_RETRIES} assignment attempts failed for ${userId}`);
          throw error;
        }
        
        // Wait before retry
        const delay = 1000 * attempts;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw new Error(`Assignment failed after ${MAX_RETRIES} attempts`);
  };
  
  async function attemptAssignmentWithLock(userId, totalImages) {
    return await runTransaction(db, async (transaction) => {
      // Simple lock mechanism
      const lockRef = doc(db, 'systemData', 'assignmentLock');
      const lockDoc = await transaction.get(lockRef);
      
      const now = Date.now();
      const lockTimeout = 30000; // 30 seconds
      
      // Check if lock exists and is not expired
      if (lockDoc.exists()) {
        const lockData = lockDoc.data();
        const lockAge = now - (lockData.timestamp || 0);
        
        if (lockAge < lockTimeout) {
          // Lock is active, can't proceed
          throw new Error('Assignment in progress by another user');
        }
      }
      
      // Acquire lock
      transaction.set(lockRef, {
        userId,
        timestamp: now,
        acquired: serverTimestamp()
      });
      
      try {
        // Use your existing working assignment system
        const assignedImages = await getBalancedImageAssignment(userId, totalImages);
        
        // Log successful assignment
        const logRef = doc(db, 'assignmentLogs', `${userId}_${now}`);
        transaction.set(logRef, {
          userId,
          assignedImages: assignedImages.map(img => img.id || img.name),
          timestamp: serverTimestamp(),
          method: 'simple_concurrent_with_lock'
        });
        
        // Release lock
        transaction.delete(lockRef);
        
        return assignedImages;
        
      } catch (error) {
        // Release lock on error
        transaction.delete(lockRef);
        throw error;
      }
    });
  }
  
  // Simple capacity check using existing system
  export const getSimpleConcurrentCapacity = async () => {
    try {
      // Import your existing capacity check
      const { checkAssignmentCapacity } = await import('./balancedImageAssignment');
      return await checkAssignmentCapacity();
    } catch (error) {
      console.error('Error checking simple concurrent capacity:', error);
      return { canAssign: false, reason: 'Error checking capacity' };
    }
  };
  
  // Fallback assignment function that uses your existing system
  export const getFallbackAssignment = async (userId, totalImages = 10) => {
    try {
      console.log(`🔄 Using fallback assignment for ${userId}`);
      
      // Use your existing working system directly
      const { getBalancedImageAssignment } = await import('./balancedImageAssignment');
      const assignedImages = await getBalancedImageAssignment(userId, totalImages);
      
      console.log(`✅ Fallback assignment successful: ${assignedImages.length} images`);
      return assignedImages;
      
    } catch (error) {
      console.error('❌ Fallback assignment failed:', error);
      throw error;
    }
  };