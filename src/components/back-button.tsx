import { useRouter } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";

export function BackButton() {
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
      className="fixed left-4 top-4 z-50 inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card/90 text-foreground shadow-soft backdrop-blur transition hover:bg-accent"
    >
      <ChevronLeft className="h-4 w-4" />
    </button>
  );
}
