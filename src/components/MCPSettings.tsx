import React, { useState, useEffect } from 'react';
import { Cpu, RefreshCw, CheckCircle, XCircle, Wrench } from 'lucide-react';
import { Button } from './ui/button';
import { toast } from 'sonner';

interface MCPServer {
  name: string;
  command: string;
  args: string[];
  enabled: boolean;
  connected: boolean;
}

export function MCPSettings({ t }: { t?: any }) {
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchServers = async () => {
    try {
      const res = await fetch('/api/mcp');
      const data = await res.json();
      setServers(data.servers || []);
    } catch {
      // MCP endpoint unavailable
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchServers(); }, []);

  const toggleServer = async (name: string, enabled: boolean) => {
    const updated = servers.map(s => s.name === name ? { ...s, enabled } : s);
    setServers(updated);

    const payload: Record<string, any> = {};
    for (const s of updated) {
      payload[s.name] = { command: s.command, args: s.args, enabled: s.enabled };
    }

    try {
      const res = await fetch('/api/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ servers: payload }),
      });
      const data = await res.json();
      toast.success(`${data.count} ${t?.mcpToolsRegistered || 'tools registered'}`);
      fetchServers();
    } catch (err: any) {
      toast.error(`${t?.mcpUpdateFailed || 'MCP update failed'}: ${err.message}`);
      fetchServers();
    }
  };

  const restartServer = async (name: string) => {
    try {
      const res = await fetch(`/api/mcp/restart/${name}`, { method: 'POST' });
      const data = await res.json();
      toast.success(`${data.tools?.length || 0} ${t?.mcpToolsReconnected || 'tools reconnected'}`);
      fetchServers();
    } catch (err: any) {
      toast.error(`${t?.mcpRestartFailed || 'Restart failed'}: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div className="space-y-8 animate-in fade-in duration-500">
        <div className="flex items-center gap-3">
          <Cpu className="text-celestial-saturn" />
          <h3 className="text-xl font-bold uppercase tracking-tighter text-white/90">{t?.mcpServers || 'MCP Servers'}</h3>
        </div>
        <p className="text-white/40 text-sm">{t?.mcpScanning || 'Scanning for MCP protocol servers...'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-3">
        <Cpu className="text-celestial-saturn" />
        <h3 className="text-xl font-bold uppercase tracking-tighter text-white/90">{t?.mcpServers || 'MCP Servers'}</h3>
      </div>

      <p className="text-sm text-white/40 max-w-xl">
        {t?.mcpDescription || "Model Context Protocol servers extend agent capabilities with community-maintained tools. Enable a server to give your agent access to filesystem, database, git, and more."}
      </p>

      {servers.length === 0 ? (
        <div className="p-10 bg-white/5 rounded-[2rem] border border-white/5 text-center">
          <Wrench size={32} className="text-white/20 mx-auto mb-4" />
          <p className="text-white/40 font-bold uppercase tracking-widest text-sm">{t?.mcpNoServers || 'No MCP servers configured'}</p>
          <p className="text-white/20 text-xs mt-2">{t?.mcpAddHint || 'Add servers to server/mcp/config.json'}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {servers.map(server => (
            <div
              key={server.name}
              className="p-6 bg-white/5 rounded-3xl border border-white/5 space-y-4 hover:border-white/10 transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    server.connected ? 'bg-green-500/10 text-green-500' : 'bg-white/5 text-white/20'
                  }`}>
                    {server.connected ? <CheckCircle size={20} /> : <XCircle size={20} />}
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-sm uppercase tracking-tight">{server.name}</h4>
                    <p className="text-[10px] text-white/30 font-mono">{server.command} {server.args.join(' ')}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {server.enabled && (
                    <Button
                      onClick={() => restartServer(server.name)}
                      className="bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] font-black uppercase tracking-widest px-3 h-9 rounded-xl"
                    >
                      <RefreshCw size={14} className="mr-1" />
                      {t?.mcpRestart || 'Restart'}
                    </Button>
                  )}
                  <button
                    onClick={() => toggleServer(server.name, !server.enabled)}
                    className={`w-10 h-5 rounded-full p-1 transition-colors cursor-pointer ${
                      server.enabled ? 'bg-celestial-saturn' : 'bg-white/10'
                    }`}
                  >
                    <div className={`w-3 h-3 rounded-full bg-white transition-transform ${
                      server.enabled ? 'translate-x-5' : 'translate-x-0'
                    }`} />
                  </button>
                </div>
              </div>

              {server.connected && (
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-green-500">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  {t?.mcpConnected || 'Connected'}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="p-6 glass-dark rounded-[2rem] border border-white/5 space-y-4">
        <div className="flex items-center gap-3">
          <Wrench className="text-celestial-saturn" size={18} />
          <h4 className="text-sm font-bold uppercase tracking-tight text-white">{t?.mcpAvailableServers || 'Available MCP Servers'}</h4>
        </div>
        <p className="text-[11px] text-white/30 leading-relaxed">
          {t?.mcpInstallHint || 'Install MCP servers via npm or edit server/mcp/config.json to add new servers.'}
        </p>
      </div>
    </div>
  );
}
