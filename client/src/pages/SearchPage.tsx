import { useState, useMemo, useEffect } from "react";
import { useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { SpotCard } from "@/components/SpotCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, MapPin, X } from "lucide-react";

export default function SearchPage() {
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const initialQuery = params.get("q") || "";

  const [query, setQuery] = useState(initialQuery);
  const [searchTerm, setSearchTerm] = useState(initialQuery);

  const { data: categoriesData } = trpc.category.list.useQuery();
  const categories = categoriesData ?? [];

  const { data, isLoading } = trpc.spot.list.useQuery(
    { search: searchTerm, limit: 50 },
    { enabled: searchTerm.length > 0 }
  );

  const spots = data?.items ?? [];

  const categoryMap = useMemo(() => {
    const map = new Map<number, (typeof categories)[0]>();
    categories.forEach((c) => map.set(c.id, c));
    return map;
  }, [categories]);

  useEffect(() => {
    setQuery(initialQuery);
    setSearchTerm(initialQuery);
  }, [initialQuery]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchTerm(query.trim());
  };

  return (
    <div className="min-h-screen pb-20 md:pb-8">
      <div className="container py-6">
        <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight mb-6">検索</h1>

        {/* Search form */}
        <form onSubmit={handleSearch} className="flex gap-2 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="店名・エリア・学割内容で検索..."
              className="pl-10 h-12 border-2 border-foreground rounded-xl text-base shadow-[3px_3px_0px_oklch(0.15_0.01_0)]"
            />
            {query && (
              <button
                type="button"
                onClick={() => { setQuery(""); setSearchTerm(""); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X size={18} />
              </button>
            )}
          </div>
          <Button type="submit" className="memphis-btn h-12 px-5 rounded-xl bg-primary text-primary-foreground">
            <Search size={18} />
          </Button>
        </form>

        {/* Results */}
        {!searchTerm ? (
          <div className="text-center py-16">
            <Search size={48} className="mx-auto text-muted-foreground/20 mb-3" />
            <p className="text-muted-foreground font-medium">キーワードを入力して検索してください</p>
          </div>
        ) : isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-64 rounded-xl" />
            ))}
          </div>
        ) : spots.length === 0 ? (
          <div className="text-center py-16 bg-card rounded-xl border-2 border-foreground shadow-[4px_4px_0px_oklch(0.15_0.01_0)]">
            <MapPin size={48} className="mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground font-medium">
              「{searchTerm}」に一致するスポットが見つかりません
            </p>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground mb-4 font-semibold">
              「{searchTerm}」の検索結果: {spots.length}件
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
