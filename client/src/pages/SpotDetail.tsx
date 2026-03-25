import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { StarRating } from "@/components/StarRating";
import { CategoryIcon, getCategoryBgColor } from "@/components/CategoryIcon";
import { MapView } from "@/components/Map";
import { useCapabilities } from "@/_core/hooks/useCapabilities";
import { toast } from "sonner";
import {
  MapPin, Phone, Globe, Clock, Tag, ArrowLeft,
  Star, MessageSquare, Send, Camera, CheckCircle2
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function SpotDetail() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const spotId = parseInt(params.id ?? "0");
  const mapRef = useRef<google.maps.Map | null>(null);

  const { data: spot, isLoading: spotLoading } = trpc.spot.byId.useQuery({ id: spotId }, { enabled: spotId > 0 });
  const { data: reviewsData, isLoading: reviewsLoading } = trpc.review.bySpot.useQuery({ spotId }, { enabled: spotId > 0 });
  const { data: categoriesData } = trpc.category.list.useQuery();

  const reviews = reviewsData ?? [];
  const categories = categoriesData ?? [];
  const category = useMemo(() => categories.find((c) => c.id === spot?.categoryId), [categories, spot]);

  // Review form state
  const [reviewName, setReviewName] = useState("");
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewImage, setReviewImage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { capabilities } = useCapabilities();
  const canUploadImages = capabilities?.canUploadImages ?? true;

  const utils = trpc.useUtils();
  const createReview = trpc.review.create.useMutation({
    onSuccess: () => {
      toast.success("レビューを投稿しました！");
      setReviewName("");
      setReviewRating(0);
      setReviewComment("");
      setReviewImage(null);
      utils.review.bySpot.invalidate({ spotId });
      utils.spot.byId.invalidate({ id: spotId });
    },
    onError: () => {
      toast.error("投稿に失敗しました");
    },
  });

  const uploadImage = trpc.upload.image.useMutation();

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("画像は5MB以下にしてください");
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(",")[1];
      try {
        const { url } = await uploadImage.mutateAsync({
          base64,
          contentType: file.type,
          fileName: file.name,
        });
        setReviewImage(url);
        toast.success("画像をアップロードしました");
      } catch {
        toast.error("画像のアップロードに失敗しました");
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewName.trim() || reviewRating === 0) {
      toast.error("名前と評価を入力してください");
      return;
    }
    setSubmitting(true);
    try {
      await createReview.mutateAsync({
        spotId,
        userName: reviewName.trim(),
        rating: reviewRating,
        comment: reviewComment.trim() || undefined,
        imageUrl: canUploadImages ? reviewImage ?? undefined : undefined,
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Map marker
  const handleMapReady = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  useEffect(() => {
    if (!mapRef.current || !spot) return;
    const lat = typeof spot.lat === "string" ? parseFloat(spot.lat) : spot.lat;
    const lng = typeof spot.lng === "string" ? parseFloat(spot.lng) : spot.lng;
    if (isNaN(lat) || isNaN(lng)) return;

    mapRef.current.setCenter({ lat, lng });
    mapRef.current.setZoom(16);

    const pinEl = document.createElement("div");
    pinEl.style.cssText = `width:40px;height:40px;border-radius:50%;background:#fb923c;border:3px solid #1a1a1a;display:flex;align-items:center;justify-content:center;font-size:18px;box-shadow:3px 3px 0px #1a1a1a;`;
    pinEl.textContent = "📍";

    new google.maps.marker.AdvancedMarkerElement({
      map: mapRef.current,
      position: { lat, lng },
      title: spot.name,
      content: pinEl,
    });
  }, [spot]);

  if (spotLoading) {
    return (
      <div className="container py-6 pb-20 md:pb-8">
        <Skeleton className="h-8 w-32 mb-4" />
        <Skeleton className="h-64 rounded-xl mb-4" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
    );
  }

  if (!spot) {
    return (
      <div className="container py-6 text-center">
        <p className="text-muted-foreground">スポットが見つかりません</p>
        <Button className="mt-4" onClick={() => navigate("/spots")}>一覧に戻る</Button>
      </div>
    );
  }

  const spotLat = typeof spot.lat === "string" ? parseFloat(spot.lat) : spot.lat;
  const spotLng = typeof spot.lng === "string" ? parseFloat(spot.lng) : spot.lng;

  return (
    <div className="min-h-screen pb-20 md:pb-8">
      <div className="container py-4 sm:py-6">
        {/* Back button */}
        <Button variant="ghost" size="sm" className="mb-4 font-bold" onClick={() => navigate("/spots")}>
          <ArrowLeft size={16} className="mr-1" /> 一覧に戻る
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Hero image */}
            <div className="relative rounded-xl overflow-hidden border-2 border-foreground shadow-[4px_4px_0px_oklch(0.15_0.01_0)]">
              {spot.imageUrl ? (
                <img src={spot.imageUrl} alt={spot.name} className="w-full h-48 sm:h-64 object-cover" />
              ) : (
                <div className="w-full h-48 sm:h-64 bg-gradient-to-br from-memphis-mint/40 to-memphis-lilac/40 flex items-center justify-center">
                  <MapPin size={64} className="text-foreground/15" />
                </div>
              )}
              {spot.discountRate && (
                <div className="absolute top-3 right-3">
                  <Badge className="memphis-btn bg-memphis-yellow text-foreground border-foreground text-sm px-3 py-1">
                    <Tag size={14} className="mr-1" />
                    {spot.discountRate}
                  </Badge>
                </div>
              )}
              {spot.isVerified === 1 && (
                <div className="absolute top-3 left-3">
                  <Badge className="bg-memphis-mint text-foreground border-2 border-foreground px-3 py-1 flex items-center gap-1">
                    <CheckCircle2 size={14} />
                    認証済み
                  </Badge>
                </div>
              )}
            </div>

            {/* Spot info */}
            <div className="bg-card rounded-xl border-2 border-foreground shadow-[4px_4px_0px_oklch(0.15_0.01_0)] p-4 sm:p-6">
              {category && (
                <span className={cn("inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full mb-3", getCategoryBgColor(category.color))}>
                  <CategoryIcon icon={category.icon} size={14} />
                  {category.name}
                </span>
              )}
              <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight mb-2">{spot.name}</h1>

              <div className="flex items-center gap-3 mb-4">
                <StarRating rating={spot.avgRating ?? 0} size={20} />
                <span className="font-bold text-lg">{(spot.avgRating ?? 0).toFixed(1)}</span>
                <span className="text-sm text-muted-foreground">({spot.reviewCount ?? 0}件)</span>
              </div>

              {/* Discount detail */}
              <div className="bg-memphis-yellow/20 border-2 border-foreground rounded-xl p-4 mb-4 shadow-[2px_2px_0px_oklch(0.15_0.01_0)]">
                <h3 className="font-bold text-sm uppercase mb-1 flex items-center gap-1.5">
                  <Tag size={16} />
                  学割内容
                </h3>
                <p className="text-base font-medium">{spot.discountDetail}</p>
              </div>

              {spot.description && (
                <p className="text-muted-foreground mb-4">{spot.description}</p>
              )}

              {/* Details grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex items-start gap-2 text-sm">
                  <MapPin size={16} className="shrink-0 mt-0.5 text-primary" />
                  <span>{spot.address}</span>
                </div>
                {spot.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone size={16} className="shrink-0 text-primary" />
                    <a href={`tel:${spot.phone}`} className="hover:underline">{spot.phone}</a>
                  </div>
                )}
                {spot.website && (
                  <div className="flex items-center gap-2 text-sm">
                    <Globe size={16} className="shrink-0 text-primary" />
                    <a href={spot.website} target="_blank" rel="noopener noreferrer" className="hover:underline truncate">{spot.website}</a>
                  </div>
                )}
                {spot.openingHours && (
                  <div className="flex items-start gap-2 text-sm">
                    <Clock size={16} className="shrink-0 mt-0.5 text-primary" />
                    <span className="whitespace-pre-line">{spot.openingHours}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Reviews */}
            <div className="bg-card rounded-xl border-2 border-foreground shadow-[4px_4px_0px_oklch(0.15_0.01_0)] p-4 sm:p-6">
              <h2 className="text-xl font-black uppercase tracking-tight mb-4 flex items-center gap-2">
                <MessageSquare size={20} />
                レビュー ({reviews.length})
              </h2>

              {/* Review form */}
              <form onSubmit={handleSubmitReview} className="bg-muted/50 rounded-xl p-4 mb-6 border border-border">
                <h3 className="font-bold text-sm mb-3">レビューを書く</h3>
                <div className="space-y-3">
                  <Input
                    placeholder="ニックネーム"
                    value={reviewName}
                    onChange={(e) => setReviewName(e.target.value)}
                    className="border-2 border-foreground/30 rounded-lg"
                  />
                  <div>
                    <span className="text-sm font-medium mb-1 block">評価</span>
                    <StarRating rating={reviewRating} size={28} interactive onChange={setReviewRating} />
                  </div>
                  <Textarea
                    placeholder="コメント（任意）"
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    className="border-2 border-foreground/30 rounded-lg min-h-[80px]"
                  />
                  {canUploadImages && (
                    <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 text-sm font-medium cursor-pointer text-primary hover:underline">
                      <Camera size={16} />
                      写真を追加
                      <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploadImage.isPending} />
                    </label>
                    {reviewImage && (
                      <img src={reviewImage} alt="preview" className="w-12 h-12 rounded-lg object-cover border-2 border-foreground" />
                    )}
                    </div>
                  )}
                  <Button
                    type="submit"
                    disabled={submitting || uploadImage.isPending || !reviewName.trim() || reviewRating === 0}
                    className="memphis-btn bg-primary text-primary-foreground w-full sm:w-auto"
                  >
                    <Send size={16} className="mr-1" />
                    {submitting ? "投稿中..." : "レビューを投稿"}
                  </Button>
                </div>
              </form>

              {/* Review list */}
              {reviewsLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
                </div>
              ) : reviews.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">まだレビューがありません。最初のレビューを書きましょう！</p>
              ) : (
                <div className="space-y-4">
                  {reviews.map((review) => (
                    <div key={review.id} className="border-2 border-border rounded-xl p-4 hover:border-foreground/30 transition-colors">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-memphis-lilac/40 border-2 border-foreground flex items-center justify-center text-xs font-bold">
                            {review.userName.charAt(0)}
                          </div>
                          <span className="font-bold text-sm">{review.userName}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(review.createdAt).toLocaleDateString("ja-JP")}
                        </span>
                      </div>
                      <StarRating rating={review.rating} size={14} className="mb-2" />
                      {review.comment && <p className="text-sm text-foreground/80">{review.comment}</p>}
                      {review.imageUrl && (
                        <img src={review.imageUrl} alt="review" className="mt-2 rounded-lg max-h-40 object-cover border-2 border-foreground" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar - Map */}
          <div className="space-y-4">
            <div className="sticky top-20">
              <div className="rounded-xl overflow-hidden border-2 border-foreground shadow-[4px_4px_0px_oklch(0.15_0.01_0)]">
                <MapView
                  className="h-[250px] sm:h-[300px]"
                  initialCenter={{ lat: spotLat, lng: spotLng }}
                  initialZoom={16}
                  onMapReady={handleMapReady}
                />
              </div>
              <div className="mt-4 bg-card rounded-xl border-2 border-foreground shadow-[4px_4px_0px_oklch(0.15_0.01_0)] p-4">
                <h3 className="font-bold text-sm mb-2">アクセス</h3>
                <p className="text-sm text-muted-foreground">{spot.address}</p>
                <Button
                  className="memphis-btn mt-3 w-full bg-memphis-mint text-foreground"
                  onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${spotLat},${spotLng}`, "_blank")}
                >
                  <Navigation size={16} className="mr-1" />
                  Google Mapsで開く
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Navigation(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={props.size || 24} height={props.size || 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className}>
      <polygon points="3 11 22 2 13 21 11 13 3 11" />
    </svg>
  );
}
