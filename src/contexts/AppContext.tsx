import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { toast } from 'sonner';
import * as authService from '../services/authService';

interface UserProfile {
  uid: string;
  username: string;
  displayName?: string;
  email?: string;
  photoURL?: string;
  balance: number;
  role: string;
  phone?: string;
  provider: 'custom' | 'google';
}

interface Agent {
  id: string;
  ownerUid: string;
  name: string;
  category: string;
  data: string;
  createdAt: string;
  status: 'active' | 'inactive';
}

interface AIConfig {
  provider: string;
  model: string;
  apiKey: string;
}

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
}

interface ToolOverride {
  enabled: boolean;
  securityLevel?: string;
}

interface AppContextType {
  user: UserProfile | null;
  loading: boolean;
  agents: Agent[];
  aiConfig: AIConfig;
  personalityId: string;
  // Voice
  selectedVoiceId: string | undefined;
  setSelectedVoiceId: (id: string) => void;
  favoriteVoices: string[];
  toggleFavoriteVoice: (id: string) => void;
  // Notifications
  notifications: NotificationItem[];
  unreadCount: number;
  addNotification: (item: Omit<NotificationItem, 'id' | 'timestamp' | 'read'>) => void;
  markAllNotificationsRead: () => void;
  clearNotifications: () => void;
  // Tools
  toolOverrides: Record<string, ToolOverride>;
  setToolOverride: (name: string, override: ToolOverride) => void;
  // Core
  login: () => Promise<void>;
  logout: () => Promise<void>;
  createAgent: (name: string, category: string, data: any) => Promise<void>;
  deleteAgent: (id: string) => Promise<void>;
  updateBalance: (amount: number) => Promise<void>;
  refreshUser: () => Promise<void>;
  updateAIConfig: (config: Partial<AIConfig>) => void;
  setPersonalityId: (id: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiConfig, setAiConfig] = useState<AIConfig>(() => {
    const saved = localStorage.getItem('lumi_ai_config');
    return saved ? JSON.parse(saved) : { provider: 'deepseek', model: 'deepseek-chat', apiKey: '' };
  });
  const [personalityId, setPersonalityIdState] = useState<string>(() => {
    return localStorage.getItem('lumi_personality_id') || 'lumi';
  });

  // Voice state
  const [selectedVoiceId, setSelectedVoiceIdState] = useState<string | undefined>(() => {
    return localStorage.getItem('lumi_selected_voice_id') || undefined;
  });
  const [favoriteVoices, setFavoriteVoices] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('lumi_favorite_voices') || '[]'); } catch { return []; }
  });

  // Notifications state
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const unreadCount = notifications.filter(n => !n.read).length;

  // Tool overrides state
  const [toolOverrides, setToolOverrides] = useState<Record<string, ToolOverride>>(() => {
    try { return JSON.parse(localStorage.getItem('lumi_tool_overrides') || '{}'); } catch { return {}; }
  });

  const updateAIConfig = (newConfig: Partial<AIConfig>) => {
    setAiConfig(prev => {
      const updated = { ...prev, ...newConfig };
      localStorage.setItem('lumi_ai_config', JSON.stringify(updated));
      return updated;
    });
    toast.success('Neural core configuration synchronized');
  };

  const refreshUser = async () => {
    try {
      const customAuth = await authService.getMe();
      if (customAuth) {
        setUser({ ...customAuth.user, provider: 'custom' } as any);
        const agentsRes = await fetch('/api/agents');
        if (agentsRes.ok) {
          const agentsData = await agentsRes.json();
          setAgents(agentsData);
        }
      } else {
        setUser(null);
        setAgents([]);
      }
    } catch (error) {
      console.error('Error refreshing user:', error);
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        await refreshUser();
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const login = async () => {
    window.dispatchEvent(new CustomEvent('lumi:open-login'));
  };

  const logout = async () => {
    try {
      await authService.logout();
      setUser(null);
      setAgents([]);
      toast.info('Returned to the mortal realm');
    } catch (error: any) {
      toast.error('Logout failed: ' + error.message);
    }
  };

  const createAgent = async (name: string, category: string, data: any) => {
    if (!user) {
      toast.error('You must be authenticated to synthesize agents');
      return;
    }

    try {
      const response = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, category, data: JSON.stringify(data) })
      });

      if (!response.ok) throw new Error('Failed to create agent');
      
      const newAgent = await response.json();
      setAgents(prev => [...prev, newAgent]);
      toast.success(`${name} has been synthesized`);
    } catch (error: any) {
      console.error('Synthesis error:', error);
      toast.error('Synthesis failed: ' + error.message);
    }
  };

  const deleteAgent = async (id: string) => {
    try {
      const response = await fetch(`/api/agents/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete agent');
      
      setAgents(prev => prev.filter(a => a.id !== id));
      toast.success('Agent essence has been released');
    } catch (error: any) {
      console.error('Deletion error:', error);
      toast.error('Deletion failed: ' + error.message);
    }
  };

  const updateBalance = async (amount: number) => {
    // Local balance update logic could be added here
    toast.info('Balance updates are handled by the core system.');
  };

  const setPersonalityId = (id: string) => {
    setPersonalityIdState(id);
    localStorage.setItem('lumi_personality_id', id);
  };

  const setSelectedVoiceId = (id: string) => {
    setSelectedVoiceIdState(id);
    localStorage.setItem('lumi_selected_voice_id', id);
  };

  const toggleFavoriteVoice = (id: string) => {
    setFavoriteVoices(prev => {
      const next = prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id];
      localStorage.setItem('lumi_favorite_voices', JSON.stringify(next));
      return next;
    });
  };

  const addNotification = (item: Omit<NotificationItem, 'id' | 'timestamp' | 'read'>) => {
    const notification: NotificationItem = {
      ...item,
      id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
      read: false,
    };
    setNotifications(prev => [notification, ...prev].slice(0, 50));
  };

  const markAllNotificationsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const clearNotifications = () => {
    setNotifications([]);
  };

  const setToolOverride = (name: string, override: ToolOverride) => {
    setToolOverrides(prev => {
      const next = { ...prev, [name]: override };
      localStorage.setItem('lumi_tool_overrides', JSON.stringify(next));
      return next;
    });
  };

  return (
    <AppContext.Provider value={{
      user,
      loading,
      agents,
      aiConfig,
      personalityId,
      selectedVoiceId,
      setSelectedVoiceId,
      favoriteVoices,
      toggleFavoriteVoice,
      notifications,
      unreadCount,
      addNotification,
      markAllNotificationsRead,
      clearNotifications,
      toolOverrides,
      setToolOverride,
      login,
      logout,
      createAgent,
      deleteAgent,
      updateBalance,
      refreshUser,
      updateAIConfig,
      setPersonalityId,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
