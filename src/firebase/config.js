// src/firebase/config.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDQW5SID37wt3gQTvNcYVRFWFXv_DZjirI",
  authDomain: "c-image-survey.firebaseapp.com",
  projectId: "c-image-survey",
  storageBucket: "c-image-survey.firebasestorage.app",
  messagingSenderId: "866519610904",
  appId: "1:866519610904:web:aa5bb9e460c901ac53f56d",
  measurementId: "G-QG1N64DJBK"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage };