import { cn } from "@/lib/utils";

const logoUrl =
  "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Moveby_Green_Wordmark_clean_transparent-04C71YTiCAuZshSwmXDO1kZFV7xRhC.png";

export function DlvryLogo({
  className,
  tone = "dark",
}: {
  className?: string;
  tone?: "dark" | "light";
}) {
  return (
    <span className={cn("moveby-logo inline-flex shrink-0 items-center", className)}>
      <img src={logoUrl} alt="MOVEBY" width={1920} height={579}
        className={cn("h-[1.35em] w-auto max-w-full object-contain", tone === "light" && "brightness-0 invert")} />
    </span>
  );
}
