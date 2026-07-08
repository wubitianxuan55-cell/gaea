import { ArrowUp, FolderOpen, Code, Search, FileText, MessageSquare, Clock, Zap, List } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import logo from "../assets/logo.png";
import { useT } from "../lib/i18n";
import { useCompact } from "../hooks/useCompact";
import { sessionTitle } from "../lib/session";
import type { Meta, SessionMeta } from "../lib/types";

function formatTimeAgo(ms: number): string {
  const diff = Date.now() - ms;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "刚刚";
  if (min < 60) return `${min}分钟前`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs}小时前`;
  return new Date(ms).toLocaleDateString([], { month: "short", day: "numeric" });
}

const QUICK_COMMANDS = [
  { icon: <Search size={14} />, label: "🏗️ 场地环境调查", prompt: "启动场地环境调查初调报告框架，梳理场地基本信息、历史使用情况、周边敏感目标等关键内容。" },
  { icon: <FileText size={14} />, label: "⚖️ 污染风险评估", prompt: "根据提供的检测数据，对标 GB 36600 和 GB 15618 进行超标判定，计算污染风险并给出评估结论。" },
  { icon: <Zap size={14} />, label: "📋 修复技术方案", prompt: "撰写污染土壤修复实施方案，包括技术比选、工艺设计、施工部署等内容。" },
  { icon: <Search size={14} />, label: "💰 成本测算", prompt: "生成土壤修复工程七项汇总成本测算表，涵盖场地调查、风险评估、方案设计、施工实施、监测验收等各阶段费用。" },
  { icon: <List size={14} />, label: "📊 检测数据分析", prompt: "导入检测数据CSV文件，进行统计分析，包括超标识别、空间分布、统计描述等。" },
  { icon: <MessageSquare size={14} />, label: "📝 投标文件编制", prompt: "生成土壤修复工程技术标投标方案，包括工程概况、施工组织设计、质量保证措施等。" },
];

export function Welcome({
  onPrompt,
  cwd: _cwd,
  cwdName,
  sessions,
  onResumeSession,
  meta,
}: {
  onPrompt: (text: string) => void;
  cwd?: string;
  cwdName?: string;
  sessions?: SessionMeta[];
  onResumeSession?: (path: string) => Promise<void>;
  meta?: Meta;
}) {
  const t = useT();
  const compact = useCompact();
  const [text, setText] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem("gaeaW.shortcutsSeen")) {
        setShowShortcuts(true);
        localStorage.setItem("gaeaW.shortcutsSeen", "1");
        const timer = setTimeout(() => setShowShortcuts(false), 5000);
        return () => clearTimeout(timer);
      }
    } catch {}
  }, []);

  const handleSubmit = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onPrompt(trimmed);
    setText("");
  }, [text, onPrompt]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  const recentSessions = sessions?.filter(s => !s.current).slice(0, 3) ?? [];

  return (
    <div className="h-full flex flex-col items-center justify-center max-w-2xl mx-auto px-6 overflow-y-auto">
      {cwdName && (
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 mb-5 rounded-full bg-accent-soft border border-accent/20 text-fg-dim ${compact ? "text-[11px]" : "text-[12px]"}`}>
          <FolderOpen size={compact ? 12 : 13} className="text-accent" />
          <span className="font-medium text-accent">{cwdName}</span>
          {meta?.label && <span className="text-fg-faint">· {meta.label}</span>}
        </div>
      )}

      <div className="welcome-stagger-1">
        <img src={logo} className={`rounded-[10px] mb-5 welcome-logo ${compact ? "w-8 h-8" : "w-10 h-10"}`} alt="gaeaW" />
      </div>
      <div className={`welcome-stagger-2 text-fg-dim mb-8 ${compact ? "text-[13px]" : "text-[14px]"}`} style={{fontFamily: "var(--ds-font-display)", fontWeight: 500, letterSpacing: "-0.01em"}}>{t("welcome.tagline")}</div>
      <div className="welcome-stagger-3 w-full border border-border-soft bg-bg-elev rounded-2xl shadow-[var(--ds-shadow-composer)] hover:border-fg-faint/30 focus-within:border-accent/30 focus-within:shadow-[0_0_0_1px_var(--accent-soft),var(--ds-shadow-composer)] transition-all duration-[var(--dur-base)]">
        <textarea
          ref={taRef}
          className={`w-full resize-none border-0 bg-transparent text-fg leading-relaxed outline-none placeholder:text-fg-faint px-5 pt-5 pb-2 ${compact ? "text-[13px] min-h-[64px]" : "text-[14px] min-h-[80px]"} max-h-[160px]`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={cwdName ? `在 ${cwdName}/ 中提问…` : t("composer.placeholder")}
          rows={2}
        />
        <div className="flex items-center justify-between px-4 pb-4">
          <span className={`text-fg-faint ${compact ? "text-[10px]" : "text-[11px]"}`}>
            <kbd className="ds-kbd">/</kbd> 命令
            <span className="mx-1.5 text-fg-faint/40">·</span>
            <kbd className="ds-kbd">@</kbd> 文件
            <span className="mx-1.5 text-fg-faint/40">·</span>
            <kbd className="ds-kbd">↵</kbd> 发送
          </span>
          <button
            className={`inline-flex items-center justify-center w-8 h-8 border-0 rounded-full cursor-pointer shrink-0 transition-all duration-[var(--dur-fast)] active:scale-95 ${
              text.trim()
                ? "bg-accent text-accent-fg hover:brightness-110"
                : "bg-bg-elev-2 text-fg-faint"
            }`}
            style={text.trim() ? {boxShadow: "var(--ds-shadow-accent-btn)"} : undefined}
            onClick={handleSubmit}
            disabled={!text.trim()}
          >
            <ArrowUp size={16} />
          </button>
        </div>
      </div>

      {showShortcuts && (
        <div className="w-full mt-3 animate-[toast-in_0.3s_ease-out]">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-accent-soft border border-accent/15 text-[11px] text-fg-dim">
            <Code size={12} className="text-accent" />
            <span>
              <kbd className="font-mono text-accent bg-accent/10 rounded px-1 py-px text-[10px]">Enter</kbd> 发送
              <span className="mx-1.5 text-fg-faint">·</span>
              <kbd className="font-mono text-accent bg-accent/10 rounded px-1 py-px text-[10px]">Shift+Enter</kbd> 换行
              <span className="mx-1.5 text-fg-faint">·</span>
              <kbd className="font-mono text-accent bg-accent/10 rounded px-1 py-px text-[10px]">/</kbd> 命令
              <span className="mx-1.5 text-fg-faint">·</span>
              <kbd className="font-mono text-accent bg-accent/10 rounded px-1 py-px text-[10px]">@</kbd> 文件引用
            </span>
          </div>
        </div>
      )}

      <div className={`welcome-stagger-4 grid grid-cols-3 gap-2 mt-4 w-full ${compact ? "[&_button]:p-2 [&_button]:text-[11px]" : ""}`}>
        {QUICK_COMMANDS.map((cmd) => (
          <button
            key={cmd.label}
            className={`flex items-center gap-2 text-left font-[inherit] bg-bg-elev border border-border-soft text-fg-dim rounded-xl hover:text-fg hover:border-accent/20 hover:bg-bg-elev hover:-translate-y-px hover:shadow-[var(--ds-shadow-card)] transition-all ${compact ? "p-2 text-[11px]" : "p-2.5 text-[12px]"}`}
            onClick={() => onPrompt(cmd.prompt)}
            title={cmd.prompt}
          >
            <span className="text-fg-faint shrink-0">{cmd.icon}</span>
            <span className="font-medium truncate">{cmd.label}</span>
          </button>
        ))}
      </div>

      {recentSessions.length > 0 && onResumeSession && (
        <div className="w-full mt-5 pt-4 border-t border-border-soft">
          <div className={`font-semibold text-fg-faint uppercase tracking-wider mb-2.5 flex items-center gap-1.5 ${compact ? "text-[10px]" : "text-[11px]"}`}>
            <Clock size={12} />
            最近会话
          </div>
          <div className="flex flex-col gap-1.5">
            {recentSessions.map((s) => (
              <button
                key={s.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg bg-bg-soft border border-border-soft text-left font-[inherit] text-fg-dim hover:text-fg hover:bg-bg-elev hover:border-fg-faint transition-all ${compact ? "text-[11px]" : "text-[12px]"}`}
                onClick={() => void onResumeSession(s.path)}
              >
                <MessageSquare size={compact ? 12 : 13} className="text-fg-faint shrink-0" />
                <span className="flex-1 truncate font-medium">{sessionTitle(s, "未命名会话")}</span>
                <span className={`text-fg-faint shrink-0 ${compact ? "text-[10px]" : "text-[11px]"}`}>{formatTimeAgo(s.modTime)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
