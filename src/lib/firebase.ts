import { initializeApp } from 'firebase/app';
import { initializeFirestore, getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  projectId: "gen-lang-client-0627587839",
  appId: "1:27809964491:web:3061c1a40a0996cc2b164e",
  apiKey: "AIzaSyAcruc1GgPaKqFIjcxHK9lTR1Lo_KvLzqc",
  authDomain: "gen-lang-client-0627587839.firebaseapp.com",
  storageBucket: "gen-lang-client-0627587839.firebasestorage.app",
  messagingSenderId: "27809964491"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore with specific database ID
const db = initializeFirestore(app, {}, "ai-studio-terminallabossim-41629ba1-1ec6-480b-9893-673a9aca228d");

// Initialize Firebase Auth
const auth = getAuth(app);

export { app, db, auth };
