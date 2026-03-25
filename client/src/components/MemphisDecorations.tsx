import { useMemo } from "react";

interface DecorationProps {
  count?: number;
  className?: string;
}

// Seeded random for consistent positions
function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const SHAPES = ["circle", "triangle", "square", "dot", "diamond", "line"] as const;
const COLORS = [
  "oklch(0.87 0.12 165)", // mint
  "oklch(0.80 0.10 300)", // lilac
  "oklch(0.93 0.15 95)",  // yellow
  "oklch(0.72 0.16 25)",  // coral
  "oklch(0.78 0.14 350)", // pink
  "oklch(0.15 0.01 0)",   // black
];

export function MemphisBackground({ count = 20, className = "" }: DecorationProps) {
  const shapes = useMemo(() => {
    const rand = seededRandom(42);
    return Array.from({ length: count }, (_, i) => {
      const shape = SHAPES[Math.floor(rand() * SHAPES.length)];
      const color = COLORS[Math.floor(rand() * COLORS.length)];
      const x = rand() * 100;
      const y = rand() * 100;
      const size = 8 + rand() * 24;
      const rotation = rand() * 360;
      const opacity = 0.15 + rand() * 0.25;
      return { id: i, shape, color, x, y, size, rotation, opacity };
    });
  }, [count]);

  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`} aria-hidden="true">
      {shapes.map((s) => {
        const style: React.CSSProperties = {
          position: "absolute",
          left: `${s.x}%`,
          top: `${s.y}%`,
          opacity: s.opacity,
          transform: `rotate(${s.rotation}deg)`,
        };

        switch (s.shape) {
          case "circle":
            return (
              <div key={s.id} style={{ ...style, width: s.size, height: s.size, borderRadius: "50%", border: `2.5px solid ${s.color}` }} />
            );
          case "triangle":
            return (
              <div key={s.id} style={{
                ...style,
                width: 0, height: 0,
                borderLeft: `${s.size / 2}px solid transparent`,
                borderRight: `${s.size / 2}px solid transparent`,
                borderBottom: `${s.size}px solid ${s.color}`,
              }} />
            );
          case "square":
            return (
              <div key={s.id} style={{ ...style, width: s.size, height: s.size, backgroundColor: s.color, borderRadius: "2px" }} />
            );
          case "dot":
            return (
              <div key={s.id} style={{ ...style, width: s.size * 0.4, height: s.size * 0.4, borderRadius: "50%", backgroundColor: s.color }} />
            );
          case "diamond":
            return (
              <div key={s.id} style={{
                ...style,
                width: s.size * 0.7, height: s.size * 0.7,
                backgroundColor: s.color,
                transform: `rotate(45deg)`,
              }} />
            );
          case "line":
            return (
              <div key={s.id} style={{
                ...style,
                width: s.size * 1.5, height: "3px",
                backgroundColor: s.color,
              }} />
            );
          default:
            return null;
        }
      })}
    </div>
  );
}

export function MemphisDivider() {
  return (
    <div className="flex items-center gap-3 py-4">
      <div className="h-[3px] flex-1 bg-foreground/10" />
      <div className="w-3 h-3 bg-memphis-mint rotate-45" />
      <div className="w-2 h-2 rounded-full bg-memphis-coral" />
      <div className="w-3 h-3 bg-memphis-yellow rotate-12" />
      <div className="h-[3px] flex-1 bg-foreground/10" />
    </div>
  );
}
