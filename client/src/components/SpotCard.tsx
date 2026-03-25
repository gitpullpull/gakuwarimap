import { Link } from "wouter";
import { MapPin, Tag, Star } from "lucide-react";
import { StarRating } from "./StarRating";
import { CategoryIcon, getCategoryBgColor } from "./CategoryIcon";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface SpotCardProps {
  spot: {
    id: number;
    name: string;
    address: string;
    discountDetail: string;
    discountRate?: string | null;
    avgRating?: number | null;
    reviewCount?: number | null;
    imageUrl?: string | null;
    categoryId: number;
    isVerified?: number | null;
  };
  category?: {
    name: string;
    icon: string;
    color: string;
  } | null;
  distance?: number | null;
}

export function SpotCard({ spot, category, distance }: SpotCardProps) {
  return (
    <Link href={`/spots/${spot.id}`}>
      <div className="memphis-card rounded-xl bg-card overflow-hidden group">
        {/* Image */}
        <div className="relative h-36 sm:h-40 bg-muted overflow-hidden">
          {spot.imageUrl ? (
            <img
              src={spot.imageUrl}
              alt={spot.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-memphis-mint/40 to-memphis-lilac/40">
              <MapPin size={40} className="text-foreground/20" />
            </div>
          )}
          {/* Discount badge */}
          {spot.discountRate && (
            <div className="absolute top-2 right-2">
              <Badge className="memphis-btn bg-memphis-yellow text-foreground border-foreground text-xs px-2 py-0.5">
                <Tag size={12} className="mr-1" />
                {spot.discountRate}
              </Badge>
            </div>
          )}
          {/* Verified badge */}
          {spot.isVerified === 1 && (
            <div className="absolute top-2 left-2">
              <Badge className="bg-memphis-mint text-foreground border-2 border-foreground text-xs px-2 py-0.5">
                認証済み
              </Badge>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-3 sm:p-4">
          {/* Category */}
          {category && (
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className={cn("inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full", getCategoryBgColor(category.color))}>
                <CategoryIcon icon={category.icon} size={12} />
                {category.name}
              </span>
            </div>
          )}

          {/* Name */}
          <h3 className="font-bold text-base leading-tight mb-1 line-clamp-1 group-hover:text-primary transition-colors">
            {spot.name}
          </h3>

          {/* Address */}
          <p className="text-xs text-muted-foreground flex items-center gap-1 mb-2 line-clamp-1">
            <MapPin size={12} className="shrink-0" />
            {spot.address}
            {distance != null && (
              <span className="ml-1 font-semibold text-primary">
                {distance < 1 ? `${Math.round(distance * 1000)}m` : `${distance.toFixed(1)}km`}
              </span>
            )}
          </p>

          {/* Discount detail */}
          <p className="text-sm font-medium text-foreground/80 line-clamp-2 mb-2">
            {spot.discountDetail}
          </p>

          {/* Rating */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <StarRating rating={spot.avgRating ?? 0} size={14} />
              <span className="text-xs font-semibold text-muted-foreground">
                {(spot.avgRating ?? 0).toFixed(1)}
              </span>
            </div>
            <span className="text-xs text-muted-foreground">
              {spot.reviewCount ?? 0}件のレビュー
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
