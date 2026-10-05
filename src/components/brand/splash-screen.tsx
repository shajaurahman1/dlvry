import { useEffect, useState } from "react";
import { DlvryLogo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export function SplashScreen() {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const timeout = window.setTimeout(() => setVisible(false), 1400);
    return () => window.clearTimeout(timeout);
  }, []);
  if (!visible) return null;
  return (
    <div className="moveby-splash" role="status" aria-label="MOVEBY is opening">
      <Button variant="ghost" className="splash-logo-button" aria-label="Open MOVEBY" onClick={() => setVisible(false)}>
        <DlvryLogo className="text-7xl" />
      </Button>
      <p className="mt-8 text-sm font-medium text-primary">Your neighbourhood. In motion.</p>
      <div className="splash-progress mt-8" aria-hidden="true"><span /></div>
    </div>
  );
}