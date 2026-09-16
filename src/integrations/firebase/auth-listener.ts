import { onAuthStateChanged, type Auth, type User } from "firebase/auth";

/**
 * Thin wrapper so the provider can lazily load firebase/auth without pulling
 * it into the initial bundle.
 */
export function onAuthStateChange(auth: Auth, cb: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, (user) => cb(user));
}
