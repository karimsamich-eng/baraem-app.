import React, { createContext, useContext } from 'react';
import { UserProfile } from './types';

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
