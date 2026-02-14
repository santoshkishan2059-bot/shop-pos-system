import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getFirestore, enableIndexedDbPersistence } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBSAU9tbT327b92UKXFV_7REzAH0iJQLNc",
  authDomain: "smart-pos-system-7eaa0.firebaseapp.com",
  projectId: "smart-pos-system-7eaa0",
  storageBucket: "smart-pos-system-7eaa0.appspot.com",
  messagingSenderId: "120796402477",
  appId: "1:120796402477:web:423237d132207a9549f9a4"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Firestore
export const db = getFirestore(app);

// Enable offline persistence
enableIndexedDbPersistence(db).catch(err => {
  console.warn("Offline persistence error:", err);
});
