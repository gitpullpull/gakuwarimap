import { useState, useMemo } from "react";
import { useLocation, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { SpotCard } from "@/components/SpotCard";
import { CategoryIcon, getCategoryBgColor } from "@/components/CategoryIcon";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, SlidersHorizontal, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 12;

export default function SpotList() {
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const initialCategory = params.get("category");

  const [categoryId, setCategoryId] = useState<number | undefined>(
    initialCategory ? parseInt(initialCategory) : undefined
  );
  const [sortBy, setSortBy] = useState<"newest" | "rating" | "name">("newest");
  const [page, setPage] = useState(0);

  const { data: categoriesData } = trpc.category.list.useQuery();
  const categories = categoriesData ?? [];

  const { data, isLoading } = trpc.spot.list.useQuery({
    categoryId,
    sortBy,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  });

  const spots = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const categoryMap = useMemo(() => {
    const map = new Map<number, (typeof categories)[0]>();
    categories.forEach((c) => map.set(c.id, c));
    return map;
  }, [categories]);

  return (
    <div className="min-h-screen pb-20 md:pb-8">
      <div className="container py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight">
            学割スポット一覧
          </h1>
          <span className="text-sm text-muted-foreground font-semibold">
            {total}件
          </span>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          {/* Category filter */}
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap scrollbar-hide">
            <button
              onClick={() => { setCategoryId(undefined); setPage(0); }}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full border-2 border-foreground text-xs font-bold shrink-0 transition-all",
                "shadow-[2px_2px_0px_oklch(0.15_0.01_0)]",
                !categoryId ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted"
              )}
            >
              すべて
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => { setCategoryId(cat.id); setPage(0); }}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full border-2 border-foreground text-xs font-bold shrink-0 transition-all",
                  "shadow-[2px_2px_0px_oklch(0.15_0.01_0)]",
                  categoryId === cat.id ? "bg-primary text-primary-foreground" : cn("bg-card hover:bg-muted", getCategoryBgColor(cat.color))
                )}
              >
                <CategoryIcon icon={cat.icon} size={14} />
                {cat.name}
              </button>
            ))}
          </div>

          {/* Sort */}
          <div className="flex items-center gap-2 shrink-0">
            <SlidersHorizontal size={16} className="text-muted-foreground" />
            <Select value={sortBy} onValueChange={(v) => { setSortBy(v as any); setPage(0); }}>
              <SelectTrigger className="w-[140px] h-9 border-2 border-foreground rounded-lg text-xs font-bold shadow-[2px_2px_0px_oklch(0.15_0.01_0)]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">新着順</SelectItem>
                <SelectItem value="rating">評価順</SelectItem>
                <SelectItem value="name">名前順</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-64 rounded-xl" />
            ))}
          </div>
        ) : spots.length === 0 ? (
          <div className="text-center py-16 bg-card rounded-xl border-2 border-foreground shadow-[4px_4px_0px_oklch(0.15_0.01_0)]">
            <MapPin size={48} className="mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground font-medium">該当するスポットが見つかりません</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {spots.map((spot) => (
                <SpotCard
                  key={spot.id}
                  spot={spot}
                  category={categoryMap.get(spot.categoryId) ?? null}
                />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <Button
                  variant="outline"
                  size="sm"
                  className="memphis-btn"
                  disabled={page === 0}
                  onClick={() => setPage(page - 1)}
                >
                  <ChevronLeft size={16} />
                </Button>
                <span className="text-sm font-bold px-3">
                  {page + 1} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="memphis-btn"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage(page + 1)}
                >
                  <ChevronRight size={16} />
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
