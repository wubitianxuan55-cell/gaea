import React, { useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Rocket, Mail, Github, Twitter, Send } from 'lucide-react';

export function JoinUs({ t }: { t: any }) {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'feedback'), {
        email,
        message,
        timestamp: serverTimestamp()
      });
      setSent(true);
      setEmail('');
      setMessage('');
    } catch (error) {
      console.error("Feedback error", error);
    }
  };

  return (
    <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-16 items-center">
      <div className="space-y-8">
        <div className="space-y-4">
          <Badge className="bg-celestial-mars text-white px-4 py-1">{t.hiring}</Badge>
          <h1 className="text-6xl font-bold tracking-tighter leading-none">
            {t.buildFuture} <br />
            <span className="text-celestial-saturn">{t.celestialIntel}</span>
          </h1>
          <p className="text-xl text-white/60 leading-relaxed">
            {t.tagline}
          </p>
        </div>

        <div className="flex items-center gap-6">
          <SocialLink icon={<Twitter />} href="#" />
          <SocialLink icon={<Github />} href="#" />
          <SocialLink icon={<Mail />} href="#" />
        </div>

        <div className="glass p-8 rounded-3xl space-y-4 border-l-4 border-celestial-mars">
          <h3 className="font-bold text-xl">{t.mission}</h3>
          <p className="text-white/60 text-sm leading-relaxed">
            {t.missionDesc}
          </p>
        </div>
      </div>

      <div className="glass p-10 rounded-[2.5rem] border-white/10 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-celestial-mars/20 blur-3xl" />
        
        {sent ? (
          <div className="text-center py-12 space-y-4">
            <div className="w-16 h-16 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mx-auto">
              <Send />
            </div>
            <h3 className="text-2xl font-bold">{t.signalReceived}</h3>
            <p className="text-white/60">{t.signalReceived}</p>
            <Button onClick={() => setSent(false)} variant="ghost">{t.joinExpedition}</Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-white/60 uppercase tracking-widest">{t.yourEmail}</label>
              <Input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t.placeholderEmail}
                className="bg-white/5 border-white/10 py-6 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-white/60 uppercase tracking-widest">{t.yourMessage}</label>
              <Textarea
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t.placeholderMessage}
                className="bg-white/5 border-white/10 min-h-[150px] rounded-xl"
              />
            </div>
            <Button type="submit" className="w-full py-6 mars-gradient text-white font-bold rounded-xl hover:scale-[1.02] transition-transform flex items-center gap-2">
              <Rocket size={20} />
              {t.joinExpedition}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}

function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center rounded-full text-xs font-semibold ${className}`}>
      {children}
    </span>
  );
}

function SocialLink({ icon, href }: { icon: React.ReactNode; href: string }) {
  return (
    <a href={href} className="w-12 h-12 rounded-full glass flex items-center justify-center text-white/60 hover:text-white hover:scale-110 transition-all border-white/10">
      {icon}
    </a>
  );
}
