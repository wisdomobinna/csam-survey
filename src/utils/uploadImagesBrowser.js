// src/utils/uploadImagesBrowser.js
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { storage, db } from '../firebase/config';

// Import all images
// You need to create an index file for your images
const importAll = (r) => {
  let images = {};
  r.keys().forEach((item) => {
    images[item.replace('./', '')] = r(item);
  });
  return images;
};

// This will import all images from the images folder
const images = importAll(require.context('../images', false, /\.(png|jpe?g|svg)$/));

async function uploadImagesToBrowser() {
  try {
    console.log('Starting image upload...');
    const imageUrls = [];
    const imageEntries = Object.entries(images);
    
    for (let i = 0; i < imageEntries.length; i++) {
      const [fileName, imageSrc] = imageEntries[i];
      
      try {
        // Convert image to blob
        const response = await fetch(imageSrc);
        const blob = await response.blob();
        
        // Create storage reference
        const storageRef = ref(storage, `survey-images/${fileName}`);
        
        // Upload file
        const snapshot = await uploadBytes(storageRef, blob);
        
        // Get download URL
        const downloadURL = await getDownloadURL(snapshot.ref);
        
        // Store metadata in Firestore
        const imageDoc = {
          fileName: fileName,
          url: downloadURL,
          uploadedAt: serverTimestamp(),
          index: parseInt(fileName.split('.')[0]) || i
        };
        
        await setDoc(doc(db, 'images', fileName.split('.')[0]), imageDoc);
        
        imageUrls.push(imageDoc);
        console.log(`Uploaded: ${fileName} (${i + 1}/${imageEntries.length})`);
        
      } catch (error) {
        console.error(`Error uploading ${fileName}:`, error);
      }
    }
    
    // Save metadata
    await setDoc(doc(db, 'surveyMetadata', 'imageCollection'), {
      totalImages: imageUrls.length,
      lastUpdated: serverTimestamp(),
      images: imageUrls
    });
    
    console.log(`Successfully uploaded ${imageUrls.length} images`);
    return imageUrls;
    
  } catch (error) {
    console.error('Error in upload process:', error);
    throw error;
  }
}

export default uploadImagesToBrowser;