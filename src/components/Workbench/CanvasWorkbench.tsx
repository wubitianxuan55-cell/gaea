import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Menu } from 'lucide-react';
import { socketService } from '@/services/socketService';
import { useCanvasSocket } from './useCanvasSocket';
import { CanvasViewport } from './CanvasViewport';
import { CanvasSessionPanel } from './CanvasSessionPanel';
import { CanvasInputBar } from './CanvasInputBar';
import { CanvasCard, CanvasEdge, CanvasSessionSummary } from './types';

interface CanvasWorkbenchProps {
  isOpen: boolean;
  onClose: () => void;
  t: any;
  user: any;
}

export function CanvasWorkbench({ isOpen, onClose, t, user }: CanvasWorkbenchProps) {
  const socket = socketService.connect();
  const [sessions, setSessions] = useState<CanvasSessionSummary[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [cards, setCards] = useState<CanvasCard[]>([]);
  const [edges, setEdges] = useState<CanvasEdge[]>([]);
  const [showSessionPanel, setShowSessionPanel] = useState(false);
  const [statusText, setStatusText] = useState('');
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cardsRef = useRef<CanvasCard[]>([]);
  const edgesRef = useRef<CanvasEdge[]>([]);

  useEffect(() => { cardsRef.current = cards; }, [cards]);
  useEffect(() => { edgesRef.current = edges; }, [edges]);

  const onCardsReceived = useCallback((newCards: CanvasCard[]) => {
    setCards(newCards);
  }, []);

  const onEdgesReceived = useCallback((newEdges: CanvasEdge[]) => {
    setEdges(newEdges);
  }, []);

  const onStatusChange = useCallback((status: string) => {
    if (status === 'thinking') setStatusText('Working...');
    else if (status === 'responding') setStatusText('Responding...');
    else setStatusText('');
  }, []);

  const { submitTask, clearCards, retryFromCard } = useCanvasSocket({
    socket,
    onCards: onCardsReceived,
    onEdges: onEdgesReceived,
    onStatusChange,
  });

  // Load session list
  useEffect(() => {
    fetch('/api/canvas/sessions')
      .then(r => r.json())
      .then(data => setSessions(data.sessions || []))
      .catch(() => {});
  }, []);

  // Auto-save
  const autoSave = useCallback(() => {
    if (!currentSessionId) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      try {
        await fetch(`/api/canvas/sessions/${currentSessionId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cards: cardsRef.current }),
        });
      } catch {}
    }, 2000);
  }, [currentSessionId]);

  useEffect(() => {
    if (currentSessionId && cards.length > 0) autoSave();
  }, [cards, currentSessionId, autoSave]);

  const handleNewSession = useCallback(async () => {
    try {
      const res = await fetch('/api/canvas/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const session = await res.json();
      setCurrentSessionId(session.id);
      setCards([]);
      setEdges([]);
      setSessions(prev => [
        { id: session.id, title: session.title, taskText: session.taskText, status: session.status, cardCount: 0, createdAt: session.createdAt, updatedAt: session.updatedAt },
        ...prev,
      ]);
      setShowSessionPanel(false);
    } catch {}
  }, []);

  const handleLoadSession = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/canvas/sessions/${id}`);
      const session = await res.json();
      setCurrentSessionId(session.id);
      setCards(session.cards || []);
      setEdges([]); // edges recomputed from cards
      setShowSessionPanel(false);
    } catch {}
  }, []);

  const handleDeleteSession = useCallback(async (id: string) => {
    try {
      await fetch(`/api/canvas/sessions/${id}`, { method: 'DELETE' });
      setSessions(prev => prev.filter(s => s.id !== id));
      if (currentSessionId === id) {
        setCurrentSessionId(null);
        setCards([]);
        setEdges([]);
      }
    } catch {}
  }, [currentSessionId]);

  const handleClearCanvas = useCallback(() => {
    clearCards();
  }, [clearCards]);

  const handleTaskSubmit = useCallback(async (text: string) => {
    if (!currentSessionId) {
      try {
        const res = await fetch('/api/canvas/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ taskText: text, title: text.slice(0, 60) }),
        });
        const session = await res.json();
        setCurrentSessionId(session.id);
        setSessions(prev => [
          { id: session.id, title: session.title, taskText: session.taskText, status: session.status, cardCount: 0, createdAt: session.createdAt, updatedAt: session.updatedAt },
          ...prev,
        ]);
        fetch(`/api/canvas/sessions/${session.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: text.slice(0, 60), taskText: text }),
        }).catch(() => {});
      } catch { return; }
    }

    submitTask(text);
  }, [currentSessionId, submitTask]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !showSessionPanel) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, showSessionPanel]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[220] bg-[#0a0a10]"
        >
          <div className="absolute top-0 left-0 right-0 z-40 h-12 flex items-center justify-between px-4 bg-gradient-to-b from-black/60 to-transparent">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowSessionPanel(true)}
                className="w-9 h-9 flex items-center justify-center rounded-xl text-white/50 hover:text-white hover:bg-white/10 transition-colors"
              ><Menu size={18} /></button>
              <span className="text-sm font-medium text-white/70">
                {t.canvasWorkbench || 'Canvas'}
              </span>
              {statusText && (
                <span className="text-[10px] text-amber-400/70 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  {statusText}
                </span>
              )}
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-xl text-white/40 hover:text-white hover:bg-white/10 transition-colors"
            ><X size={18} /></button>
          </div>

          <CanvasViewport
            cards={cards}
            edges={edges}
            onRetry={retryFromCard}
            onClear={handleClearCanvas}
          />

          <CanvasSessionPanel
            isOpen={showSessionPanel}
            onClose={() => setShowSessionPanel(false)}
            sessions={sessions}
            currentId={currentSessionId}
            onSelect={handleLoadSession}
            onNew={handleNewSession}
            onDelete={handleDeleteSession}
            t={t}
          />

          <CanvasInputBar
            onSend={handleTaskSubmit}
            disabled={statusText !== ''}
            t={t}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
