// Configuration Firebase de KISUSI COMPANY.
// Valeurs à copier depuis la console Firebase (voir FIREBASE.md) :
// Paramètres du projet → Général → Vos applications → Configuration du SDK.
// Tant que `apiKey` est vide, la section « Actualités » reste masquée.
export const firebaseConfig = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: '',
};

// Paramètres du projet → Cloud Messaging → Certificats Web Push → « Paire de clés ».
export const vapidKey = '';

// Version de Firebase chargée depuis le CDN de Google.
export const FIREBASE_VERSION = '12.19.0';

export const isConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
