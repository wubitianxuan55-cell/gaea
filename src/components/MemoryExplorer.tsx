import React, { useState, useEffect, useCallback } from 'react';
import { Search, Plus, Trash2, Edit3, Check, X, BrainCircuit, SlidersHorizontal, Bell, Clock, BellOff, TrendingUp } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { toast } from 'sonner';
import { useSocket } from '@/hooks/useSocket';

interface Memory {
  id: string;
  userId: string;
  type: 'preference' | 'fact' | 'habit' | 'knowledge';
  content: string;
  keywords: string[];
  confidence: number;
  sourceInteractionId: string;
  createdAt: string;
  updatedAt: string;
  lastRetrievedAt: string | null;
  retrieveCount: number;
}

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  preference: { label: 'Preferences', color: 'text-purple-400' },
  fact: { label: 'Facts', color: 'text-blue-400' },
  habit: { label: 'Habits', color: 'text-green-400' },
  knowledge: { label: 'Knowledge', color: 'text-orange-400' },
};

export function MemoryExplorer({ t }: { t?: any }) {
  const socket = useSocket();
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [adding, setAdding] = useState(false);
  const [newType, setNewType] = useState<string>('preference');
  const [newContent, setNewContent] = useState('');

  const fetchMemories = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (typeFilter) params.set('type', typeFilter);
      params.set('limit', '100');

      const res = await fetch(`/api/memories?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setMemories(data);
    } catch {
      // Not authenticated or no memories yet
      setMemories([]);
    } finally {
      setLoading(false);
    }
  }, [search, typeFilter]);

  useEffect(() => { fetchMemories(); }, [fetchMemories]);

  // Listen for cross-device memory changes
  useEffect(() => {
    if (!socket) return;
    const handler = (data: { action: string; memoryId?: string }) => {
      if (data.action === 'deleted') {
        setMemories(prev => prev.filter(m => m.id !== data.memoryId));
      } else {
        fetchMemories();
      }
    };
    socket.on('memories:changed', handler);
    return () => { socket.off('memories:changed', handler); };
  }, [socket, fetchMemories]);

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/memories/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      setMemories(prev => prev.filter(m => m.id !== id));
      toast.success('Memory deleted');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleEditStart = (memory: Memory) => {
    setEditingId(memory.id);
    setEditContent(memory.content);
  };

  const handleEditSave = async (id: string) => {
    try {
      const res = await fetch(`/api/memories/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editContent }),
      });
      if (!res.ok) throw new Error('Update failed');
      setEditingId(null);
      fetchMemories();
      toast.success('Memory updated');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleAdd = async () => {
    if (!newContent.trim()) return;
    try {
      const res = await fetch('/api/memories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: newType,
          content: newContent,
          keywords: newContent.toLowerCase().split(/\s+/).filter(w => w.length > 2),
        }),
      });
      if (!res.ok) throw new Error('Add failed');
      setAdding(false);
      setNewContent('');
      fetchMemories();
      toast.success('Memory added');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // Behavioral analysis
  const [analyzing, setAnalyzing] = useState(false);

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      const res = await fetch('/api/memory/analyze-behavior', { method: 'POST' });
      const data = await res.json();
      if (data.patternsFound > 0) {
        toast.success(`Found ${data.patternsFound} behavioral patterns`);
        fetchMemories();
      } else {
        toast.info('No new patterns found yet. Keep interacting!');
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setAnalyzing(false);
    }
  };

  // Reminders
  const [reminders, setReminders] = useState<any[]>([]);
  const [showReminders, setShowReminders] = useState(false);
  const [newReminderContent, setNewReminderContent] = useState('');
  const [newReminderDueAt, setNewReminderDueAt] = useState('');

  const fetchReminders = useCallback(async () => {
    try {
      const res = await fetch('/api/reminders');
      if (!res.ok) throw new Error('Failed to fetch reminders');
      setReminders(await res.json());
    } catch {
      setReminders([]);
    }
  }, []);

  useEffect(() => {
    if (showReminders) fetchReminders();
  }, [showReminders, fetchReminders]);

  const handleAddReminder = async () => {
    if (!newReminderContent.trim()) return;
    try {
      const res = await fetch('/api/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: newReminderContent.trim(),
          dueAt: newReminderDueAt ? new Date(newReminderDueAt).toISOString() : null,
        }),
      });
      if (!res.ok) throw new Error('Reminder creation failed');
      setNewReminderContent('');
      setNewReminderDueAt('');
      fetchReminders();
      toast.success('Reminder added');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleCompleteReminder = async (id: string) => {
    try {
      const res = await fetch(`/api/reminders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'fired' }),
      });
      if (!res.ok) throw new Error('Reminder update failed');
      fetchReminders();
      toast.success('Reminder completed');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDeleteReminder = async (id: string) => {
    try {
      const res = await fetch(`/api/reminders/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Reminder delete failed');
      fetchReminders();
      toast.success('Reminder deleted');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const grouped = memories.reduce((acc, m) => {
    (acc[m.type] ||= []).push(m);
    return acc;
  }, {} as Record<string, Memory[]>);

  const typeOrder = ['preference', 'fact', 'habit', 'knowledge'];

  if (loading) {
    return (
      <div className="space-y-8 animate-in fade-in duration-500">
        <div className="flex items-center gap-3">
          <BrainCircuit className="text-celestial-saturn" />
          <h3 className="text-xl font-bold uppercase tracking-tighter text-white/90">Memory Explorer</h3>
        </div>
        <p className="text-white/40 text-sm">Loading neural memory traces...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-3">
        <BrainCircuit className="text-celestial-saturn" />
        <h3 className="text-xl font-bold uppercase tracking-tighter text-white/90">Memory Explorer</h3>
      </div>

      <p className="text-sm text-white/40 max-w-xl">
        These are the patterns, preferences, and facts Lumi has learned about you.
        Memories evolve automatically — confidence rises with repetition and decays when unused.
      </p>

      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search memories..."
            className="bg-white/5 border-white/10 rounded-xl pl-9 py-2 text-sm focus-visible:ring-celestial-saturn/50"
          />
        </div>

        <div className="relative">
          <SlidersHorizontal size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" />
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-sm font-bold appearance-none cursor-pointer focus:border-celestial-saturn/50 outline-none text-white/80"
          >
            <option value="">All types</option>
            {typeOrder.map(t => (
              <option key={t} value={t}>{TYPE_LABELS[t]?.label || t}</option>
            ))}
          </select>
        </div>

        <Button
          onClick={() => setAdding(true)}
          className="bg-celestial-saturn text-black font-bold text-xs px-4 py-2 rounded-xl hover:scale-105 transition-transform"
        >
          <Plus size={14} className="mr-1" />
          Add
        </Button>
        <Button
          onClick={() => setShowReminders(!showReminders)}
          className={`text-xs font-bold px-4 py-2 rounded-xl border transition-colors ${showReminders ? 'bg-celestial-saturn/10 border-celestial-saturn/30 text-celestial-saturn' : 'bg-white/5 text-white/70 hover:bg-white/10 border-white/10'}`}
        >
          <Bell size={14} className="mr-1" /> Reminders
        </Button>
        <Button
          onClick={handleAnalyze}
          disabled={analyzing}
          className="bg-white/5 text-white/70 hover:bg-white/10 border border-white/10 text-xs font-bold px-4 py-2 rounded-xl transition-all"
        >
          <TrendingUp size={14} className={`mr-1 ${analyzing ? 'animate-pulse' : ''}`} />
          {analyzing ? 'Analyzing...' : 'Analyze Patterns'}
        </Button>
      </div>

      {/* Add new memory form */}
      {adding && (
        <div className="p-6 bg-celestial-saturn/5 rounded-3xl border border-celestial-saturn/20 space-y-4">
          <div className="flex items-center gap-3">
            <select
              value={newType}
              onChange={e => setNewType(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold uppercase appearance-none cursor-pointer"
            >
              {typeOrder.map(t => (
                <option key={t} value={t}>{TYPE_LABELS[t]?.label || t}</option>
              ))}
            </select>
            <Input
              value={newContent}
              onChange={e => setNewContent(e.target.value)}
              placeholder="What should Lumi remember?"
              className="flex-1 bg-white/5 border-white/10 rounded-xl py-2 text-sm focus-visible:ring-celestial-saturn/50"
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
            />
            <Button onClick={handleAdd} className="bg-celestial-saturn text-black font-bold text-xs px-4 py-2 rounded-xl">
              <Check size={14} className="mr-1" /> Save
            </Button>
            <Button onClick={() => setAdding(false)} variant="ghost" className="text-white/40">
              <X size={14} />
            </Button>
          </div>
        </div>
      )}

      {/* Memory list by type */}
      {memories.length === 0 ? (
        <div className="p-16 bg-white/5 rounded-[2rem] border border-white/5 text-center">
          <BrainCircuit size={40} className="text-white/20 mx-auto mb-4" />
          <p className="text-white/40 font-bold uppercase tracking-widest text-sm">
            {search ? 'No memories match your search' : 'No memories yet'}
          </p>
          <p className="text-white/20 text-xs mt-2">
            {search ? 'Try different keywords' : 'Interact with Lumi to build memories automatically'}
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {typeOrder.map(type => {
            const items = grouped[type];
            if (!items?.length) return null;
            const { label, color } = TYPE_LABELS[type];

            return (
              <div key={type} className="space-y-3">
                <div className="flex items-center gap-2">
                  <h4 className={`text-xs font-black uppercase tracking-widest ${color}`}>{label}</h4>
                  <span className="text-[10px] text-white/20">({items.length})</span>
                </div>

                <div className="space-y-2">
                  {items.map(memory => (
                    <div
                      key={memory.id}
                      className="p-4 bg-white/5 rounded-2xl border border-white/5 group hover:border-white/10 transition-all"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          {editingId === memory.id ? (
                            <div className="flex items-center gap-2">
                              <Input
                                value={editContent}
                                onChange={e => setEditContent(e.target.value)}
                                className="flex-1 bg-white/10 border-white/20 rounded-xl py-1 text-sm"
                                onKeyDown={e => e.key === 'Enter' && handleEditSave(memory.id)}
                              />
                              <Button onClick={() => handleEditSave(memory.id)} className="p-1.5 h-auto bg-celestial-saturn text-black rounded-lg">
                                <Check size={12} />
                              </Button>
                              <Button onClick={() => setEditingId(null)} variant="ghost" className="p-1.5 h-auto text-white/40 rounded-lg">
                                <X size={12} />
                              </Button>
                            </div>
                          ) : (
                            <p className="text-sm text-white/70 leading-relaxed">{memory.content}</p>
                          )}

                          {/* Meta row */}
                          <div className="flex items-center gap-3 mt-2 flex-wrap">
                            <span className="text-[9px] font-bold uppercase tracking-widest text-white/30">
                              {(memory.confidence * 100).toFixed(0)}% confidence
                            </span>
                            {memory.keywords?.length > 0 && (
                              <div className="flex items-center gap-1">
                                {memory.keywords.slice(0, 4).map(kw => (
                                  <span key={kw} className="text-[8px] px-1.5 py-0.5 bg-white/5 rounded-full text-white/20 uppercase">
                                    {kw}
                                  </span>
                                ))}
                              </div>
                            )}
                            <span className="text-[9px] text-white/20">
                              {memory.sourceInteractionId?.startsWith('behavioral_') ? (
                                <span className="text-celestial-saturn">Behavioral pattern</span>
                              ) : memory.sourceInteractionId === 'manual' ? 'Manual entry' : 'Auto-extracted'}
                            </span>
                            <span className="text-[9px] text-white/20">
                              retrieved {memory.retrieveCount || 0}x
                            </span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <button
                            onClick={() => handleEditStart(memory)}
                            className="p-2 hover:bg-white/10 rounded-xl text-white/30 hover:text-white/70 transition-colors"
                          >
                            <Edit3 size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(memory.id)}
                            className="p-2 hover:bg-red-500/10 rounded-xl text-white/30 hover:text-red-500 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Reminders Section */}
      {showReminders && (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-3 pt-4 border-t border-white/5">
            <Clock className="text-celestial-saturn" size={20} />
            <h3 className="text-lg font-bold uppercase tracking-tighter text-white/90">Reminders</h3>
            <span className="text-[10px] text-white/20">({reminders.filter((r: any) => r.status === 'pending').length} pending)</span>
          </div>

          <div className="p-4 bg-white/5 rounded-2xl border border-white/5 flex flex-col md:flex-row gap-3">
            <Input
              value={newReminderContent}
              onChange={e => setNewReminderContent(e.target.value)}
              placeholder="Add a reminder..."
              className="flex-1 bg-black/20 border-white/10 rounded-xl py-2 text-sm focus-visible:ring-celestial-saturn/50"
              onKeyDown={e => e.key === 'Enter' && handleAddReminder()}
            />
            <input
              type="datetime-local"
              value={newReminderDueAt}
              onChange={e => setNewReminderDueAt(e.target.value)}
              className="bg-black/20 border border-white/10 rounded-xl px-3 py-2 text-sm text-white/70 outline-none focus:border-celestial-saturn/50"
            />
            <Button
              onClick={handleAddReminder}
              className="bg-celestial-saturn text-black font-bold text-xs px-4 py-2 rounded-xl"
            >
              <Plus size={14} className="mr-1" /> Add
            </Button>
          </div>

          {reminders.length === 0 ? (
            <div className="p-8 bg-white/5 rounded-2xl border border-white/5 text-center">
              <BellOff size={24} className="text-white/20 mx-auto mb-2" />
              <p className="text-white/40 text-xs font-bold uppercase tracking-widest">No reminders yet</p>
              <p className="text-white/20 text-[10px] mt-1">Create one here or let Lumi extract deadlines from conversations.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {reminders.map((reminder: any) => (
                <div
                  key={reminder.id}
                  className={`p-4 rounded-2xl border transition-all ${
                    reminder.status === 'fired'
                      ? 'bg-white/5 border-white/5 opacity-50'
                      : 'bg-celestial-saturn/5 border-celestial-saturn/20'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${reminder.status === 'fired' ? 'text-white/30 line-through' : 'text-white/80'}`}>
                        {reminder.content}
                      </p>
                      <div className="flex items-center gap-3 mt-2">
                        {reminder.dueAt && (
                          <span className="text-[10px] text-white/30 font-mono">
                            Due: {new Date(reminder.dueAt).toLocaleString()}
                          </span>
                        )}
                        <span className={`text-[10px] font-bold uppercase tracking-widest ${reminder.status === 'pending' ? 'text-celestial-saturn' : 'text-white/20'}`}>
                          {reminder.status}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {reminder.status !== 'fired' && (
                        <button
                          onClick={() => handleCompleteReminder(reminder.id)}
                          className="p-2 hover:bg-green-500/10 rounded-xl text-white/30 hover:text-green-400 transition-colors"
                          title="Complete"
                        >
                          <Check size={14} />
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteReminder(reminder.id)}
                        className="p-2 hover:bg-red-500/10 rounded-xl text-white/30 hover:text-red-500 transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
