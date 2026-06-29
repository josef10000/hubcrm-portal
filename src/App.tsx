import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import PortalLogin from './views/PortalLogin';
import { ThemeProvider } from './lib/ThemeContext';

const ClientPortalLayout = lazy(() => import('./components/ClientPortalLayout'));
const PortalActivation = lazy(() => import('./views/PortalActivation'));
const ConfirmarPresenca = lazy(() => import('./views/ConfirmarPresenca'));
const PortalBioSite = lazy(() => import('./views/PortalBioSite'));
const PortalPublicBooking = lazy(() => import('./views/PortalPublicBooking'));
const PortalPixPayment = lazy(() => import('./views/PortalPixPayment'));
const PortalResourceGuide = lazy(() => import('./views/PortalResourceGuide'));

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Suspense fallback={
          <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center">
            <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full mb-4 animate-spin" />
            <p className="text-gray-400 font-medium animate-pulse">Carregando Portal Hub...</p>
          </div>
        }>
          <Routes>
            <Route path="/" element={<PortalLogin />} />
            <Route path="/login" element={<PortalLogin />} />
            <Route path="/portal/login" element={<PortalLogin />} />
            <Route path="/activate" element={<PortalActivation />} />
            <Route path="/portal/activate" element={<PortalActivation />} />
            <Route path="/confirmar-presenca" element={<ConfirmarPresenca />} />
            <Route path="/portal/confirmar-presenca" element={<ConfirmarPresenca />} />
            
            <Route path="/pagar-pix" element={<PortalPixPayment />} />
            <Route path="/portal/pagar-pix" element={<PortalPixPayment />} />
            
            <Route path="/bio/:orgId" element={<PortalBioSite />} />
            <Route path="/portal/bio/:orgId" element={<PortalBioSite />} />
            <Route path="/agendar/:orgId" element={<PortalPublicBooking />} />
            <Route path="/portal/agendar/:orgId" element={<PortalPublicBooking />} />

            <Route path="/guia/:orgId/:resourceId" element={<PortalResourceGuide />} />
            <Route path="/portal/guia/:orgId/:resourceId" element={<PortalResourceGuide />} />
            
            <Route path="/:orgId/:clientId/*" element={<ClientPortalLayout />} />
            <Route path="/portal/:orgId/:clientId/*" element={<ClientPortalLayout />} />
            
            {/* Fallback */}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ThemeProvider>
  );
}
