import { cn } from "@/lib/utils";
import logoUrl from "@/assets/moveby-logo.png";

export function DlvryLogo({
  className,
  tone = "dark",
}: {
  className?: string;
  tone?: "dark" | "light";
}) {
  return (
    <span className={cn("moveby-logo inline-flex shrink-0 items-center", className)}>
      <img src={logoUrl} alt="MOVEBY" width={2000} height={603}
        className={cn("h-[1.35em] w-auto max-w-full object-contain", tone === "light" && "brightness-0 invert")} />
    </span>
  );
}
