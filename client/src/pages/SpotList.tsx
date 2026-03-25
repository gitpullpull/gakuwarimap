import { useMemo, useState } from "react";
import { useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import {
  buildSpotBrowseQueryInput,
  isSpotSortBy,
  SPOT_SORT_OPTIONS,
  type SpotSortBy,
} from "@/lib/spotSort";
import { SpotCard } from "@/components/SpotCard";
import { CategoryIcon, getCategoryBgColor } from "@/components/CategoryIcon";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChevronLeft,
  ChevronRight,
  MapPin,
  SlidersHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 12;

export default function SpotList() {
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const initialCategory = params.get("category");

  const [categoryId, setCategoryId] = useState<number | undefined>(
    initialCategory ? parseInt(initialCategory, 10) : undefined
  );
  const [sortBy, setSortBy] = useState<SpotSortBy>("newest");
  const [page, setPage] = useState(0);

  const { data: categoriesData } = trpc.category.list.useQuery();
  const categories = categoriesData ?? [];

  const { data, isLoading } = trpc.spot.list.useQuery(
    buildSpotBrowseQueryInput({
      categoryId,
      sortBy,
      page,
      pageSize: PAGE_SIZE,
    })
  );

  const spots = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const categoryMap = useMemo(() => {
    const map = new Map<number, (typeof categories)[0]>();
    categories.forEach((category) => map.set(category.id, category));
    return map;
  }, [categories]);

  return (
    <div className="min-h-screen pb-20 md:pb-8">
      <div className="container py-6">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-black uppercase tracking-tight sm:text-3xl">
            学割スポット一覧
          </h1>
          <span className="text-sm font-semibold text-muted-foreground">
            {total}件
          </span>
        </div>

        <div className="mb-6 flex flex-col gap-3 sm:flex-row">
          <div className="scrollbar-hide -mx-4 flex gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:px-0">
            <button
              onClick={() => {
                setCategoryId(undefined);
                setPage(0);
              }}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full border-2 border-foreground px-3 py-1.5 text-xs font-bold transition-all",
                "shadow-[2px_2px_0px_oklch(0.15_0.01_0)]",
                !categoryId
                  ? "bg-primary text-primary-foreground"
                  : "bg-card hover:bg-muted"
              )}
            >
              すべて
            </button>
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => {
                  setCategoryId(category.id);
                  setPage(0);
                }}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-full border-2 border-foreground px-3 py-1.5 text-xs font-bold transition-all",
                  "shadow-[2px_2px_0px_oklch(0.15_0.01_0)]",
                  categoryId === category.id
                    ? "bg-primary text-primary-foreground"
                    : cn(
                        "bg-card hover:bg-muted",
                        getCategoryBgColor(category.color)
                      )
                )}
              >
                <CategoryIcon icon={category.icon} size={14} />
                {category.name}
              </button>
            ))}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <SlidersHorizontal size={16} className="text-muted-foreground" />
            <Select
              value={sortBy}
              onValueChange={(value) => {
                if (!isSpotSortBy(value)) return;
                setSortBy(value);
                setPage(0);
              }}
            >
              <SelectTrigger className="h-9 w-[170px] rounded-lg border-2 border-foreground text-xs font-bold shadow-[2px_2px_0px_oklch(0.15_0.01_0)]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SPOT_SORT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-64 rounded-xl" />
            ))}
          </div>
        ) : spots.length === 0 ? (
          <div className="rounded-xl border-2 border-foreground bg-card py-16 text-center shadow-[4px_4px_0px_oklch(0.15_0.01_0)]">
            <MapPin size={48} className="mx-auto mb-3 text-muted-foreground/30" />
            <p className="font-medium text-muted-foreground">
              条件に合うスポットが見つかりません
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {spots.map((spot) => (
                <SpotCard
                  key={spot.id}
                  spot={spot}
                  category={categoryMap.get(spot.categoryId) ?? null}
                />
              ))}
            </div>

            {totalPages > 1 && (
              <div className="mt-8 flex items-center justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="memphis-btn"
                  disabled={page === 0}
                  onClick={() => setPage(page - 1)}
                >
                  <ChevronLeft size={16} />
                </Button>
                <span className="px-3 text-sm font-bold">
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
