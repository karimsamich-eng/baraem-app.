import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, onSnapshot, query, where, orderBy, getDocFromServer, FirestoreError, enableMultiTabIndexedDbPersistence, increment } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Remove measurementId to prevent adblockers from blocking Firebase initialization
const { measurementId, ...safeConfig } = firebaseConfig as any;

// Initialize Firebase SDK
const app = initializeApp(safeConfig);
export const db = getFirestore(app, safeConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// Enable offline persistence
// enableMultiTabIndexedDbPersistence(db).catch((err) => {
//   if (err.code === 'failed-precondition') {
//     // Multiple tabs open, persistence can only be enabled in one tab at a time.
//     console.warn('Persistence failed-precondition');
//   } else if (err.code === 'unimplemented') {
//     // The current browser does not support all of the features required to enable persistence
//     console.warn('Persistence unimplemented');
//   }
// });

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Test connection to Firestore
async function testConnection() {
  try {
    console.log("Testing connection to Firestore database:", firebaseConfig.firestoreDatabaseId);
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firestore connection successful.");
  } catch (error) {
    if (error instanceof Error) {
      console.error("Firestore connection test failed with error:", error.message);
      if (error.message.includes('the client is offline')) {
        console.error("Please check your Firebase configuration. The client is offline.");
      } else if (error.message.includes('Missing or insufficient permissions')) {
        console.warn("Firestore connection test failed with permissions error. This is expected if the test path is not public.");
      }
    }
  }
}
testConnection();

export { 
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, onSnapshot, query, where, orderBy, increment
};
export type { FirestoreError };
