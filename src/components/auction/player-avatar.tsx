import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { monogram } from "@/lib/auction-ui";
import { cn } from "@/lib/utils";

const SIZE = {
  sm: "size-10 text-xs",
  md: "size-14 text-sm",
  lg: "size-24 text-xl sm:size-28 sm:text-2xl",
  xl: "size-32 text-2xl sm:size-40 sm:text-3xl",
} as const;

export function PlayerAvatar({
  name,
  imageUrl,
  size = "md",
  className,
  highlight,
  square = false,
}: {
  name: string;
  imageUrl?: string | null;
  size?: keyof typeof SIZE;
  className?: string;
  highlight?: boolean;
  /** Square frame for auction lot stage (AuctionBazi-style). */
  square?: boolean;
}) {
  return (
    <Avatar
      className={cn(
        SIZE[size],
        "bg-[#0a0d14] ring-1 ring-white/15",
        square && "rounded-md after:rounded-md",
        highlight && "ring-2 ring-primary shadow-[0_0_24px_rgba(245,158,11,0.35)]",
        className,
      )}
    >
      {imageUrl ? (
        <AvatarImage
          src={imageUrl}
          alt=""
          className={cn(square && "rounded-md")}
        />
      ) : null}
      <AvatarFallback
        className={cn(
          "bg-gradient-to-br from-[#1a2232] to-[#0a0d14] font-display font-bold tracking-[0.14em] text-foreground",
          square && "rounded-md",
        )}
      >
        {monogram(name)}
      </AvatarFallback>
    </Avatar>
  );
}
