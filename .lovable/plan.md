# Move HabitPet onto Firebase (habitpet-co)

Firebase is now connected: the library is installed, your web settings are wired in, sign-in, Firestore, Storage and Analytics are ready to use. Nothing has moved yet — the app still runs on its current backend, so everything keeps working while we switch.

## Why this needs an order

Today every screen talks to the current backend through 19 server files, and every one of them checks "who is signed in?" using the current sign-in system. If sign-in moves first, all 19 break at once. If the data moves first, there is nothing to protect it with. So the switch happens in one coordinated cut-over, prepared in small safe steps beforehand.

## The steps

**Step 1 — Prepare (no visible change)**
- Write the Firestore data shapes for all 21 collections (profiles, pets, habits, habit completions, meal logs, activity logs, daily goals, daily reports, scan usage, subscriptions, shop items, inventory, coins, achievements, community feed, routines, routine messages, motivations, contact messages, AI corrections).
- Write Firestore security rules so each person can only read and write their own records, plus the read-only shared lists (shop items, achievements, community feed).
- Write Storage rules for meal photos.

**Step 2 — Sign-in**
- Add a Firebase sign-in provider: email + password and Google (Google must be switched on in your Firebase console).
- Keep the loading splash and the protected-page behaviour exactly as they are now.

**Step 3 — Data, feature by feature**
Each feature is converted and checked before the next one starts:
1. Profile and pet
2. Habits and completions
3. Meals, scan counts and photos
4. Nutrition, activity, daily goals and reports
5. Routine, motivation and coach history
6. Shop, coins, inventory, achievements, community
7. Subscriptions and the payment webhook

**Step 4 — Cut over**
Switch the app to Firebase, keep the old backend read-only for a short verification window, then retire it.

## What stays exactly the same

- All AI features (food scanning, coach, routine builder, motivation, meal and workout planners) keep running on the Lovable AI service. Untouched.
- The look, the yellow-and-black identity, the pet, the pages and the subscription plans.

## What I need from you

1. **A Firebase service-account key** (Firebase console → Project settings → Service accounts → Generate new private key). Needed so the app's server side and the payment webhook can write to Firestore. I'll ask for it securely when we reach Step 2 — don't paste it in chat.
2. **Google sign-in switched on** in Firebase console → Authentication → Sign-in method.
3. Confirmation that you have **no existing users or data in Firebase** to preserve (you said none earlier), so we start clean and copy your current data across at Step 4.

## Technical notes

- Browser: `src/integrations/firebase/client.ts` lazily initialises app/auth/firestore/storage; the web API key is served from the stored secret via `src/lib/firebase-config.functions.ts` (the key is publishable, but not hard-coded).
- Server side runs on Cloudflare Workers, where the standard `firebase-admin` package does not work. Server writes will use the Firestore REST API with a service-account JWT signed via Web Crypto, or move to client-side Firestore calls guarded by security rules — chosen per feature.
- Reads/writes move from server functions to client-side Firestore where rules can enforce ownership; AI server functions stay server-side and keep `LOVABLE_API_KEY`.
