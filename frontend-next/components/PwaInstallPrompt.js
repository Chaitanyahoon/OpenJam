'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Smartphone, Download, Share2, X } from 'lucide-react';

export default function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [installType, setInstallType] = useState(null); // 'android' or 'ios'

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check if already in standalone mode
    const isStandaloneMode = 
      window.matchMedia('(display-mode: standalone)').matches || 
      (window.navigator.standalone === true);
    
    setIsStandalone(isStandaloneMode);

    // Check if dismissed recently (ignore if dismissed in the last 7 days)
    const dismissedAt = localStorage.getItem('openjam_pwa_prompt_dismissed');
    const isDismissed = dismissedAt && (Date.now() - parseInt(dismissedAt) < 7 * 24 * 60 * 60 * 1000);

    if (isStandaloneMode || isDismissed) {
      return;
    }

    // Check for iOS
    const userAgent = window.navigator.userAgent;
    const isIosDevice = /iPad|iPhone|iPod/.test(userAgent) && !window.MSStream;
    setIsIOS(isIosDevice);

    let iosTimer = null;
    if (isIosDevice) {
      setInstallType('ios');
      // Show prompt after a short delay (e.g. 4 seconds)
      iosTimer = setTimeout(() => setShowPrompt(true), 4000);
    }

    // Listen for beforeinstallprompt for Android/Chrome/Edge
    const handleBeforeInstallPrompt = (e) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      window.deferredPrompt = e;
      window.dispatchEvent(new CustomEvent('pwa-install-ready'));
      setInstallType('android');
      // Show prompt after a short delay
      setTimeout(() => setShowPrompt(true), 4000);
    };

    const handleForceShowPrompt = () => {
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('show-pwa-install-prompt', handleForceShowPrompt);

    return () => {
      if (iosTimer) clearTimeout(iosTimer);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('show-pwa-install-prompt', handleForceShowPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    // Show the install prompt
    deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`[PWA] Install prompt outcome: ${outcome}`);

    // We've used the prompt, and can't use it again
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('openjam_pwa_prompt_dismissed', Date.now().toString());
  };

  if (isStandalone) return null;

  return (
    <AnimatePresence>
      {showPrompt && (
        <motion.div
          className="pwa-install-prompt-container"
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 30, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 350, damping: 25 }}
          style={{
            position: 'fixed',
            bottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
            left: '12px',
            right: '12px',
            marginLeft: 'auto',
            marginRight: 'auto',
            maxWidth: '420px',
          background: 'rgba(15, 15, 25, 0.75)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 176, 58, 0.25)',
          borderRadius: '16px',
          padding: '16px',
          boxShadow: '0 12px 40px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'rgba(255, 176, 58, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid rgba(255, 176, 58, 0.2)'
            }}>
              <Smartphone className="h-5 w-5" style={{ color: '#ffb03a' }} />
            </div>
            <div>
              <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#ffffff', letterSpacing: '-0.01em' }}>
                Install OpenJam App
              </h4>
              <p style={{ margin: 0, fontSize: '11px', color: 'rgba(255, 255, 255, 0.6)', marginTop: '2px', lineHeight: '1.4' }}>
                Add OpenJam to your home screen for quick access, background playback, and native feeling.
              </p>
            </div>
          </div>
          <button 
            onClick={handleDismiss}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'rgba(255, 255, 255, 0.4)',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {installType === 'android' ? (
          <button
            onClick={handleInstallClick}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #ffb03a 0%, #ff9f1c 100%)',
              border: 'none',
              color: '#000000',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              boxShadow: '0 4px 12px rgba(255, 159, 28, 0.25)'
            }}
          >
            <Download className="h-4 w-4" />
            Install App
          </button>
        ) : (
          <div style={{
            background: 'rgba(255, 255, 255, 0.03)',
            borderRadius: '10px',
            padding: '10px',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            fontSize: '11px',
            color: 'rgba(255, 255, 255, 0.8)',
            lineHeight: '1.5',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <Share2 className="h-4 w-4" style={{ color: '#ffb03a', flexShrink: 0 }} />
            <span>
              Tap the <strong>Share</strong> button, then select <strong>Add to Home Screen</strong> to install.
            </span>
          </div>
        )}
      </motion.div>
      )}
    </AnimatePresence>
  );
}
