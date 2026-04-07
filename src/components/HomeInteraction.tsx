import React, { useState, useEffect } from 'react';
import { db, auth } from '@/lib/firebase';
import { collection, query, orderBy, limit, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { Send, User, Bot, MessageSquare, Sparkles } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card } from './ui/card';
import { LocalAgentSphere } from './LocalAgentSphere';

export function HomeInteraction({ t }: { t: any }) {
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    if (!auth.currentUser) {
      setMessages([]);
      return;
    }

    const q = query(collection(db, 'lumiai_interactions'), orderBy('timestamp', 'desc'), limit(50));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).reverse();
      setMessages(msgs);
    }, (error) => {
      console.error("Firestore Error in HomeInteraction:", error);
      // If permission denied, it might be because the user is not logged in or rules are still deploying
      if (error.code === 'permission-denied') {
        setMessages([]);
      }
    });
    return () => unsubscribe();
  }, [auth.currentUser]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !auth.currentUser) return;

    const interactionData = {
      text: newMessage,
      userId: auth.currentUser.uid,
      userName: auth.currentUser.displayName || 'Anonymous',
      userPhoto: auth.currentUser.photoURL,
      timestamp: serverTimestamp(),
      type: 'user'
    };

    try {
      await addDoc(collection(db, 'lumiai_interactions'), interactionData);
      setNewMessage('');
      
      // Simulate local agent response
      setIsTyping(true);
      setTimeout(async () => {
        try {
          await addDoc(collection(db, 'lumiai_interactions'), {
            text: `[Lumi Core] Received: "${newMessage}". Processing within local neural node.`,
            userId: 'lumiai-agent',
            userName: 'Lumi Core',
            timestamp: serverTimestamp(),
            type: 'agent'
          });
        } catch (err) {
          console.error("Agent response error:", err);
        }
        setIsTyping(false);
      }, 1500);
    } catch (error) {
      console.error("Error sending message:", error);
      // You could show a toast or alert here
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-16">
      {/* Local Agent Sphere Section */}
      <section className="space-y-8">
        <div className="text-center space-y-4">
          <h2 className="text-4xl font-bold tracking-tighter glow-text">Local Core Agent</h2>
          <p className="text-white/40 max-w-xl mx-auto">Your private, high-performance local intelligence. No data leaves your node.</p>
        </div>
        <LocalAgentSphere t={t} />
      </section>

      <div className="text-center space-y-4">
        <h1 className="text-5xl font-bold tracking-tighter glow-text">{t.interactionTitle}</h1>
        <p className="text-white/60">{t.interactionDesc}</p>
      </div>

      <div className="flex flex-col h-[70vh] overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, x: msg.type === 'agent' ? 20 : -20 }}
                animate={{ opacity: 1, x: 0 }}
                className={`flex items-start gap-4 ${msg.type === 'agent' ? 'flex-row-reverse' : ''}`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border border-white/10 ${msg.type === 'agent' ? 'bg-celestial-saturn/20 text-celestial-saturn' : 'bg-white/5 text-white/40'}`}>
                  {msg.type === 'agent' ? <Sparkles size={20} /> : <User size={20} />}
                </div>
                <div className={`max-w-[85%] space-y-1 ${msg.type === 'agent' ? 'text-right' : ''}`}>
                  <div className="text-[10px] opacity-40 font-bold uppercase tracking-widest flex items-center gap-2 justify-start">
                    {msg.type === 'agent' && <span className="w-1 h-1 rounded-full bg-celestial-saturn animate-pulse" />}
                    {msg.userName}
                  </div>
                  <div className={`p-4 rounded-3xl text-sm leading-relaxed ${msg.type === 'agent' ? 'bg-celestial-saturn/5 text-celestial-saturn border border-celestial-saturn/10' : 'bg-white/5 text-white/80 border border-white/5'}`}>
                    {msg.text}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {isTyping && (
            <div className="flex items-center gap-2 text-celestial-saturn/40 text-xs animate-pulse justify-center py-4">
              <Sparkles size={14} />
              The Spirit is manifesting a response...
            </div>
          )}
        </div>

        <div className="p-6 mt-4">
          <form onSubmit={handleSendMessage} className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-celestial-mars via-celestial-saturn to-celestial-glow rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-1000 group-hover:duration-200" />
            <div className="relative flex gap-2 bg-black/40 backdrop-blur-xl border border-white/10 p-2 rounded-2xl">
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder={t.speakToAgent}
                className="bg-transparent border-none focus-visible:ring-0 text-white placeholder:text-white/20"
              />
              <Button type="submit" className="bg-celestial-saturn text-black rounded-xl px-6 hover:scale-105 transition-transform font-bold">
                <Send size={18} className="mr-2" />
                {t.postMessage}
              </Button>
            </div>
          </form>
        </div>
      </div>
      
      <div className="grid md:grid-cols-3 gap-4">
        <div className="glass p-4 rounded-2xl border-white/5 text-center space-y-1">
           <MessageSquare className="mx-auto text-celestial-saturn" size={20} />
           <div className="text-xs font-bold uppercase tracking-widest text-white/40">Community</div>
           <div className="text-lg font-bold">1.2k Active</div>
        </div>
        <div className="glass p-4 rounded-2xl border-white/5 text-center space-y-1">
           <Bot className="mx-auto text-celestial-mars" size={20} />
           <div className="text-xs font-bold uppercase tracking-widest text-white/40">Local Agents</div>
           <div className="text-lg font-bold">854 Online</div>
        </div>
        <div className="glass p-4 rounded-2xl border-white/5 text-center space-y-1">
           <Sparkles className="mx-auto text-celestial-glow" size={20} />
           <div className="text-xs font-bold uppercase tracking-widest text-white/40">Interactions</div>
           <div className="text-lg font-bold">45.2k Total</div>
        </div>
      </div>
    </div>
  );
}
