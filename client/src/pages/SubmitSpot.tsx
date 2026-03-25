import { useState, useRef, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { MemphisBackground } from "@/components/MemphisDecorations";
import { MapView } from "@/components/Map";
import { useCapabilities } from "@/_core/hooks/useCapabilities";
import { toast } from "sonner";
import { MapPin, Camera, Send, Sparkles } from "lucide-react";

export default function SubmitSpot() {
  const [, navigate] = useLocation();
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);

  const [form, setForm] = useState({
    name: "",
    description: "",
    address: "",
    lat: "",
    lng: "",
    categoryId: "",
    discountDetail: "",
    discountRate: "",
    phone: "",
    website: "",
    openingHours: "",
    imageUrl: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const { capabilities } = useCapabilities();

  const { data: categoriesData } = trpc.category.list.useQuery();
  const categories = categoriesData ?? [];
  const canUploadImages = capabilities?.canUploadImages ?? true;

  const utils = trpc.useUtils();
  const createSpot = trpc.spot.create.useMutation({
    onSuccess: (data) => {
      toast.success("スポットを投稿しました！");
      utils.spot.list.invalidate();
      navigate(`/spots/${data.id}`);
    },
    onError: () => {
      toast.error("投稿に失敗しました");
    },
  });

  const uploadImage = trpc.upload.image.useMutation();

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

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
        updateField("imageUrl", url);
        toast.success("画像をアップロードしました");
      } catch {
        toast.error("画像のアップロードに失敗しました");
      }
    };
    reader.readAsDataURL(file);
  };

  // Map click to set location
  const handleMapReady = useCallback((map: google.maps.Map) => {
    mapRef.current = map;

    map.addListener("click", (e: google.maps.MapMouseEvent) => {
      const lat = e.latLng?.lat();
      const lng = e.latLng?.lng();
      if (lat == null || lng == null) return;

      updateField("lat", lat.toFixed(7));
      updateField("lng", lng.toFixed(7));

      // Update marker
      if (markerRef.current) {
        markerRef.current.position = { lat, lng };
      } else {
        const pinEl = document.createElement("div");
        pinEl.style.cssText = `width:36px;height:36px;border-radius:50%;background:#fb923c;border:3px solid #1a1a1a;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:3px 3px 0px #1a1a1a;`;
        pinEl.textContent = "📍";

        markerRef.current = new google.maps.marker.AdvancedMarkerElement({
          map,
          position: { lat, lng },
          content: pinEl,
        });
      }

      // Reverse geocode
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ location: { lat, lng } }, (results, status) => {
        if (status === "OK" && results?.[0]) {
          updateField("address", results[0].formatted_address);
        }
      });
    });
  }, []);

  // Try to get user location for map center
  const [mapCenter, setMapCenter] = useState({ lat: 35.6812, lng: 139.7671 });
  useEffect(() => {
    navigator.geolocation?.getCurrentPosition((pos) => {
      setMapCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.address || !form.lat || !form.lng || !form.categoryId || !form.discountDetail) {
      toast.error("必須項目を入力してください");
      return;
    }
    setSubmitting(true);
    try {
      await createSpot.mutateAsync({
        name: form.name,
        description: form.description || undefined,
        address: form.address,
        lat: form.lat,
        lng: form.lng,
        categoryId: parseInt(form.categoryId),
        discountDetail: form.discountDetail,
        discountRate: form.discountRate || undefined,
        phone: form.phone || undefined,
        website: form.website || undefined,
        openingHours: form.openingHours || undefined,
        imageUrl: canUploadImages ? form.imageUrl || undefined : undefined,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen pb-20 md:pb-8">
      {/* Header */}
      <section className="relative overflow-hidden py-8 sm:py-10">
        <MemphisBackground count={15} />
        <div className="container relative z-10">
          <div className="max-w-2xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-memphis-lilac/30 border-2 border-foreground rounded-full px-4 py-1.5 mb-3 shadow-[2px_2px_0px_oklch(0.15_0.01_0)]">
              <Sparkles size={14} />
              <span className="text-xs font-bold uppercase tracking-wider">みんなでシェア</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tight">
              新しいスポットを投稿
            </h1>
            <p className="text-sm text-muted-foreground mt-2">
              学割が使えるお店を見つけたら、みんなに教えてあげよう！
            </p>
          </div>
        </div>
      </section>

      <div className="container">
        <form onSubmit={handleSubmit} className="max-w-2xl mx-auto space-y-6">
          {/* Basic info */}
          <div className="bg-card rounded-xl border-2 border-foreground shadow-[4px_4px_0px_oklch(0.15_0.01_0)] p-4 sm:p-6 space-y-4">
            <h2 className="font-black text-lg uppercase">基本情報</h2>

            <div>
              <Label className="font-bold text-sm">店舗名 *</Label>
              <Input
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
                placeholder="例: スターバックス 渋谷店"
                className="mt-1 border-2 border-foreground/30 rounded-lg"
              />
            </div>

            <div>
              <Label className="font-bold text-sm">カテゴリ *</Label>
              <Select value={form.categoryId} onValueChange={(v) => updateField("categoryId", v)}>
                <SelectTrigger className="mt-1 border-2 border-foreground/30 rounded-lg">
                  <SelectValue placeholder="カテゴリを選択" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={String(cat.id)}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="font-bold text-sm">説明</Label>
              <Textarea
                value={form.description}
                onChange={(e) => updateField("description", e.target.value)}
                placeholder="お店の雰囲気や特徴など"
                className="mt-1 border-2 border-foreground/30 rounded-lg min-h-[80px]"
              />
            </div>
          </div>

          {/* Discount info */}
          <div className="bg-card rounded-xl border-2 border-foreground shadow-[4px_4px_0px_oklch(0.15_0.01_0)] p-4 sm:p-6 space-y-4">
            <h2 className="font-black text-lg uppercase">学割情報</h2>

            <div>
              <Label className="font-bold text-sm">学割内容 *</Label>
              <Textarea
                value={form.discountDetail}
                onChange={(e) => updateField("discountDetail", e.target.value)}
                placeholder="例: 学生証提示で全品10%OFF"
                className="mt-1 border-2 border-foreground/30 rounded-lg min-h-[80px]"
              />
            </div>

            <div>
              <Label className="font-bold text-sm">割引率・金額</Label>
              <Input
                value={form.discountRate}
                onChange={(e) => updateField("discountRate", e.target.value)}
                placeholder="例: 10%OFF, 500円引き"
                className="mt-1 border-2 border-foreground/30 rounded-lg"
              />
            </div>
          </div>

          {/* Location */}
          <div className="bg-card rounded-xl border-2 border-foreground shadow-[4px_4px_0px_oklch(0.15_0.01_0)] p-4 sm:p-6 space-y-4">
            <h2 className="font-black text-lg uppercase">場所</h2>
            <p className="text-xs text-muted-foreground">マップをクリックして場所を指定してください</p>

            <div className="rounded-xl overflow-hidden border-2 border-foreground shadow-[2px_2px_0px_oklch(0.15_0.01_0)]">
              <MapView
                className="h-[250px] sm:h-[300px]"
                initialCenter={mapCenter}
                initialZoom={13}
                onMapReady={handleMapReady}
              />
            </div>

            <div>
              <Label className="font-bold text-sm">住所 *</Label>
              <Input
                value={form.address}
                onChange={(e) => updateField("address", e.target.value)}
                placeholder="マップクリックで自動入力、または手動入力"
                className="mt-1 border-2 border-foreground/30 rounded-lg"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="font-bold text-sm">緯度</Label>
                <Input value={form.lat} readOnly className="mt-1 bg-muted border-2 border-foreground/20 rounded-lg text-sm" />
              </div>
              <div>
                <Label className="font-bold text-sm">経度</Label>
                <Input value={form.lng} readOnly className="mt-1 bg-muted border-2 border-foreground/20 rounded-lg text-sm" />
              </div>
            </div>
          </div>

          {/* Contact & hours */}
          <div className="bg-card rounded-xl border-2 border-foreground shadow-[4px_4px_0px_oklch(0.15_0.01_0)] p-4 sm:p-6 space-y-4">
            <h2 className="font-black text-lg uppercase">連絡先・営業時間</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="font-bold text-sm">電話番号</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => updateField("phone", e.target.value)}
                  placeholder="03-1234-5678"
                  className="mt-1 border-2 border-foreground/30 rounded-lg"
                />
              </div>
              <div>
                <Label className="font-bold text-sm">ウェブサイト</Label>
                <Input
                  value={form.website}
                  onChange={(e) => updateField("website", e.target.value)}
                  placeholder="https://..."
                  className="mt-1 border-2 border-foreground/30 rounded-lg"
                />
              </div>
            </div>

            <div>
              <Label className="font-bold text-sm">営業時間</Label>
              <Textarea
                value={form.openingHours}
                onChange={(e) => updateField("openingHours", e.target.value)}
                placeholder="例: 月-金 10:00-22:00&#10;土日祝 11:00-21:00"
                className="mt-1 border-2 border-foreground/30 rounded-lg min-h-[80px]"
              />
            </div>
          </div>

          {/* Image */}
          {canUploadImages && (
            <div className="bg-card rounded-xl border-2 border-foreground shadow-[4px_4px_0px_oklch(0.15_0.01_0)] p-4 sm:p-6 space-y-4">
            <h2 className="font-black text-lg uppercase">写真</h2>

            <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-foreground/30 rounded-xl cursor-pointer hover:bg-muted/50 transition-colors">
              {form.imageUrl ? (
                <img src={form.imageUrl} alt="preview" className="h-full w-full object-cover rounded-xl" />
              ) : (
                <>
                  <Camera size={32} className="text-muted-foreground/40 mb-2" />
                  <span className="text-sm text-muted-foreground">クリックして写真をアップロード</span>
                </>
              )}
              <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploadImage.isPending} />
            </label>
            </div>
          )}

          {/* Submit */}
          <Button
            type="submit"
            disabled={submitting || uploadImage.isPending}
            className="memphis-btn w-full h-14 text-lg bg-primary text-primary-foreground rounded-xl"
          >
            <Send size={20} className="mr-2" />
            {submitting ? "投稿中..." : "スポットを投稿する"}
          </Button>
        </form>
      </div>
    </div>
  );
}
