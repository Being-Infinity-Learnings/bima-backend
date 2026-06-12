// Authentication context for the dashboard.
//
// Handles Firebase Phone Auth (OTP) flow, backend profile lookup, and role-based access.
import { createContext, useContext, useEffect, useRef, useState } from "react";
import {
  signOut,
  onAuthStateChanged,
  PhoneAuthProvider,
  signInWithCredential,
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

  // While verifyOtp() is in flight, ALL onAuthStateChanged firings are ignored.
  // Firebase can fire the listener multiple times during phone sign-in; we let
  // verifyOtp be the sole owner of state during that window.
  const verifyingOtp = useRef(false);

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
        return null;
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
      // Block every listener fire while verifyOtp() owns the flow.
      if (verifyingOtp.current) {
        setLoading(false);
        return;
      }

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

  async function sendOtp(phoneNumber, appVerifier) {
    setError(null);
    const provider = new PhoneAuthProvider(auth);
    const verificationId = await provider.verifyPhoneNumber(
      phoneNumber,
      appVerifier,
    );
    return verificationId;
  }

  async function verifyOtp(verificationId, otp) {
    setError(null);

    // Lock out the auth listener for the entire duration of this function.
    verifyingOtp.current = true;
    try {
      const credential = PhoneAuthProvider.credential(verificationId, otp);
      const cred = await signInWithCredential(auth, credential);
      setFirebaseUser(cred.user);

      const fetchedProfile = await fetchProfile();
      const isNewUser = fetchedProfile === null;
      return { isNewUser, profile: fetchedProfile };
    } finally {
      // Always release the lock, even if an error is thrown.
      verifyingOtp.current = false;
    }
  }

  async function completeSignup(profileInput) {
    setError(null);
    await authApi.registerProfile(profileInput);
    const fetchedProfile = await fetchProfile();
    return fetchedProfile;
  }

  async function logout() {
    await signOut(auth);
    setProfile(null);
    setError(null);
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
        sendOtp,
        verifyOtp,
        completeSignup,
        logout,
        refetchProfile: fetchProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
