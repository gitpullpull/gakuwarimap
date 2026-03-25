import { MapPin, Tag, ExternalLink, ShieldCheck, ShieldQuestion, ShieldAlert, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface AgentResult {
  place_id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  rating?: number;
  website?: string;
  types?: string[];
  has_gakuwari: boolean;
  discount_info: string;
  source_url: string;
  confidence: "high" | "medium" | "low";
}

interface AgentResultCardProps {
  result: AgentResult;
  onClick?: () => void;
  isSelected?: boolean;
}

function ConfidenceBadge({ confidence }: { confidence: "high" | "medium" | "low" }) {
  const config = {
    high: { icon: ShieldCheck, label: "信頼度: 高", className: "bg-memphis-mint text-foreground border-foreground" },
    medium: { icon: ShieldQuestion, label: "信頼度: 中", className: "bg-memphis-yellow text-foreground border-foreground" },
    low: { icon: ShieldAlert, label: "信頼度: 低", className: "bg-memphis-coral/30 text-foreground border-foreground" },
  };
  const { icon: Icon, label, className } = config[confidence];
  return (
    <Badge className={cn("text-xs px-2 py-0.5 border-2 gap-1", className)}>
      <Icon size={12} />
      {label}
    </Badge>
  );
}

export function AgentResultCard({ result, onClick, isSelected }: AgentResultCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "memphis-card rounded-xl bg-card overflow-hidden cursor-pointer transition-all",
        isSelected && "ring-2 ring-primary ring-offset-2"
      )}
    >
      <div className="p-3 sm:p-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-base leading-tight line-clamp-1">
              {result.name}
            </h3>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 line-clamp-1">
              <MapPin size={12} className="shrink-0" />
              {result.address}
            </p>
          </div>
          {result.has_gakuwari ? (
            <Badge className="memphis-btn bg-memphis-yellow text-foreground border-foreground text-xs px-2 py-0.5 shrink-0">
              <Tag size={12} className="mr-1" />
              学割あり
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs px-2 py-0.5 shrink-0 border-2 text-muted-foreground">
              学割なし
            </Badge>
          )}
        </div>

        {/* Discount info */}
        {result.has_gakuwari && result.discount_info && (
          <div className="bg-memphis-yellow/20 border-2 border-foreground/10 rounded-lg p-2.5 mb-2">
            <div className="flex items-start gap-2">
              <Sparkles size={14} className="text-primary shrink-0 mt-0.5" />
              <p className="text-sm font-medium text-foreground/90 leading-snug">
                {result.discount_info}
              </p>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 mt-2">
          <ConfidenceBadge confidence={result.confidence} />
          <div className="flex items-center gap-2">
            {result.rating && (
              <span className="text-xs text-muted-foreground">
                ★ {result.rating.toFixed(1)}
              </span>
            )}
            {result.source_url && (
              <a
                href={result.source_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-xs text-primary hover:underline flex items-center gap-0.5"
              >
                <ExternalLink size={10} />
                出典
              </a>
            )}
            {result.website && (
              <a
                href={result.website}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-xs text-primary hover:underline flex items-center gap-0.5"
              >
                <ExternalLink size={10} />
                公式
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
