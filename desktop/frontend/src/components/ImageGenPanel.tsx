// ImageGenPanel.tsx — 绘梦图片生成弹窗（wubigork 三栏布局）
import { useState, useCallback, useEffect, useRef } from "react";
import {
  X, Sparkles, Play, Square, Loader2,
  Shuffle, Trash2, Pencil,
} from "lucide-react";
import { generateFreeImage, getComfyUIStatus, startComfyUI, stopComfyUI, saveImageResults, loadImageResults } from "../lib/image";
import { ResultGallery } from "./ResultGallery";
import { PromptBar } from "./imagegen/PromptBar";
import { Lightbox, type LightboxImage } from "./Lightbox";
import {
  TEMPLATES, getAllCategories,
  loadCustomTemplates, saveCustomTemplates, generateTemplateId,
  type Template, type CustomTemplate,
} from "../data/imageTemplates";
import type { ImageGenResult, ComfyUIStatus } from "../lib/types";

// ── 尺寸选项 ──
const SIZE_OPTIONS = [
  { label: "🟦 方形 1:1 (1024)", value: "1024x1024" },
  { label: "🖼 风景 4:3", value: "1024x768" },
  { label: "🎬 宽屏 16:9", value: "1024x576" },
  { label: "📱 竖屏 9:16", value: "576x1024" },
  { label: "📐 肖像 3:4", value: "768x1024" },
  { label: "🖥 超宽 21:9", value: "1280x544" },
];

// ── 模型选项 ──
const MODEL_OPTIONS = [
  { label: "🌊 Flux Dev", value: "flux" },
  { label: "⚡ Z-Image-Turbo", value: "z-image-turbo" },
];

interface ImageGenPanelProps {
  onClose: () => void;
}

export function ImageGenPanel({ onClose }: ImageGenPanelProps) {
  // 输入状态
  const [prompt, setPrompt] = useState("");
  const [negative, setNegative] = useState("");
  const [size, setSize] = useState("1024x1024");
  const [model, setModel] = useState("flux");
  const [seed, setSeed] = useState(0);
  const [count, setCount] = useState(1);

  // 模板
  const [templateCat, setTemplateCat] = useState<string | undefined>();
  const [customTemplates, setCustomTemplates] = useState<CustomTemplate[]>(() => loadCustomTemplates());
  const [showCustomEditor, setShowCustomEditor] = useState(false);
  const [editingCustom, setEditingCustom] = useState<CustomTemplate | null>(null);
  const [customLabel, setCustomLabel] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [customNegative, setCustomNegative] = useState("");

  // 生成状态
  const [generating, setGenerating] = useState(false);
  const [comfyStatus, setComfyStatus] = useState<ComfyUIStatus>({ running: false, url: "" });
  const [comfyStarting, setComfyStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

  // 结果
  const [results, setResults] = useState<ImageGenResult[]>([]);
  const [history, setHistory] = useState<ImageGenResult[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(-1);

  // 定时器
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const generatingRef = useRef(false);

  // 加载 ComfyUI 状态
  const refreshStatus = useCallback(async () => {
    try {
      const s = await getComfyUIStatus();
      setComfyStatus(s);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    refreshStatus();
    const interval = comfyStarting ? 2000 : 10000;
    const iv = setInterval(refreshStatus, interval);
    return () => clearInterval(iv);
  }, [refreshStatus, comfyStarting]);

  // 启动成功后自动清除启动中状态
  useEffect(() => {
    if (comfyStatus.running && comfyStarting) {
      setComfyStarting(false);
    }
  }, [comfyStatus.running, comfyStarting]);

  // 加载持久化历史
  useEffect(() => {
    void (async () => {
      try {
        const h = await loadImageResults();
        if (h && h.length > 0) {
          const items = h as unknown as ImageGenResult[];
          setHistory(items);
        }
      } catch { /* ignore */ }
    })();
  }, []);

  // 生成计时
  useEffect(() => {
    if (!generating) { setElapsed(0); return; }
    const start = Date.now();
    timerRef.current = setInterval(() => setElapsed(Math.round((Date.now() - start) / 1000)), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [generating]);

  // 生成
  const generate = async () => {
    if (!prompt.trim()) return;
    generatingRef.current = true;
    setError(null);
    setGenerating(true);
    setResults([]);
    try {
      const resp = await generateFreeImage(prompt, negative, size, model, seed, count);
      if (resp.error) {
        setError(resp.error);
      } else if (resp.images) {
        const newItems = resp.images as ImageGenResult[];
        setResults(newItems);
        setHistory((prev) => [...newItems, ...prev]);
        saveImageResults(newItems as unknown as Record<string, unknown>[]).catch(() => {});
      }
    } catch (e: unknown) {
      setError(typeof e === "string" ? e : (e instanceof Error ? e.message : String(e ?? "生成失败")));
    } finally {
      setGenerating(false);
      generatingRef.current = false;
    }
  };

  // ComfyUI 启停
  const handleStart = async () => {
    setComfyStarting(true);
    try { await startComfyUI(); }
    catch (e: unknown) {
      setError(typeof e === "string" ? e : (e instanceof Error ? e.message : String(e ?? "启动失败")));
      setComfyStarting(false);
    }
  };
  const handleStop = async () => {
    try { await stopComfyUI(); setComfyStatus({ running: false, url: "" }); }
    catch (e: unknown) { setError(typeof e === "string" ? e : (e instanceof Error ? e.message : String(e ?? "停止失败"))); }
  };

  // 复用

  // 复用
  const reuseResult = (r: ImageGenResult) => {
    setPrompt(r.prompt);
    if (r.model) setModel(r.model);
    if (r.size) setSize(r.size);
    if (r.seed) setSeed(r.seed);
  };

  // 删除
  const handleDelete = (index: number) => {
    const r = results[index];
    if (!r) return;
    setResults((prev) => prev.filter((_, i) => i !== index));
    setHistory((prev) => prev.filter((h) => !(h.seed === r.seed && h.prompt === r.prompt && h.time === r.time)));
    if (lightboxIndex === index) setLightboxIndex(-1);
    else if (lightboxIndex > index) setLightboxIndex((li) => li - 1);
  };

  // 下载
  const handleDownload = (index: number) => {
    const r = results[index];
    if (!r?.image) return;
    const a = document.createElement("a");
    a.href = r.image;
    a.download = `gaea-${r.seed || Date.now()}.png`;
    a.click();
  };

  // ── 自定义模板 CRUD ──
  const openCustomAdd = () => {
    setEditingCustom(null); setCustomLabel(""); setCustomPrompt(""); setCustomNegative("");
    setShowCustomEditor(true);
  };
  const openCustomEdit = (t: CustomTemplate) => {
    setEditingCustom(t); setCustomLabel(t.label); setCustomPrompt(t.prompt); setCustomNegative(t.negative);
    setShowCustomEditor(true);
  };
  const saveCustom = () => {
    if (!customLabel.trim() || !customPrompt.trim()) return;
    let updated: CustomTemplate[];
    if (editingCustom) {
      updated = customTemplates.map((t) => t.id === editingCustom.id ? { ...t, label: customLabel, prompt: customPrompt, negative: customNegative } : t);
    } else {
      updated = [...customTemplates, { id: generateTemplateId(), label: customLabel, prompt: customPrompt, negative: customNegative }];
    }
    setCustomTemplates(updated);
    saveCustomTemplates(updated);
    setShowCustomEditor(false);
  };
  const deleteCustom = (id: string) => {
    const updated = customTemplates.filter((t) => t.id !== id);
    setCustomTemplates(updated);
    saveCustomTemplates(updated);
  };

  const applyTemplate = (t: Template) => {
    setPrompt((p) => p ? p + "，" + t.prompt : t.prompt);
    if (t.negative) setNegative((n) => n ? n + ", " + t.negative : t.negative);
  };

  const allCats = getAllCategories(customTemplates.length);
  const currentTemplates: (Template & { _id?: string })[] = templateCat
    ? (templateCat === "⭐ 自定义" ? customTemplates.map((t) => ({ ...t, _id: t.id })) : TEMPLATES[templateCat] || [])
    : [];

  // Lightbox
  const lightboxImages: LightboxImage[] = results.map((r) => ({
    dataUrl: r.image,
    prompt: r.prompt,
    seed: r.seed,
  }));

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      {/* 弹窗主体 */}
      <div
        className="w-full max-w-5xl h-[90vh] flex flex-col rounded-2xl bg-white dark:bg-gray-900 shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ═══ 顶栏 ═══ */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">绘梦</h2>
            {/* ComfyUI 状态 */}
            {comfyStarting ? (
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                <Loader2 className="w-2.5 h-2.5 animate-spin" />
                启动中…
              </span>
            ) : (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  comfyStatus.running
                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                    : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${comfyStatus.running ? "bg-green-500 animate-pulse" : "bg-gray-400"}`} />
                {comfyStatus.running ? "已连接" : "未连接"}
              </span>
            )}
            {!comfyStarting && (comfyStatus.running ? (
              <button onClick={handleStop} className="rounded-full p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition" title="停止">
                <Square className="w-3 h-3" />
              </button>
            ) : (
              <button onClick={handleStart} className="rounded-full p-1 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 transition" title="启动">
                <Play className="w-3 h-3" />
              </button>
            ))}
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-gray-800 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ═══ 三栏主体 ═══ */}
        <div className="flex-1 flex gap-4 overflow-hidden p-4">
          {/* ── 左栏：参数 w-52 ── */}
          <div className="w-52 shrink-0 flex flex-col gap-4 overflow-y-auto pr-1">
            {/* 错误提示 */}
            {error && (
              <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-2.5 py-2 text-[11px] text-red-700 dark:text-red-400">
                {error}
                <button onClick={() => setError(null)} className="ml-1 underline">✕</button>
              </div>
            )}

            {/* 模板 */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400">📐 快速模板</span>
                <button onClick={openCustomAdd} className="text-[10px] text-purple-500 hover:text-purple-600">+ 自定义</button>
              </div>
              <select
                value={templateCat || ""}
                onChange={(e) => setTemplateCat(e.target.value || undefined)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-[11px] text-gray-900 dark:text-white mb-1.5 focus:ring-2 focus:ring-purple-500"
              >
                <option value="">选择类别…</option>
                {allCats.map((c) => (<option key={c} value={c}>{c}</option>))}
              </select>
              {currentTemplates.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {currentTemplates.map((t, i) => {
                    const isCustom = templateCat === "⭐ 自定义";
                    return (
                      <span
                        key={isCustom ? (t._id || i) : i}
                        onClick={() => !isCustom && applyTemplate(t)}
                        className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] cursor-pointer transition border ${
                          isCustom
                            ? "border-purple-300 dark:border-purple-700 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400"
                            : "border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:border-gray-300"
                        }`}
                      >
                        {isCustom && (
                          <span onClick={(e) => { e.stopPropagation(); openCustomEdit(t as CustomTemplate); }} className="cursor-pointer">
                            <Pencil className="w-2 h-2 mr-0.5 inline" />
                          </span>
                        )}
                        {t.label}
                        {isCustom && (
                          <button onClick={(e) => { e.stopPropagation(); deleteCustom((t as CustomTemplate).id); }} className="ml-0.5 hover:text-red-500">
                            <X className="w-2 h-2" />
                          </button>
                        )}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 种子 */}
            <div>
              <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 block mb-1">🎲 种子</span>
              <div className="flex gap-1">
                <input
                  type="number"
                  value={seed || ""}
                  onChange={(e) => setSeed(Number(e.target.value) || 0)}
                  placeholder="随机"
                  min={1}
                  className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-[11px] text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                />
                <button onClick={() => setSeed(0)} className="px-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" title="随机">
                  <Shuffle className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* 负向提示词 */}
            <div>
              <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 block mb-1">🚫 不想出现</span>
              <textarea
                placeholder="模糊, 低质量, 畸形手指..."
                value={negative}
                onChange={(e) => setNegative(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-[11px] text-gray-900 dark:text-white placeholder-gray-400 resize-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            {/* 图片参数 */}
            <div>
              <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 block mb-1">📐 图片参数</span>
              <div className="flex flex-col gap-1.5">
                <select value={size} onChange={(e) => setSize(e.target.value)} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-[11px] text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500">
                  {SIZE_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
                </select>
                <select value={model} onChange={(e) => setModel(e.target.value)} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-[11px] text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500">
                  {MODEL_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
                </select>
                <div>
                  <span className="text-[10px] text-gray-500 dark:text-gray-400 block mb-0.5">生成数量</span>
                  <select value={count} onChange={(e) => setCount(Number(e.target.value))} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-[11px] text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500">
                    {[1, 2, 3, 4].map((n) => (<option key={n} value={n}>{n}</option>))}
                  </select>
                </div>
              </div>
            </div>

            {/* 自定义模板编辑器 */}
            {showCustomEditor && (
              <div className="rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/20 p-2.5 space-y-1.5">
                <input value={customLabel} onChange={(e) => setCustomLabel(e.target.value)} placeholder="模板名称" className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-[11px]" />
                <textarea value={customPrompt} onChange={(e) => setCustomPrompt(e.target.value)} placeholder="提示词" rows={2} className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-[11px] resize-none" />
                <textarea value={customNegative} onChange={(e) => setCustomNegative(e.target.value)} placeholder="负向（可选）" rows={1} className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-[11px] resize-none" />
                <div className="flex gap-1.5">
                  <button onClick={saveCustom} disabled={!customLabel.trim() || !customPrompt.trim()} className="flex-1 rounded bg-purple-600 px-2 py-1 text-[11px] text-white hover:bg-purple-700 disabled:opacity-50 transition">保存</button>
                  <button onClick={() => setShowCustomEditor(false)} className="rounded border border-gray-300 dark:border-gray-600 px-2 py-1 text-[11px] text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition">取消</button>
                </div>
              </div>
            )}
          </div>

          {/* ── 中间：画廊 + PromptBar ── */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <div className="flex-1 overflow-y-auto">
              <ResultGallery
                results={results}
                generating={generating}
                onPreview={(i) => setLightboxIndex(i)}
                onDownload={handleDownload}
                onReuse={reuseResult}
                onDelete={handleDelete}
              />
            </div>
            <PromptBar
              prompt={prompt}
              onPromptChange={setPrompt}
              generating={generating}
              elapsed={elapsed}
              onGenerate={generate}
            />
          </div>

          {/* ── 右栏：历史 w-44 ── */}
          <div className="w-44 shrink-0 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between shrink-0 mb-2">
              <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400">📜 历史 ({history.length})</span>
              <div className="flex items-center gap-0.5">
                <button onClick={() => setHistory([])} className="text-[10px] text-gray-400 hover:text-red-500 px-1 transition" title="清空">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto flex flex-col gap-1.5">
              {history.length === 0 && (
                <p className="text-[10px] text-gray-400 dark:text-gray-500 text-center mt-8">暂无历史</p>
              )}
              {history.map((h, i) => (
                <div
                  key={i}
                  onClick={() => setLightboxIndex(i)}
                  className={`rounded-lg overflow-hidden cursor-pointer shrink-0 transition border-2 ${
                    lightboxIndex === i ? "border-purple-500" : "border-transparent hover:border-gray-300 dark:hover:border-gray-600"
                  }`}
                >
                  <img src={h.image} alt="" className="w-full block object-cover" style={{ aspectRatio: "1/1" }} loading="lazy" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {lightboxIndex >= 0 && (
        <Lightbox
          images={lightboxImages}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(-1)}
          onNavigate={(i) => setLightboxIndex(i)}
        />
      )}
    </div>
  );
}
