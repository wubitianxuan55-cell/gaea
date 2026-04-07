import React, { useState, useEffect } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, User } from 'firebase/auth';
import { doc, getDoc, setDoc, getDocFromServer } from 'firebase/firestore';
import { Navbar } from './components/Navbar';
import { HomeInteraction } from './components/HomeInteraction';
import { AgentGenerator } from './components/AgentGenerator';
import { LumiEcosystem } from './components/LumiEcosystem';
import { JoinUs } from './components/JoinUs';
import { LandingSections } from './components/LandingSections';
import { Footer } from './components/Footer';
import { Settings } from './components/Settings';
import { Profile } from './components/Profile';
import { Docs } from './components/Docs';
import { MultimodalProducts } from './components/MultimodalProducts';
import { LocalAgentSphere } from './components/LocalAgentSphere';
import { motion, AnimatePresence } from 'motion/react';
import { Rocket, Sparkles } from 'lucide-react';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

import { translations } from './lib/translations';

function LoginRequired({ t, onLogin }: { t: any; onLogin: () => void }) {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-8"
    >
      <div className="w-24 h-24 rounded-3xl bg-celestial-saturn/10 flex items-center justify-center text-celestial-saturn">
        <Sparkles size={48} />
      </div>
      <div className="space-y-2">
        <h2 className="text-3xl font-bold tracking-tighter">{t.loginRequired || 'Authentication Required'}</h2>
        <p className="text-white/40 max-w-md mx-auto">
          {t.loginRequiredDesc || 'Please connect your account to access this module and synchronize your local intelligence.'}
        </p>
      </div>
      <button
        onClick={onLogin}
        className="px-8 py-4 bg-celestial-saturn text-black font-bold rounded-full hover:scale-105 transition-transform flex items-center gap-2"
      >
        <Rocket size={20} />
        {t.connect}
      </button>
    </motion.div>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('home');
  const [lang, setLang] = useState<'en' | 'zh'>('zh');

  const t = translations[lang];

  useEffect(() => {
    // Connection test
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    };
    testConnection();

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const path = `users/${user.uid}`;
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (!userDoc.exists()) {
            await setDoc(doc(db, 'users', user.uid), {
              uid: user.uid,
              email: user.email,
              displayName: user.displayName,
              photoURL: user.photoURL,
              role: 'user',
              createdAt: new Date().toISOString()
            });
          }
          setUser(user);
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, path);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    // Safety timeout for loading state
    const loadingTimeout = setTimeout(() => {
      setLoading(false);
    }, 3000);

    return () => {
      unsubscribe();
      clearTimeout(loadingTimeout);
    };
  }, []);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-celestial-deep">
        <motion.div
          animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="flex flex-col items-center gap-4"
        >
          <Rocket size={48} className="text-celestial-saturn" />
          <div className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-celestial-mars to-celestial-saturn">
            LumiAI Initializing...
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col dark">
      <div className="star-field" />
      <Navbar 
        user={user} 
        onLogin={handleLogin} 
        onLogout={() => signOut(auth)} 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        lang={lang}
        setLang={setLang}
        t={t}
      />
      
      <main className="flex-1 container mx-auto px-4 py-8 relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="w-full"
          >
            {activeTab === 'home' && (
              !user ? (
                <div className="space-y-32">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col items-center justify-center min-h-[70vh] text-center"
                  >
                    <div className="mb-12 scale-75 opacity-80">
                      <LocalAgentSphere t={t} />
                    </div>
                    <h1 className="text-5xl md:text-7xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-celestial-mars via-celestial-saturn to-celestial-glow animate-pulse mb-6">
                      {t.heroTitle}
                    </h1>
                    <p className="text-xl text-white/60 max-w-2xl mb-8">
                      {t.heroSubtitle}
                    </p>
                    <div className="flex justify-center gap-4">
                      <button
                        onClick={handleLogin}
                        className="px-8 py-4 bg-celestial-saturn text-black font-bold rounded-full hover:scale-105 transition-transform flex items-center gap-2"
                      >
                        <Sparkles size={20} />
                        {t.getStarted}
                      </button>
                      <button 
                        onClick={() => setActiveTab('docs')}
                        className="px-8 py-4 border border-white/20 text-white font-bold rounded-full hover:bg-white/5 transition-all"
                      >
                        {t.learnMore}
                      </button>
                    </div>
                  </motion.div>
                  <LandingSections t={t} />
                </div>
              ) : (
                <div className="space-y-32">
                  <HomeInteraction t={t} />
                  <LandingSections t={t} />
                </div>
              )
            )}

            {activeTab === 'generate' && (
              !user ? <LoginRequired t={t} onLogin={handleLogin} /> : <AgentGenerator t={t} />
            )}

            {activeTab === 'ecosystem' && <LumiEcosystem t={t} />}
            
            {activeTab === 'multimodal' && <MultimodalProducts t={t} />}
            
            {activeTab === 'docs' && <Docs t={t} />}
            
            {activeTab === 'join' && <JoinUs t={t} />}
            
            {activeTab === 'settings' && (
              !user ? <LoginRequired t={t} onLogin={handleLogin} /> : <Settings t={t} />
            )}
            
            {activeTab === 'profile' && (
              !user ? <LoginRequired t={t} onLogin={handleLogin} /> : <Profile t={t} />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Background Elements */}
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none -z-10 overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-celestial-mars/10 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-celestial-glow/5 blur-[120px]" />
      </div>
      
      <Footer t={t} />
    </div>
  );
}
