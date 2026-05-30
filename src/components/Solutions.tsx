import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Building2, Factory, Landmark, Shield, Zap, Cpu, Globe, ArrowRight, Server, Network, Database, CheckCircle2 } from 'lucide-react';
import { Button } from './ui/button';
import { GlassCard, IconBox, FeatureItem } from './SharedUI';

export function Solutions({ t }: { t: any }) {
  const [requested, setRequested] = useState<string | null>(null);

  const handleRequest = (id: string) => {
    setRequested(id);
    setTimeout(() => setRequested(null), 3000);
  };

  const solutions = [
    {
      id: 'org',
      title: t.orgSolutions,
      subtitle: t.lumiNexusTitle,
      desc: t.lumiNexusDesc,
      icon: <Building2 size={40} className="text-celestial-saturn" />,
      features: [
        { title: t.orgGrade, desc: t.highAvailability },
        { title: t.dataSovereignty, desc: t.premiseIsolation },
        { title: t.collectiveWisdom, desc: t.knowledgeGraph }
      ],
      color: "from-celestial-saturn/20 to-transparent"
    },
    {
      id: 'industrial',
      title: t.industrialSolutions,
      subtitle: t.lumiIndustrialTitle,
      desc: t.lumiIndustrialDesc,
      icon: <Factory size={40} className="text-celestial-mars" />,
      features: [
        { title: t.edgeIntelligence, desc: t.subMillisecond },
        { title: t.predictiveMaintenance, desc: t.failureForecasting },
        { title: t.autonomousLogistics, desc: t.supplyChainNodes }
      ],
      color: "from-celestial-mars/20 to-transparent"
    },
    {
      id: 'institutional',
      title: t.institutionalSolutions,
      subtitle: t.lumiSanctuaryTitle,
      desc: t.lumiSanctuaryDesc,
      icon: <Landmark size={40} className="text-celestial-glow" />,
      features: [
        { title: t.federatedLearning, desc: t.collabTraining },
        { title: t.sovereignAI, desc: t.regulatoryStandards },
        { title: t.privacyFirstResearch, desc: t.secureMultiParty }
      ],
      color: "from-celestial-glow/20 to-transparent"
    }
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-24 pb-24">
      {/* Hero Section */}
      <div className="text-center space-y-8 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-block px-4 py-1.5 rounded-full bg-celestial-saturn/10 border border-celestial-saturn/20 text-celestial-saturn text-xs font-bold uppercase tracking-widest"
        >
          {t.lumiForOrgs}
        </motion.div>
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-7xl font-bold tracking-tighter glow-text"
        >
          {t.solutions}
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-xl text-white/60 max-w-3xl mx-auto leading-relaxed"
        >
          {t.solutionsSubtitle}
        </motion.p>
      </div>

      {/* Solutions Grid */}
      <div className="space-y-32">
        {solutions.map((solution, index) => (
          <motion.section 
            key={solution.id}
            initial={{ opacity: 0, x: index % 2 === 0 ? -50 : 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className={`grid lg:grid-cols-2 gap-16 items-center ${index % 2 === 1 ? 'lg:flex-row-reverse' : ''}`}
          >
            <div className={`space-y-8 ${index % 2 === 1 ? 'lg:order-2' : ''}`}>
              <div className="space-y-4">
                <h2 className="text-sm font-bold uppercase tracking-[0.3em] text-white/40">{solution.title}</h2>
                <h3 className="text-5xl font-bold tracking-tight">{solution.subtitle}</h3>
                <p className="text-lg text-white/60 leading-relaxed">
                  {solution.desc}
                </p>
              </div>

              <div className="grid sm:grid-cols-2 gap-6">
                {solution.features.map((feature, fIdx) => (
                  <div key={fIdx} className="space-y-2">
                    <div className="flex items-center gap-2 text-white/80 font-bold">
                      <div className="w-1.5 h-1.5 rounded-full bg-celestial-saturn" />
                      {feature.title}
                    </div>
                    <p className="text-xs text-white/40">{feature.desc}</p>
                  </div>
                ))}
              </div>

              <Button 
                onClick={() => handleRequest(solution.id)}
                className={`rounded-2xl px-8 py-6 transition-all flex items-center gap-2 group ${requested === solution.id ? 'bg-green-500 text-white' : 'bg-white/5 border border-white/10 hover:bg-celestial-saturn hover:text-black'}`}
              >
                {requested === solution.id ? (
                  <>
                    <CheckCircle2 size={18} />
                    {t.requestSent}
                  </>
                ) : (
                  <>
                    {t.requestCaseStudy}
                    <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </Button>
            </div>

            <div className={`relative aspect-video rounded-[4rem] overflow-hidden group ${index % 2 === 1 ? 'lg:order-1' : ''}`}>
              <div className={`absolute inset-0 bg-gradient-to-br ${solution.color} opacity-50 group-hover:opacity-80 transition-opacity duration-700`} />
              <div className="absolute inset-0 flex items-center justify-center">
                <motion.div
                  animate={{ 
                    y: [0, -20, 0],
                    rotate: [0, 5, 0]
                  }}
                  transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                >
                  <IconBox icon={solution.icon} size="lg" className="scale-150 shadow-[0_0_50px_rgba(255,204,0,0.1)]" />
                </motion.div>
              </div>
              
              {/* Decorative Tech Elements */}
              <div className="absolute top-12 left-12 w-24 h-24 border-t border-l border-white/10 rounded-tl-3xl" />
              <div className="absolute bottom-12 right-12 w-24 h-24 border-b border-r border-white/10 rounded-br-3xl" />
              
              {/* Scanning Effect */}
              <motion.div 
                animate={{ top: ['-10%', '110%'] }}
                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"
              />
            </div>
          </motion.section>
        ))}
      </div>

      {/* Infrastructure Section */}
      <GlassCard className="p-16 rounded-[4rem] relative overflow-hidden group" hoverEffect={false}>
        <div className="absolute inset-0 bg-gradient-to-br from-celestial-saturn/5 via-transparent to-celestial-mars/5" />
        <div className="relative z-10 grid lg:grid-cols-3 gap-12 text-center">
          <div className="space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto group-hover:border-celestial-saturn/50 transition-colors">
              <Server className="text-celestial-saturn" />
            </div>
            <h4 className="text-xl font-bold">{t.lumiCoreRack}</h4>
            <p className="text-sm text-white/40">{t.rackUnits}</p>
          </div>
          <div className="space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto group-hover:border-celestial-mars/50 transition-colors">
              <Network className="text-celestial-mars" />
            </div>
            <h4 className="text-xl font-bold">{t.syncProtocol}</h4>
            <p className="text-sm text-white/40">{t.meshProtocolDescLong}</p>
          </div>
          <div className="space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto group-hover:border-celestial-glow/50 transition-colors">
              <Database className="text-celestial-glow" />
            </div>
            <h4 className="text-xl font-bold">{t.neuralVault}</h4>
            <p className="text-sm text-white/40">{t.hardwareEncryption}</p>
          </div>
        </div>
      </GlassCard>

      {/* CTA Section */}
      <div className="text-center space-y-8 py-12">
        <h2 className="text-4xl font-bold tracking-tight">{t.readyToEvolve}</h2>
        <div className="flex flex-wrap justify-center gap-4">
          <Button className="bg-celestial-saturn text-black rounded-full px-10 py-6 font-bold text-lg hover:scale-105 transition-transform">
            {t.contactSales}
          </Button>
          <Button className="bg-white/5 border border-white/10 rounded-full px-10 py-6 font-bold text-lg hover:bg-white/10 transition-colors">
            {t.downloadWhitepaper}
          </Button>
        </div>
      </div>
    </div>
  );
}
