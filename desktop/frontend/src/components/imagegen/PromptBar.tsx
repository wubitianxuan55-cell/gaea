// PromptBar.tsx — 沉浸式创作输入卡（照搬 wubigork 设计，Tailwind + Lucide）
import { useRef } from "react";
import { Send, Loader2 } from "lucide-react";

interface PromptBarProps {
  prompt: string;
  onPromptChange: (v: string) => void;
  generating: boolean;
  elapsed: number;
  onGenerate: () => void;
}

/** 快捷风格标签 */
const QUICK_TAGS = [
  "电影级光影", "8K超高清", "概念艺术", "史诗场景",
  "黑暗奇幻", "赛博朋克", "水墨风", "油画质感",
];

/** PromptBar — 沉浸式创作输入卡 */
export function PromptBar({ prompt, onPromptChange, generating, elapsed, onGenerate }: PromptBarProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  const handleTagClick = (tag: string) => {
    if (prompt.includes(tag)) return;
    const sep = prompt.trim() ? "，" : "";
    onPromptChange(prompt + sep + tag);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !generating) {
      e.preventDefault();
      onGenerate();
    }
  };

  return (
    <div className="shrink-0 pt-4">
      <div
        ref={cardRef}
        className="prompt-card rounded-2xl p-4 transition-shadow duration-300"
        style={{
          background: "rgba(255,255,255,0.04)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(139,92,246,0.25)",
        }}
        onFocusCapture={() => {
          if (cardRef.current) {
            cardRef.current.style.borderColor = "rgba(139,92,246,0.5)";
            cardRef.current.style.boxShadow = "0 0 20px rgba(139,92,246,0.2)";
          }
        }}
        onBlurCapture={() => {
          if (cardRef.current) {
            cardRef.current.style.borderColor = "rgba(139,92,246,0.25)";
            cardRef.current.style.boxShadow = "none";
          }
        }}
      >
        {/* 标题 */}
        <div className="flex items-center gap-1.5 mb-2.5 text-gray-500 dark:text-gray-400 text-[11px]">
          <span className="text-sm">🎨</span>
          描述你心中的画面…
        </div>

        {/* TextArea */}
        <textarea
          placeholder="悬浮云端的仙侠城市，琉璃瓦宫殿，瀑布倾泻而下，霞光万丈…"
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          rows={3}
          onKeyDown={handleKeyDown}
          className="w-full rounded-xl border border-gray-700/30 dark:border-gray-600/30 px-3.5 py-3 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 resize-none focus:outline-none transition"
          style={{
            background: "rgba(0,0,0,0.25)",
            fontSize: 14,
            lineHeight: 1.7,
          }}
        />

        {/* 快捷标签 */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          {QUICK_TAGS.map((tag) => {
            const active = prompt.includes(tag);
            return (
              <button
                key={tag}
                onClick={() => handleTagClick(tag)}
                className="px-2.5 py-0.5 text-[11px] rounded-lg border transition-all select-none"
                style={{
                  borderColor: active ? "rgba(139,92,246,0.5)" : "rgba(255,255,255,0.08)",
                  background: active ? "rgba(139,92,246,0.15)" : "rgba(255,255,255,0.04)",
                  color: active ? "var(--color-primary, #a78bfa)" : "var(--color-text-secondary, #9ca3af)",
                }}
              >
                {tag}
              </button>
            );
          })}
        </div>

        {/* 分隔线 */}
        <div className="h-px my-3 bg-gray-200 dark:bg-gray-700" />

        {/* 底部栏：字符计数 + 按钮 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-gray-400 dark:text-gray-500 tabular-nums">
              ⌨ {prompt.length} 字符
            </span>
            {generating && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[10px] font-medium">
                <Loader2 className="w-2.5 h-2.5 animate-spin" />
                {elapsed}s
              </span>
            )}
          </div>
          <button
            onClick={onGenerate}
            disabled={generating || !prompt.trim()}
            className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.97]"
            style={{
              minWidth: 120,
              height: 38,
              background: generating
                ? "linear-gradient(135deg, #8b5cf6, #7c3aed)"
                : "linear-gradient(135deg, #8b5cf6, #3b82f6)",
              boxShadow: "0 4px 14px rgba(139,92,246,0.3)",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.boxShadow = "0 6px 20px rgba(139,92,246,0.4)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 14px rgba(139,92,246,0.3)";
            }}
          >
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                生成中 {elapsed}s
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                生成图像
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
