import { cn } from "@/lib/utils";

export function DlvryLogo({
  className,
  tone = "dark",
}: {
  className?: string;
  tone?: "dark" | "light";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-baseline gap-[1px] font-black tracking-[-0.06em]",
        tone === "light" ? "text-background" : "text-foreground",
        className,
      )}
    >
      <span>DLVR</span>
      <span className="font-serif-italic font-normal text-[1.15em] leading-none translate-y-[0.05em]">
        y
      </span>
    </span>
  );
}
