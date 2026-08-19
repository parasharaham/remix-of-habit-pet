# Remix of Habit Pet

# PROJECT SPECIFICATION: THE HABIT STREAK TAMAGOTCHI (VIRTUAL PET HABIT TRACKER)

# TARGET ARCHITECTURE: Python FastAPI (Backend) + Flutter/Dart (Mobile Frontend) + PostgreSQL (Database)

You are an expert software architect and senior engineer. Your task is to build a complete, production-ready "Virtual Pet Habit Tracker" Micro-SaaS application using Python FastAPI for the backend and Flutter/Dart for the frontend. The system must include full database models, API routing, business logic, state management, and basic functional visual templates. Follow clean code principles, absolute type safety, and comprehensive error handling.

---

## SECTION 1: SYSTEM & DATABASE ARCHITECTURE (POSTGRESQL + SQLALCHEMY)

Create a highly scalable database schema using SQLAlchemy ORM. All tables must include standard audit fields (id, created_at, updated_at).

### 1. User & Wallet Table (`users`)

- id (UUID, Primary Key)

- email (String, Unique, Indexed)

- hashed_password (String)

- is_premium (Boolean, Default=False)

- stripe_customer_id (String, Nullable)

- created_at (DateTime, TZ=True)

### 2. Habit Table (`habits`)

- id (UUID, Primary Key)

- user_id (UUID, ForeignKey users.id)

- title (String, Max 100)

- frequency (Enum: 'daily', 'weekly')

- current_streak (Integer, Default=0)

- longest_streak (Integer, Default=0)

- last_completed_at (DateTime, TZ=True, Nullable)

- is_active (Boolean, Default=True)

### 3. Pet Ecosystem Table (`pets`)

- id (UUID, Primary Key)

- user_id (UUID, ForeignKey users.id, Unique)

- pet_name (String, Default='Tama')

- pet_stage (Enum: 'egg', 'baby', 'child', 'adult')

- health_points (Integer, Default=100, Min=0, Max=100)

- happiness_points (Integer, Default=100, Min=0, Max=100)

- total_experience_points (Integer, Default=0)

- current_level (Integer, Default=1)

- last_decay_checked_at (DateTime, TZ=True)

---

## SECTION 2: CORE MATHEMATICAL & BUSINESS ALGORITHMS (PYTHON)

Implement a robust service layer in Python to handle the Tamagotchi state engine, dynamic decay rates, and level-up loops.

### 1. The Dynamic Health & Happiness Decay Algorithm

Every 24 hours, if a user has active habits that are not completed, the pet's health and happiness decay.

- **Formula for Decay:**

  $Base\_Decay = 10 \text{ points}$

  $Total\_Active\_Habits = N$

  $Completed\_Habits = C$

  $Uncompleted\_Ratio = (N - C) / N$

  $Actual\_Health\_Decay = Base\_Decay \times Uncompleted\_Ratio \times 1.5$

  $Actual\_Happiness\_Decay = Base\_Decay \times Uncompleted\_Ratio \times 1.2$

### 2. The Experience & Evolution Logic

When a habit is checked off, the pet gains Experience Points (XP) and Happiness.

- **Habit Completion Reward:** +15 XP, +10 Happiness. If streak > 5 days, grant a 1.2x multiplier.

- **Level Up Requirement Formula:** $XP\_Needed = Current\_Level \times 100 \times 1.5$

- **Evolution Milestones:**

  - Level 1-3: 'egg'

  - Level 4-7: 'baby'

  - Level 8-15: 'child'

  - Level 16+: 'adult'

---

## SECTION 3: BACKEND API ENDPOINTS (FASTAPI)

Generate fully typed FastAPI routers with Pydantic schemas, dependency injection for database sessions, and JWT security tokens.

### 1. Habit Management Router (`/api/v1/habits`)

- `POST /create`: Create a new tracking habit.

- `GET /`: List all active habits for the authenticated user.

- `POST /{id}/complete`: Check off a habit, increment streaks, trigger the Pet Rewards calculation service, and return updated pet stats.

### 2. Pet Status Router (`/api/v1/pet`)

- `GET /status`: Fetch current pet name, stage, level, HP, Happiness, XP progress bar data, and execution state.

- `POST /rename`: Allow user to change pet name.

- `POST /sync-decay`: Background job endpoint triggered on login to compute health deductions since the user's last session using timestamp deltas.

---

## SECTION 4: MOBILE FRONTEND IMPLEMENTATION (FLUTTER/DART)

Generate a clean, professional, and visually engaging frontend architecture using Flutter. Use the `flutter_bloc` package for enterprise state management.

### 1. State Management Pattern (BLoC)

Create full BLoC files: `PetBloc`, `PetEvent`, and `PetState` to handle loading pet states, processing level-up animations, and optimistic UI rendering when habits are completed.

### 2. Visual Dashboards (UI Code)

- **The Tamagotchi Main View Screen:**

  - A clean top section displaying the Pet's Visual Representation based on its `pet_stage`.

  - Beautiful custom progress bars for **Health (HP)** (Green/Red color shift), **Happiness** (Yellow), and **XP Level Progress**.

  - Smooth animation triggers when the state updates.

- **The Habit Feed List:**

  - Scrollable view displaying active habits as punchy actionable cards.

  - A check-off button that triggers a celebratory haptic feedback action and immediately feeds data to the backend API.

---

## SECTION 5: STRUCTURAL INTEGRATION AND INSTRUCTIONS

1. **Step-by-Step Generation:** Generate the project files cleanly. Do not use placeholders or generic comments like `# write code here`.

2. **Robust Handling:** Include full data validations, explicit database transaction commits/rollbacks, global exception handling blocks, and clean JSON structural responses.

3. **Stripe Middleware Hook:** Provide an abstract Python decorator `require_premium_license` to protect advanced custom pet skins behind an ongoing active subscription model.

Begin executing the complete workflow, setting up schemas first, followed by backend business scripts, and completing with the interactive Flutter UI widgets.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/c1054df2-92f3-4722-aa75-74f211884103).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
