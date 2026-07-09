import { BookOpen, Search, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KnowledgeEntry, KnowledgeSummary } from "../lib/types";
import { app } from "../lib/bridge";
import { useT } from "../lib/i18n";
import { EmptyState } from "./EmptyState";

// All categories from the Go constants, plus "all".
const CATEGORIES = [
  "all",
  "规范标准",
  "工程案例",
  "经验总结",
  "材料工艺",
  "法规政策",
  "调查报告",
  "设计方案",
  "其他",
];

export function KnowledgePanel(p: { onClose: () => void }) {
  const { onClose } = p;
  const t = useT();
  const [entries, setEntries] = useState<KnowledgeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [expandedEntry, setExpandedEntry] = useState<KnowledgeEntry | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Load list on mount.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    app.KnowledgeList().then((list) => {
      if (!cancelled) {
        setEntries(list);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, []);

  // Focus search on mount.
  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  // Filtered entries.
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      entries.filter((e) => {
        if (category !== "all" && e.category !== category) return false;
        if (!normalizedQuery) return true;
        return [e.title, e.name, e.category, ...e.tags]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);
      }),
    [entries, normalizedQuery, category],
  );

  // Expand/collapse detail.
  const handleToggle = useCallback(
    async (name: string) => {
      if (expanded === name) {
        setExpanded(null);
        setExpandedEntry(null);
        setDetailError(null);
        return;
      }
      setExpanded(name);
      setExpandedEntry(null);
      setDetailError(null);
      setDetailLoading(true);
      try {
        const entry = await app.KnowledgeGet(name);
        if (entry) {
          setExpandedEntry(entry);
        } else {
          setDetailError("条目不存在");
        }
      } catch {
        setDetailError("加载失败");
      }
      setDetailLoading(false);
    },
    [expanded],
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[64px] pb-8"
      style={{ background: "var(--ds-overlay)" }}
    >
      <div className="relative w-full max-w-[620px] max-h-full flex flex-col rounded-xl border border-border-soft bg-bg shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border-soft shrink-0">
          <BookOpen size={17} className="text-accent" />
          <h2 className="flex-1 text-fg text-[14px] font-semibold">{t("knowledge.title")}</h2>
          <button
            className="inline-flex items-center justify-center w-7 h-7 border-0 rounded-md bg-transparent text-fg-faint cursor-pointer hover:text-fg hover:bg-bg-soft transition-colors"
            onClick={onClose}
            aria-label={t("common.close")}
            type="button"
          >
            <X size={15} />
          </button>
        </div>

        {/* Search & category filters */}
        <div className="shrink-0 px-4 pt-3 pb-2 space-y-2">
          <div className="flex items-center gap-1.5 px-3 h-8 border border-border rounded-lg bg-bg text-fg-faint focus-within:border-accent transition-colors">
            <Search size={14} />
            <input
              ref={searchRef}
              className="flex-1 min-w-0 border-0 outline-none bg-transparent text-fg text-[12.5px] placeholder:text-fg-faint"
              placeholder={t("knowledge.search")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label={t("knowledge.search")}
            />
            {query && (
              <button
                className="bg-transparent border-0 text-fg-faint cursor-pointer hover:text-fg p-0"
                onClick={() => setQuery("")}
                type="button"
              >
                <X size={12} />
              </button>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                className={`px-2.5 py-1 rounded-full text-[11.5px] border cursor-pointer transition-colors ${
                  category === cat
                    ? "bg-accent text-accent-fg border-accent"
                    : "bg-transparent text-fg-faint border-border-soft hover:border-accent hover:text-fg"
                }`}
                onClick={() => setCategory(cat)}
                type="button"
              >
                {cat === "all" ? t("knowledge.all") : cat}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-3">
          {loading ? (
            <div className="py-10 text-center text-fg-faint text-[13px]">{t("common.loading")}</div>
          ) : entries.length === 0 ? (
            <EmptyState message={t("knowledge.empty")} />
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center text-fg-faint text-[13px]">
              {t("knowledge.noMatch")}
              {(query || category !== "all") && (
                <button
                  className="block mx-auto mt-2 text-accent text-[12px] bg-transparent border-0 cursor-pointer hover:underline"
                  onClick={() => { setQuery(""); setCategory("all"); }}
                  type="button"
                >
                  {t("memory.clearFilters")}
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-2 pt-2">
              {filtered.map((entry) => (
                <div key={entry.name}>
                  {/* Card */}
                  <button
                    className={`w-full text-left flex flex-col gap-1 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${
                      expanded === entry.name
                        ? "border-accent bg-sidebar-active"
                        : "border-border-soft bg-bg hover:border-accent-soft hover:bg-bg-soft"
                    }`}
                    onClick={() => void handleToggle(entry.name)}
                    type="button"
                  >
                    <div className="flex items-start gap-2">
                      <span className="flex-1 text-fg text-[13px] font-medium leading-snug">{entry.title}</span>
                      <span className="shrink-0 text-[10.5px] text-accent font-medium px-1.5 py-0.5 rounded-full bg-accent/10">
                        {entry.category}
                      </span>
                    </div>
                    {entry.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {entry.tags.map((tag) => (
                          <span
                            key={tag}
                            className="text-[10px] text-fg-faint px-1.5 py-0.5 rounded-full bg-bg-soft"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="text-[10.5px] text-fg-faint">
                      {entry.updatedAt && new Date(entry.updatedAt).toLocaleDateString()}
                    </div>
                  </button>

                  {/* Expanded detail */}
                  {expanded === entry.name && (
                    <div className="mx-2 px-3 py-3 border-l-2 border-accent/40 bg-bg-soft rounded-r-lg mt-0.5">
                      {detailLoading ? (
                        <div className="text-fg-faint text-[12px]">{t("common.loading")}</div>
                      ) : detailError ? (
                        <div className="text-err text-[12px]">{detailError}</div>
                      ) : expandedEntry ? (
                        <div className="space-y-2">
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-fg-faint">
                            {expandedEntry.author && <span>作者: {expandedEntry.author}</span>}
                            {expandedEntry.phase && <span>阶段: {expandedEntry.phase}</span>}
                            {expandedEntry.discipline && <span>专业: {expandedEntry.discipline}</span>}
                            {expandedEntry.source && <span>来源: {expandedEntry.source}</span>}
                            {expandedEntry.version > 0 && <span>版本: v{expandedEntry.version}</span>}
                          </div>
                          <div className="text-fg text-[12.5px] leading-relaxed whitespace-pre-wrap break-words">
                            {expandedEntry.body}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
