import { createServerFn } from "@tanstack/react-start";

export interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
}

/**
 * Firebase web config. The web API key is publishable, but it is stored as a
 * project secret, so it is handed to the browser from the server at runtime.
 */
export const getFirebaseConfig = createServerFn({ method: "GET" }).handler(
  async (): Promise<FirebaseWebConfig | null> => {
    const apiKey = process.env["GOOGLE_API_KEY"];
    if (!apiKey) return null;
    return {
      apiKey,
      authDomain: "habitpet-co.firebaseapp.com",
      projectId: "habitpet-co",
      storageBucket: "habitpet-co.firebasestorage.app",
      messagingSenderId: "300913221755",
      appId: "1:300913221755:web:e7efece18e3415eb92c2de",
      measurementId: process.env["GOOGLE_ANALYTICS_MEASUREMENT_ID"] || undefined,
    };
  },
);
