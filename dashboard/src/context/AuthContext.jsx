// Authentication context for the dashboard.
//
// Keeps Firebase auth state, loads the matching backend profile, and exposes login/signup/logout helpers.
import { createContext, useContext, useEffect, useState } from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
} from "firebase/auth";
import { auth } from "../config/firebase.config.js";
import { authApi } from "../services/api.service.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [error, setError] = useState(null);

  // Convert backend profile data into the shape this app expects.
  // Ensures the user role is uppercase and gracefully handles null values.
  function normalizeProfile(nextProfile) {
    if (!nextProfile) return null;
    return {
      ...nextProfile,
      role:
        typeof nextProfile.role === "string"
          ? nextProfile.role.toUpperCase()
          : null,
    };
  }

  // Load the current user's profile from the backend and store it in context.
  // Handles errors such as missing profile or forbidden access with friendly messages.
  async function fetchProfile() {
    setProfileLoading(true);
    try {
      const nextProfile = normalizeProfile(await authApi.getMyProfile());
      setProfile(nextProfile);
      setError(null);
      return nextProfile;
    } catch (err) {
      console.error("Failed to fetch profile", err);
      setProfile(null);

      if (err?.status === 404) {
        setError(
          "Your Firebase account exists, but no backend profile was found for it.",
        );
      } else if (err?.status === 403) {
        setError(
          err.message || "This account cannot access the admin backend.",
        );
      } else {
        setError(
          err?.message || "Failed to load your account from the backend.",
        );
      }

      return null;
    } finally {
      setProfileLoading(false);
    }
  }

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      setError(null);

      if (user) {
        await fetchProfile();
      } else {
        setProfile(null);
      }

      setLoading(false);
    });

    return unsub;
  }, []);

  // Sign in with Firebase credentials then fetch the admin profile from the backend.
  async function login(email, password) {
    setError(null);
    const cred = await signInWithEmailAndPassword(auth, email, password);
    await fetchProfile();
    return cred;
  }

  // Create a new Firebase user, register the backend admin profile, then refresh context.
  async function signup(email, password, profileInput) {
    setError(null);
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await authApi.registerProfile(profileInput);
    await fetchProfile();
    return cred;
  }

  // Sign the user out of Firebase and clear profile state.
  async function logout() {
    await signOut(auth);
    setProfile(null);
    setError(null);
  }

  // Trigger Firebase password reset email for the provided address.
  async function resetPassword(email) {
    await sendPasswordResetEmail(auth, email);
  }

  const role = profile?.role ?? null;

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        profile,
        role,
        loading,
        profileLoading,
        error,
        login,
        signup,
        logout,
        resetPassword,
        refetchProfile: fetchProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// Hook for consuming authentication state from any component.
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
