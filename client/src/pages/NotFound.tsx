import { Zap } from "lucide-react";
import { useLocation } from "wouter";

export default function NotFound() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="flex justify-center mb-6">
          <Zap className="w-12 h-12 text-cyan" />
        </div>
        <h1 className="text-6xl font-bold font-mono text-foreground mb-2">404</h1>
        <p className="text-sm font-mono text-muted-foreground uppercase tracking-wider mb-8">
          Signal not found
        </p>
        <button
          onClick={() => setLocation("/")}
          className="px-8 py-3 bg-primary text-primary-foreground font-bold text-sm uppercase tracking-wider hover:opacity-90 transition-opacity"
        >
          Return to Dashboard
        </button>
      </div>
    </div>
  );
}
