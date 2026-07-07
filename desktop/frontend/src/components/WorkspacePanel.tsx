import { X } from "lucide-react";
import { useT } from "../lib/i18n";

// Minimal stub replacement — the full WorkspacePanel was removed as part of
// the parallel-D frontend UI refactor (programming → office focus).
export function WorkspacePanel({
  cwd,
  onClose,
}: {
  open?: boolean;
  cwd?: string;
  maximized?: boolean;
  panelWidth?: number;
  onClose: () => void;
  onToggleMaximized?: () => void;
  onPreviewModeChange?: (v: boolean) => void;
  initialViewMode?: string;
}) {
  const t = useT();
  void t; // suppress unused warning
  return (
    <div className="flex flex-col h-full p-4 text-fg-dim text-xs">
      <div className="flex items-center justify-between mb-3">
        <span className="font-semibold text-fg text-sm">工作区</span>
        <button className="border-0 bg-transparent text-fg-faint cursor-pointer hover:text-fg p-1" onClick={onClose}>
          <X size={14} />
        </button>
      </div>
      {cwd && <div className="text-fg-faint mb-2 font-mono text-[11px] truncate">{cwd}</div>}
      <div className="flex-1 flex items-center justify-center text-fg-faint/60">工作区面板已简化</div>
    </div>
  );
}
