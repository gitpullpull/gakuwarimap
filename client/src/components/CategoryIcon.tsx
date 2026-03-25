import {
  Utensils, Coffee, ShoppingBag, Scissors, BookOpen,
  Dumbbell, Music, Film, Palette, Shirt,
  Heart, Sparkles, type LucideIcon
} from "lucide-react";
import { cn } from "@/lib/utils";

const ICON_MAP: Record<string, LucideIcon> = {
  utensils: Utensils,
  coffee: Coffee,
  shopping: ShoppingBag,
  scissors: Scissors,
  book: BookOpen,
  gym: Dumbbell,
  music: Music,
  film: Film,
  art: Palette,
  fashion: Shirt,
  health: Heart,
  beauty: Sparkles,
};

interface CategoryIconProps {
  icon: string;
  color?: string;
  size?: number;
  className?: string;
}

export function CategoryIcon({ icon, color, size = 20, className }: CategoryIconProps) {
  const IconComponent = ICON_MAP[icon] || Sparkles;
  return (
    <IconComponent
      size={size}
      className={cn("shrink-0", className)}
      style={color ? { color } : undefined}
    />
  );
}

export function getCategoryBgColor(color: string): string {
  const colorMap: Record<string, string> = {
    mint: "bg-memphis-mint/30",
    lilac: "bg-memphis-lilac/30",
    yellow: "bg-memphis-yellow/30",
    coral: "bg-memphis-coral/30",
    pink: "bg-memphis-pink/30",
    peach: "bg-memphis-peach/30",
  };
  return colorMap[color] || "bg-muted";
}
