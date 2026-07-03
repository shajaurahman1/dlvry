import { useRouter } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";

export function BackButton({ className = "" }: { className?: string }) {
  const router = useRouter();
  const onClick = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      window.history.back();
    } else {
      router.navigate({ to: "/" });
    }
  };
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Go back"
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-foreground shadow-soft transition hover:bg-accent ${className}`}
    >
      <ChevronLeft className="h-4 w-4" />
    </button>
  );
}
