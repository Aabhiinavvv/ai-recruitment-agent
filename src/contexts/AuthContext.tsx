import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  onIdTokenChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase';

interface AuthContextValue {
  user: User | null;
  idToken: string | null;
  authReady: boolean;
  isSigningIn: boolean;
  authError: string | null;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState<boolean>(false);
  const [isSigningIn, setIsSigningIn] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          const token = await firebaseUser.getIdToken();
          setIdToken(token);
        } catch (err) {
          console.error('Failed to read auth token:', err);
          setIdToken(null);
        }
      } else {
        setIdToken(null);
      }
      setAuthReady(true);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    setIsSigningIn(true);
    setAuthError(null);
    try {
      const result = await signInWithPopup(auth, googleAuthProvider);
      const token = await result.user.getIdToken();
      setUser(result.user);
      setIdToken(token);
    } catch (err: any) {
      if (err?.code !== 'auth/popup-closed-by-user') {
        console.error('Sign-in error:', err);
        setAuthError('Sign-in could not be completed. Please try again.');
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  const signOutUser = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setIdToken(null);
    } catch (err) {
      console.error('Sign-out error:', err);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        idToken,
        authReady,
        isSigningIn,
        authError,
        signInWithGoogle,
        signOutUser,
        clearAuthError: () => setAuthError(null),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
