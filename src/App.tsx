import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

const ClientPortalLayout = lazy(() => import('./components/ClientPortalLayout'));
const PortalLogin = lazy(() => import('./views/PortalLogin'));

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={
        <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center">
          <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full mb-4 animate-spin" />
          <p className="text-gray-400 font-medium animate-pulse">Carregando Portal Hub...</p>
        </div>
      }>
        <Routes>
          <Route path="/login" element={<PortalLogin />} />
          <Route path="/portal/login" element={<PortalLogin />} />
          
          <Route path="/:orgId/:clientId/*" element={<ClientPortalLayout />} />
          <Route path="/portal/:orgId/:clientId/*" element={<ClientPortalLayout />} />
          
          {/* Fallback */}
          <Route path="*" element={
            <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6">
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-[2rem] max-w-md text-center">
                <div className="w-16 h-16 bg-primary-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-primary-500/20">
                  <svg className="w-8 h-8 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-white mb-2">Portal Hub</h2>
                <p className="text-gray-400 text-sm mb-6 leading-relaxed">
                  Para acessar a sua área do cliente restrita, utilize o link de convite oficial enviado pelo suporte ou faça o login com suas credenciais.
                </p>
                <a href="/login" className="block w-full py-3.5 bg-primary-500 hover:bg-primary-600 text-white rounded-xl font-bold transition-all shadow-lg shadow-primary-500/10">
                  Acessar Minha Conta
                </a>
              </div>
            </div>
          } />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
