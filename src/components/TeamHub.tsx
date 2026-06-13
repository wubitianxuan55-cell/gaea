import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Users, Bot, ExternalLink, Trash2, Power, PowerOff, Cpu, Plus, CheckCircle, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { toast } from 'sonner';

export function TeamHub({ t }: { t?: any }) {
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showConnectForm, setShowConnectForm] = useState(false);
  const [connectName, setConnectName] = useState('');
  const [connectCategory, setConnectCategory] = useState('general');
  const [connectSkillTags, setConnectSkillTags] = useState('');
  const [connectCommand, setConnectCommand] = useState('');
  const [connecting, setConnecting] = useState(false);

  const fetchAgents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/agents', { credentials: 'include' });
      if (res.ok) setAgents(await res.json());
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchAgents(); }, [fetchAgents]);

  const handleConnectExternal = async () => {
    if (!connectName.trim() || !connectCommand.trim()) return;
    setConnecting(true);
    try {
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: connectName.trim(),
          category: connectCategory,
          skillTags: connectSkillTags ? connectSkillTags.split(',').map((s: string) => s.trim()) : [],
          runtime: 'external',
          externalCommand: connectCommand.trim(),
          executionMode: 'sequential',
          territory: 'open',
        }),
        credentials: 'include',
      });
      if (res.ok) {
        toast.success(t?.agentConnected || 'External agent connected');
        setShowConnectForm(false);
        setConnectName('');
        setConnectCommand('');
        fetchAgents();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || t?.connectFailed || 'Connection failed');
      }
    } catch (err: any) {
      toast.error(err.message || t?.connectFailed || 'Connection failed');
    }
    setConnecting(false);
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/agents/${id}`, { method: 'DELETE', credentials: 'include' });
      if (res.ok) {
        setAgents(prev => prev.filter(a => a.id !== id));
        toast.success(t?.agentRemoved || 'Agent removed');
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || t?.removeFailed || 'Failed to remove');
      }
    } catch (err: any) {
      toast.error(err.message || t?.removeFailed || 'Failed to remove');
    }
  };

  const handleToggle = async (agent: any) => {
    const nextFrozen = !(agent.isFrozen ?? false);
    try {
      const res = await fetch(`/api/agents/${agent.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isFrozen: nextFrozen }),
        credentials: 'include',
      });
      if (res.ok) {
        setAgents(prev => prev.map(a => a.id === agent.id ? { ...a, isFrozen: nextFrozen } : a));
        toast.info(nextFrozen ? (t?.agentFrozen || 'Agent frozen') : (t?.agentActivated || 'Agent activated'));
      }
    } catch (err: any) {
      toast.error(err.message || t?.toggleFailed || 'Toggle failed');
    }
  };

  const internalAgents = agents.filter(a => a.runtime !== 'external');
  const externalAgents = agents.filter(a => a.runtime === 'external');

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold uppercase tracking-tighter text-white/90 flex items-center gap-2">
            <Users size={20} className="text-cyan-400" />
            {t?.teamHub || 'Agent Team'}
          </h2>
          <p className="text-sm text-white/40 max-w-xl mt-1">
            {t?.teamDesc || "Lumi's team of agents. Each member has their own skills — Lumi can dispatch tasks through the orchestrator."}
          </p>
        </div>
        <button
          onClick={() => setShowConnectForm(!showConnectForm)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-xs font-bold text-cyan-400 hover:bg-cyan-500/20 transition-all shrink-0"
        >
          <ExternalLink size={12} />
          {t?.connectExternal || 'Connect External Agent'}
        </button>
      </div>

      <AnimatePresence>
        {showConnectForm && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="p-5 bg-cyan-500/5 rounded-2xl border border-cyan-500/10 space-y-4">
              <p className="text-xs text-cyan-400/70">{t?.connectExternalDesc || 'Link an AI agent running on your machine or cloud.'}</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input value={connectName} onChange={e => setConnectName(e.target.value)}
                  placeholder={t?.agentName || 'Agent Name'} className="bg-white/5 border-white/10 rounded-xl py-2 text-xs" />
                <select value={connectCategory} onChange={e => setConnectCategory(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-xl py-2 px-3 text-xs text-white/80">
                  {['general','code','content','analysis','search','automation','assistant','media'].map(c => (
                    <option key={c} value={c} className="bg-gray-900">{c}</option>
                  ))}
                </select>
                <Input value={connectSkillTags} onChange={e => setConnectSkillTags(e.target.value)}
                  placeholder={t?.agentSkillTags || 'Skill Tags (comma separated)'} className="bg-white/5 border-white/10 rounded-xl py-2 text-xs" />
                <Input value={connectCommand} onChange={e => setConnectCommand(e.target.value)}
                  placeholder={t?.agentCommandHint || 'openclaw send --task "{task}"'} className="bg-white/5 border-white/10 rounded-xl py-2 text-xs font-mono" />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleConnectExternal}
                  disabled={connecting || !connectName.trim() || !connectCommand.trim()}
                  className="bg-cyan-500 text-black font-bold text-xs px-4 py-2 rounded-xl hover:scale-105 transition-transform disabled:opacity-40">
                  {connecting ? (t?.connectingBtn || 'Connecting...') : (t?.connectBtn || 'Connect')}
                </Button>
                <Button onClick={() => setShowConnectForm(false)}
                  className="bg-white/5 text-white/55 font-bold text-xs px-4 py-2 rounded-xl hover:bg-white/10 transition-all">
                  {t?.cancel || 'Cancel'}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="p-16 bg-white/5 rounded-[2rem] border border-white/5 text-center">
          <Loader2 size={32} className="text-white/40 mx-auto mb-4 animate-spin" />
          <p className="text-white/40 text-sm">{t?.loading || 'Loading...'}</p>
        </div>
      ) : agents.length === 0 ? (
        <div className="p-16 bg-white/5 rounded-[2rem] border border-white/5 text-center">
          <Users size={40} className="text-white/45 mx-auto mb-4" />
          <p className="text-white/40 font-bold uppercase tracking-widest text-sm">{t?.noTeamMembers || 'No team members yet'}</p>
          <p className="text-white/45 text-xs mt-2">{t?.teamCreateHint || 'Use agent_create in chat to add a teammate.'}</p>
        </div>
      ) : (
        <>
          {/* Internal Agents */}
          {internalAgents.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-black uppercase tracking-widest text-white/50">{t?.internalAgents || 'Internal Agents'}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <AnimatePresence>
                  {internalAgents.map((agent: any) => (
                    <motion.div
                      key={agent.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="p-5 bg-white/5 rounded-2xl border border-white/5 hover:border-white/10 transition-all space-y-3"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                            <Bot size={16} className="text-cyan-400" />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-white">{agent.name}</h4>
                            <span className="text-[11px] text-white/40 uppercase">{agent.category || 'general'}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleToggle(agent)}
                            className={`p-1.5 rounded-lg transition-all ${agent.isFrozen ? 'bg-white/5 text-white/30 hover:text-white/50' : 'bg-green-500/10 text-green-400'}`}
                            title={agent.isFrozen ? (t?.activate || 'Activate') : (t?.freeze || 'Freeze')}
                          >
                            {agent.isFrozen ? <Power size={14} /> : <PowerOff size={14} />}
                          </button>
                          <button
                            onClick={() => handleDelete(agent.id)}
                            className="p-1.5 rounded-lg hover:bg-red-500/10 text-white/30 hover:text-red-400 transition-all"
                            title={t?.remove || 'Remove'}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-white/40">
                        <span className={`w-1.5 h-1.5 rounded-full ${agent.isFrozen ? 'bg-white/20' : 'bg-green-400 animate-pulse'}`} />
                        {agent.isFrozen ? (t?.frozen || 'Frozen') : (t?.active || 'Active')}
                        {agent.memoryScope === 'private' && (
                          <span className="px-1.5 py-0.5 bg-purple-500/10 text-purple-400 rounded text-[10px]">{t?.sanctuary || 'Sanctuary'}</span>
                        )}
                      </div>
                      {(agent.skillTags || []).length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {agent.skillTags.map((t: string) => (
                            <span key={t} className="px-1.5 py-0.5 bg-white/5 rounded text-[10px] text-white/40 uppercase">{t}</span>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )}

          {/* External Agents */}
          {externalAgents.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-black uppercase tracking-widest text-white/50">{t?.externalAgents || 'External Agents'}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <AnimatePresence>
                  {externalAgents.map((agent: any) => (
                    <motion.div
                      key={agent.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="p-5 bg-cyan-500/5 rounded-2xl border border-cyan-500/10 hover:border-cyan-500/30 transition-all space-y-3"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                            <ExternalLink size={16} className="text-cyan-400" />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-white">{agent.name}</h4>
                            <span className="text-[11px] text-cyan-400/70">{agent.category || 'external'}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDelete(agent.id)}
                          className="p-1.5 rounded-lg hover:bg-red-500/10 text-white/30 hover:text-red-400 transition-all"
                          title={t?.remove || 'Remove'}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      {agent.externalCommand && (
                        <div className="p-2 bg-black/40 rounded-lg text-xs font-mono text-white/40 truncate">
                          {agent.externalCommand}
                        </div>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
