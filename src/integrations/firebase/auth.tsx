import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { User } from "firebase/auth";
import { getFirebase } from "./client";

export interface FirebaseAuthState {
  /** null once resolved and signed out; undefined while still restoring. */
  user: User | null;
  loading: boolean;
  available: boolean;
}

const FirebaseAuthContext = createContext<FirebaseAuthState>({
  user: null,
  loading: true,
  available: false,
});

export function FirebaseAuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<FirebaseAuthState>({
    user: null,
    loading: true,
    available: false,
  });

  useEffect(() => {
    let unsub: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      const fb = await getFirebase();
      if (cancelled) return;
      if (!fb) {
        setState({ user: null, loading: false, available: false });
        return;
      }
      const { onAuthStateChange } = await import("./auth-listener");
      unsub = onAuthStateChange(fb.auth, (user) => {
        setState({ user, loading: false, available: true });
      });
    })();

    return () => {
      cancelled = true;
      unsub?.();
    };
  }, []);

  const value = useMemo(() => state, [state]);
  return <FirebaseAuthContext.Provider value={value}>{children}</FirebaseAuthContext.Provider>;
}

export function useFirebaseAuth(): FirebaseAuthState {
  return useContext(FirebaseAuthContext);
}

/** Email + password sign-up. */
export async function firebaseSignUp(email: string, password: string) {
  const fb = await requireFirebase();
  const { createUserWithEmailAndPassword } = await import("firebase/auth");
  return createUserWithEmailAndPassword(fb.auth, email, password);
}

/** Email + password sign-in. */
export async function firebaseSignIn(email: string, password: string) {
  const fb = await requireFirebase();
  const { signInWithEmailAndPassword } = await import("firebase/auth");
  return signInWithEmailAndPassword(fb.auth, email, password);
}

/** Google sign-in (enable Google in Firebase console → Authentication). */
export async function firebaseSignInWithGoogle() {
  const fb = await requireFirebase();
  const { GoogleAuthProvider, signInWithPopup } = await import("firebase/auth");
  return signInWithPopup(fb.auth, new GoogleAuthProvider());
}

export async function firebaseSignOut() {
  const fb = await requireFirebase();
  const { signOut } = await import("firebase/auth");
  await signOut(fb.auth);
}

export async function firebaseResetPassword(email: string) {
  const fb = await requireFirebase();
  const { sendPasswordResetEmail } = await import("firebase/auth");
  await sendPasswordResetEmail(fb.auth, email, {
    url: `${window.location.origin}/auth`,
  });
}

async function requireFirebase() {
  const fb = await getFirebase();
  if (!fb) throw new Error("Firebase is not configured for this environment.");
  return fb;
}
