import { useEffect, useMemo, useState } from "react";
import { useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import {
  buildSpotSearchQueryInput,
  isSpotSortBy,
  SPOT_SORT_OPTIONS,
  type SpotSortBy,
} from "@/lib/spotSort";
import { SpotCard } from "@/components/SpotCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, Search, SlidersHorizontal, X } from "lucide-react";

export default function SearchPage() {
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const initialQuery = params.get("q") || "";

  const [query, setQuery] = useState(initialQuery);
  const [searchTerm, setSearchTerm] = useState(initialQuery);
  const [sortBy, setSortBy] = useState<SpotSortBy>("newest");

  const { data: categoriesData } = trpc.category.list.useQuery();
  const categories = categoriesData ?? [];

  const { data, isLoading } = trpc.spot.list.useQuery(
    buildSpotSearchQueryInput({
      searchTerm,
      sortBy,
      limit: 50,
    }),
    { enabled: searchTerm.length > 0 }
  );

  const spots = data?.items ?? [];

  const categoryMap = useMemo(() => {
    const map = new Map<number, (typeof categories)[0]>();
    categories.forEach((category) => map.set(category.id, category));
    return map;
  }, [categories]);

  useEffect(() => {
    setQuery(initialQuery);
    setSearchTerm(initialQuery);
  }, [initialQuery]);

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    setSearchTerm(query.trim());
  };

  return (
    <div className="min-h-screen pb-20 md:pb-8">
      <div className="container py-6">
        <h1 className="mb-6 text-2xl font-black uppercase tracking-tight sm:text-3xl">
          検索
        </h1>

        <form onSubmit={handleSearch} className="mb-4 flex gap-2">
          <div className="relative flex-1">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              size={18}
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="駅名・エリア・学割内容で検索..."
              className="h-12 rounded-xl border-2 border-foreground pl-10 text-base shadow-[3px_3px_0px_oklch(0.15_0.01_0)]"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setSearchTerm("");
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X size={18} />
              </button>
            )}
          </div>
          <Button
            type="submit"
            className="memphis-btn h-12 rounded-xl bg-primary px-5 text-primary-foreground"
          >
            <Search size={18} />
          </Button>
        </form>

        <div className="mb-6 flex items-center gap-2">
          <SlidersHorizontal size={16} className="text-muted-foreground" />
          <Select
            value={sortBy}
            onValueChange={(value) => {
              if (!isSpotSortBy(value)) return;
              setSortBy(value);
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

        {!searchTerm ? (
          <div className="py-16 text-center">
            <Search size={48} className="mx-auto mb-3 text-muted-foreground/20" />
            <p className="font-medium text-muted-foreground">
              キーワードを入力して検索してください
            </p>
          </div>
        ) : isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-64 rounded-xl" />
            ))}
          </div>
        ) : spots.length === 0 ? (
          <div className="rounded-xl border-2 border-foreground bg-card py-16 text-center shadow-[4px_4px_0px_oklch(0.15_0.01_0)]">
            <MapPin size={48} className="mx-auto mb-3 text-muted-foreground/30" />
            <p className="font-medium text-muted-foreground">
              「{searchTerm}」に一致するスポットが見つかりません
            </p>
          </div>
        ) : (
          <>
            <p className="mb-4 text-sm font-semibold text-muted-foreground">
              「{searchTerm}」の検索結果: {spots.length}件
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {spots.map((spot) => (
                <SpotCard
                  key={spot.id}
                  spot={spot}
                  category={categoryMap.get(spot.categoryId) ?? null}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
