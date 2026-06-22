import { initializeApp } from "firebase/app";
import {
  getAuth,
  RecaptchaVerifier,
  signInWithPhoneNumber
} from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDZGZBmqjtWqoUG2P1UtfqXu0IjSjbjVg0",
  authDomain: "mulhim-ai.firebaseapp.com",
  projectId: "mulhim-ai",
  storageBucket: "mulhim-ai.firebasestorage.app",
  messagingSenderId: "499682675869",
  appId: "1:499682675869:web:8211ba47f9e9e4fbd09874"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export { RecaptchaVerifier, signInWithPhoneNumber };
