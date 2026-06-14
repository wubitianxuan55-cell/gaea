import { useState, useEffect, useCallback, useRef } from 'react';
import { ShieldAlert, Check, X, AlertTriangle, Infinity } from 'lucide-react';
import { createPortal } from 'react-dom';
import { Button } from './ui/button';
import { motion, AnimatePresence } from 'motion/react';
import { systemService } from '@/services/systemService';
import { useT } from '../lib/useT';

interface PendingConfirm {
  correlationId: string;
  name: string;
  arguments: Record<string, any>;
}

/**
 * Tool confirmation dialog with session-level auto-approve and global allow-all toggle.
 * When allowAll is enabled, all confirm tools auto-pass without showing the dialog.
 * "Always Allow" adds the tool name to a session whitelist.
 */
export function ToolConfirmDialog({ socket, isWallpaperMode = false }: { socket: any; isWallpaperMode?: boolean }) {
  const [pending, setPending] = useState<PendingConfirm[]>([]);
  const [autoApproved, setAutoApproved] = useState<Set<string>>(new Set());
  const [allowAll, setAllowAll] = useState(() => {
    try { return localStorage.getItem('gaea_auto_approve') === 'true'; } catch { return false; }
  });
  const wasWallpaperRef = useRef(false);
  const t = useT();

  const toggleAllowAll = () => {
    const next = !allowAll;
    setAllowAll(next);
    localStorage.setItem('gaea_auto_approve', String(next));
  };

  // Temporarily exit wallpaper mode while confirm dialog is showing
  useEffect(() => {
    if (pending.length > 0 && isWallpaperMode) {
      wasWallpaperRef.current = true;
      systemService.setWallpaperMode(false);
    } else if (pending.length === 0 && wasWallpaperRef.current) {
      wasWallpaperRef.current = false;
      systemService.setWallpaperMode(true);
    }
  }, [pending.length, isWallpaperMode]);

  useEffect(() => {
    if (!socket) return;

    const handleConfirm = (data: { correlationId: string; name: string; arguments: Record<string, any> }) => {
      // 1. Global allow-all — auto pass
      if (allowAll) {
        socket.emit(`tool:confirm_result:${data.correlationId}`, { correlationId: data.correlationId, allowed: true });
        return;
      }
      // 2. Session-level auto-approve for this tool
      if (autoApproved.has(data.name)) {
        socket.emit(`tool:confirm_result:${data.correlationId}`, { correlationId: data.correlationId, allowed: true });
        return;
      }
      // 3. Show dialog
      setPending(prev => [...prev, data]);
    };

    socket.on('agent:confirm_tool', handleConfirm);
    return () => { socket.off('agent:confirm_tool', handleConfirm); };
  }, [socket, allowAll, autoApproved]);

  const respond = useCallback((correlationId: string, allowed: boolean) => {
    socket?.emit(`tool:confirm_result:${correlationId}`, { correlationId, allowed });
    setPending(prev => prev.filter(p => p.correlationId !== correlationId));
  }, [socket]);

  const allowAlways = useCallback((correlationId: string, toolName: string) => {
    setAutoApproved(prev => new Set(prev).add(toolName));
    socket?.emit(`tool:confirm_result:${correlationId}`, { correlationId, allowed: true });
    setPending(prev => prev.filter(p => p.correlationId !== correlationId));
  }, [socket]);

  // Sync allowAll from other tabs (storage event)
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'gaea_auto_approve') {
        setAllowAll(e.newValue === 'true');
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const current = pending[0];

  const dialog = (
    <AnimatePresence>
      {current && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => respond(current.correlationId, false)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            onClick={e => e.stopPropagation()}
            className="bg-zinc-900 border border-yellow-500/30 rounded-[2rem] p-8 max-w-md w-full mx-4 shadow-2xl"
          >
            {/* Header with global toggle */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-yellow-500/10 rounded-2xl">
                  <ShieldAlert size={24} className="text-yellow-400" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-yellow-400">{t.toolAuthorization || 'Tool Authorization'}</h3>
                  <p className="text-xs text-white/55 mt-0.5">{t.toolExplicitPermission || 'This tool requires your explicit permission'}</p>
                </div>
              </div>
              {/* Global allow-all toggle */}
              <button
                onClick={toggleAllowAll}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ${allowAll ? 'bg-emerald-500' : 'bg-white/10'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${allowAll ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>

            <p className="text-[12px] text-white/40 mb-4">
              {t.autoApproveDesc || 'Enable to auto-approve all tools. Disable to restore per-tool confirmations.'}
            </p>

            {/* Tool info */}
            <div className="space-y-4">
              <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle size={14} className="text-yellow-400" />
                  <span className="text-xs font-bold text-white/80 font-mono">{current.name}</span>
                </div>
                {Object.keys(current.arguments).length > 0 && (
                  <pre className="text-xs text-white/40 font-mono whitespace-pre-wrap break-all max-h-32 overflow-y-auto custom-scrollbar">
                    {JSON.stringify(current.arguments, null, 2)}
                  </pre>
                )}
              </div>

              {pending.length > 1 && (
                <p className="text-xs text-white/45 text-center">
                  {pending.length - 1} {t.moreToolsWaiting || 'more tool waiting'}
                </p>
              )}

              {/* Three action buttons */}
              <div className="flex items-center gap-2.5">
                <Button
                  onClick={() => respond(current.correlationId, false)}
                  className="flex-1 bg-white/5 text-white/60 hover:bg-white/10 font-bold text-xs px-3 py-3 rounded-xl border border-white/10 transition-all"
                >
                  <X size={14} className="mr-1" /> {t.deny || 'Deny'}
                </Button>
                <Button
                  onClick={() => respond(current.correlationId, true)}
                  className="flex-1 bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 font-bold text-xs px-3 py-3 rounded-xl border border-yellow-500/30 transition-all"
                >
                  <Check size={14} className="mr-1" /> {t.allow || 'Allow'}
                </Button>
                <Button
                  onClick={() => allowAlways(current.correlationId, current.name)}
                  className="flex-1 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 font-bold text-xs px-3 py-3 rounded-xl border border-emerald-500/30 transition-all"
                >
                  <Infinity size={14} className="mr-1" /> {t.alwaysAllow || 'Always'}
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return createPortal(dialog, document.body);
}
