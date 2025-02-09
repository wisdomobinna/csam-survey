// src/utils/auth-utils.js
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase/config';

export const initializeAnonymousAuth = () => {
  return new Promise((resolve, reject) => {
    let timeoutId;
    
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      clearTimeout(timeoutId);
      unsubscribe();
      
      if (user) {
        resolve(user);
      } else {
        // No user, attempt anonymous sign in
        signInAnonymously(auth)
          .then(result => resolve(result.user))
          .catch(reject);
      }
    });

    // Add timeout to prevent hanging
    timeoutId = setTimeout(() => {
      unsubscribe();
      reject(new Error('Auth initialization timeout'));
    }, 10000); // 10 second timeout
  });
};

export const setupAuthListener = (onUserChange) => {
  const unsubscribe = onAuthStateChanged(auth, (user) => {
    // Add additional validation if needed
    if (user && !sessionStorage.getItem('userLoginId')) {
      // Invalid state - user exists but no login ID
      auth.signOut();
      return;
    }
    onUserChange(user);
  });

  return unsubscribe;
};