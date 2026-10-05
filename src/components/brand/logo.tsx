import { cn } from "@/lib/utils";
import logo from "@/assets/moveby-logo-transparent.png.asset.json";

export function DlvryLogo({
  className,
  tone = "dark",
}: {
  className?: string;
  tone?: "dark" | "light";
}) {
  return (
    <span className={cn("moveby-logo inline-flex shrink-0 items-center", className)}>
      <img src={logo.url} alt="MOVEBY" width={414} height={126}
        className={cn("h-[1.35em] w-auto max-w-full object-contain", tone === "light" && "brightness-0 invert")} />
    </span>
  );
}
