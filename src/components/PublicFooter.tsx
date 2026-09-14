import { Link } from "@tanstack/react-router";
import { BrandMark } from "@/components/BrandMark";

export function PublicFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-foreground/10 bg-card/50 mt-16">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="grid gap-8 md:grid-cols-2">
          <div>
            <div className="flex items-center gap-2">
              <BrandMark className="h-8 w-8" />
              <span className="text-lg font-bold">HabitPet</span>
            </div>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">
              Build daily habits and grow a virtual pet from egg to legend.
            </p>
          </div>
          <nav className="grid grid-cols-2 gap-3 text-sm md:justify-end md:text-right">
            <Link to="/pricing" className="text-muted-foreground hover:text-foreground">Pricing</Link>
            <Link to="/contact" className="text-muted-foreground hover:text-foreground">Contact</Link>
            <Link to="/terms" className="text-muted-foreground hover:text-foreground">Terms of Service</Link>
            <Link to="/privacy" className="text-muted-foreground hover:text-foreground">Privacy Policy</Link>
            <Link to="/refund-policy" className="text-muted-foreground hover:text-foreground">Refund Policy</Link>
            <Link to="/auth" className="text-muted-foreground hover:text-foreground">Log in</Link>
          </nav>
        </div>
        <div className="mt-8 flex flex-col items-start justify-between gap-2 border-t border-foreground/5 pt-6 text-xs text-muted-foreground md:flex-row md:items-center">
          <p>© {year} SevenLabs. All rights reserved.</p>
          <p>support@habitpet.app</p>
        </div>
      </div>
    </footer>
  );
}

export function PublicNav() {
  return (
    <header className="border-b border-foreground/5 bg-card/40 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center gap-2 font-bold">
          <BrandMark className="h-8 w-8" />
          <span>HabitPet</span>
        </Link>
        <nav className="flex items-center gap-1 text-sm font-medium md:gap-2">
          <Link to="/" className="rounded-full px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground">Home</Link>
          <Link to="/pricing" className="rounded-full px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground">Pricing</Link>
          <Link to="/contact" className="hidden rounded-full px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground sm:inline">Contact</Link>
          <Link to="/auth" className="rounded-full px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground">Log in</Link>
          <Link
            to="/auth"
            className="ml-1 rounded-full bg-primary px-4 py-2 font-semibold text-primary-foreground shadow-card transition hover:-translate-y-0.5"
          >
            Sign up
          </Link>
        </nav>
      </div>
    </header>
  );
}
