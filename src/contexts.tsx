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
  activeIcon: string | null;
  setActiveIcon: (icon: string | null) => void;
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
  const [activeIcon, setActiveIcon] = useState<string | null>(null);

  const refreshLogo = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'site_settings'), (docSnap) => {
      if (docSnap.exists()) {
        const url = docSnap.data().logoUrl;
        if (url) {
          // Add cache busting timestamp only if it's not a data URL (Base64)
          if (url.startsWith('data:')) {
            setLogoUrl(url);
          } else {
            setLogoUrl(`${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`);
          }
        } else {
          setLogoUrl(null);
        }
      }
      setLogoLoading(false);
    }, (error) => {
      console.error("CRITICAL: Error fetching logo from site_settings:", error);
      setLogoLoading(false);
    });

    return () => unsub();
  }, [refreshTrigger]);

  return (
    <BrandingContext.Provider value={{ logoUrl, logoLoading, refreshLogo, activeIcon, setActiveIcon }}>
      {children}
    </BrandingContext.Provider>
  );
};

export interface GradeContextType {
  selectedGrade: string;
  setSelectedGrade: (grade: string) => void;
  appYear: string;
  setSelectedYear: (year: string) => void;
}

export const GradeContext = createContext<GradeContextType | null>(null);

export const useGrade = () => {
  const context = useContext(GradeContext);
  if (!context) throw new Error('useGrade must be used within a GradeProvider');
  return context;
};

export interface ErrorMessage {
  title: string;
  message: string;
  code?: string;
  details?: any;
}

export const GlobalErrorContext = createContext<{
  showError: (error: ErrorMessage | any) => void;
  clearError: () => void;
  currentError: ErrorMessage | null;
} | null>(null);

export const useGlobalError = () => {
  const context = useContext(GlobalErrorContext);
  if (!context) throw new Error('useGlobalError must be used within an GlobalErrorProvider');
  return context;
};

export const GlobalErrorProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentError, setCurrentError] = useState<ErrorMessage | null>(null);

  const showError = useCallback((error: ErrorMessage | any) => {
    if (error?.title && error?.message) {
      setCurrentError(error);
    } else {
      // Handle standard Error objects or strings
      const message = error instanceof Error ? error.message : String(error);
      
      // Try to parse Firestore JSON error if applicable
      try {
        if (message.startsWith('{') && message.endsWith('}')) {
          const parsed = JSON.parse(message);
          setCurrentError({
            title: `خطأ في ${parsed.operationType === 'write' ? 'الحجز/التعديل' : 'جلب البيانات'}`,
            message: parsed.error,
            code: parsed.operationType,
            details: parsed
          });
          return;
        }
      } catch (e) {}

      setCurrentError({
        title: 'حدث خطأ غير متوقع',
        message: message || 'عذراً، حدث خطأ ما. يرجى المحاولة مرة أخرى.',
      });
    }
    
    console.error('Global Error Reported:', error);
  }, []);

  const clearError = useCallback(() => {
    setCurrentError(null);
  }, []);

  return (
    <GlobalErrorContext.Provider value={{ showError, clearError, currentError }}>
      {children}
    </GlobalErrorContext.Provider>
  );
};

export const useErrorHandler = () => {
  const { showError } = useGlobalError();
  
  return useCallback((error: any) => {
    showError(error);
  }, [showError]);
};

export type Theme = 'light' | 'dark';

export interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

export const ThemeContext = createContext<ThemeContextType | null>(null);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('baraem_theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    localStorage.setItem('baraem_theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const GradeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedGrade, setSelectedGrade] = useState('all');
  const [appYear, setAppYear] = useState('2026');

  return (
    <GradeContext.Provider value={{ selectedGrade, setSelectedGrade, appYear, setSelectedYear: setAppYear }}>
      {children}
    </GradeContext.Provider>
  );
};
