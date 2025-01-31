// src/utils/auth-utils.js
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase/config';

export const initializeAnonymousAuth = () => {
  return new Promise((resolve, reject) => {
    // First check if we already have a user
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe(); // Unsubscribe immediately after first check
      
      if (user) {
        resolve(user);
      } else {
        // No user, attempt anonymous sign in
        signInAnonymously(auth)
          .then(result => resolve(result.user))
          .catch(reject);
      }
    });
  });
};

export const setupAuthListener = (onUserChange) => {
  return onAuthStateChanged(auth, onUserChange);
};