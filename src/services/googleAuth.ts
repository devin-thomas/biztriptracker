import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  Auth,
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut,
} from 'firebase/auth';
import { firebaseConfig, isFirebaseConfigured } from './firebaseConfig.js';

const GOOGLE_CONFIG_ERROR = 'Google Sheets integration is not configured for this deployment.';
let authInstance: Auth | null = null;

const getFirebaseAuth = (): Auth => {
  if (!isFirebaseConfigured()) {
    throw new Error(GOOGLE_CONFIG_ERROR);
  }

  if (!authInstance) {
    const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    authInstance = getAuth(app);
  }

  return authInstance;
};

const provider = new GoogleAuthProvider();
// Add Sheets scope requested by user
provider.addScope('https://www.googleapis.com/auth/spreadsheets');

let isSigningIn = false;
let cachedAccessToken: string | null = null;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  if (!isFirebaseConfigured()) {
    onAuthFailure?.();
    return () => undefined;
  }

  return onAuthStateChanged(getFirebaseAuth(), async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(getFirebaseAuth(), provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to obtain Google OAuth access token.');
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: unknown) {
    if (!(error instanceof Error) || error.message !== GOOGLE_CONFIG_ERROR) {
      console.error('Sign in error:', error);
    }
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const logout = async () => {
  if (isFirebaseConfigured()) {
    await signOut(getFirebaseAuth());
  }
  cachedAccessToken = null;
};
