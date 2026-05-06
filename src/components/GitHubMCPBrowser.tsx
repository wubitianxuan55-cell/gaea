import { useState } from 'react';
import { motion } from 'motion/react';
import { Search, Github, Star, ExternalLink, Download, Loader2, Package } from 'lucide-react';

interface MCPSearchResult {
  id: number;
  name: string;
  description: string;
  stars: number;
  url: string;
  topics: string[];
  language: string;
  updatedAt: string;
}

export function GitHubMCPBrowser() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MCPSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [installing, setInstalling] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const res = await fetch(`/api/mcp/github/search?q=${encodeURIComponent(query.trim())}`);
      const data = await res.json();
      setResults(data.results || []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleInstall = async (repo: MCPSearchResult) => {
    setInstalling(repo.name);
    try {
      const config = {
        type: 'stdio',
        command: 'npx',
        args: ['-y', repo.name],
        env: {} as Record<string, string>,
      };
      const res = await fetch('/api/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          servers: { [repo.name.split('/').pop() || repo.name]: config },
        }),
      });
      if (res.ok) {
        alert(`Installed ${repo.name}! Restart MCP server to use new tools.`);
      }
    } catch {
      // ignore
    } finally {
      setInstalling(null);
    }
  };

  return (
    <div className="h-full flex flex-col bg-zinc-950/60 backdrop-blur-xl text-white overflow-y-auto">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-white/5">
        <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
          <Github size={20} className="text-purple-400" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-white/90">GitHub MCP Browser</h2>
          <p className="text-[10px] text-white/30">Discover and install community MCP servers</p>
        </div>
      </div>

      <div className="flex-1 p-6 space-y-4">
        {/* Search bar */}
        <div className="flex gap-2">
          <div className="flex-1 flex items-center gap-2 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl">
            <Search size={14} className="text-white/30" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="Search GitHub for MCP servers..."
              className="flex-1 bg-transparent text-white/80 text-sm outline-none placeholder:text-white/30"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={loading}
            className="px-4 py-2.5 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-300 text-xs font-bold uppercase tracking-wider hover:bg-purple-500/30 transition-all disabled:opacity-40"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : 'Search'}
          </button>
        </div>

        {/* Results */}
        <div className="space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-white/30">
              <Loader2 size={24} className="animate-spin mr-2" /> Searching GitHub...
            </div>
          ) : searched && results.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-white/20">
              <Package size={40} className="mb-3 opacity-30" />
              <span className="text-xs font-bold uppercase tracking-widest">No MCP servers found</span>
            </div>
          ) : (
            results.map(repo => (
              <div
                key={repo.id}
                className="flex items-start gap-3 p-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all"
              >
                <div className="flex-shrink-0 mt-0.5">
                  <Github size={18} className="text-white/40" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white/80 truncate">{repo.name}</span>
                    <div className="flex items-center gap-1 text-amber-400">
                      <Star size={12} fill="currentColor" />
                      <span className="text-[10px] font-bold">{repo.stars}</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-white/40 mt-1 line-clamp-2">{repo.description || 'No description'}</p>
                  <div className="flex items-center gap-2 mt-2">
                    {repo.language && (
                      <span className="text-[8px] px-1.5 py-0.5 rounded-md bg-blue-500/10 text-blue-400 font-bold uppercase">
                        {repo.language}
                      </span>
                    )}
                    {repo.topics.slice(0, 3).map(t => (
                      <span key={t} className="text-[8px] px-1.5 py-0.5 rounded-md bg-white/5 text-white/30 font-bold uppercase">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <a
                    href={repo.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/10 transition-all"
                  >
                    <ExternalLink size={14} />
                  </a>
                  <button
                    onClick={() => handleInstall(repo)}
                    disabled={installing === repo.name}
                    className="p-2 rounded-lg text-emerald-400/60 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all"
                  >
                    {installing === repo.name ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
