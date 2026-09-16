import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import { getFirebaseConfig, type FirebaseWebConfig } from "@/lib/firebase-config.functions";

export interface FirebaseServices {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  storage: FirebaseStorage;
  config: FirebaseWebConfig;
}

let servicesPromise: Promise<FirebaseServices | null> | undefined;

/**
 * Lazily initialises Firebase in the browser. Returns null when the Firebase
 * web API key has not been configured for this environment.
 */
export function getFirebase(): Promise<FirebaseServices | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (!servicesPromise) {
    servicesPromise = (async () => {
      const config = await getFirebaseConfig();
      if (!config) {
        console.warn("[Firebase] No web config available (GOOGLE_API_KEY missing).");
        return null;
      }
      const app = getApps()[0] ?? initializeApp(config);
      const services: FirebaseServices = {
        app,
        auth: getAuth(app),
        db: getFirestore(app),
        storage: getStorage(app),
        config,
      };
      void initAnalytics(app, config);
      return services;
    })();
  }
  return servicesPromise;
}

async function initAnalytics(app: FirebaseApp, config: FirebaseWebConfig) {
  if (!config.measurementId) return;
  try {
    const { getAnalytics, isSupported } = await import("firebase/analytics");
    if (await isSupported()) getAnalytics(app);
  } catch (error) {
    console.warn("[Firebase] Analytics unavailable", error);
  }
}
