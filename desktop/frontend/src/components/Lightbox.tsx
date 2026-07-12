// Lightbox.tsx — 全屏大图查看器，支持键盘翻页、下载
import { useEffect, useCallback } from "react";
import { X, ChevronLeft, ChevronRight, Download } from "lucide-react";

export interface LightboxImage {
  dataUrl: string; // base64 data URL
  prompt?: string;
  seed?: number;
}

interface LightboxProps {
  images: LightboxImage[];
  index: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

export function Lightbox({ images, index, onClose, onNavigate }: LightboxProps) {
  const current = images[index];
  const hasPrev = index > 0;
  const hasNext = index < images.length - 1;

  const goPrev = useCallback(() => {
    if (hasPrev) onNavigate(index - 1);
  }, [hasPrev, index, onNavigate]);

  const goNext = useCallback(() => {
    if (hasNext) onNavigate(index + 1);
  }, [hasNext, index, onNavigate]);

  // 下载当前图片
  const download = useCallback(() => {
    if (!current) return;
    const a = document.createElement("a");
    a.href = current.dataUrl;
    a.download = `gaea-${current.seed || Date.now()}.png`;
    a.click();
  }, [current]);

  // 键盘事件
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      switch (e.key) {
        case "Escape":
          onClose();
          break;
        case "ArrowLeft":
          goPrev();
          break;
        case "ArrowRight":
          goNext();
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, goPrev, goNext]);

  if (!current) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* 关闭按钮 */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 rounded-full bg-white/10 p-2 text-white/80 hover:bg-white/20 hover:text-white transition"
      >
        <X className="w-6 h-6" />
      </button>

      {/* 下载按钮 */}
      <button
        onClick={download}
        className="absolute top-4 left-4 z-10 rounded-full bg-white/10 p-2 text-white/80 hover:bg-white/20 hover:text-white transition"
      >
        <Download className="w-6 h-6" />
      </button>

      {/* 上一张 */}
      {hasPrev && (
        <button
          onClick={(e) => { e.stopPropagation(); goPrev(); }}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-10 rounded-full bg-white/10 p-3 text-white/80 hover:bg-white/20 hover:text-white transition"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      )}

      {/* 下一张 */}
      {hasNext && (
        <button
          onClick={(e) => { e.stopPropagation(); goNext(); }}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-10 rounded-full bg-white/10 p-3 text-white/80 hover:bg-white/20 hover:text-white transition"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      )}

      {/* 图片 */}
      <img
        src={current.dataUrl}
        alt={current.prompt || "生成图片"}
        className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg"
        onClick={(e) => e.stopPropagation()}
      />

      {/* 底栏信息 */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-lg bg-black/60 px-4 py-2 text-white/70 text-sm">
        {index + 1} / {images.length}
        {current.seed != null && <span className="ml-3">Seed: {current.seed}</span>}
      </div>
    </div>
  );
}
