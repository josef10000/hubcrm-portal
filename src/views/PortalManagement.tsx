import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Package, Calculator, Briefcase, ChevronDown, ShoppingCart } from 'lucide-react';
import PortalInventory from '../components/PortalInventory';
import PortalCalculator from '../components/PortalCalculator';
import PortalPOS from './PortalPOS';
import { db, auth } from '../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

interface PortalManagementProps {
  orgId: string;
  clientId: string;
}

export default function PortalManagement({ orgId, clientId }: PortalManagementProps) {
  const [activeSubTab, setActiveSubTab] = useState<'inventory' | 'pos' | 'calculator'>('inventory');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Escuta modulesConfig do profissional no seu profiles do Firestore
  const [modulesConfig, setModulesConfig] = useState<any>(null);

  useEffect(() => {
    let unsubProfile: (() => void) | undefined;
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        const profileRef = doc(db, 'profiles', user.uid);
        unsubProfile = onSnapshot(profileRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setModulesConfig(data.modulesConfig || null);
          }
        });
      } else {
        setModulesConfig(null);
        if (unsubProfile) unsubProfile();
      }
    });

    return () => {
      unsubAuth();
      if (unsubProfile) unsubProfile();
    };
  }, []);

  const isSubTabActive = (subTabId: string) => {
    if (!modulesConfig || !modulesConfig.activeModules) return true;
    const active = modulesConfig.activeModules;
    if (subTabId === 'pos') return active.management_pos !== false;
    if (subTabId === 'calculator') return active.management_calc !== false;
    return true;
  };

  // Redirecionamento se a sub-aba ativa for desativada
  useEffect(() => {
    if (activeSubTab === 'inventory') return;
    if (!isSubTabActive(activeSubTab)) {
      setActiveSubTab('inventory');
    }
  }, [modulesConfig, activeSubTab]);

  const subTabs = [
    { id: 'inventory', label: 'Estoque & Produtos', icon: Package },
    ...(isSubTabActive('pos') ? [{ id: 'pos', label: 'Caixa Rápido (PDV)', icon: ShoppingCart }] : []),
    ...(isSubTabActive('calculator') ? [{ id: 'calculator', label: 'Calculadora de Orçamentos', icon: Calculator }] : [])
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h3 className="text-xl lg:text-2xl font-bold text-white flex items-center gap-3">
            <div className="p-2 bg-primary-500/10 rounded-xl">
              <Briefcase className="text-primary-400 w-5 h-5 lg:w-6 lg:h-6" />
            </div>
            Meu Negócio
          </h3>
          <p className="text-gray-500 text-xs lg:text-sm mt-1">
            Gerencie o estoque de produtos, simule orçamentos operacionais e venda com dedução automática.
          </p>
        </div>
      </div>

      {/* Seletor Mobile (Dropdown Customizado) */}
      <div className="relative block md:hidden w-full mb-6 z-20">
        <button
          type="button"
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="w-full pl-12 pr-10 py-4 bg-[#0d0e12]/80 backdrop-blur-xl border border-white/10 hover:border-white/20 text-white rounded-2xl text-xs font-black uppercase tracking-wider outline-none transition-all cursor-pointer flex items-center justify-between text-left relative"
        >
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-primary-400">
            {(() => {
              if (activeSubTab === 'inventory') return <Package size={18} />;
              if (activeSubTab === 'pos') return <ShoppingCart size={18} />;
              return <Calculator size={18} />;
            })()}
          </div>
          <span>
            {activeSubTab === 'inventory' 
              ? 'Estoque & Produtos' 
              : activeSubTab === 'pos' 
                ? 'Caixa Rápido (PDV)' 
                : 'Calculadora de Orçamentos'}
          </span>
          <ChevronDown 
            size={16} 
            className={`text-gray-500 transition-transform duration-300 ${isDropdownOpen ? 'rotate-180 text-primary-400' : ''}`} 
          />
        </button>

        {isDropdownOpen && (
          <>
            <div className="fixed inset-0 z-10 cursor-default" onClick={() => setIsDropdownOpen(false)} />
            <div className="absolute top-full left-0 right-0 mt-2 z-20 bg-[#0a0c10]/95 border border-white/10 backdrop-blur-2xl rounded-2xl p-2 shadow-2xl flex flex-col space-y-1 animate-in fade-in slide-in-from-top-2 duration-200">
              <button
                type="button"
                onClick={() => {
                  setActiveSubTab('inventory');
                  setIsDropdownOpen(false);
                }}
                className={`w-full px-4 py-3.5 rounded-xl text-left text-xs font-bold uppercase tracking-wider flex items-center gap-3 transition-colors cursor-pointer border-0 ${
                  activeSubTab === 'inventory' 
                    ? 'bg-primary-500/15 text-primary-400 font-black' 
                    : 'text-gray-400 hover:bg-primary-500/10 hover:text-primary-400'
                }`}
              >
                <Package size={16} className={activeSubTab === 'inventory' ? 'text-primary-400' : 'text-gray-500'} />
                Estoque & Produtos
              </button>
              {isSubTabActive('pos') && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveSubTab('pos');
                    setIsDropdownOpen(false);
                  }}
                  className={`w-full px-4 py-3.5 rounded-xl text-left text-xs font-bold uppercase tracking-wider flex items-center gap-3 transition-colors cursor-pointer border-0 ${
                    activeSubTab === 'pos' 
                      ? 'bg-primary-500/15 text-primary-400 font-black' 
                      : 'text-gray-400 hover:bg-primary-500/10 hover:text-primary-400'
                  }`}
                >
                  <ShoppingCart size={16} className={activeSubTab === 'pos' ? 'text-primary-400' : 'text-gray-500'} />
                  Caixa Rápido (PDV)
                </button>
              )}
              {isSubTabActive('calculator') && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveSubTab('calculator');
                    setIsDropdownOpen(false);
                  }}
                  className={`w-full px-4 py-3.5 rounded-xl text-left text-xs font-bold uppercase tracking-wider flex items-center gap-3 transition-colors cursor-pointer border-0 ${
                    activeSubTab === 'calculator' 
                      ? 'bg-primary-500/15 text-primary-400 font-black' 
                      : 'text-gray-400 hover:bg-primary-500/10 hover:text-primary-400'
                  }`}
                >
                  <Calculator size={16} className={activeSubTab === 'calculator' ? 'text-primary-400' : 'text-gray-500'} />
                  Calculadora de Orçamentos
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Sub Tabs Navigation (Desktop) */}
      <div className="hidden md:flex border-b border-white/10 gap-2 md:gap-4 overflow-x-auto pb-px scrollbar-none">
        {subTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as 'inventory' | 'pos' | 'calculator')}
              className={`
                flex items-center gap-2 px-4 py-3 border-b-2 text-sm font-bold transition-all whitespace-nowrap relative
                ${isActive 
                  ? 'border-primary-500 text-primary-400' 
                  : 'border-transparent text-gray-500 hover:text-gray-300'}
              `}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
              {isActive && (
                <motion.div 
                  layoutId="activeSubTabIndicator"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-500"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Component Area */}
      <div className="relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeSubTab}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.25 }}
          >
            {activeSubTab === 'inventory' && (
              <PortalInventory orgId={orgId} />
            )}
            {activeSubTab === 'pos' && (
              <PortalPOS orgId={orgId} clientId={clientId} />
            )}
            {activeSubTab === 'calculator' && (
              <PortalCalculator orgId={orgId} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
