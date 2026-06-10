import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager 
} from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBOzaAsS1MWLq6vU50PfOBD1xoIFflDa8E",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "gassistant-83242.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "gassistant-83242",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "gassistant-83242.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "997841212210",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:997841212210:web:ed242fa1d1db0b92587d2b"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});

export const storage = getStorage(app);
storage.maxUploadRetryTime = 10000; 

export const googleProvider = new GoogleAuthProvider();
