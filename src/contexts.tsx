import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { UserProfile } from './types';
import { db, doc, onSnapshot } from './firebase.ts';

export interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  canAccess: (tab: string) => boolean;
}
export const AuthContext = createContext<AuthContextType | null>(null);
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

export const ToastContext = createContext<{
  addToast: (message: string, type: 'success' | 'error' | 'info') => void;
} | null>(null);
export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within a ToastProvider');
  return context;
};

export interface ConfirmOptions {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel?: () => void;
}
export const ConfirmContext = createContext<{
  confirm: (options: ConfirmOptions) => void;
} | null>(null);
export const useConfirm = () => {
  const context = useContext(ConfirmContext);
  if (!context) throw new Error('useConfirm must be used within a ConfirmProvider');
  return context;
};

export interface BrandingContextType {
  logoUrl: string | null;
  logoLoading: boolean;
  refreshLogo: () => void;
}
export const BrandingContext = createContext<BrandingContextType | null>(null);
export const useBranding = () => {
  const context = useContext(BrandingContext);
  if (!context) throw new Error('useBranding must be used within a BrandingProvider');
  return context;
};

export const BrandingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoLoading, setLogoLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const refreshLogo = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'branding'), (docSnap) => {
      if (docSnap.exists()) {
        const url = docSnap.data().logoUrl;
        if (url) {
          // Add cache busting timestamp
          setLogoUrl(`${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`);
        } else {
          setLogoUrl(null);
        }
      }
      setLogoLoading(false);
    }, (error) => {
      console.error("Error fetching logo:", error);
      setLogoLoading(false);
    });

    return () => unsub();
  }, [refreshTrigger]);

  return (
    <BrandingContext.Provider value={{ logoUrl, logoLoading, refreshLogo }}>
      {children}
    </BrandingContext.Provider>
  );
};
