/**
 * Firebase Configuration & Initialization
 * 
 * Propósito: Inicializar Firebase y exportar instancias de Firestore y Auth
 * 
 * Exports:
 * - db: Firestore database instance
 * - auth: Firebase Auth instance
 * - collection, addDoc, query, orderBy, onSnapshot, limit, where, getCountFromServer: Firebase helpers
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
    getFirestore,
    collection,
    addDoc,
    query,
    orderBy,
    onSnapshot,
    limit,
    where,
    getCountFromServer,
    doc,
    getDoc,
    setDoc,
    getDocs,
    deleteDoc,
    updateDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
    getAuth,
    GoogleAuthProvider,
    signInWithPopup,
    signOut,
    onAuthStateChanged,
    RecaptchaVerifier,
    signInWithPhoneNumber,
    PhoneAuthProvider
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyDiRY9xyTiQWeJuFCjU7CTBDWcJxDUcVVo",
    authDomain: "real-futbol-950e9.firebaseapp.com",
    projectId: "real-futbol-950e9",
    storageBucket: "real-futbol-950e9.firebasestorage.app",
    messagingSenderId: "997733956346",
    appId: "1:997733956346:web:af680c55a189c9114fe743",
    measurementId: "G-JNGMN81PHB"
};

// Initialize Firebase
const fbApp = initializeApp(firebaseConfig);
const db = getFirestore(fbApp);
const auth = getAuth(fbApp);

// Export database instance and Firestore helpers
export {
    db,
    auth,
    collection,
    addDoc,
    query,
    orderBy,
    onSnapshot,
    limit,
    where,
    getCountFromServer,
    doc,
    getDoc,
    setDoc,
    getDocs,
    deleteDoc,
    updateDoc,
    GoogleAuthProvider,
    signInWithPopup,
    signOut,
    onAuthStateChanged,
    RecaptchaVerifier,
    signInWithPhoneNumber,
    PhoneAuthProvider
};
