import { TrendingUp } from 'lucide-react';

export default function Header() {
  return (
    <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-accent">
            <TrendingUp className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Hyperliquid Trade Analyzer</h1>
            <p className="text-xs text-muted-foreground">Analysieren Sie Ihre Handelsdaten</p>
          </div>
        </div>
      </div>
    </header>
  );
}
