import { type ReactNode, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "motion/react";
import { supabase } from "@/integrations/supabase/client";
import { useReminders } from "@/lib/reminders";
import { useSubscription } from "@/hooks/useSubscription";
import { ProBadge } from "@/components/ProBadge";
import { ProNudges } from "@/components/ProNudges";
import {
  Home,
  ListChecks,
  Trophy,
  ShoppingBag,
  BarChart3,
  Users,
  Sparkles,
  Settings,
  LogOut,
  PawPrint,
  Menu,
  X,
  Shield,
  Utensils,
  Apple,
  Camera,
  CalendarHeart,
  Dumbbell,

  Image as ImageIcon,
} from "lucide-react";

interface NavItem {
  to: string;
  label: string;
  icon: typeof Home;
}

const NAV: NavItem[] = [
  { to: "/app", label: "Dashboard", icon: Home },
  { to: "/pet", label: "My Pet", icon: PawPrint },
  { to: "/habits", label: "Habits", icon: ListChecks },
  { to: "/food-scanner", label: "Scan Food", icon: Camera },
  { to: "/coach", label: "AI Coach", icon: Sparkles },
  { to: "/meal-planner", label: "Meal Planner", icon: CalendarHeart },
  { to: "/workout-planner", label: "Workout Plan", icon: Dumbbell },

  { to: "/food", label: "Food Log", icon: Utensils },
  { to: "/meal-history", label: "Meal History", icon: ImageIcon },
  { to: "/nutrition", label: "Nutrition", icon: Apple },
  { to: "/achievements", label: "Achievements", icon: Trophy },
  { to: "/shop", label: "Shop", icon: ShoppingBag },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/community", label: "Community", icon: Users },
  { to: "/pricing", label: "Premium", icon: Sparkles },
  { to: "/settings", label: "Settings", icon: Settings },
];

interface Props {
  children: ReactNode;
  title?: string;
  isAdmin?: boolean;
}

export function AppShell({ children, title, isAdmin }: Props) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);
  const { isPro } = useSubscription();
  useReminders();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const allNav = isAdmin ? [...NAV, { to: "/admin", label: "Admin", icon: Shield }] : NAV;

  return (
    <div className="min-h-dvh md:flex">
      {/* Sidebar — desktop */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-1 border-r border-border bg-surface/60 p-4 backdrop-blur-xl md:flex">
        <Link to="/app" className="mb-6 flex items-center gap-2 px-2 text-2xl font-extrabold">
          <span className="grid h-9 w-9 place-items-center rounded-2xl bg-[var(--gradient-primary)] text-lg shadow-glow">
            🐣
          </span>
          <span className="text-gradient">HabitPet</span>
          {isPro && <ProBadge className="ml-1" />}
        </Link>
        <nav className="flex-1 space-y-1 overflow-y-auto pr-1">
          {allNav.map(({ to, label, icon: Icon }) => {
            const active = pathname === to;
            return (
              <Link
                key={to}
                to={to}
                className={`group relative flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-bold transition ${
                  active ? "text-primary-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="sidebar-active"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    className="absolute inset-0 -z-10 rounded-2xl bg-[var(--gradient-primary)] shadow-glow"
                  />
                )}
                <Icon size={18} />
                {label}
              </Link>
            );
          })}
        </nav>
        <ProNudges />
        <button
          onClick={signOut}
          className="focus-ring flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-bold text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <LogOut size={18} /> Sign out
        </button>
      </aside>

      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-surface/70 px-4 py-3 backdrop-blur-xl md:hidden">
        <Link to="/app" className="flex items-center gap-2 text-lg font-extrabold">
          <span className="text-2xl">🐣</span> <span className="text-gradient">HabitPet</span>
        </Link>
        <button
          onClick={() => setMobileOpen(true)}
          className="focus-ring rounded-full border border-border p-2 backdrop-blur hover:bg-muted"
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-background/80 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 340, damping: 34 }}
              className="glass-strong absolute right-0 top-0 h-full w-72 overflow-y-auto p-4 shadow-pet"
            >
              <div className="mb-4 flex items-center justify-between">
                <span className="text-lg font-extrabold">Menu</span>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="focus-ring rounded-full p-2 hover:bg-muted"
                  aria-label="Close menu"
                >
                  <X size={20} />
                </button>
              </div>
              <nav className="space-y-1 pb-8">
                {allNav.map(({ to, label, icon: Icon }) => {
                  const active = pathname === to;
                  return (
                    <Link
                      key={to}
                      to={to}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-bold transition ${
                        active
                          ? "bg-[var(--gradient-primary)] text-primary-foreground shadow-glow"
                          : "text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      <Icon size={18} /> {label}
                    </Link>
                  );
                })}
                <button
                  onClick={signOut}
                  className="mt-4 flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-sm font-bold text-danger hover:bg-danger/10"
                >
                  <LogOut size={18} /> Sign out
                </button>
              </nav>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <main className="min-w-0 flex-1 px-4 py-6 pb-36 md:px-8 md:py-10 md:pb-10">
        {title && (
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="mb-6 text-3xl font-extrabold tracking-tight md:text-4xl"
          >
            {title}
          </motion.h1>
        )}
        {children}
      </main>

      <MobileCameraNav pathname={pathname} />
    </div>
  );
}

function MobileCameraNav({ pathname }: { pathname: string }) {
  const items = [
    { to: "/app", label: "Home", icon: Home },
    { to: "/habits", label: "Habits", icon: ListChecks },
    { to: "/coach", label: "Coach", icon: Sparkles },
    { to: "/pet", label: "Pet", icon: PawPrint },
  ] as const;

  const Item = ({ to, label, icon: Icon }: { to: string; label: string; icon: typeof Home }) => {
    const active = pathname === to;
    return (
      <Link
        to={to}
        className={`relative flex flex-1 flex-col items-center gap-0.5 rounded-2xl px-2 py-2 text-[10px] font-bold transition ${
          active ? "text-accent" : "text-muted-foreground"
        }`}
      >
        {active && (
          <motion.span
            layoutId="tab-glow"
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            className="absolute inset-0 -z-10 rounded-2xl bg-accent/12 shadow-[0_0_22px_-6px_var(--brand-cyan)]"
          />
        )}
        <motion.span whileTap={{ scale: 0.85 }} animate={active ? { y: -2 } : { y: 0 }}>
          <Icon size={20} />
        </motion.span>
        {label}
      </Link>
    );
  };

  return (
    <nav className="fixed inset-x-3 bottom-3 z-40 md:hidden">
      <div className="glass-strong flex items-end justify-around rounded-[2rem] px-2 pb-2 pt-1.5 shadow-pet">
        {items.slice(0, 2).map((i) => (
          <Item key={i.to} {...i} />
        ))}
        <div className="flex flex-1 justify-center">
          <Link
            to="/food-scanner"
            aria-label="Scan food"
            className="-mt-8 grid h-16 w-16 place-items-center rounded-full bg-[var(--gradient-primary)] text-primary-foreground shadow-glow ring-4 ring-background transition active:scale-95"
          >
            <motion.span animate={{ scale: [1, 1.08, 1] }} transition={{ duration: 2.4, repeat: Infinity }}>
              <Camera size={26} />
            </motion.span>
          </Link>
        </div>
        {items.slice(2).map((i) => (
          <Item key={i.to} {...i} />
        ))}
      </div>
    </nav>
  );
}
