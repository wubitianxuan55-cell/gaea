import { useState, useCallback, useEffect } from "react";
import { Search, BookOpen, X } from "lucide-react";
import { app } from "../lib/bridge";
import type { SpecEntryView } from "../lib/types";

export function SpecPanel() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SpecEntryView[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const doSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) {
      setResults([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    setSearched(true);
    try {
      const entries = await app.SearchSpecs(trimmed);
      setResults(entries);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim()) {
        doSearch(query);
      } else {
        setResults([]);
        setSearched(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, doSearch]);

  const categories = new Set(results.map((r) => r.category));
  const [activeCat, setActiveCat] = useState("");

  const filtered = activeCat
    ? results.filter((r) => r.category === activeCat)
    : results;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border-soft">
        <BookOpen size={13} className="text-accent shrink-0" />
        <span className="text-xs font-semibold text-fg-dim">规范浏览</span>
      </div>

      <div className="px-3 pt-2 pb-1">
        <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-bg-soft border border-border-soft">
          <Search size={12} className="text-fg-faint shrink-0" />
          <input
            className="flex-1 bg-transparent text-xs text-fg outline-none placeholder:text-fg-faint/60"
            placeholder="搜索规范关键词…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button
              className="text-fg-faint hover:text-fg"
              onClick={() => setQuery("")}
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {categories.size > 1 && (
        <div className="flex gap-1 px-3 pb-1 overflow-x-auto">
          <button
            className={`text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap ${
              activeCat === "" ? "bg-accent text-bg" : "bg-bg-soft text-fg-dim"
            }`}
            onClick={() => setActiveCat("")}
          >
            全部
          </button>
          {[...categories].map((cat) => (
            <button
              key={cat}
              className={`text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap ${
                activeCat === cat
                  ? "bg-accent text-bg"
                  : "bg-bg-soft text-fg-dim"
              }`}
              onClick={() => setActiveCat(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-3">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <span className="text-fg-faint text-xs">搜索中…</span>
          </div>
        )}

        {!loading && searched && results.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <BookOpen size={24} className="text-fg-faint/40 mb-2" />
            <span className="text-fg-faint text-xs">
              未找到与「{query}」匹配的规范
            </span>
          </div>
        )}

        {!loading && !searched && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Search size={24} className="text-fg-faint/40 mb-2" />
            <span className="text-fg-faint text-xs">输入关键词搜索规范</span>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div className="flex flex-col gap-2 pt-2">
            {filtered.map((entry, i) => (
              <div
                key={i}
                className="rounded-lg bg-bg-soft border border-border-soft p-3"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold text-fg">
                    {entry.code}
                  </span>
                  <span className="text-[10px] text-fg-faint">
                    {entry.clause}
                  </span>
                  <span className="ml-auto text-[9px] px-1.5 py-px rounded-full bg-accent-soft text-accent">
                    {entry.category}
                  </span>
                </div>
                <div className="text-[11px] text-fg-dim font-medium mb-0.5">
                  {entry.title}
                </div>
                <div className="text-[10px] text-fg-faint/80 leading-relaxed mb-1">
                  {entry.content.length > 120
                    ? entry.content.slice(0, 120) + "…"
                    : entry.content}
                </div>
                <div className="text-[9px] text-fg-faint/60 italic">
                  {entry.explanation}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
