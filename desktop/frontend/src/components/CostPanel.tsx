import { useState, useEffect, useCallback, useRef } from "react";
import { Calculator, X, Plus, Pencil, Trash2, Check, X as XIcon } from "lucide-react";
import { app } from "../lib/bridge";
import { useT } from "../lib/i18n";
import type { CostDBView, CostItemView, LaborItemView, MaterialItemView, MachineItemView, RegionFactorView } from "../lib/types";
import type { DictKey } from "../locales/en";

type TFunc = (key: DictKey, vars?: Record<string, string | number>) => string;

/** 空 CostItemView */
function emptyCostItem(): CostItemView {
  return { code: "", name: "", category: "", unit: "元/次", basePrice: 0, laborCost: 0, materialCost: 0, machineCost: 0, overheadRate: 10, profitRate: 8, taxRate: 6, wasteFactor: 1.0, source: "", confidence: 0.7, region: "全国", validFrom: "", remark: "" };
}

/** 空 LaborItemView */
function emptyLabor(): LaborItemView {
  return { tradeType: "", unit: "元/工日", price: 0, region: "全国", priceDate: "", source: "" };
}

/** 空 MaterialItemView */
function emptyMaterial(): MaterialItemView {
  return { code: "", nameSpec: "", unit: "元/吨", price: 0, source: "", priceDate: "", region: "全国" };
}

/** 空 MachineItemView */
function emptyMachine(): MachineItemView {
  return { code: "", nameSpec: "", unit: "元/台班", purchasePrice: 0, hourlyRate: 0, fuelRate: 0, operatorLabor: 0, region: "全国" };
}

/** 空 RegionFactorView */
function emptyRegion(): RegionFactorView {
  return { region: "", adjustmentFactor: 1.0, validFrom: "" };
}

// ── 主面板 ──────────────────────────────────────────────────────────────

export function CostPanel(p: { onClose: () => void }) {
  const t = useT();
  const [db, setDb] = useState<CostDBView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("items");
  const [backups, setBackups] = useState<string[]>([]);
  const [selectedBackup, setSelectedBackup] = useState("");
  const [backupMsg, setBackupMsg] = useState<string | null>(null);

  const handleBackup = async () => {
    try {
      const name = await app.CostDBBackup();
      setBackupMsg(`备份已创建: ${name}`);
      setBackups(await app.CostDBListBackups());
      setTimeout(() => setBackupMsg(null), 3000);
    } catch (e) {
      setBackupMsg(`备份失败: ${e}`);
      setTimeout(() => setBackupMsg(null), 3000);
    }
  };

  const handleRestore = async () => {
    if (!selectedBackup) return;
    try {
      await app.CostDBRestore(selectedBackup);
      setBackupMsg("已恢复，正在刷新...");
      setTimeout(() => loadDB(), 500);
    } catch (e) {
      setBackupMsg(`恢复失败: ${e}`);
      setTimeout(() => setBackupMsg(null), 3000);
    }
  };

  const loadDB = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await app.CostDBLoad();
      setDb(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDB();
  }, [loadDB]);

  useEffect(() => {
    const loadBackups = async () => {
      try {
        const list = await app.CostDBListBackups();
        setBackups(list);
      } catch {
        // Wails binding may not be ready yet
      }
    };
    void loadBackups();
  }, []);

  useEffect(() => {
    const handler = (ke: KeyboardEvent) => {
      if (ke.key === "Escape") p.onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [p.onClose]);

  const saveDB = useCallback(async (updated: CostDBView) => {
    try {
      await app.CostDBSave(updated);
      setDb(updated);
    } catch (e) {
      setError(String(e));
    }
  }, []);

  const tabs = [
    { id: "items", label: t("cost.tab.items") },
    { id: "labor", label: t("cost.tab.labor") },
    { id: "material", label: t("cost.tab.material") },
    { id: "machine", label: t("cost.tab.machine") },
    { id: "regions", label: t("cost.tab.regions") },
    { id: "estimate", label: t("cost.tab.estimate") },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] backdrop-blur-sm bg-black/30" onClick={p.onClose}>
      <div
        className="bg-bg-secondary border border-border rounded-xl shadow-2xl w-[860px] max-w-[95vw] max-h-[80vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2.5">
            <Calculator size={18} className="text-fg" />
            <h2 className="text-[15px] font-semibold">{t("cost.title")}</h2>
          </div>
          <button className="flex items-center justify-center w-7 h-7 rounded-md text-fg-faint hover:text-fg hover:bg-sidebar-hover transition-colors" onClick={p.onClose}>
            <X size={15} />
          </button>
        </div>

        <div className="flex gap-1 px-4 pt-3 pb-2 border-b border-border shrink-0 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`px-3 py-1.5 rounded-md text-[13px] transition-colors shrink-0 ${
                activeTab === tab.id ? "bg-accent text-white font-medium" : "text-fg-faint hover:text-fg hover:bg-sidebar-hover"
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 备份管理栏 */}
        <div className="flex items-center gap-2 px-4 py-1.5 border-b border-border bg-bg-tertiary/30">
          <button className="flex items-center gap-1 px-2 py-1 rounded-md text-fg-faint hover:text-fg hover:bg-sidebar-hover text-[12px]" onClick={handleBackup}>
            💾 创建备份
          </button>
          <span className="text-fg-faint text-[12px]">|</span>
          <select className="px-1.5 py-1 rounded bg-bg-tertiary border border-border text-[12px] text-fg outline-none" value={selectedBackup} onChange={(e) => setSelectedBackup(e.target.value)}>
            <option value="">选择备份恢复...</option>
            {backups.map((b) => (<option key={b} value={b}>{b}</option>))}
          </select>
          <button className="flex items-center gap-1 px-2 py-1 rounded-md text-fg-faint hover:text-fg hover:bg-sidebar-hover text-[12px]" onClick={handleRestore} disabled={!selectedBackup}>
            ↩ 恢复
          </button>
          {backupMsg && <span className="text-[12px] text-accent ml-1">{backupMsg}</span>}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {error && <div className="text-red-500 text-sm mb-3 bg-red-500/10 p-2 rounded">{error}</div>}
          {loading ? (
            <div className="text-fg-faint text-sm">{t("common.loading")}</div>
          ) : !db || (!db.items && !db.labor && !db.materials && !db.machines && !db.regions) ? (
            <div className="text-fg-faint text-sm">{t("cost.empty")}</div>
          ) : activeTab === "items" ? (
            <ItemsTab db={db} saveDB={saveDB} t={t} />
          ) : activeTab === "labor" ? (
            <LaborTab db={db} saveDB={saveDB} />
          ) : activeTab === "material" ? (
            <MaterialTab db={db} saveDB={saveDB} />
          ) : activeTab === "machine" ? (
            <MachineTab db={db} saveDB={saveDB} />
          ) : activeTab === "regions" ? (
            <RegionsTab db={db} saveDB={saveDB} />
          ) : (
            <EstimateTab db={db} t={t} />
          )}
        </div>
      </div>
    </div>
  );
}

// ── 通用表格辅助 ──────────────────────────────────────────────────────────

/** 可编辑数字输入 */
function NumInput({ value, onChange, className = "" }: { value: number; onChange: (v: number) => void; className?: string }) {
  return (
    <input
      className={`w-full px-1.5 py-1 rounded bg-bg-tertiary border border-border text-[12px] text-fg outline-none focus:border-accent ${className}`}
      type="number"
      step="any"
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
    />
  );
}

/** 可编辑文本输入 */
function TextInput({ value, onChange, placeholder = "" }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      className="w-full px-1.5 py-1 rounded bg-bg-tertiary border border-border text-[12px] text-fg outline-none focus:border-accent"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  );
}

/** 行操作按钮组 */
function RowActions({ onEdit, onDelete, isEditing, onSave, onCancel }: {
  onEdit: () => void;
  onDelete: () => void;
  isEditing: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  if (isEditing) {
    return (
      <td className="py-1 px-2 text-right whitespace-nowrap">
        <button className="inline-flex items-center justify-center w-6 h-6 rounded text-green-500 hover:bg-green-500/10 mr-1" title="保存" onClick={onSave}>
          <Check size={14} />
        </button>
        <button className="inline-flex items-center justify-center w-6 h-6 rounded text-fg-faint hover:text-fg hover:bg-sidebar-hover" title="取消" onClick={onCancel}>
          <XIcon size={14} />
        </button>
      </td>
    );
  }
  return (
    <td className="py-1 px-2 text-right whitespace-nowrap">
      <button className="inline-flex items-center justify-center w-6 h-6 rounded text-fg-faint hover:text-accent hover:bg-accent/10 mr-1" title="编辑" onClick={onEdit}>
        <Pencil size={13} />
      </button>
      <button className="inline-flex items-center justify-center w-6 h-6 rounded text-fg-faint hover:text-red-500 hover:bg-red-500/10" title="删除" onClick={onDelete}>
        <Trash2 size={13} />
      </button>
    </td>
  );
}

// --- CSV 导出/导入辅助 ------------------------------------------------

function CSVActions({ kind, label }: { kind: string; label: string }) {
	const [importMsg, setImportMsg] = useState<string | null>(null);
	const fileRef = useRef<HTMLInputElement>(null);

	const handleExport = async () => {
		try {
			const csv = await app.CostDBExportCSV(kind);
			const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = `costdb-${kind}.csv`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
		} catch (e) {
			setImportMsg(`导出失败: ${e}`);
		}
	};

	const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;
		try {
			const text = await file.text();
			const result = await app.CostDBImportCSV(kind, text);
			const msgs: string[] = [];
		if (result.errors?.length) msgs.push(`${result.errors.length} 行有误`);
		setImportMsg(msgs.join("，") || "无变化");
		setTimeout(() => setImportMsg(null), 4000);
		} catch (e) {
			setImportMsg(`导入失败: ${e}`);
			setTimeout(() => setImportMsg(null), 4000);
		}
		if (fileRef.current) fileRef.current.value = "";
	};

	return (
		<>
			<input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleImport} />
			<button className="flex items-center gap-1 px-2 py-1.5 rounded-md text-fg-faint hover:text-fg hover:bg-sidebar-hover text-[13px]" onClick={handleExport} title={`导出 ${label} 为 CSV`}>
				↥ {label}
			</button>
			<button className="flex items-center gap-1 px-2 py-1.5 rounded-md text-fg-faint hover:text-fg hover:bg-sidebar-hover text-[13px]" onClick={() => fileRef.current?.click()} title={`从 CSV 导入 ${label}`}>
				↧ {label}
			</button>
			{importMsg && <span className="text-[12px] text-accent ml-2">{importMsg}</span>}
		</>
	);
}

// --- 成本条目 Tab ─────────────────────────────────────────────────────────

function ItemsTab({ db, saveDB, t }: { db: CostDBView; saveDB: (d: CostDBView) => Promise<void>; t: TFunc }) {
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [editForm, setEditForm] = useState<CostItemView>(emptyCostItem());

  const categories = [...new Set((db.items || []).map((i) => i.category))].sort();

  const filtered = (db.items || []).filter((i) => {
    if (catFilter !== "all" && i.category !== catFilter) return false;
    if (search && !i.code.toLowerCase().includes(search.toLowerCase()) && !i.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleAdd = () => {
    const item = { ...editForm };
    const next = { ...db, items: [...db.items, item] };
    void saveDB(next);
    setAdding(false);
    setEditForm(emptyCostItem());
  };

  const handleUpdate = (code: string) => {
    const next = { ...db, items: db.items.map((i) => (i.code === code ? { ...editForm } : i)) };
    void saveDB(next);
    setEditing(null);
  };

  const handleDelete = (code: string) => {
    const next = { ...db, items: db.items.filter((i) => i.code !== code) };
    void saveDB(next);
  };

  const startEdit = (item: CostItemView) => {
    setEditForm({ ...item });
    setEditing(item.code);
    setAdding(false);
  };

  const startAdd = () => {
    setEditForm(emptyCostItem());
    setAdding(true);
    setEditing(null);
  };

  return (
    <div>
      <div className="flex gap-2 mb-3 items-center">
        <input
          className="flex-1 px-2.5 py-1.5 rounded-md bg-bg-tertiary border border-border text-[13px] text-fg outline-none focus:border-accent"
          placeholder={t("cost.search")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="px-2.5 py-1.5 rounded-md bg-bg-tertiary border border-border text-[13px] text-fg outline-none"
          value={catFilter}
          onChange={(e) => setCatFilter(e.target.value)}
        >
          <option value="all">全部</option>
          {categories.map((c) => (<option key={c} value={c}>{c}</option>))}
        </select>
        <button className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-accent text-white text-[13px] hover:opacity-90" onClick={startAdd}>
          <Plus size={14} /> 新增
        </button>
        <CSVActions kind="items" label="CSV" />
      </div>

      {/* 新增行 */}
      {adding && (
        <div className="mb-3 p-2 rounded bg-bg-tertiary border border-border">
          <div className="grid grid-cols-4 gap-2 mb-2">
            <TextInput value={editForm.code} onChange={(v) => setEditForm({ ...editForm, code: v })} placeholder="编码 *" />
            <TextInput value={editForm.name} onChange={(v) => setEditForm({ ...editForm, name: v })} placeholder="名称 *" />
            <TextInput value={editForm.category} onChange={(v) => setEditForm({ ...editForm, category: v })} placeholder="分类" />
            <NumInput value={editForm.basePrice} onChange={(v) => setEditForm({ ...editForm, basePrice: v })} />
          </div>
          <div className="flex gap-2 justify-end">
            <button className="px-2 py-1 rounded bg-green-600 text-white text-[12px]" onClick={handleAdd}><Check size={13} className="inline mr-1" />保存</button>
            <button className="px-2 py-1 rounded bg-sidebar-hover text-fg text-[12px]" onClick={() => setAdding(false)}>取消</button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-[13px] border-collapse">
          <thead>
            <tr className="text-fg-faint border-b border-border">
              <th className="text-left py-1.5 px-2">编码</th>
              <th className="text-left py-1.5 px-2">名称</th>
              <th className="text-left py-1.5 px-2">分类</th>
              <th className="text-right py-1.5 px-2">基价</th>
              <th className="text-right py-1.5 px-2">人工</th>
              <th className="text-right py-1.5 px-2">材料</th>
              <th className="text-right py-1.5 px-2">机械</th>
              <th className="text-center py-1.5 px-2 w-[70px]">操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) =>
              editing === item.code ? (
                <tr key={item.code} className="border-b border-border/50 bg-bg-tertiary/50">
                  <td className="py-1 px-2"><TextInput value={editForm.code} onChange={(v) => setEditForm({ ...editForm, code: v })} /></td>
                  <td className="py-1 px-2"><TextInput value={editForm.name} onChange={(v) => setEditForm({ ...editForm, name: v })} /></td>
                  <td className="py-1 px-2"><TextInput value={editForm.category} onChange={(v) => setEditForm({ ...editForm, category: v })} /></td>
                  <td className="py-1 px-2"><NumInput value={editForm.basePrice} onChange={(v) => setEditForm({ ...editForm, basePrice: v })} /></td>
                  <td className="py-1 px-2"><NumInput value={editForm.laborCost} onChange={(v) => setEditForm({ ...editForm, laborCost: v })} /></td>
                  <td className="py-1 px-2"><NumInput value={editForm.materialCost} onChange={(v) => setEditForm({ ...editForm, materialCost: v })} /></td>
                  <td className="py-1 px-2"><NumInput value={editForm.machineCost} onChange={(v) => setEditForm({ ...editForm, machineCost: v })} /></td>
                  <RowActions onEdit={() => {}} onDelete={() => {}} isEditing={true} onSave={() => handleUpdate(item.code)} onCancel={() => setEditing(null)} />
                </tr>
              ) : (
                <tr key={item.code} className="border-b border-border/50 hover:bg-sidebar-hover transition-colors">
                  <td className="py-1.5 px-2 font-mono text-[12px]">{item.code}</td>
                  <td className="py-1.5 px-2">{item.name}</td>
                  <td className="py-1.5 px-2 text-fg-faint">{item.category}</td>
                  <td className="py-1.5 px-2 text-right">{item.basePrice.toFixed(2)}</td>
                  <td className="py-1.5 px-2 text-right">{item.laborCost.toFixed(2)}</td>
                  <td className="py-1.5 px-2 text-right">{item.materialCost.toFixed(2)}</td>
                  <td className="py-1.5 px-2 text-right">{item.machineCost.toFixed(2)}</td>
                  <RowActions onEdit={() => startEdit(item)} onDelete={() => handleDelete(item.code)} isEditing={false} onSave={() => {}} onCancel={() => {}} />
                </tr>
              )
            )}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="text-fg-faint text-sm mt-2">{t("cost.noMatch")}</div>}
      </div>
    </div>
  );
}

// ── 人工 Tab ─────────────────────────────────────────────────────────────

function LaborTab(p: { db: CostDBView; saveDB: (d: CostDBView) => Promise<void> }) {
  const db = p.db, saveDB = p.saveDB;
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<LaborItemView>(emptyLabor());

  const handleAdd = () => {
    void saveDB({ ...db, labor: [...db.labor, { ...form }] });
    setAdding(false);
    setForm(emptyLabor());
  };
  const handleUpdate = (tradeType: string) => {
    void saveDB({ ...db, labor: db.labor.map((l) => (l.tradeType === tradeType ? { ...form } : l)) });
    setEditing(null);
  };
  const handleDelete = (tradeType: string) => {
    void saveDB({ ...db, labor: db.labor.filter((l) => l.tradeType !== tradeType) });
  };

  return (
    <div>
      <div className="flex gap-2 mb-3 items-center">
        <button className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-accent text-white text-[13px] hover:opacity-90" onClick={() => { setForm(emptyLabor()); setAdding(true); setEditing(null); }}>
          <Plus size={14} /> 新增
        </button>
        <CSVActions kind="labor" label="CSV" />
      </div>
      {adding && (
        <div className="mb-3 p-2 rounded bg-bg-tertiary border border-border flex gap-2 flex-wrap">
          <TextInput value={form.tradeType} onChange={(v) => setForm({ ...form, tradeType: v })} placeholder="工种" />
          <NumInput value={form.price} onChange={(v) => setForm({ ...form, price: v })} />
          <button className="px-2 py-1 rounded bg-green-600 text-white text-[12px]" onClick={handleAdd}><Check size={13} className="inline mr-1" />保存</button>
          <button className="px-2 py-1 rounded bg-sidebar-hover text-fg text-[12px]" onClick={() => setAdding(false)}>取消</button>
        </div>
      )}
      <table className="w-full text-[13px] border-collapse">
        <thead>
          <tr className="text-fg-faint border-b border-border">
            <th className="text-left py-1.5 px-2">工种</th><th className="text-right py-1.5 px-2">单价</th><th className="text-center py-1.5 px-2 w-[70px]">操作</th>
          </tr>
        </thead>
        <tbody>
          {db.labor.map((l) =>
            editing === l.tradeType ? (
              <tr key={l.tradeType} className="border-b border-border/50 bg-bg-tertiary/50">
                <td className="py-1 px-2"><TextInput value={form.tradeType} onChange={(v) => setForm({ ...form, tradeType: v })} /></td>
                <td className="py-1 px-2"><NumInput value={form.price} onChange={(v) => setForm({ ...form, price: v })} /></td>
                <RowActions onEdit={() => {}} onDelete={() => {}} isEditing={true} onSave={() => handleUpdate(l.tradeType)} onCancel={() => setEditing(null)} />
              </tr>
            ) : (
              <tr key={l.tradeType} className="border-b border-border/50 hover:bg-sidebar-hover transition-colors">
                <td className="py-1.5 px-2">{l.tradeType}</td>
                <td className="py-1.5 px-2 text-right">{l.price.toFixed(2)}</td>
                <RowActions onEdit={() => { setForm({ ...l }); setEditing(l.tradeType); setAdding(false); }} onDelete={() => handleDelete(l.tradeType)} isEditing={false} onSave={() => {}} onCancel={() => {}} />
              </tr>
            )
          )}
        </tbody>
      </table>
    </div>
  );
}

// ── 材料 Tab ─────────────────────────────────────────────────────────────

function MaterialTab(p: { db: CostDBView; saveDB: (d: CostDBView) => Promise<void> }) {
  const db = p.db, saveDB = p.saveDB;
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<MaterialItemView>(emptyMaterial());

  const handleAdd = () => {
    void saveDB({ ...db, materials: [...db.materials, { ...form }] });
    setAdding(false);
    setForm(emptyMaterial());
  };
  const handleUpdate = (code: string) => {
    void saveDB({ ...db, materials: db.materials.map((m) => (m.code === code ? { ...form } : m)) });
    setEditing(null);
  };
  const handleDelete = (code: string) => {
    void saveDB({ ...db, materials: db.materials.filter((m) => m.code !== code) });
  };

  return (
    <div>
      <div className="flex gap-2 mb-3 items-center">
        <button className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-accent text-white text-[13px] hover:opacity-90" onClick={() => { setForm(emptyMaterial()); setAdding(true); setEditing(null); }}>
          <Plus size={14} /> 新增
        </button>
        <CSVActions kind="material" label="CSV" />
      </div>
      {adding && (
        <div className="mb-3 p-2 rounded bg-bg-tertiary border border-border flex gap-2 flex-wrap">
          <TextInput value={form.code} onChange={(v) => setForm({ ...form, code: v })} placeholder="编码" />
          <TextInput value={form.nameSpec} onChange={(v) => setForm({ ...form, nameSpec: v })} placeholder="名称" />
          <NumInput value={form.price} onChange={(v) => setForm({ ...form, price: v })} />
          <button className="px-2 py-1 rounded bg-green-600 text-white text-[12px]" onClick={handleAdd}><Check size={13} className="inline mr-1" />保存</button>
          <button className="px-2 py-1 rounded bg-sidebar-hover text-fg text-[12px]" onClick={() => setAdding(false)}>取消</button>
        </div>
      )}
      <table className="w-full text-[13px] border-collapse">
        <thead>
          <tr className="text-fg-faint border-b border-border">
            <th className="text-left py-1.5 px-2">编码</th><th className="text-left py-1.5 px-2">名称</th><th className="text-right py-1.5 px-2">单价</th><th className="text-center py-1.5 px-2 w-[70px]">操作</th>
          </tr>
        </thead>
        <tbody>
          {db.materials.map((m) =>
            editing === m.code ? (
              <tr key={m.code} className="border-b border-border/50 bg-bg-tertiary/50">
                <td className="py-1 px-2"><TextInput value={form.code} onChange={(v) => setForm({ ...form, code: v })} /></td>
                <td className="py-1 px-2"><TextInput value={form.nameSpec} onChange={(v) => setForm({ ...form, nameSpec: v })} /></td>
                <td className="py-1 px-2"><NumInput value={form.price} onChange={(v) => setForm({ ...form, price: v })} /></td>
                <RowActions onEdit={() => {}} onDelete={() => {}} isEditing={true} onSave={() => handleUpdate(m.code)} onCancel={() => setEditing(null)} />
              </tr>
            ) : (
              <tr key={m.code} className="border-b border-border/50 hover:bg-sidebar-hover transition-colors">
                <td className="py-1.5 px-2 font-mono text-[12px]">{m.code}</td>
                <td className="py-1.5 px-2">{m.nameSpec}</td>
                <td className="py-1.5 px-2 text-right">{m.price.toFixed(2)}</td>
                <RowActions onEdit={() => { setForm({ ...m }); setEditing(m.code); setAdding(false); }} onDelete={() => handleDelete(m.code)} isEditing={false} onSave={() => {}} onCancel={() => {}} />
              </tr>
            )
          )}
        </tbody>
      </table>
    </div>
  );
}

// ── 机械 Tab ─────────────────────────────────────────────────────────────

function MachineTab(p: { db: CostDBView; saveDB: (d: CostDBView) => Promise<void> }) {
  const db = p.db, saveDB = p.saveDB;
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<MachineItemView>(emptyMachine());

  const handleAdd = () => {
    void saveDB({ ...db, machines: [...db.machines, { ...form }] });
    setAdding(false);
    setForm(emptyMachine());
  };
  const handleUpdate = (code: string) => {
    void saveDB({ ...db, machines: db.machines.map((m) => (m.code === code ? { ...form } : m)) });
    setEditing(null);
  };
  const handleDelete = (code: string) => {
    void saveDB({ ...db, machines: db.machines.filter((m) => m.code !== code) });
  };

  return (
    <div>
      <div className="flex gap-2 mb-3 items-center">
        <button className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-accent text-white text-[13px] hover:opacity-90" onClick={() => { setForm(emptyMachine()); setAdding(true); setEditing(null); }}>
          <Plus size={14} /> 新增
        </button>
        <CSVActions kind="machine" label="CSV" />
      </div>
      {adding && (
        <div className="mb-3 p-2 rounded bg-bg-tertiary border border-border flex gap-2 flex-wrap">
          <TextInput value={form.code} onChange={(v) => setForm({ ...form, code: v })} placeholder="编码" />
          <TextInput value={form.nameSpec} onChange={(v) => setForm({ ...form, nameSpec: v })} placeholder="名称" />
          <NumInput value={form.purchasePrice} onChange={(v) => setForm({ ...form, purchasePrice: v })} />
          <button className="px-2 py-1 rounded bg-green-600 text-white text-[12px]" onClick={handleAdd}><Check size={13} className="inline mr-1" />保存</button>
          <button className="px-2 py-1 rounded bg-sidebar-hover text-fg text-[12px]" onClick={() => setAdding(false)}>取消</button>
        </div>
      )}
      <table className="w-full text-[13px] border-collapse">
        <thead>
          <tr className="text-fg-faint border-b border-border">
            <th className="text-left py-1.5 px-2">编码</th><th className="text-left py-1.5 px-2">名称</th><th className="text-right py-1.5 px-2">台班费</th><th className="text-center py-1.5 px-2 w-[70px]">操作</th>
          </tr>
        </thead>
        <tbody>
          {db.machines.map((m) =>
            editing === m.code ? (
              <tr key={m.code} className="border-b border-border/50 bg-bg-tertiary/50">
                <td className="py-1 px-2"><TextInput value={form.code} onChange={(v) => setForm({ ...form, code: v })} /></td>
                <td className="py-1 px-2"><TextInput value={form.nameSpec} onChange={(v) => setForm({ ...form, nameSpec: v })} /></td>
                <td className="py-1 px-2"><NumInput value={form.purchasePrice} onChange={(v) => setForm({ ...form, purchasePrice: v })} /></td>
                <RowActions onEdit={() => {}} onDelete={() => {}} isEditing={true} onSave={() => handleUpdate(m.code)} onCancel={() => setEditing(null)} />
              </tr>
            ) : (
              <tr key={m.code} className="border-b border-border/50 hover:bg-sidebar-hover transition-colors">
                <td className="py-1.5 px-2 font-mono text-[12px]">{m.code}</td>
                <td className="py-1.5 px-2">{m.nameSpec}</td>
                <td className="py-1.5 px-2 text-right">{m.purchasePrice.toFixed(2)}</td>
                <RowActions onEdit={() => { setForm({ ...m }); setEditing(m.code); setAdding(false); }} onDelete={() => handleDelete(m.code)} isEditing={false} onSave={() => {}} onCancel={() => {}} />
              </tr>
            )
          )}
        </tbody>
      </table>
    </div>
  );
}

// ── 地区系数 Tab ─────────────────────────────────────────────────────────

function RegionsTab(p: { db: CostDBView; saveDB: (d: CostDBView) => Promise<void> }) {
  const db = p.db, saveDB = p.saveDB;
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<RegionFactorView>(emptyRegion());

  const handleAdd = () => {
    void saveDB({ ...db, regions: [...db.regions, { ...form }] });
    setAdding(false);
    setForm(emptyRegion());
  };
  const handleUpdate = (region: string) => {
    void saveDB({ ...db, regions: db.regions.map((r) => (r.region === region ? { ...form } : r)) });
    setEditing(null);
  };
  const handleDelete = (region: string) => {
    void saveDB({ ...db, regions: db.regions.filter((r) => r.region !== region) });
  };

  return (
    <div>
      <div className="flex gap-2 mb-3 items-center">
        <button className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-accent text-white text-[13px] hover:opacity-90" onClick={() => { setForm(emptyRegion()); setAdding(true); setEditing(null); }}>
          <Plus size={14} /> 新增
        </button>
        <CSVActions kind="regions" label="CSV" />
      </div>
      {adding && (
        <div className="mb-3 p-2 rounded bg-bg-tertiary border border-border flex gap-2 flex-wrap">
          <TextInput value={form.region} onChange={(v) => setForm({ ...form, region: v })} placeholder="地区名" />
          <NumInput value={form.adjustmentFactor} onChange={(v) => setForm({ ...form, adjustmentFactor: v })} />
          <button className="px-2 py-1 rounded bg-green-600 text-white text-[12px]" onClick={handleAdd}><Check size={13} className="inline mr-1" />保存</button>
          <button className="px-2 py-1 rounded bg-sidebar-hover text-fg text-[12px]" onClick={() => setAdding(false)}>取消</button>
        </div>
      )}
      <table className="w-full text-[13px] border-collapse">
        <thead>
          <tr className="text-fg-faint border-b border-border">
            <th className="text-left py-1.5 px-2">地区</th><th className="text-right py-1.5 px-2">系数</th><th className="text-center py-1.5 px-2 w-[70px]">操作</th>
          </tr>
        </thead>
        <tbody>
          {db.regions.map((r) =>
            editing === r.region ? (
              <tr key={r.region} className="border-b border-border/50 bg-bg-tertiary/50">
                <td className="py-1 px-2"><TextInput value={form.region} onChange={(v) => setForm({ ...form, region: v })} /></td>
                <td className="py-1 px-2"><NumInput value={form.adjustmentFactor} onChange={(v) => setForm({ ...form, adjustmentFactor: v })} /></td>
                <RowActions onEdit={() => {}} onDelete={() => {}} isEditing={true} onSave={() => handleUpdate(r.region)} onCancel={() => setEditing(null)} />
              </tr>
            ) : (
              <tr key={r.region} className="border-b border-border/50 hover:bg-sidebar-hover transition-colors">
                <td className="py-1.5 px-2">{r.region}</td>
                <td className="py-1.5 px-2 text-right">{r.adjustmentFactor.toFixed(2)}</td>
                <RowActions onEdit={() => { setForm({ ...r }); setEditing(r.region); setAdding(false); }} onDelete={() => handleDelete(r.region)} isEditing={false} onSave={() => {}} onCancel={() => {}} />
              </tr>
            )
          )}
        </tbody>
      </table>
    </div>
  );
}

// ── 估算 Tab ─────────────────────────────────────────────────────────────

function EstimateTab({ db, t }: { db: CostDBView; t: TFunc }) {
  const [rows, setRows] = useState<{ code: string; qty: number }[]>([]);
  const [region, setRegion] = useState("全国");
  const [result, setResult] = useState<{ total: number; breakdown: { code: string; name: string; unit: string; unitPrice: number; quantity: number; subtotal: number }[] } | null>(null);

  const handleCalculate = async () => {
    const codes = rows.map((r) => r.code);
    const quantities = rows.map((r) => r.qty);
    try {
      const res = await app.CostEstimate(codes, quantities, region);
      setResult(res);
    } catch (e) {
      setResult(null);
    }
  };

  const addRow = () => setRows([...rows, { code: "", qty: 1 }]);
  const removeRow = (i: number) => setRows(rows.filter((_, idx) => idx !== i));
  const updateRow = (i: number, code: string, qty: number) => {
    const next = [...rows];
    next[i] = { code, qty };
    setRows(next);
  };

  // 可用的条目列表（去重+排序）
  const itemOptions = [...new Map(db.items.map((i) => [i.code, i])).values()].sort((a, b) => a.code.localeCompare(b.code));

  return (
    <div>
      <div className="flex gap-2 mb-3 items-center">
        <select className="px-2.5 py-1.5 rounded-md bg-bg-tertiary border border-border text-[13px] text-fg outline-none" value={region} onChange={(e) => setRegion(e.target.value)}>
          {db.regions.map((r) => (<option key={r.region} value={r.region}>{r.region} (×{r.adjustmentFactor})</option>))}
        </select>
        <button className="px-2.5 py-1.5 rounded-md bg-accent text-white text-[13px] hover:opacity-90" onClick={addRow}>
          <Plus size={14} className="inline mr-1" />添加条目
        </button>
        <button className="px-2.5 py-1.5 rounded-md bg-green-600 text-white text-[13px] hover:opacity-90" onClick={handleCalculate}>
          {t("cost.estimate.calculate")}
        </button>
      </div>

      {rows.map((row, i) => (
        <div key={i} className="flex gap-2 mb-2 items-center">
          <select
            className="flex-1 px-2.5 py-1.5 rounded-md bg-bg-tertiary border border-border text-[13px] text-fg outline-none"
            value={row.code}
            onChange={(e) => updateRow(i, e.target.value, row.qty)}
          >
            <option value="">-- 选择条目 --</option>
            {itemOptions.map((item) => (
              <option key={item.code} value={item.code}>
                [{item.code}] {item.name} — {item.unit} {item.basePrice}元
              </option>
            ))}
          </select>
          <input
            className="w-20 px-2 py-1.5 rounded-md bg-bg-tertiary border border-border text-[13px] text-fg outline-none text-right"
            type="number"
            min="0"
            step="any"
            value={row.qty}
            onChange={(e) => updateRow(i, row.code, parseFloat(e.target.value) || 0)}
          />
          <button className="text-red-500 hover:bg-red-500/10 rounded p-1" onClick={() => removeRow(i)}>
            <XIcon size={14} />
          </button>
        </div>
      ))}

      {result && (
        <div className="mt-4">
          <h4 className="text-[14px] font-medium mb-2">{t("cost.estimate.total")}</h4>
          <table className="w-full text-[13px] border-collapse">
            <thead>
              <tr className="text-fg-faint border-b border-border">
                <th className="text-left py-1.5 px-2">编码</th>
                <th className="text-left py-1.5 px-2">名称</th>
                <th className="text-right py-1.5 px-2">单价</th>
                <th className="text-right py-1.5 px-2">数量</th>
                <th className="text-right py-1.5 px-2">小计</th>
              </tr>
            </thead>
            <tbody>
              {result.breakdown.map((b) => (
                <tr key={b.code} className="border-b border-border/50">
                  <td className="py-1.5 px-2 font-mono text-[12px]">{b.code}</td>
                  <td className="py-1.5 px-2">{b.name}</td>
                  <td className="py-1.5 px-2 text-right">{b.unitPrice.toFixed(2)}</td>
                  <td className="py-1.5 px-2 text-right">{b.quantity}</td>
                  <td className="py-1.5 px-2 text-right font-medium">{b.subtotal.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-semibold border-t-2 border-border">
                <td colSpan={4} className="text-right py-2 px-2">{t("cost.estimate.total")}</td>
                <td className="text-right py-2 px-2 text-accent">{result.total.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
