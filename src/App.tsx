/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, createContext, useContext, ReactNode, useRef, useCallback } from 'react';
import { 
  db, auth,
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, onSnapshot, query, where, orderBy, increment,
  handleFirestoreError, OperationType
} from './firebase.ts';
import { signInAnonymously } from 'firebase/auth';
import { HeroSlider } from './components/HeroSlider';
import { MonthlyExamCenter } from './components/MonthlyExamCenter';
import { StudentProfileNew } from './components/StudentProfile';
import { StudentListNew } from './components/StudentList';
import { CurriculumManager, SliderManager } from './components/Managers';
import { 
  Users, Calendar, GraduationCap, LayoutDashboard, LogOut, Plus, Search, Trophy,
  CheckCircle2, XCircle, Clock, MoreVertical, Edit2, Trash2, ChevronRight, 
  ArrowLeft, Save, Filter, Download, UserPlus, BookOpen, AlertCircle, Star, Heart,
  FileText, Eye, EyeOff, Menu, X, Upload, Image as ImageIcon,
  CheckCircle, Info, MessageCircle, Sun, Moon, UserCog
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
const logo = import.meta.env.BASE_URL + 'logo.png';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';

// --- Types ---
import { 
  UserProfile, Student, AttendanceRecord, GradeRecord, 
  Resource, Curriculum, SliderImage, Report, StaffMember, Event 
} from './types';
import { exportToPdf, fileToBase64 } from './utils';
import { AuthContext, AuthContextType, useAuth, ToastContext, useToast, ConfirmContext, useConfirm, ConfirmOptions } from './contexts';

// --- Helpers ---

const generatePDFReport = async (reportData: any, type: 'attendance' | 'tayo' | 'practical', user: UserProfile) => {
  // Generate PDF for immediate download/viewing
  const pdfDoc = await createPDFDocument(reportData, user.displayName);
  const pdfBase64 = pdfDoc.output('datauristring');
  
  // Save metadata and data to Firestore (avoiding large PDF string)
  try {
    const reportRef = doc(collection(db, 'reports'));
    await setDoc(reportRef, {
      id: reportRef.id,
      title: reportData.title || 'تقرير',
      type,
      reportDataJson: JSON.stringify(reportData),
      createdAt: new Date().toISOString(),
      createdBy: user.username,
      squad: reportData.squad || 'عام'
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'reports');
  }

  return pdfBase64;
};

const createPDFDocument = async (reportData: any, createdBy: string) => {
  // Dynamic color based on squad
  const isSquad2 = reportData.squad === 'الفرقة الثانية' || reportData.squad === 'الثانية';
  const primaryColor = isSquad2 ? '#003366' : '#8B0000'; // Deep Blue for Squad 2, Royal Red for Squad 1/Default

  // Create a temporary container for rendering the report
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '800px';
  container.style.padding = '60px';
  container.style.backgroundColor = 'white';
  container.style.direction = 'rtl';
  container.style.fontFamily = "'Amiri', 'Cairo', serif";

  // Build the report HTML with inline styles for html2canvas
  container.innerHTML = `
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Cairo:wght@400;700&display=swap');
      * { box-sizing: border-box; }
      body { margin: 0; padding: 0; }
      .report-container {
        font-family: 'Amiri', 'Cairo', serif;
        direction: rtl;
        background-color: white;
        padding: 40px;
        width: 800px;
        position: relative;
        min-height: 1000px;
      }
      .watermark {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        opacity: 0.08;
        width: 400px;
        height: 400px;
        z-index: 0;
        pointer-events: none;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .report-content {
        position: relative;
        z-index: 1;
      }
    </style>
    <div class="report-container">
      <div class="watermark">
        <img src="${logo}" style="width: 100%; height: 100%; object-fit: contain;" />
      </div>
      <div class="report-content">
        <div style="background-color: ${primaryColor}; color: white; padding: 30px; border-radius: 20px; margin-bottom: 40px; display: flex; align-items: center; justify-content: space-between; flex-direction: row-reverse;">
          <div style="display: flex; align-items: center; gap: 20px; flex-direction: row-reverse;">
            <img src="${logo}" style="width: 100px; height: 100px; object-fit: contain;" />
            <div style="text-align: right;">
              <h1 style="margin: 0; font-size: 32px; font-weight: bold;">خدمة البراعم الأرثوذكسية</h1>
              <h2 style="margin: 10px 0 0 0; font-size: 22px; opacity: 0.9;">${reportData.title || 'تقرير'}</h2>
            </div>
          </div>
        </div>

        <div style="margin-bottom: 40px; color: #444; font-size: 16px; display: flex; justify-content: space-between; border-bottom: 2px solid ${primaryColor}22; padding-bottom: 20px; flex-direction: row-reverse;">
          <div style="text-align: right;">
            <div style="margin-bottom: 5px;"><strong>التاريخ:</strong> ${new Date().toLocaleDateString('ar-EG')}</div>
            <div style="margin-bottom: 5px;"><strong>بواسطة:</strong> ${createdBy}</div>
            ${reportData.squad ? `<div><strong>الفرقة:</strong> ${reportData.squad}</div>` : ''}
          </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; text-align: right; font-size: 10pt; direction: rtl;">
          <thead>
            <tr style="background-color: ${primaryColor}; color: white;">
              ${(reportData.headers || []).map(h => `<th style="padding: 12px; border: 1px solid #ddd; font-weight: bold; text-align: right;">${h}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${(reportData.rows || []).map((row, i) => `
              <tr style="background-color: ${i % 2 === 0 ? '#ffffff' : '#f9f9f9'};">
                ${row.map(cell => `<td style="padding: 10px; border: 1px solid #ddd; text-align: right;">${cell}</td>`).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div style="margin-top: 60px; text-align: center; color: #999; font-size: 12px; border-top: 1px solid #eee; padding-top: 30px;">
          تم إنشاء هذا التقرير آلياً بواسطة نظام إدارة خدمة البراعم - كنيسة الشهيد العظيم مارجرجس
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(container);

  try {
    // Wait for images to load
    const images = container.getElementsByTagName('img');
    await Promise.all(Array.from(images).map(img => {
      if (img.complete) return Promise.resolve();
      return new Promise(resolve => { img.onload = resolve; img.onerror = resolve; });
    }));

    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      onclone: (clonedDoc) => {
        // CRITICAL: Remove all global stylesheets that might contain 'oklch' colors
        // which html2canvas cannot parse.
        const styleElements = clonedDoc.getElementsByTagName('style');
        const linkElements = clonedDoc.getElementsByTagName('link');
        
        // We keep only the style tag we just added inside the container
        // Actually, it's easier to just remove everything from the head
        const head = clonedDoc.getElementsByTagName('head')[0];
        if (head) {
          head.innerHTML = '';
        }
        
        // Ensure our container is still styled correctly if we removed global styles
        // The inline styles and the <style> tag inside the container should suffice.
      }
    });

    const imgData = canvas.toDataURL('image/jpeg', 1.0);
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    
    const imgProps = pdf.getImageProperties(imgData);
    const imgWidth = pdfWidth - 20; // Margin
    const imgHeight = (imgProps.height * imgWidth) / imgProps.width;
    
    let heightLeft = imgHeight;
    let position = 10;
    
    pdf.addImage(imgData, 'JPEG', 10, position, imgWidth, imgHeight);
    heightLeft -= pdfHeight;
    
    while (heightLeft >= 0) {
      position = position - pdfHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 10, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;
    }
    
    document.body.removeChild(container);
    return pdf;
  } catch (error) {
    console.error('PDF generation error:', error);
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
    throw error;
  }
};



// --- Toast System ---
interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}



const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: 'success' | 'error' | 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="fixed bottom-6 left-6 z-[100] flex flex-col gap-3">
        <AnimatePresence>
          {toasts.map(toast => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className={`flex items-center gap-3 px-6 py-4 rounded-2xl shadow-xl border backdrop-blur-md ${
                toast.type === 'success' ? 'bg-emerald-50/90 border-emerald-100 text-emerald-800' :
                toast.type === 'error' ? 'bg-red-50/90 border-red-100 text-red-800' :
                'bg-blue-50/90 border-blue-100 text-blue-800'
              }`}
            >
              {toast.type === 'success' && <CheckCircle size={20} />}
              {toast.type === 'error' && <AlertCircle size={20} />}
              {toast.type === 'info' && <Info size={20} />}
              <span className="font-bold text-sm">{toast.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};

// --- Confirm Dialog System ---


const ConfirmProvider = ({ children }: { children: ReactNode }) => {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);

  const confirm = useCallback((opt: ConfirmOptions) => setOptions(opt), []);

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <AnimatePresence>
        {options && (
          <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-[2rem] p-8 max-w-sm w-full shadow-2xl border border-stone-100 text-center"
            >
              <div className="w-16 h-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <AlertCircle size={32} />
              </div>
              <h2 className="text-2xl font-bold text-stone-900 mb-2">{options.title}</h2>
              <p className="text-stone-500 mb-8">{options.message}</p>
              <div className="flex gap-4">
                <button
                  onClick={() => {
                    options.onConfirm();
                    setOptions(null);
                  }}
                  className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-200"
                >
                  تأكيد الحذف
                </button>
                <button
                  onClick={() => {
                    options.onCancel?.();
                    setOptions(null);
                  }}
                  className="flex-1 py-3 bg-stone-100 text-stone-600 rounded-xl font-bold hover:bg-stone-200 transition-colors"
                >
                  إلغاء
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </ConfirmContext.Provider>
  );
};

// --- Hardcoded Credentials ---
// REMINDER: Add the new GitHub Pages URL to 'Authorized Domains' in the Firebase Console.
// --- Error Boundary ---
class ErrorBoundary extends React.Component<{ children: ReactNode }, { hasError: boolean; error: any }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = "حدث خطأ ما.";
      try {
        const parsed = JSON.parse(this.state.error.message);
        errorMessage = `خطأ: ${parsed.error} (العملية: ${parsed.operationType})`;
      } catch (e) {
        errorMessage = this.state.error.message || String(this.state.error);
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-stone-50 p-4">
          <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full border border-red-100">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <AlertCircle size={32} />
              <h2 className="text-2xl font-serif font-bold">خطأ في النظام</h2>
            </div>
            <p className="text-stone-600 mb-6 font-sans">{errorMessage}</p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full bg-stone-900 text-white py-3 rounded-full font-medium hover:bg-stone-800 transition-colors"
            >
              إعادة تحميل التطبيق
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// --- Components ---

const AuthScreen = ({ setActiveTab }: { setActiveTab: (t: string) => void }) => {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    const success = await login(username, password);
    if (success) {
      setActiveTab('hub');
    } else {
      setError('اسم المستخدم أو كلمة المرور غير صحيحة');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-off-white dark:bg-dark-bg relative overflow-hidden transition-colors duration-300">
      <div className="absolute inset-0 opacity-5 dark:opacity-10 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(#9B1B1B_1px,transparent_1px)] [background-size:40px_40px]" />
      </div>
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-dark-surface p-6 md:p-10 mx-4 md:mx-0 rounded-3xl shadow-xl max-w-md w-full text-center border border-stone-100 dark:border-dark-border relative z-10"
      >
        <div className="mb-8 inline-flex items-center justify-center w-24 h-24 bg-white dark:bg-dark-bg rounded-2xl shadow-lg border border-stone-100 dark:border-dark-border p-2">
          <img 
            src={logo} 
            alt="Baraem Logo" 
            className="w-full h-full object-contain"
            referrerPolicy="no-referrer"
          />
        </div>
        <h1 className="text-3xl font-bold mb-2 text-royal-red dark:text-gold">خدمة براعم</h1>
        <p className="text-stone-500 dark:text-dark-muted mb-8 font-serif italic">"دعوا الأولاد يأتون إليّ"</p>
        
        <form onSubmit={handleSubmit} className="space-y-4 text-right">
          <div className="space-y-1">
            <label className="text-sm font-bold text-stone-600 dark:text-dark-muted mr-1">اسم المستخدم</label>
            <input 
              type="text" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="input-clean"
              placeholder="أدخل اسم المستخدم"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-bold text-stone-600 dark:text-dark-muted mr-1">كلمة المرور</label>
            <div className="relative">
              <input 
                type={showPassword ? "text" : "password"} 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="input-clean pr-4 pl-12"
                placeholder="أدخل كلمة المرور"
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 dark:text-dark-muted hover:text-royal-red dark:hover:text-gold transition-colors"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>
          
          {error && <p className="text-red-600 dark:text-red-400 text-sm font-medium">{error}</p>}
          
          <button 
            type="submit"
            disabled={loading}
            className="w-full btn-primary mt-4 flex items-center justify-center gap-2"
          >
            {loading ? 'جاري التحميل...' : 'تسجيل الدخول'}
          </button>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-stone-200 dark:border-dark-border"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white dark:bg-dark-surface px-2 text-stone-400 dark:text-dark-muted">أو</span>
            </div>
          </div>

          <button 
            type="button"
            onClick={async () => {
              setLoading(true);
              const success = await login('guest', '');
              if (success) {
                setActiveTab('hub');
              }
              setLoading(false);
            }}
            disabled={loading}
            className="w-full py-3 px-4 rounded-full border-2 border-royal-red dark:border-gold text-royal-red dark:text-gold font-bold hover:bg-red-50 dark:hover:bg-gold/10 transition-all flex items-center justify-center gap-2"
          >
            <UserPlus size={20} />
            دخول كزائر / تصفح حر
          </button>
        </form>
        
        <p className="mt-8 text-stone-400 dark:text-dark-muted text-xs">
          نظام إدارة خدمة البراعم - كنيسة مارجرجس
        </p>
      </motion.div>
    </div>
  );
};

const Sidebar = ({ activeTab, setActiveTab, isOpen, setIsOpen }: { activeTab: string, setActiveTab: (t: string) => void, isOpen: boolean, setIsOpen: (o: boolean) => void }) => {
  const { user, logout, canAccess } = useAuth();
  
  const menuItems = [
    { id: 'dashboard', label: 'لوحة التحكم', icon: LayoutDashboard },
    { id: 'reports', label: 'صندوق التقارير', icon: FileText },
    { id: 'students', label: 'معرض الطلاب', icon: Users },
    { id: 'attendance', label: 'تسجيل الحضور', icon: Calendar },
    { id: 'tayo', label: 'تقييم طايو', icon: GraduationCap },
    { id: 'practical', label: 'الخدمة العملية', icon: Heart },
    { id: 'acceptance', label: 'تقييم القبول', icon: CheckCircle2 },
    { id: 'exam_center', label: 'مركز الامتحانات', icon: BookOpen },
    { id: 'staff', label: 'الهيكل التنظيمي', icon: Users },
    { id: 'events', label: 'الأحداث القادمة', icon: Calendar },
  ].filter(item => canAccess(item.id));

  return (
    <>
      {/* Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      <div 
        className={`w-72 bg-white dark:bg-dark-surface border-l border-stone-100 dark:border-dark-border flex flex-col h-screen fixed right-0 top-0 shadow-xl z-50 transition-transform duration-300 ease-in-out lg:translate-x-0 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="p-8 flex-1 overflow-y-auto custom-scrollbar">
          <div className="flex items-center justify-between mb-10">
            <button 
              onClick={() => {
                setActiveTab('hub');
                setIsOpen(false);
              }}
              className="flex items-center gap-3 group transition-all text-right"
            >
              <div className="w-12 h-12 rounded-xl overflow-hidden shadow-md group-hover:shadow-[0_0_15px_rgba(139,0,0,0.4)] transition-all">
                <img 
                  src={logo} 
                  alt="Baraem Orthodox Logo" 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
              <span className="font-bold text-lg leading-tight text-[#8B0000] dark:text-gold group-hover:text-royal-red transition-colors">براعم<br/>أرثوذكسية</span>
            </button>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setIsOpen(false)}
                className="lg:hidden p-2 hover:bg-stone-100 dark:hover:bg-dark-surface rounded-full text-stone-400"
              >
                <X size={24} />
              </button>
            </div>
          </div>
          
          <nav className="space-y-2">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                  activeTab === item.id 
                    ? 'bg-royal-red text-white shadow-lg' 
                    : 'text-stone-500 dark:text-dark-muted hover:bg-stone-50 dark:hover:bg-dark-bg hover:text-royal-red dark:hover:text-gold'
                }`}
              >
                <item.icon size={20} />
                <span className="font-bold">{item.label}</span>
              </button>
            ))}
          </nav>
        </div>
        
        <div className="p-8 border-t border-stone-50 dark:border-dark-border bg-white dark:bg-dark-surface">
          {user ? (
            <>
              <div className="flex items-center gap-3 mb-6 bg-stone-50 dark:bg-dark-bg p-3 rounded-xl border border-stone-100 dark:border-dark-border">
                <div className="w-10 h-10 bg-gold text-white rounded-full flex items-center justify-center font-bold shadow-sm shrink-0">
                  {user.displayName?.[0]}
                </div>
                <div className="overflow-hidden">
                  <p className="font-bold text-stone-900 dark:text-dark-text truncate text-sm">{user.displayName}</p>
                  <p className="text-[10px] text-stone-400 dark:text-dark-muted font-medium">
                    {(user.role === 'admin' || user.role === 'coordinator') ? 'منسق' : 
                     user.role === 'attendance' ? 'خادم الحضور' :
                     user.role === 'tayo' ? 'خادم الطايو' : 
                     user.role === 'practical' ? 'خادم الخدمة العملية' : 'زائر'}
                  </p>
                </div>
              </div>
              <button 
                onClick={logout}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors font-bold border border-transparent hover:border-red-100 dark:hover:border-red-900/30"
              >
                <LogOut size={20} />
                <span>تسجيل الخروج</span>
              </button>
            </>
          ) : (
            <button 
              onClick={() => setActiveTab('login')}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-royal-red dark:text-gold hover:bg-red-50 dark:hover:bg-dark-bg transition-colors font-bold border border-transparent hover:border-red-100 dark:hover:border-dark-border"
            >
              <LogOut size={20} className="rotate-180" />
              <span>تسجيل الدخول</span>
            </button>
          )}
        </div>
      </div>
    </>
  );
};

// --- Practical Service ---
const PracticalService = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
  const [services, setServices] = useState<any[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const { user } = useAuth();
  const { addToast } = useToast();
  const { confirm } = useConfirm();

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const snap = await getDocs(query(collection(db, 'students'), orderBy('name')));
        const list: Student[] = [];
        snap.forEach(doc => list.push({ id: doc.id, ...doc.data() } as Student));
        setStudents(list);
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'students');
      }
    };
    fetchStudents();
  }, []);

  useEffect(() => {
    if (!selectedStudent) return;
    const q = query(collection(db, 'practical_service'), where('studentId', '==', selectedStudent.id), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
      setServices(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'practical_service');
    });
    return () => unsubscribe();
  }, [selectedStudent]);

  const [editingService, setEditingService] = useState<any | null>(null);

  const handleAddService = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedStudent) return;
    const formData = new FormData(e.currentTarget);
    const serviceData = {
      studentId: selectedStudent.id,
      serviceType: formData.get('serviceType') as string,
      description: formData.get('description') as string,
      date: formData.get('date') as string,
      points: Number(formData.get('points')),
      updatedAt: new Date().toISOString(),
      updatedBy: user?.username || '',
    };

    try {
      if (editingService) {
        // Revert old points
        const studentRef = doc(db, 'students', selectedStudent.id);
        await updateDoc(studentRef, { practicalPoints: increment(-editingService.points) });
        
        // Update service
        await updateDoc(doc(db, 'practical_service', editingService.id), serviceData);
        
        // Add new points
        await updateDoc(studentRef, { practicalPoints: increment(serviceData.points) });
        addToast('تم تعديل الخدمة بنجاح', 'success');
        setEditingService(null);
        setIsAdding(false);
      } else {
        const docRef = doc(collection(db, 'practical_service'));
        await setDoc(docRef, { ...serviceData, id: docRef.id });
        
        // Update student practical points
        const studentRef = doc(db, 'students', selectedStudent.id);
        await updateDoc(studentRef, {
          practicalPoints: increment(serviceData.points)
        });
        addToast('تم إضافة الخدمة بنجاح', 'success');
      }

      setIsAdding(false);
      setEditingService(null);
    } catch (error) {
      handleFirestoreError(error, editingService ? OperationType.UPDATE : OperationType.CREATE, 'practical_service');
      addToast('فشل حفظ الخدمة', 'error');
    }
  };

  const handleDeleteService = (service: any) => {
    confirm({
      title: 'حذف الخدمة',
      message: 'هل أنت متأكد من حذف هذه الخدمة؟',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'practical_service', service.id));
          const studentRef = doc(db, 'students', service.studentId);
          await updateDoc(studentRef, { practicalPoints: increment(-service.points) });
          addToast('تم حذف الخدمة بنجاح', 'success');
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, 'practical_service');
          addToast('فشل حذف الخدمة', 'error');
        }
      }
    });
  };

  const [generating, setGenerating] = useState(false);

  const handleGenerateReport = async () => {
    if (!user) return;
    setGenerating(true);
    try {
      const q = query(
        collection(db, 'practical_service'),
        where('date', '==', reportDate)
      );
      const snap = await getDocs(q);
      
      if (snap.empty) {
        addToast('لا توجد خدمات مسجلة في هذا اليوم', 'error');
        return;
      }

      const dailyServices: any[] = [];
      snap.forEach(doc => dailyServices.push({ id: doc.id, ...doc.data() }));

      const reportData = {
        title: `تقرير الخدمة العملية اليومي - ${reportDate}`,
        squad: 'جميع الفرق',
        headers: ['الطالب', 'الخدمة', 'الوصف', 'النقاط'],
        rows: dailyServices.map(s => {
          const student = students.find(st => st.id === s.studentId);
          return [student?.name || 'طالب غير معروف', s.serviceType, s.description, s.points.toString()];
        })
      };

      await generatePDFReport(reportData, 'practical', user);
      addToast('تم إنشاء التقرير بنجاح وحفظه في الصندوق.', 'success');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'reports');
      addToast('فشل في إنشاء التقرير.', 'error');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="p-4 md:p-12 max-w-7xl mx-auto">
      <header className="flex flex-col md:flex-row items-center justify-between mb-8 md:mb-12 gap-4 text-center md:text-right">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-royal-red mb-2">الخدمة العملية</h1>
          <p className="text-stone-500 italic">تسجيل ومتابعة الأنشطة والخدمات العملية للطلاب</p>
        </div>
        <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
          <div className="flex items-center gap-2 bg-white p-2 rounded-xl shadow-sm border border-stone-200 w-full md:w-auto">
            <Calendar size={18} className="text-stone-400" />
            <input 
              type="date" 
              value={reportDate}
              onChange={(e) => setReportDate(e.target.value)}
              className="bg-transparent border-none focus:ring-0 text-stone-700 text-sm"
            />
          </div>
          {!!user && (
            <button 
              onClick={handleGenerateReport}
              disabled={generating}
              className="btn-primary flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 w-full md:w-auto"
            >
              <FileText size={20} />
              {generating ? 'جاري الإنشاء...' : 'استخراج تقرير اليوم'}
            </button>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-12">
        <div className="lg:col-span-1">
          <div className="card-clean overflow-hidden">
            <div className="p-6 border-b border-stone-100 bg-off-white/50">
              <h3 className="font-bold text-xl text-royal-red">اختر طالباً</h3>
            </div>
            <div className="max-h-[600px] overflow-y-auto p-4 space-y-2">
              {students.map(s => (
                <button
                  key={s.id}
                  onClick={() => setSelectedStudent(s)}
                  className={`w-full flex items-center gap-3 p-4 rounded-xl transition-all border ${
                    selectedStudent?.id === s.id 
                      ? 'bg-royal-red text-white border-royal-red shadow-md' 
                      : 'hover:bg-off-white text-stone-600 border-transparent hover:border-stone-100'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${
                    selectedStudent?.id === s.id ? 'bg-white/20' : 'bg-stone-100'
                  }`}>
                    {s.name[0]}
                  </div>
                  <span className="font-bold">{s.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          {selectedStudent ? (
            <div className="space-y-6 md:space-y-8">
              <div className="card-clean p-6 md:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-r-4 border-r-gold">
                <div>
                  <h2 className="text-2xl md:text-3xl font-bold text-stone-900">{selectedStudent.name}</h2>
                  <p className="text-stone-400 font-medium">{selectedStudent.gradeLevel}</p>
                </div>
                {!!user && (
                  <button 
                    onClick={() => setIsAdding(true)}
                    className="btn-primary flex items-center justify-center gap-2 w-full sm:w-auto"
                  >
                    <Plus size={20} />
                    إضافة خدمة
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {services.map(service => (
                  <motion.div 
                    key={service.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="card-clean p-6 border-t-4 border-t-gold"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <span className="px-3 py-1 bg-royal-red/10 text-royal-red rounded-lg text-xs font-bold border border-royal-red/20">
                        {service.serviceType}
                      </span>
                      <span className="text-stone-400 text-xs font-mono">{service.date}</span>
                    </div>
                    <p className="text-stone-700 font-bold mb-4">{service.description}</p>
                    <div className="flex items-center justify-between pt-4 border-t border-stone-50">
                      <div className="flex items-center gap-2 text-gold">
                        <Star size={16} fill="currentColor" />
                        <span className="font-bold">{service.points} نقطة</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-stone-400">بواسطة: {service.updatedBy}</span>
                        {(user?.role === 'admin' || user?.role === 'coordinator' || user?.role === 'practical') && (
                          <>
                            <button onClick={() => { setEditingService(service); setIsAdding(true); }} className="p-1.5 bg-stone-100 text-stone-600 rounded-lg hover:bg-stone-200">
                              <Edit2 size={14} />
                            </button>
                            <button onClick={() => handleDeleteService(service)} className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100">
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
                {services.length === 0 && (
                  <div className="col-span-full py-12 text-center text-stone-400 italic bg-white rounded-3xl border border-stone-100">
                    لا توجد خدمات مسجلة لهذا الطالب بعد.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-12 bg-white rounded-3xl border-2 border-stone-100 border-dashed">
              <div className="w-20 h-20 bg-off-white rounded-full flex items-center justify-center mb-6">
                <Heart size={40} className="text-stone-200" />
              </div>
              <h3 className="text-xl font-bold text-stone-400">اختر طالباً لعرض سجلات الخدمة العملية</h3>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl max-w-md w-full border border-stone-100"
            >
              <div className="p-8 border-b border-stone-100 flex items-center justify-between bg-off-white/50">
                <h2 className="text-2xl font-bold text-royal-red">تسجيل خدمة عملية</h2>
                <button onClick={() => { setIsAdding(false); setEditingService(null); }} className="p-2 hover:bg-stone-100 rounded-full transition-colors">
                  <XCircle size={24} className="text-stone-400" />
                </button>
              </div>
              
              <form onSubmit={handleAddService} className="p-8 space-y-6">
                <input type="hidden" name="id" value={editingService?.id || ''} />
                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-500 uppercase tracking-wider mr-1">نوع الخدمة</label>
                  <select name="serviceType" defaultValue={editingService?.serviceType || ''} required className="input-clean">
                    <option value="">اختر النوع...</option>
                    {(user?.role === 'practical' || user?.role === 'admin' || user?.role === 'coordinator' || user?.role === 'tayo') && (
                      <option value="خدمة عملية">خدمة عملية (20 نقطة)</option>
                    )}
                    {(user?.role === 'admin' || user?.role === 'coordinator') && (
                      <>
                        <option value="نظافة">نظافة</option>
                        <option value="ترتيب">ترتيب</option>
                        <option value="مساعدة">مساعدة</option>
                        <option value="أخرى">أخرى</option>
                      </>
                    )}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-500 uppercase tracking-wider mr-1">الوصف</label>
                  <input name="description" defaultValue={editingService?.description || ''} required className="input-clean" placeholder="ماذا فعل الطالب؟" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-500 uppercase tracking-wider mr-1">النقاط</label>
                  <input name="points" type="number" min="0" required className="input-clean bg-stone-50" readOnly={user?.role === 'practical' || user?.role === 'tayo'} defaultValue={editingService?.points || ((user?.role === 'practical' || user?.role === 'tayo') ? 20 : 10)} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-500 uppercase tracking-wider mr-1">التاريخ</label>
                  <input name="date" type="date" defaultValue={editingService?.date || new Date().toISOString().split('T')[0]} required className="input-clean" />
                </div>
                <div className="pt-4 flex gap-4">
                  <button 
                    type="button"
                    onClick={() => { setIsAdding(false); setEditingService(null); }}
                    className="flex-1 py-4 rounded-xl font-bold text-stone-500 hover:bg-stone-50 transition-colors"
                  >
                    إلغاء
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 btn-primary"
                  >
                    حفظ الخدمة
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

// --- Resource Library ---
const LibraryPage = () => {
  const [resources, setResources] = useState<Resource[]>([]);
  const [curricula, setCurricula] = useState<Curriculum[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'resources'), orderBy('updatedAt', 'desc'));
    const unsubscribeResources = onSnapshot(q, (snapshot) => {
      const list: Resource[] = [];
      snapshot.forEach(doc => list.push({ id: doc.id, ...doc.data() } as Resource));
      setResources(list);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'resources');
    });

    const unsubscribeCurricula = onSnapshot(collection(db, 'curriculum'), (snapshot) => {
      setCurricula(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Curriculum)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'curriculum');
    });

    return () => {
      unsubscribeResources();
      unsubscribeCurricula();
    };
  }, []);

  const filteredResources = resources.filter(r => {
    const matchesSearch = r.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || r.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = ['All', 'Menahej', 'Alhan', 'Spiritual'];

  return (
    <div className="p-4 md:p-12 max-w-7xl mx-auto">
      <header className="mb-8 md:mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6 text-center md:text-right">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-royal-red mb-2">مكتبة الموارد</h1>
          <p className="text-stone-500 italic">المناهج، الألحان، والروحيات لخدمة البراعم</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-400" size={20} />
            <input 
              type="text" 
              placeholder="بحث عن درس أو لحن..." 
              className="input-clean pr-12"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-xl font-bold text-sm transition-all border whitespace-nowrap ${
                  selectedCategory === cat 
                    ? 'bg-royal-red text-white border-royal-red shadow-md' 
                    : 'bg-white text-stone-600 border-stone-100 hover:border-royal-red/30'
                }`}
              >
                {cat === 'All' ? 'الكل' : cat === 'Menahej' ? 'مناهج' : cat === 'Alhan' ? 'ألحان' : 'روحيات'}
              </button>
            ))}
          </div>
        </div>
      </header>

      {curricula.length > 0 && (
        <div className="mb-12 grid grid-cols-1 md:grid-cols-2 gap-8">
          {curricula.map(curr => (
            <motion.div 
              key={curr.id} 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-br from-royal-red to-red-900 rounded-3xl p-8 text-white shadow-xl flex items-center justify-between group overflow-hidden relative"
            >
              <div className="relative z-10">
                <h3 className="text-2xl font-bold mb-2">منهج {curr.id}</h3>
                <p className="text-red-100/80 text-sm mb-6">المادة العلمية الرسمية المعتمدة</p>
                <a 
                  href={curr.pdfUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-white text-royal-red px-6 py-3 rounded-xl font-bold hover:bg-gold hover:text-white transition-all shadow-lg"
                >
                  <FileText size={20} />
                  تحميل المنهج (PDF)
                </a>
              </div>
              <BookOpen size={120} className="absolute -left-8 -bottom-8 text-white/10 group-hover:scale-110 transition-transform duration-500" />
            </motion.div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-12 h-12 border-4 border-royal-red border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredResources.map(resource => (
            <motion.div 
              key={resource.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="card-clean group overflow-hidden border-t-4 border-t-gold hover:shadow-xl transition-all"
            >
              <div className="p-8">
                <div className="flex justify-between items-start mb-6">
                  <span className="px-3 py-1 bg-royal-red/10 text-royal-red rounded-lg text-xs font-bold border border-royal-red/20">
                    {resource.category === 'Menahej' ? 'منهج' : resource.category === 'Alhan' ? 'لحن' : 'روحي'}
                  </span>
                  <span className="text-stone-400 text-xs font-bold px-2 py-1 bg-stone-50 rounded-md">
                    {resource.squad}
                  </span>
                </div>
                <h3 className="text-2xl font-bold text-stone-900 mb-4 group-hover:text-royal-red transition-colors">
                  {resource.title}
                </h3>
                <div className="flex items-center justify-between pt-6 border-t border-stone-50">
                  <a 
                    href={resource.link} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="btn-primary flex items-center gap-2 py-2 px-6 text-sm"
                  >
                    <Download size={18} />
                    عرض / تحميل
                  </a>
                  <span className="text-[10px] text-stone-400 font-mono">
                    {new Date(resource.updatedAt).toLocaleDateString('ar-EG')}
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
          {filteredResources.length === 0 && (
            <div className="col-span-full py-20 text-center bg-white rounded-3xl border-2 border-dashed border-stone-100">
              <BookOpen size={64} className="mx-auto text-stone-100 mb-6" />
              <p className="text-stone-400 font-bold text-xl">لا توجد موارد تطابق بحثك حالياً.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// --- Resource Manager (Admin) ---
const ResourceManager = () => {
  const [resources, setResources] = useState<Resource[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingResource, setEditingResource] = useState<Resource | null>(null);
  const { user } = useAuth();
  const { addToast } = useToast();
  const { confirm } = useConfirm();

  useEffect(() => {
    const q = query(collection(db, 'resources'), orderBy('updatedAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Resource[] = [];
      snapshot.forEach(doc => list.push({ id: doc.id, ...doc.data() } as Resource));
      setResources(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'resources');
    });
    return () => unsubscribe();
  }, []);

  const handleAddResource = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newResource = {
      title: formData.get('title') as string,
      category: formData.get('category') as any,
      squad: formData.get('squad') as any,
      link: formData.get('link') as string,
      updatedAt: new Date().toISOString(),
      updatedBy: user?.username || '',
    };

    const form = e.currentTarget;
    try {
      const docRef = doc(collection(db, 'resources'));
      await setDoc(docRef, { ...newResource, id: docRef.id });
      setIsAdding(false);
      form.reset();
      addToast('تم إضافة المورد بنجاح', 'success');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'resources');
      addToast('فشل إضافة المورد', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    confirm({
      title: 'حذف مورد',
      message: 'هل أنت متأكد من حذف هذا المورد؟ لا يمكن التراجع عن هذا الإجراء.',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'resources', id));
          addToast('تم حذف المورد بنجاح', 'success');
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, 'resources');
          addToast('فشل حذف المورد', 'error');
        }
      }
    });
  };

  const handleEditResource = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingResource) return;
    const formData = new FormData(e.currentTarget);
    const updatedResource = {
      title: formData.get('title') as string,
      category: formData.get('category') as any,
      squad: formData.get('squad') as any,
      link: formData.get('link') as string,
      updatedAt: new Date().toISOString(),
      updatedBy: user?.username || '',
    };

    try {
      await updateDoc(doc(db, 'resources', editingResource.id), updatedResource);
      setEditingResource(null);
      addToast('تم تحديث المورد بنجاح', 'success');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'resources');
      addToast('فشل تحديث المورد', 'error');
    }
  };

  return (
    <div className="p-12 max-w-7xl mx-auto">
      <header className="mb-12 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-royal-red mb-2">إدارة الموارد</h1>
          <p className="text-stone-500 italic">إضافة وتعديل المناهج والألحان</p>
        </div>
        <button onClick={() => setIsAdding(true)} className="btn-primary flex items-center gap-2">
          <Plus size={20} />
          إضافة مورد جديد
        </button>
      </header>

      <div className="card-clean overflow-hidden">
        <table className="w-full text-right border-collapse">
          <thead>
            <tr className="bg-off-white border-b border-stone-100">
              <th className="p-6 font-bold text-stone-600">العنوان</th>
              <th className="p-6 font-bold text-stone-600">التصنيف</th>
              <th className="p-6 font-bold text-stone-600">الفرقة</th>
              <th className="p-6 font-bold text-stone-600">بواسطة</th>
              <th className="p-6 font-bold text-stone-600">الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            {resources.map(res => (
              <tr key={res.id} className="border-b border-stone-50 hover:bg-off-white/30 transition-colors">
                <td className="p-6 font-bold text-stone-900">{res.title}</td>
                <td className="p-6">
                  <span className="px-3 py-1 bg-royal-red/10 text-royal-red rounded-lg text-xs font-bold">
                    {res.category === 'Menahej' ? 'منهج' : res.category === 'Alhan' ? 'لحن' : 'روحي'}
                  </span>
                </td>
                <td className="p-6 text-stone-600 font-medium">{res.squad}</td>
                <td className="p-6 text-stone-400 text-sm">{res.updatedBy}</td>
                <td className="p-6">
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setEditingResource(res)}
                      className="p-2 text-stone-300 hover:text-gold transition-colors"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button 
                      onClick={() => handleDelete(res.id)}
                      className="p-2 text-stone-300 hover:text-royal-red transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                    <a 
                      href={res.link} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="p-2 text-stone-300 hover:text-gold transition-colors"
                    >
                      <Download size={18} />
                    </a>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl max-w-md w-full border border-stone-100"
            >
              <div className="p-8 border-b border-stone-100 flex items-center justify-between bg-off-white/50">
                <h2 className="text-2xl font-bold text-royal-red">إضافة مورد جديد</h2>
                <button onClick={() => setIsAdding(false)} className="p-2 hover:bg-stone-100 rounded-full transition-colors">
                  <XCircle size={24} className="text-stone-400" />
                </button>
              </div>
              
              <form onSubmit={handleAddResource} className="p-8 space-y-6">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-500 uppercase tracking-wider mr-1">عنوان المورد</label>
                  <input name="title" required className="input-clean" placeholder="مثلاً: لحن آجيوس" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-500 uppercase tracking-wider mr-1">التصنيف</label>
                  <select name="category" required className="input-clean">
                    <option value="Menahej">منهج</option>
                    <option value="Alhan">ألحان</option>
                    <option value="Spiritual">روحيات</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-500 uppercase tracking-wider mr-1">الفرقة</label>
                  <select name="squad" required className="input-clean">
                    <option value="الفرقة الأولى">الفرقة الأولى</option>
                    <option value="الفرقة الثانية">الفرقة الثانية</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-500 uppercase tracking-wider mr-1">رابط المورد (Link/Base64)</label>
                  <input name="link" required className="input-clean" placeholder="https://..." />
                </div>
                
                <button type="submit" className="btn-primary w-full py-4 text-lg flex items-center justify-center gap-2">
                  <Save size={20} />
                  حفظ المورد
                </button>
              </form>
            </motion.div>
          </div>
        )}
        {editingResource && (
          <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl max-w-md w-full border border-stone-100"
            >
              <div className="p-8 border-b border-stone-100 flex items-center justify-between bg-off-white/50">
                <h2 className="text-2xl font-bold text-royal-red">تعديل المورد</h2>
                <button onClick={() => setEditingResource(null)} className="p-2 hover:bg-stone-100 rounded-full transition-colors">
                  <XCircle size={24} className="text-stone-400" />
                </button>
              </div>
              
              <form onSubmit={handleEditResource} className="p-8 space-y-6">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-500 uppercase tracking-wider mr-1">عنوان المورد</label>
                  <input name="title" defaultValue={editingResource.title} required className="input-clean" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-500 uppercase tracking-wider mr-1">التصنيف</label>
                  <select name="category" defaultValue={editingResource.category} required className="input-clean">
                    <option value="Menahej">منهج</option>
                    <option value="Alhan">ألحان</option>
                    <option value="Spiritual">روحيات</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-500 uppercase tracking-wider mr-1">الفرقة</label>
                  <select name="squad" defaultValue={editingResource.squad} required className="input-clean">
                    <option value="الفرقة الأولى">الفرقة الأولى</option>
                    <option value="الفرقة الثانية">الفرقة الثانية</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-500 uppercase tracking-wider mr-1">رابط المورد</label>
                  <input name="link" defaultValue={editingResource.link} required className="input-clean" />
                </div>
                
                <button type="submit" className="btn-primary w-full py-4 text-lg flex items-center justify-center gap-2">
                  <Save size={20} />
                  تحديث المورد
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

// --- Hero Slider ---





const StudentList = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [selectedStudentProfile, setSelectedStudentProfile] = useState<Student | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const { user } = useAuth();
  const { addToast } = useToast();
  const { confirm } = useConfirm();

  useEffect(() => {
    const q = query(collection(db, 'students'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Student[] = [];
      snapshot.forEach(doc => list.push({ id: doc.id, ...doc.data() } as Student));
      // Sort alphabetically by Arabic name
      list.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
      setStudents(list);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'students');
    });
    return () => unsubscribe();
  }, []);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const base64 = await fileToBase64(file);
        setPhotoBase64(base64);
      } catch (error) {
        console.error('Error uploading photo:', error);
      }
    }
  };

  const handleAddStudent = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newStudent = {
      name: formData.get('name') as string,
      gradeLevel: formData.get('gradeLevel') as string,
      phone: formData.get('phone') as string,
      parentName: formData.get('parentName') as string,
      parentPhone: formData.get('parentPhone') as string,
      notes: formData.get('notes') as string,
      photoUrl: photoBase64 || null,
      createdAt: new Date().toISOString(),
      createdBy: user?.username || '',
      attendancePoints: 0,
      behaviorPoints: 0,
      interactionPoints: 0,
      practicalPoints: 0,
    };

    try {
      const docRef = doc(collection(db, 'students'));
      await setDoc(docRef, { ...newStudent, id: docRef.id });
      setIsAdding(false);
      setPhotoBase64(null);
      addToast('تم إضافة الطالب بنجاح', 'success');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'students');
      addToast('فشل إضافة الطالب', 'error');
    }
  };

  const handleEditStudent = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingStudent) return;
    const formData = new FormData(e.currentTarget);
    const updatedStudent = {
      name: formData.get('name') as string,
      gradeLevel: formData.get('gradeLevel') as string,
      phone: formData.get('phone') as string,
      parentName: formData.get('parentName') as string,
      parentPhone: formData.get('parentPhone') as string,
      notes: formData.get('notes') as string,
      photoUrl: photoBase64 || editingStudent.photoUrl || null,
    };

    try {
      await updateDoc(doc(db, 'students', editingStudent.id), updatedStudent);
      setEditingStudent(null);
      setPhotoBase64(null);
      addToast('تم تحديث بيانات الطالب بنجاح', 'success');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'students');
      addToast('فشل تحديث بيانات الطالب', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    confirm({
      title: 'حذف طالب',
      message: 'هل أنت متأكد من حذف هذا الطالب؟ لا يمكن التراجع عن هذا الإجراء.',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'students', id));
          addToast('تم حذف الطالب بنجاح', 'success');
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, 'students');
          addToast('فشل حذف الطالب', 'error');
        }
      }
    });
  };

  const filteredStudents = students.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.gradeLevel.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-4 md:p-12 max-w-7xl mx-auto">
      <header className="flex flex-col md:flex-row items-center justify-between mb-8 md:mb-12 gap-4 text-center md:text-right">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-royal-red mb-2">الطلاب</h1>
          <p className="text-stone-500 italic">إدارة سجلات ومعلومات الطلاب</p>
        </div>
        {user && (user.role === 'admin' || user.role === 'coordinator') && (
          <button 
            onClick={() => setIsAdding(true)}
            className="btn-primary flex items-center justify-center gap-2 w-full md:w-auto"
          >
            <UserPlus size={20} />
            إضافة طالب
          </button>
        )}
      </header>

      {loading && (
        <div className="w-full bg-stone-200 rounded-full h-1.5 mb-6 overflow-hidden">
          <motion.div 
            className="bg-royal-red h-1.5 rounded-full" 
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
      )}

      {selectedStudentProfile && (
        <StudentProfileNew 
          student={selectedStudentProfile} 
          onClose={() => setSelectedStudentProfile(null)} 
        />
      )}

      <div className="mb-8 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-400" size={20} />
          <input 
            type="text" 
            placeholder="ابحث بالاسم أو المرحلة..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pr-12 pl-4 py-3 bg-white dark:bg-dark-surface rounded-2xl border border-stone-200 dark:border-dark-border focus:ring-2 focus:ring-gold outline-none transition-all shadow-sm dark:text-dark-text"
          />
        </div>
        <button className="p-3 bg-white dark:bg-dark-surface rounded-2xl text-stone-500 dark:text-dark-muted hover:text-royal-red dark:hover:text-gold transition-colors border border-stone-200 dark:border-dark-border shadow-sm flex items-center justify-center">
          <Filter size={20} />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredStudents.map((student) => (
          <motion.div
            key={student.id}
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-dark-surface rounded-3xl shadow-md overflow-hidden border border-stone-100 dark:border-dark-border group hover:shadow-xl transition-all"
          >
            <div className="aspect-square relative overflow-hidden bg-stone-100 dark:bg-dark-bg">
              {student.photoUrl ? (
                <img src={student.photoUrl} alt={student.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-stone-300 dark:text-dark-muted">
                  <Users size={64} />
                </div>
              )}
              <div className="absolute top-4 right-4 bg-white/90 dark:bg-dark-surface/90 backdrop-blur-sm px-3 py-1 rounded-full text-[10px] font-bold text-royal-red dark:text-gold shadow-sm">
                {student.gradeLevel}
              </div>
            </div>
            
            <div className="p-6 text-center">
              <h3 className="text-xl font-bold text-stone-800 dark:text-dark-text mb-1">{student.name}</h3>
              <p className="text-stone-400 dark:text-dark-muted text-sm mb-4">{student.parentName || 'لا يوجد اسم ولي أمر'}</p>
              
              <div className="flex items-center justify-center gap-2">
                {user?.role === 'coordinator' && (
                  <button 
                    onClick={() => setSelectedStudentProfile(student)}
                    className="flex-1 py-2 bg-gold/10 text-gold rounded-xl font-bold text-sm hover:bg-gold hover:text-white transition-all flex items-center justify-center gap-2"
                  >
                    <Eye size={14} />
                    عرض الملف
                  </button>
                )}
                {user && (user.role === 'admin' || user.role === 'coordinator') && (
                  <>
                    <button 
                      onClick={() => {
                        setEditingStudent(student);
                        setPhotoBase64(null);
                      }}
                      className="py-2 px-3 bg-royal-red/5 text-royal-red rounded-xl font-bold text-sm hover:bg-royal-red hover:text-white transition-all"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button 
                      onClick={() => handleDelete(student.id)}
                      className="p-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-600 hover:text-white transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        ))}
        {filteredStudents.length === 0 && !loading && (
          <div className="col-span-full py-20 text-center bg-white rounded-3xl border border-dashed border-stone-200">
            <Users size={48} className="mx-auto text-stone-200 mb-4" />
            <p className="text-stone-400 italic font-bold">لم يتم العثور على طلاب يطابقون بحثك.</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {(isAdding || editingStudent) && (
          <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-stone-100"
            >
              <div className="p-8 border-b border-stone-100 flex items-center justify-between bg-off-white/50">
                <h2 className="text-3xl font-bold text-royal-red">{editingStudent ? 'تعديل بيانات طالب' : 'إضافة طالب جديد'}</h2>
                <button onClick={() => { setIsAdding(false); setEditingStudent(null); }} className="p-2 hover:bg-stone-100 rounded-full transition-colors">
                  <XCircle size={24} className="text-stone-400" />
                </button>
              </div>
              
              <form onSubmit={editingStudent ? handleEditStudent : handleAddStudent} className="p-8 space-y-6">
                <div className="flex flex-col items-center mb-6">
                  <div className="w-24 h-24 bg-stone-50 rounded-2xl border-2 border-dashed border-stone-200 flex items-center justify-center overflow-hidden relative group">
                    {photoBase64 || (editingStudent?.photoUrl) ? (
                      <img src={photoBase64 || editingStudent?.photoUrl} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="text-stone-300" size={32} />
                    )}
                    <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                      <Upload className="text-white" size={20} />
                      <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                    </label>
                  </div>
                  <p className="text-[10px] text-stone-400 mt-2">انقر لرفع صورة الطالب</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-stone-500 uppercase tracking-wider mr-1">الاسم الكامل</label>
                    <input name="name" defaultValue={editingStudent?.name} required className="input-clean" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-stone-500 uppercase tracking-wider mr-1">المرحلة الدراسية</label>
                    <select name="gradeLevel" defaultValue={editingStudent?.gradeLevel} required className="input-clean">
                      <option value="الفرقة الأولى">الفرقة الأولى</option>
                      <option value="الفرقة الثانية">الفرقة الثانية</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-stone-500 uppercase tracking-wider mr-1">هاتف الطالب</label>
                    <input name="phone" defaultValue={editingStudent?.phone} className="input-clean" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-stone-500 uppercase tracking-wider mr-1">اسم ولي الأمر</label>
                    <input name="parentName" defaultValue={editingStudent?.parentName} className="input-clean" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-stone-500 uppercase tracking-wider mr-1">هاتف ولي الأمر</label>
                    <input name="parentPhone" defaultValue={editingStudent?.parentPhone} className="input-clean" />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-500 uppercase tracking-wider mr-1">ملاحظات</label>
                  <textarea name="notes" defaultValue={editingStudent?.notes} rows={3} className="input-clean" />
                </div>
                
                <div className="pt-4 flex gap-4">
                  <button 
                    type="button"
                    onClick={() => { setIsAdding(false); setEditingStudent(null); }}
                    className="flex-1 py-4 rounded-xl font-bold text-stone-500 hover:bg-stone-50 transition-colors"
                  >
                    إلغاء
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 btn-primary"
                  >
                    {editingStudent ? 'تحديث البيانات' : 'حفظ الطالب'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

// --- Attendance Tracker ---
const AttendanceTracker = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<Record<string, AttendanceRecord>>({});
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);
  const [notePrompt, setNotePrompt] = useState<{ studentId: string, status: 'absent' | 'late' } | null>(null);
  const [tempNote, setTempNote] = useState('');
  const { user } = useAuth();
  const { addToast } = useToast();

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const studentsSnap = await getDocs(collection(db, 'students'));
        const studentList: Student[] = [];
        studentsSnap.forEach(doc => studentList.push({ id: doc.id, ...doc.data() } as Student));
        // Sort alphabetically by Arabic name
        studentList.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
        setStudents(studentList);

        const attendanceSnap = await getDocs(query(collection(db, 'attendance'), where('date', '==', date)));
        const attendanceMap: Record<string, AttendanceRecord> = {};
        attendanceSnap.forEach(doc => {
          const data = doc.data() as AttendanceRecord;
          attendanceMap[data.studentId] = { ...data, id: doc.id };
        });
        setAttendance(attendanceMap);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'attendance');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [date]);

  const toggleAttendance = async (studentId: string, status: 'present' | 'absent' | 'late', note?: string) => {
    const existing = attendance[studentId];
    
    // Prompt for note if marking absent/late and not toggling off
    if ((status === 'absent' || status === 'late') && (!existing || existing.status !== status) && note === undefined) {
      setNotePrompt({ studentId, status });
      setTempNote('');
      return;
    }

    try {
      if (existing && existing.status === status) {
        // Toggle off: Remove record
        await deleteDoc(doc(db, 'attendance', existing.id));
        setAttendance(prev => {
          const next = { ...prev };
          delete next[studentId];
          return next;
        });
        addToast('تم التحديث بنجاح', 'success');
      } else {
        // Toggle on or update
        const newRecord = {
          studentId,
          date,
          status,
          notes: note || '',
          updatedAt: new Date().toISOString(),
          updatedBy: user?.username || '',
        };
        if (existing) {
          await updateDoc(doc(db, 'attendance', existing.id), newRecord);
          setAttendance(prev => ({ ...prev, [studentId]: { ...newRecord, id: existing.id } }));
        } else {
          const docRef = doc(collection(db, 'attendance'));
          await setDoc(docRef, { ...newRecord, id: docRef.id });
          setAttendance(prev => ({ ...prev, [studentId]: { ...newRecord, id: docRef.id } }));
        }
        addToast('تم التحديث بنجاح', 'success');
      }
      setNotePrompt(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'attendance');
      addToast('فشل في التحديث', 'error');
    }
  };

  const [generating, setGenerating] = useState(false);

  const handleGenerateReport = async () => {
    if (!user) return;
    setGenerating(true);
    const presentCount = Object.values(attendance).filter(r => r.status === 'present' || r.status === 'late').length;
    const attendancePercent = students.length > 0 ? Math.round((presentCount / students.length) * 100) : 0;

    try {
      const reportData = {
        title: `تقرير الحضور - ${date}`,
        squad: students[0]?.gradeLevel || 'الكل',
        headers: ['اسم الطالب', 'الحالة', 'ملاحظات', 'بواسطة', 'الوقت'],
        rows: students.map(s => {
          const r = attendance[s.id];
          return [
            s.name,
            r?.status === 'present' ? 'حاضر' : r?.status === 'late' ? 'متأخر' : 'غائب',
            r?.notes || '-',
            r?.updatedBy || '-',
            r?.updatedAt ? new Date(r.updatedAt).toLocaleTimeString('ar-EG') : '-'
          ];
        })
      };

      await generatePDFReport(reportData, 'attendance', user);
      addToast('تم إنشاء التقرير بنجاح وحفظه في الصندوق.', 'success');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'reports');
      addToast('فشل في إنشاء التقرير.', 'error');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="p-4 md:p-12 max-w-7xl mx-auto">
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-8 md:mb-12">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-royal-red mb-2">الحضور</h1>
          <p className="text-stone-500 italic">تتبع الحضور اليومي للخدمة</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full md:w-auto">
          {!!user && (
            <button 
              onClick={handleGenerateReport}
              disabled={generating}
              className="btn-primary flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 w-full sm:w-auto"
            >
              <FileText size={20} />
              {generating ? 'جاري الإنشاء...' : 'استخراج تقرير PDF'}
            </button>
          )}
          <div className="flex items-center gap-4 bg-white p-3 rounded-xl shadow-sm border border-stone-100 w-full sm:w-auto justify-between sm:justify-start">
            <div className="flex items-center">
              <Calendar size={20} className="text-gold mr-2" />
              <input 
                type="date" 
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="border-none bg-transparent focus:ring-0 font-bold text-stone-900 w-full"
              />
            </div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {students.map(student => {
          const record = attendance[student.id];
          return (
            <motion.div 
              key={student.id}
              layout
              className="card-clean p-6 flex flex-col justify-between hover:border-gold transition-colors"
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-royal-red/10 text-royal-red rounded-xl flex items-center justify-center font-bold text-lg border border-royal-red/20">
                  {student.name[0]}
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-lg text-stone-900">{student.name}</h3>
                  <p className="text-xs text-stone-400 font-medium">{student.gradeLevel}</p>
                </div>
                {record?.notes && (
                  <div className="group relative">
                    <Info size={18} className="text-gold cursor-help" />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-stone-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 text-center">
                      {record.notes}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button 
                  onClick={() => !!user && toggleAttendance(student.id, 'present')}
                  disabled={false}
                  className={`flex-1 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 border ${
                    record?.status === 'present' 
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-md' 
                      : 'bg-white text-stone-400 border-stone-200 hover:border-emerald-600 hover:text-emerald-600'
                  } ${false ? 'cursor-default opacity-80' : ''}`}
                >
                  <CheckCircle2 size={18} />
                  حاضر
                </button>
                <button 
                  onClick={() => !!user && toggleAttendance(student.id, 'late')}
                  disabled={false}
                  className={`flex-1 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 border ${
                    record?.status === 'late' 
                      ? 'bg-amber-500 text-white border-amber-500 shadow-md' 
                      : 'bg-white text-stone-400 border-stone-200 hover:border-amber-500 hover:text-amber-500'
                  } ${false ? 'cursor-default opacity-80' : ''}`}
                >
                  <Clock size={18} />
                  متأخر
                </button>
                <button 
                  onClick={() => !!user && toggleAttendance(student.id, 'absent')}
                  disabled={false}
                  className={`flex-1 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 border ${
                    record?.status === 'absent' 
                      ? 'bg-red-600 text-white border-red-600 shadow-md' 
                      : 'bg-white text-stone-400 border-stone-200 hover:border-red-600 hover:text-red-600'
                  } ${false ? 'cursor-default opacity-80' : ''}`}
                >
                  <XCircle size={18} />
                  غائب
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>

      <AnimatePresence>
        {notePrompt && (
          <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-stone-100"
            >
              <div className="flex items-center gap-4 mb-6">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                  notePrompt.status === 'absent' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
                }`}>
                  <MessageCircle size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-stone-900">إضافة ملاحظة</h3>
                  <p className="text-stone-500 text-sm">أضف سبب الغياب أو التأخير (اختياري)</p>
                </div>
              </div>

              <textarea
                value={tempNote}
                onChange={(e) => setTempNote(e.target.value)}
                placeholder="اكتب الملاحظة هنا..."
                className="w-full h-32 p-4 rounded-2xl border border-stone-200 focus:ring-2 focus:ring-royal-red focus:border-transparent resize-none mb-6 text-right"
                dir="rtl"
              />

              <div className="flex gap-4">
                <button
                  onClick={() => toggleAttendance(notePrompt.studentId, notePrompt.status, tempNote)}
                  className="flex-1 py-4 bg-royal-red text-white rounded-2xl font-bold hover:bg-royal-red/90 transition-all shadow-lg shadow-royal-red/20"
                >
                  حفظ
                </button>
                <button
                  onClick={() => setNotePrompt(null)}
                  className="flex-1 py-4 bg-stone-100 text-stone-600 rounded-2xl font-bold hover:bg-stone-200 transition-all"
                >
                  إلغاء
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

// --- Tayo Scoring (formerly Grade Manager) ---
const TayoScoring = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [grades, setGrades] = useState<GradeRecord[]>([]);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingGrade, setEditingGrade] = useState<GradeRecord | null>(null);
  const [topStudents, setTopStudents] = useState<{name: string, totalScore: number}[]>([]);
  const { user } = useAuth();
  const { addToast } = useToast();
  const { confirm } = useConfirm();

  useEffect(() => {
    const fetchTopStudents = async () => {
      try {
        const gradesSnap = await getDocs(collection(db, 'grades'));
        const studentScores: Record<string, number> = {};
        gradesSnap.forEach(doc => {
          const data = doc.data();
          studentScores[data.studentId] = (studentScores[data.studentId] || 0) + data.score;
        });
        
        const sorted = Object.entries(studentScores)
          .map(([id, score]) => ({
            name: students.find(s => s.id === id)?.name || 'طالب غير معروف',
            totalScore: score
          }))
          .sort((a, b) => b.totalScore - a.totalScore)
          .slice(0, 5);
        
        setTopStudents(sorted);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'grades');
      }
    };
    if (students.length > 0) fetchTopStudents();
  }, [students]);

  const [generating, setGenerating] = useState(false);

  const handleGenerateReport = async () => {
    if (!user) return;
    setGenerating(true);
    try {
      // Fetch only grades for the selected date to ensure "Pure Weekly Report"
      const gradesSnap = await getDocs(query(collection(db, 'grades'), where('date', '==', date)));
      const studentBreakdown: Record<string, {
        attendance: number,
        behavior: number,
        interaction: number,
        practical: number,
        total: number
      }> = {};

      gradesSnap.forEach(doc => {
        const data = doc.data() as GradeRecord;
        if (!studentBreakdown[data.studentId]) {
          studentBreakdown[data.studentId] = { attendance: 0, behavior: 0, interaction: 0, practical: 0, total: 0 };
        }
        
        const score = data.score || 0;
        studentBreakdown[data.studentId].total += score;
        
        if (data.subject === 'حضور') studentBreakdown[data.studentId].attendance += score;
        else if (data.subject === 'سلوك') studentBreakdown[data.studentId].behavior += score;
        else if (data.subject === 'تفاعل') studentBreakdown[data.studentId].interaction += score;
        else if (data.subject === 'خدمة عملية') studentBreakdown[data.studentId].practical += score;
      });

      const reportData = {
        title: 'تقرير درجات طايو - تفصيلي',
        squad: students[0]?.gradeLevel || 'الكل',
        headers: ['اسم الطالب', 'حضور', 'سلوك', 'تفاعل', 'خدمة عملية', 'إجمالي النقاط'],
        rows: students.map(s => {
          const b = studentBreakdown[s.id] || { attendance: 0, behavior: 0, interaction: 0, practical: 0, total: 0 };
          return [
            s.name,
            b.attendance.toString(),
            b.behavior.toString(),
            b.interaction.toString(),
            b.practical.toString(),
            b.total.toString()
          ];
        })
      };
      await generatePDFReport(reportData, 'tayo', user);
      addToast('تم إنشاء التقرير بنجاح وحفظه في الصندوق.', 'success');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'reports');
      addToast('فشل في إنشاء التقرير.', 'error');
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const snap = await getDocs(collection(db, 'students'));
        const list: Student[] = [];
        snap.forEach(doc => list.push({ id: doc.id, ...doc.data() } as Student));
        // Sort alphabetically by Arabic name
        list.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
        setStudents(list);
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'students');
      }
    };
    fetchStudents();
  }, []);

  useEffect(() => {
    if (!selectedStudent) return;
    const q = query(collection(db, 'grades'), where('studentId', '==', selectedStudent.id), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: GradeRecord[] = [];
      snapshot.forEach(doc => list.push({ id: doc.id, ...doc.data() } as GradeRecord));
      setGrades(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'grades');
    });
    return () => unsubscribe();
  }, [selectedStudent]);

  const handleAddGrade = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedStudent) return;
    const formData = new FormData(e.currentTarget);
    const newGrade = {
      studentId: selectedStudent.id,
      subject: formData.get('subject') as string,
      score: Number(formData.get('score') || 0),
      date: formData.get('date') as string,
      notes: formData.get('notes') as string,
      updatedAt: new Date().toISOString(),
      updatedBy: user?.username || '',
    };

    try {
      const studentRef = doc(db, 'students', selectedStudent.id);
      
      if (editingGrade) {
        // Revert old points
        const oldField = editingGrade.subject === 'حضور' ? 'attendancePoints' :
                         editingGrade.subject === 'سلوك' ? 'behaviorPoints' :
                         editingGrade.subject === 'تفاعل' ? 'interactionPoints' : 'practicalPoints';
        await updateDoc(studentRef, { [oldField]: increment(-editingGrade.score) });
        
        // Update grade doc
        await updateDoc(doc(db, 'grades', editingGrade.id), newGrade);
        
        // Add new points
        const newField = newGrade.subject === 'حضور' ? 'attendancePoints' :
                         newGrade.subject === 'سلوك' ? 'behaviorPoints' :
                         newGrade.subject === 'تفاعل' ? 'interactionPoints' : 'practicalPoints';
        await updateDoc(studentRef, { [newField]: increment(newGrade.score) });
        
        addToast('تم تعديل التقييم بنجاح', 'success');
      } else {
        const docRef = doc(collection(db, 'grades'));
        await setDoc(docRef, { ...newGrade, id: docRef.id });
        
        // Update student points
        const fieldToUpdate = newGrade.subject === 'حضور' ? 'attendancePoints' :
                              newGrade.subject === 'سلوك' ? 'behaviorPoints' :
                              newGrade.subject === 'تفاعل' ? 'interactionPoints' : 'practicalPoints';
        
        await updateDoc(studentRef, {
          [fieldToUpdate]: increment(newGrade.score)
        });
        addToast('تم إضافة التقييم بنجاح', 'success');
      }

      setIsAdding(false);
      setEditingGrade(null);
    } catch (error) {
      handleFirestoreError(error, editingGrade ? OperationType.UPDATE : OperationType.CREATE, 'grades');
      addToast('فشل حفظ التقييم', 'error');
    }
  };

  const handleDeleteGrade = async (grade: GradeRecord) => {
    confirm({
      title: 'حذف تقييم',
      message: 'هل أنت متأكد من حذف هذا التقييم؟ لا يمكن التراجع عن هذا الإجراء.',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'grades', grade.id));
          
          // Revert student points
          if (selectedStudent) {
            const studentRef = doc(db, 'students', selectedStudent.id);
            const fieldToUpdate = grade.subject === 'حضور' ? 'attendancePoints' :
                                  grade.subject === 'سلوك' ? 'behaviorPoints' :
                                  grade.subject === 'تفاعل' ? 'interactionPoints' : 'practicalPoints';
            await updateDoc(studentRef, {
              [fieldToUpdate]: increment(-grade.score)
            });
          }
          
          addToast('تم حذف التقييم بنجاح', 'success');
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, 'grades');
          addToast('فشل حذف التقييم', 'error');
        }
      }
    });
  };

  return (
    <div className="p-4 md:p-12 max-w-7xl mx-auto">
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-8 md:mb-12">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-royal-red mb-2">تقييم طايو</h1>
          <p className="text-stone-500 italic">إدارة الدرجات والتقدم الروحي (طايو)</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full md:w-auto">
          <div className="relative">
            <Calendar className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
            <input 
              type="date" 
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full sm:w-auto pr-12 pl-4 py-3 bg-white dark:bg-dark-surface rounded-2xl border border-stone-200 dark:border-dark-border focus:ring-2 focus:ring-gold outline-none transition-all shadow-sm font-bold text-stone-700 dark:text-dark-text"
            />
          </div>
          {!!user && (
            <button 
              onClick={handleGenerateReport}
              disabled={generating}
              className="btn-primary flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 w-full sm:w-auto"
            >
              <FileText size={20} />
              {generating ? 'جاري الإنشاء...' : 'استخراج تقرير PDF'}
            </button>
          )}
        </div>
      </header>

      {/* Top Students Section */}
      <div className="mb-12">
        <h2 className="text-2xl font-bold text-stone-900 mb-6 flex items-center gap-2">
          <Trophy className="text-gold" />
          أوائل الطلبة (Top 5)
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
          {topStudents.map((s, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.1 }}
              className="card-clean p-4 border-t-4 border-t-gold text-center"
            >
              <div className="w-10 h-10 bg-gold/10 text-gold rounded-full flex items-center justify-center mx-auto mb-3 font-bold">
                {i + 1}
              </div>
              <h4 className="font-bold text-stone-900 mb-1">{s.name}</h4>
              <div className="text-xs font-bold text-royal-red">{s.totalScore} نقطة</div>
              <div className="mt-3 h-1.5 bg-stone-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gold" 
                  style={{ width: `${Math.min(100, (s.totalScore / (topStudents[0]?.totalScore || 1)) * 100)}%` }}
                />
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div className="lg:col-span-1">
          <div className="card-clean overflow-hidden">
            <div className="p-6 border-b border-stone-100 bg-off-white/50">
              <h3 className="font-bold text-xl text-royal-red">اختر طالباً</h3>
            </div>
            <div className="max-h-[600px] overflow-y-auto p-4 space-y-2">
              {students.map(s => (
                <button
                  key={s.id}
                  onClick={() => setSelectedStudent(s)}
                  className={`w-full flex items-center gap-3 p-4 rounded-xl transition-all border ${
                    selectedStudent?.id === s.id 
                      ? 'bg-royal-red text-white border-royal-red shadow-md' 
                      : 'hover:bg-off-white text-stone-600 border-transparent hover:border-stone-100'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${
                    selectedStudent?.id === s.id ? 'bg-white/20' : 'bg-stone-100'
                  }`}>
                    {s.name[0]}
                  </div>
                  <span className="font-bold">{s.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          {selectedStudent ? (
            <div className="space-y-8">
              <div className="card-clean p-6 md:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-r-4 border-r-gold">
                <div>
                  <h2 className="text-2xl md:text-3xl font-bold text-stone-900">{selectedStudent.name}</h2>
                  <p className="text-stone-400 font-medium">{selectedStudent.gradeLevel}</p>
                </div>
                {!!user && (
                  <button 
                    onClick={() => setIsAdding(true)}
                    className="btn-primary flex items-center justify-center gap-2 w-full sm:w-auto"
                  >
                    <Plus size={20} />
                    إضافة تقييم
                  </button>
                )}
              </div>

              <div className="card-clean overflow-hidden">
                <table className="w-full text-right">
                  <thead>
                    <tr className="bg-stone-50 text-stone-500 text-xs uppercase tracking-widest font-bold border-b border-stone-100">
                      <th className="px-8 py-4">النشاط</th>
                      <th className="px-8 py-4">الدرجة</th>
                      <th className="px-8 py-4">التاريخ</th>
                      <th className="px-8 py-4 text-left">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-50">
                    {grades.map(grade => (
                      <tr key={grade.id} className="hover:bg-off-white transition-colors">
                        <td className="px-8 py-6 font-bold text-stone-900">{grade.subject}</td>
                        <td className="px-8 py-6">
                          <span className={`px-3 py-1 rounded-lg text-sm font-bold border ${
                            grade.score >= 10 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                            grade.score >= 5 ? 'bg-amber-50 text-amber-700 border-amber-200' :
                            'bg-red-50 text-red-700 border-red-200'
                          }`}>
                            {grade.score} نقطة
                          </span>
                        </td>
                        <td className="px-8 py-6 text-stone-500 font-mono text-sm">{grade.date}</td>
                        <td className="px-8 py-6 text-left">
                          {!!user ? (
                            <div className="flex items-center justify-end gap-2">
                              <button 
                                onClick={() => {
                                  setEditingGrade(grade);
                                  setIsAdding(true);
                                }}
                                className="p-2 text-stone-400 hover:text-gold transition-colors"
                              >
                                <Edit2 size={16} />
                              </button>
                              <button 
                                onClick={() => handleDeleteGrade(grade)}
                                className="p-2 text-stone-400 hover:text-red-600 transition-colors"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          ) : (
                            <button className="p-2 text-stone-400 hover:text-royal-red transition-colors">
                              <MoreVertical size={16} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {grades.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-8 py-12 text-center text-stone-400 italic">
                          لا توجد تقييمات مسجلة لهذا الطالب بعد.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-12 bg-white rounded-3xl border-2 border-stone-100 border-dashed">
              <div className="w-20 h-20 bg-off-white rounded-full flex items-center justify-center mb-6">
                <GraduationCap size={40} className="text-stone-200" />
              </div>
              <h3 className="text-xl font-bold text-stone-400">اختر طالباً لعرض سجلات التقييم</h3>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl max-w-md w-full border border-stone-100"
            >
              <div className="p-8 border-b border-stone-100 flex items-center justify-between bg-off-white/50">
                <h2 className="text-2xl font-bold text-royal-red">{editingGrade ? 'تعديل سجل تقييم' : 'إضافة سجل تقييم'}</h2>
                <button onClick={() => { setIsAdding(false); setEditingGrade(null); }} className="p-2 hover:bg-stone-100 rounded-full transition-colors">
                  <XCircle size={24} className="text-stone-400" />
                </button>
              </div>
              
              <form onSubmit={handleAddGrade} className="p-8 space-y-6">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-500 uppercase tracking-wider mr-1">نوع التقييم</label>
                  <select name="subject" required className="input-clean" defaultValue={editingGrade?.subject || ""} onChange={(e) => {
                    const scoreInput = e.currentTarget.form?.elements.namedItem('score') as HTMLInputElement;
                    if (scoreInput) {
                      if (e.target.value === 'حضور') scoreInput.value = '1';
                      else if (e.target.value === 'سلوك') scoreInput.value = '5';
                      else if (e.target.value === 'تفاعل') scoreInput.value = '10';
                      else if (e.target.value === 'خدمة عملية') scoreInput.value = '20';
                    }
                  }}>
                    <option value="">اختر النوع...</option>
                    {(user?.role === 'attendance' || user?.role === 'admin' || user?.role === 'coordinator' || user?.role === 'tayo' || user?.role === 'practical') && (
                      <>
                        <option value="حضور">حضور (1 نقطة)</option>
                        <option value="سلوك">سلوك (5 نقاط)</option>
                        <option value="تفاعل">تفاعل (10 نقاط)</option>
                      </>
                    )}
                    {(user?.role === 'admin' || user?.role === 'coordinator' || user?.role === 'tayo' || user?.role === 'practical') && (
                      <option value="خدمة عملية">خدمة عملية (20 نقطة)</option>
                    )}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-500 uppercase tracking-wider mr-1">الدرجة</label>
                  <input name="score" type="number" min="0" required className="input-clean bg-stone-50" readOnly={user?.role === 'attendance'} defaultValue={editingGrade?.score || ""} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-500 uppercase tracking-wider mr-1">التاريخ</label>
                  <input name="date" type="date" defaultValue={editingGrade?.date || new Date().toISOString().split('T')[0]} required className="input-clean" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-500 uppercase tracking-wider mr-1">ملاحظات</label>
                  <textarea name="notes" rows={2} className="input-clean" defaultValue={editingGrade?.notes || ""} />
                </div>
                
                <div className="pt-4 flex gap-4">
                  <button 
                    type="button"
                    onClick={() => { setIsAdding(false); setEditingGrade(null); }}
                    className="flex-1 py-4 rounded-xl font-bold text-stone-500 hover:bg-stone-50 transition-colors"
                  >
                    إلغاء
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 btn-primary"
                  >
                    {editingGrade ? 'حفظ التعديلات' : 'حفظ التقييم'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

// --- Acceptance Evaluation ---
const AcceptanceEvaluation = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [evaluation, setEvaluation] = useState<any | null>(null);
  const { user } = useAuth();
  const { addToast } = useToast();

  useEffect(() => {
    const q = query(collection(db, 'students'), where('gradeLevel', '==', 'الفرقة الأولى'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Student[] = [];
      snapshot.forEach(doc => list.push({ id: doc.id, ...doc.data() } as Student));
      setStudents(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'students');
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!selectedStudent) return;
    const q = query(collection(db, 'acceptance_evaluations'), where('studentId', '==', selectedStudent.id));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        setEvaluation({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() });
      } else {
        setEvaluation(null);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'acceptance_evaluations');
    });
    return () => unsubscribe();
  }, [selectedStudent]);

  const handleSaveEvaluation = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedStudent) return;
    const formData = new FormData(e.currentTarget);
    const data = {
      studentId: selectedStudent.id,
      score: Number(formData.get('score')),
      notes: formData.get('notes') as string,
      updatedAt: new Date().toISOString(),
      updatedBy: user?.username || '',
    };

    try {
      const docRef = evaluation ? doc(db, 'acceptance_evaluations', evaluation.id) : doc(collection(db, 'acceptance_evaluations'));
      await setDoc(docRef, { ...data, id: docRef.id });
      addToast('تم حفظ التقييم بنجاح', 'success');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'acceptance_evaluations');
      addToast('فشل حفظ التقييم', 'error');
    }
  };

  return (
    <div className="p-4 md:p-12 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold text-royal-red mb-8">تقييم القبول - الفرقة الأولى</h1>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div className="lg:col-span-1">
          <div className="card-clean p-4 space-y-2">
            {students.map(s => (
              <button key={s.id} onClick={() => setSelectedStudent(s)} className={`w-full p-4 rounded-xl ${selectedStudent?.id === s.id ? 'bg-royal-red text-white' : 'hover:bg-off-white'}`}>
                {s.name}
              </button>
            ))}
          </div>
        </div>
        <div className="lg:col-span-2">
          {selectedStudent ? (
            <form onSubmit={handleSaveEvaluation} className="card-clean p-8 space-y-6">
              <h2 className="text-xl font-bold">تقييم الطالب: {selectedStudent.name}</h2>
              <input name="score" type="number" defaultValue={evaluation?.score || 0} required className="input-clean" placeholder="الدرجة" />
              <textarea name="notes" defaultValue={evaluation?.notes || ''} className="input-clean" placeholder="ملاحظات" />
              <button type="submit" className="btn-primary">حفظ التقييم</button>
            </form>
          ) : (
            <p>اختر طالباً للتقييم</p>
          )}
        </div>
      </div>
    </div>
  );
};

// --- Curriculum Manager ---
// Removed CurriculumManager and SliderManager

const ViewOnlyBadge = () => {
  const { user } = useAuth();
  if (!user || user.role !== 'guest') return null;
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] bg-royal-red dark:bg-gold text-white dark:text-stone-900 px-6 py-2 rounded-full shadow-lg font-bold flex items-center gap-2 animate-bounce transition-colors">
      <AlertCircle size={18} />
      وضع العرض فقط
    </div>
  );
};

// --- Main App ---
// --- Events Page ---
const EventsPage = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'events'), orderBy('date', 'asc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      const list: Event[] = [];
      snap.forEach(doc => list.push({ id: doc.id, ...doc.data() } as Event));
      setEvents(list);
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'events'));
    return unsubscribe;
  }, []);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-off-white">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-royal-red border-t-transparent rounded-full animate-spin" />
        <p className="text-stone-500 font-bold">جاري تحميل الأحداث...</p>
      </div>
    </div>
  );

  return (
    <div className="p-12 max-w-7xl mx-auto min-h-screen">
      <header className="mb-16 text-center">
        <h1 className="text-5xl font-serif font-bold text-royal-red mb-4">الأحداث والفعاليات</h1>
        <p className="text-stone-500 italic text-lg">"كُلُّ شَيْءٍ يَعْمَلُ مَعاً لِلْخَيْرِ"</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {events.map((event) => (
          <motion.div 
            key={event.id}
            whileHover={{ y: -10 }}
            className="bg-white rounded-[2rem] p-8 shadow-sm hover:shadow-2xl transition-all border border-stone-100 relative overflow-hidden group"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-gold/5 rounded-bl-[4rem] -mr-8 -mt-8 transition-transform group-hover:scale-150" />
            
            <div className="flex items-center gap-4 text-gold mb-6">
              <div className="p-3 bg-gold/10 rounded-2xl">
                <Calendar size={28} />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-stone-900">{new Date(event.date).toLocaleDateString('ar-EG', { day: 'numeric', month: 'long' })}</span>
                <span className="text-xs text-stone-400 font-bold uppercase tracking-widest">{new Date(event.date).toLocaleDateString('ar-EG', { weekday: 'long' })}</span>
              </div>
            </div>

            <h3 className="text-2xl font-bold text-stone-900 mb-6 group-hover:text-royal-red transition-colors">{event.name}</h3>
            
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-stone-600 bg-stone-50 p-3 rounded-xl">
                <Clock size={18} className="text-gold" />
                <span className="text-sm font-medium">{event.time}</span>
              </div>
              <div className="flex items-center gap-3 text-stone-600 bg-stone-50 p-3 rounded-xl">
                <Search size={18} className="text-gold" />
                <span className="text-sm font-medium">{event.location}</span>
              </div>
            </div>
            
            <div className="mt-8 pt-6 border-t border-stone-50 flex items-center justify-between">
              <span className="text-[10px] font-bold text-stone-300 uppercase tracking-widest">حدث كنسي</span>
              <div className="w-8 h-1 bg-gold rounded-full" />
            </div>
          </motion.div>
        ))}
        {events.length === 0 && (
          <div className="col-span-full py-32 text-center">
            <Calendar size={64} className="mx-auto text-stone-200 mb-4" />
            <p className="text-stone-400 italic text-xl">لا توجد أحداث قادمة حالياً.</p>
          </div>
        )}
      </div>
    </div>
  );
};

// --- Staff Page ---
function StaffPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [squadFilter, setSquadFilter] = useState('الكل');
  const [viewPhoto, setViewPhoto] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'staff'));
    const unsubscribe = onSnapshot(q, (snap) => {
      const list: StaffMember[] = [];
      snap.forEach(doc => list.push({ id: doc.id, ...doc.data() } as StaffMember));
      
      // Sort by role hierarchy
      const roleOrder: Record<string, number> = {
        'القمص المسئول': 1,
        'القس المسئول': 2,
        'المنسق': 3,
        'المدرس': 4,
        'المدرسين': 4,
        'المساعد-المتدرب': 5,
        'المتدربين': 5
      };
      
      list.sort((a, b) => {
        // Special handling for the priests
        if (a.name === 'القمص رافائيل ميخائيل') return -1;
        if (b.name === 'القمص رافائيل ميخائيل') return 1;
        if (a.name === 'القس موسى إسحق') return -1;
        if (b.name === 'القس موسى إسحق') return 1;

        const rankA = roleOrder[a.role] || 99;
        const rankB = roleOrder[b.role] || 99;
        if (rankA !== rankB) return rankA - rankB;
        return a.name.localeCompare(b.name, 'ar');
      });
      
      setStaff(list);
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'staff'));
    return unsubscribe;
  }, []);

  const filteredStaff = staff.filter(member => {
    const matchesSearch = member.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         member.responsibility.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSquad = squadFilter === 'الكل' || member.squad === squadFilter;
    return matchesSearch && matchesSquad;
  });

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-off-white">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-gold border-t-transparent rounded-full animate-spin" />
        <p className="text-stone-500 font-bold">جاري تحميل الهيكل التنظيمي...</p>
      </div>
    </div>
  );

  return (
    <div className="p-12 max-w-7xl mx-auto min-h-screen">
      <header className="mb-16 text-center relative">
        <div className="absolute top-1/2 left-0 w-full h-px bg-stone-200 -z-10" />
        <h1 className="text-5xl font-serif font-bold text-royal-red mb-4 bg-off-white px-8 inline-block relative">الهيكل التنظيمي</h1>
        <p className="text-stone-500 italic text-lg">"خُدَّامُ اللهِ فِي كُلِّ شَيْءٍ"</p>
        
        <div className="mt-12 flex flex-col md:flex-row items-center justify-center gap-4 max-w-2xl mx-auto">
          <div className="relative flex-1 w-full">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-400" size={20} />
            <input 
              type="text" 
              placeholder="بحث بالاسم أو المسئولية..." 
              className="input-clean pr-12 bg-white shadow-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select 
            className="input-clean w-full md:w-48 bg-white shadow-sm"
            value={squadFilter}
            onChange={(e) => setSquadFilter(e.target.value)}
          >
            <option value="الكل">كل الفرق</option>
            <option value="الأولى">الفرقة الأولى</option>
            <option value="الثانية">الفرقة الثانية</option>
            <option value="عام">عام</option>
          </select>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-10">
        {filteredStaff.map((member) => (
          <motion.div 
            key={member.id}
            whileHover={{ y: -10 }}
            className={`bg-white rounded-[2rem] p-8 flex flex-col items-center text-center shadow-sm hover:shadow-2xl transition-all border-2 group relative overflow-hidden mx-auto w-full max-w-2xl ${
              member.role === 'القمص المسئول' ? 'border-royal-red scale-105' :
              member.role === 'القس المسئول' ? 'border-gold' :
              'border-stone-100'
            }`}
          >
            <div className="absolute top-0 left-0 w-full h-2 bg-gold opacity-0 group-hover:opacity-100 transition-opacity" />
            
            <div 
              className={`rounded-full overflow-hidden mb-6 border-4 border-stone-50 shadow-inner group-hover:border-gold/30 transition-all p-1 bg-white cursor-pointer relative ${
                member.role === 'القمص المسئول' ? 'w-48 h-48' : 'w-36 h-36'
              }`}
              onClick={() => member.imageUrl && setViewPhoto(member.imageUrl)}
            >
              <div className="w-full h-full rounded-full overflow-hidden relative">
                {member.imageUrl ? (
                  <>
                    <img src={member.imageUrl} alt={member.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Eye size={24} className="text-white" />
                    </div>
                  </>
                ) : (
                  <div className="w-full h-full bg-stone-100 flex items-center justify-center text-4xl font-bold text-stone-300">
                    {member.name[0]}
                  </div>
                )}
              </div>
            </div>
            
            <h3 className={`font-bold text-stone-900 mb-1 group-hover:text-royal-red transition-colors ${
              member.role === 'القمص المسئول' ? 'text-4xl' : 'text-2xl'
            }`}>{member.name}</h3>
            <p className="text-royal-red font-bold text-sm mb-2 tracking-wide uppercase">{member.role}</p>
            <p className="text-stone-500 italic text-sm mb-4">{member.responsibility}</p>
            
            <div className="flex items-center gap-1.5 text-gold mb-6">
              {[...Array(5)].map((_, i) => (
                <Star key={i} size={18} fill={i < member.rating ? "#D4AF37" : "none"} strokeWidth={2} />
              ))}
            </div>
            
            <div className="mt-auto w-full pt-4 border-t border-stone-50 flex justify-center">
              <span className="px-4 py-1.5 bg-stone-50 rounded-full text-[11px] text-stone-500 font-bold uppercase tracking-widest">
                الفرقة: {member.squad}
              </span>
            </div>
          </motion.div>
        ))}
        {filteredStaff.length === 0 && (
          <div className="col-span-full py-32 text-center">
            <Users size={64} className="mx-auto text-stone-200 mb-4" />
            <p className="text-stone-400 italic text-xl">لا توجد نتائج تطابق بحثك.</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {viewPhoto && (
          <div 
            className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-4 cursor-zoom-out"
            onClick={() => setViewPhoto(null)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-4xl w-full max-h-[90vh] flex items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              <img 
                src={viewPhoto} 
                alt="Staff member" 
                className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
                referrerPolicy="no-referrer"
              />
              <button 
                onClick={() => setViewPhoto(null)}
                className="absolute -top-12 right-0 p-2 text-white hover:text-gold transition-colors"
              >
                <X size={32} />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

// --- Reports Inbox ---
const ReportsInbox = () => {
  const { addToast } = useToast();
  const { confirm: showConfirm } = useConfirm();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'reports'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      const list: Report[] = [];
      snap.forEach(doc => list.push({ id: doc.id, ...doc.data() } as Report));
      setReports(list);
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'reports'));
    return unsubscribe;
  }, []);

  const downloadReport = async (report: Report) => {
    setProcessingId(report.id);
    try {
      const data = JSON.parse(report.reportDataJson);
      const pdfDoc = await createPDFDocument(data, report.createdBy);
      pdfDoc.save(`${report.title}.pdf`);
      addToast('تم تحميل التقرير بنجاح', 'success');
    } catch (error) {
      console.error('Error regenerating PDF:', error);
      addToast('حدث خطأ أثناء تحميل التقرير.', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const previewReport = async (report: Report) => {
    setProcessingId(report.id);
    try {
      const data = JSON.parse(report.reportDataJson);
      const pdfDoc = await createPDFDocument(data, report.createdBy);
      
      // Technical Fix: Use URL.createObjectURL(blob) and window.open to display the PDF directly
      const blob = pdfDoc.output('blob');
      const pdfUrl = URL.createObjectURL(blob);
      
      const newWindow = window.open(pdfUrl, '_blank');
      if (!newWindow) {
        addToast('يرجى السماح بفتح النوافذ المنبثقة لعرض التقرير', 'error');
      }
      addToast('تم تجهيز التقرير بنجاح', 'success');
    } catch (error) {
      console.error('Error previewing PDF:', error);
      addToast('حدث خطأ أثناء معاينة التقرير.', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeleteReport = async (id: string) => {
    showConfirm({
      title: 'حذف التقرير',
      message: 'هل أنت متأكد من حذف هذا التقرير نهائياً؟',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'reports', id));
          addToast('تم حذف التقرير بنجاح', 'success');
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, 'reports');
          addToast('فشل حذف التقرير', 'error');
        }
      }
    });
  };

  if (loading) return <div className="p-12 text-center">جاري تحميل التقارير...</div>;

  return (
    <div className="p-4 md:p-12 max-w-7xl mx-auto">
      <header className="mb-8 md:mb-12 text-center md:text-right">
        <h1 className="text-3xl md:text-4xl font-bold text-royal-red mb-2">صندوق التقارير</h1>
        <p className="text-stone-500 italic">عرض وتحميل التقارير الإدارية المرفوعة</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {reports.map((report) => (
          <div key={report.id} className="card-clean p-6 flex items-start gap-4 hover:shadow-md transition-shadow">
            <div className={`p-3 rounded-2xl ${
              report.type === 'attendance' ? 'bg-blue-50 text-blue-600' :
              report.type === 'tayo' ? 'bg-gold/10 text-gold' : 'bg-red-50 text-royal-red'
            }`}>
              <FileText size={24} />
            </div>
            <div className="flex-1 overflow-hidden">
              <h3 className="font-bold text-stone-900 truncate mb-1">{report.title}</h3>
              <p className="text-xs text-stone-400 mb-4">
                {new Date(report.createdAt).toLocaleString('ar-EG')}
              </p>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-stone-500 uppercase tracking-widest">بواسطة: {report.createdBy}</span>
                <div className="flex gap-2">
                  <button 
                    onClick={() => previewReport(report)}
                    disabled={processingId === report.id}
                    className="p-2 bg-stone-100 text-stone-600 rounded-lg hover:bg-stone-200 transition-colors disabled:opacity-50"
                    title="معاينة"
                  >
                    {processingId === report.id ? (
                      <div className="w-4 h-4 border-2 border-stone-600 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Eye size={16} />
                    )}
                  </button>
                  <button 
                    onClick={() => downloadReport(report)}
                    disabled={processingId === report.id}
                    className="p-2 bg-stone-900 text-white rounded-lg hover:bg-stone-800 transition-colors disabled:opacity-50"
                    title="تحميل"
                  >
                    {processingId === report.id ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Download size={16} />
                    )}
                  </button>
                  <button 
                    onClick={() => handleDeleteReport(report.id)}
                    className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                    title="حذف"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
        {reports.length === 0 && (
          <div className="col-span-full py-20 text-center text-stone-400 italic">
            لا توجد تقارير في الصندوق حالياً.
          </div>
        )}
      </div>

      <AnimatePresence>
        {previewUrl && (
          <div className="fixed inset-0 bg-stone-900/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 lg:p-12">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full h-full rounded-2xl md:rounded-[2.5rem] overflow-hidden flex flex-col relative"
            >
              <div className="p-6 border-b border-stone-100 flex items-center justify-between bg-white">
                <h2 className="text-2xl font-bold text-royal-red">معاينة التقرير</h2>
                <button 
                  onClick={() => setPreviewUrl(null)}
                  className="p-2 hover:bg-stone-100 rounded-full transition-colors"
                >
                  <X size={24} className="text-stone-400" />
                </button>
              </div>
              <div className="flex-1 bg-stone-200">
                <iframe 
                  src={previewUrl} 
                  className="w-full h-full border-none"
                  title="PDF Preview"
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

// --- Staff Manager (Admin) ---
export const StaffManager = () => {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingMember, setEditingMember] = useState<StaffMember | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [rating, setRating] = useState(5);
  const [searchTerm, setSearchTerm] = useState('');
  const [squadFilter, setSquadFilter] = useState('الكل');
  const [viewPhoto, setViewPhoto] = useState<string | null>(null);
  const { user } = useAuth();
  const { addToast } = useToast();
  const { confirm } = useConfirm();

  useEffect(() => {
    const q = query(collection(db, 'staff'));
    const unsubscribe = onSnapshot(q, (snap) => {
      const list: StaffMember[] = [];
      snap.forEach(doc => list.push({ id: doc.id, ...doc.data() } as StaffMember));
      
      const roleOrder: Record<string, number> = {
        'القمص المسئول': 1,
        'القس المسئول': 2,
        'المنسق': 3,
        'المدرسين': 4,
        'المتدربين': 5
      };
      
      list.sort((a, b) => {
        const rankA = roleOrder[a.role] || 99;
        const rankB = roleOrder[b.role] || 99;
        if (rankA !== rankB) return rankA - rankB;
        return a.name.localeCompare(b.name, 'ar');
      });
      
      setStaff(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'staff');
    });
    return unsubscribe;
  }, []);

  const filteredStaff = staff.filter(member => {
    const matchesSearch = member.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         member.responsibility.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSquad = squadFilter === 'الكل' || member.squad === squadFilter;
    return matchesSearch && matchesSquad;
  });

  const handleAddMember = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newMember = {
      name: formData.get('name') as string,
      responsibility: formData.get('responsibility') as string,
      role: formData.get('role') as any,
      squad: formData.get('squad') as any,
      rating: rating,
      imageUrl: photoBase64 || null,
      updatedAt: new Date().toISOString(),
      updatedBy: user?.username || '',
    };

    try {
      const docRef = doc(collection(db, 'staff'));
      await setDoc(docRef, { ...newMember, id: docRef.id });
      setIsAdding(false);
      setPhotoBase64(null);
      setRating(5);
      addToast('تم إضافة العضو بنجاح', 'success');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'staff');
      addToast('فشل إضافة العضو', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    confirm({
      title: 'حذف عضو',
      message: 'هل أنت متأكد من حذف هذا العضو؟ لا يمكن التراجع عن هذا الإجراء.',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'staff', id));
          addToast('تم حذف العضو بنجاح', 'success');
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, 'staff');
          addToast('فشل حذف العضو', 'error');
        }
      }
    });
  };

  const handleEditMember = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingMember) return;
    const formData = new FormData(e.currentTarget);
    const updatedMember = {
      name: formData.get('name') as string,
      responsibility: formData.get('responsibility') as string,
      role: formData.get('role') as any,
      squad: formData.get('squad') as any,
      rating: rating,
      imageUrl: photoBase64 || editingMember.imageUrl || null,
      updatedAt: new Date().toISOString(),
      updatedBy: user?.username || '',
    };

    try {
      await updateDoc(doc(db, 'staff', editingMember.id), updatedMember);
      setEditingMember(null);
      setPhotoBase64(null);
      setRating(5);
      addToast('تم تحديث بيانات العضو بنجاح', 'success');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'staff');
      addToast('فشل تحديث بيانات العضو', 'error');
    }
  };

  return (
    <div className="p-4 md:p-12 max-w-7xl mx-auto">
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 md:mb-12 gap-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-royal-red mb-2">إدارة الهيكل التنظيمي</h1>
          <p className="text-stone-500 italic">إضافة وتعديل بيانات الخدام</p>
        </div>
        <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
            <input 
              type="text" 
              placeholder="بحث بالاسم أو المسئولية..." 
              className="input-clean pr-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select 
            className="input-clean w-auto"
            value={squadFilter}
            onChange={(e) => setSquadFilter(e.target.value)}
          >
            <option value="الكل">كل الفرق</option>
            <option value="الأولى">الفرقة الأولى</option>
            <option value="الثانية">الفرقة الثانية</option>
            <option value="عام">عام</option>
          </select>
          <button onClick={() => { setIsAdding(true); setRating(5); }} className="btn-primary flex items-center gap-2 whitespace-nowrap">
            <Plus size={20} />
            إضافة عضو
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredStaff.map((member) => (
          <div key={member.id} className="card-clean p-6 flex items-center gap-4 group">
            <div 
              className="w-16 h-16 rounded-full overflow-hidden shrink-0 border-2 border-stone-50 group-hover:border-gold transition-all cursor-pointer relative"
              onClick={() => member.imageUrl && setViewPhoto(member.imageUrl)}
            >
              {member.imageUrl ? (
                <>
                  <img src={member.imageUrl} alt="" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Eye size={16} className="text-white" />
                  </div>
                </>
              ) : (
                <div className="w-full h-full bg-stone-100 flex items-center justify-center font-bold text-stone-300">
                  {member.name[0]}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-stone-900 truncate">{member.name}</h3>
              <p className="text-xs text-stone-500">{member.responsibility}</p>
              <div className="flex items-center gap-0.5 mt-1 text-gold">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} size={10} fill={i < member.rating ? "#D4AF37" : "none"} />
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setEditingMember(member); setPhotoBase64(null); setRating(member.rating); }} className="p-2 text-stone-400 hover:text-gold transition-colors">
                <Edit2 size={18} />
              </button>
              <button onClick={() => handleDelete(member.id)} className="p-2 text-stone-400 hover:text-red-600 transition-colors">
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        ))}
        {filteredStaff.length === 0 && (
          <div className="col-span-full py-20 text-center text-stone-400 italic bg-white rounded-3xl border-2 border-dashed border-stone-100">
            لا توجد نتائج تطابق بحثك.
          </div>
        )}
      </div>

      <AnimatePresence>
        {viewPhoto && (
          <div 
            className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-4 cursor-zoom-out"
            onClick={() => setViewPhoto(null)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-4xl w-full max-h-[90vh] flex items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              <img 
                src={viewPhoto} 
                alt="Staff member" 
                className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
                referrerPolicy="no-referrer"
              />
              <button 
                onClick={() => setViewPhoto(null)}
                className="absolute -top-12 right-0 p-2 text-white hover:text-gold transition-colors"
              >
                <X size={32} />
              </button>
            </motion.div>
          </div>
        )}
        {(isAdding || editingMember) && (
          <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-[2.5rem] p-10 max-w-md w-full shadow-2xl border border-stone-100">
              <h2 className="text-3xl font-serif font-bold text-royal-red mb-8 text-center">{editingMember ? 'تعديل بيانات العضو' : 'إضافة عضو جديد'}</h2>
              <form onSubmit={editingMember ? handleEditMember : handleAddMember} className="space-y-6">
                <div className="flex flex-col items-center mb-6">
                  <div className="w-28 h-28 bg-stone-50 rounded-full border-4 border-dashed border-stone-200 flex items-center justify-center overflow-hidden relative group p-1">
                    {photoBase64 || (editingMember?.imageUrl) ? (
                      <img src={photoBase64 || editingMember?.imageUrl} alt="" className="w-full h-full rounded-full object-cover" />
                    ) : (
                      <ImageIcon className="text-stone-300" size={32} />
                    )}
                    <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer rounded-full">
                      <Upload className="text-white" size={20} />
                      <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) setPhotoBase64(await fileToBase64(file));
                      }} />
                    </label>
                  </div>
                  <p className="text-[10px] text-stone-400 mt-2 font-bold uppercase tracking-widest">انقر لتغيير الصورة</p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-stone-500 mr-1">الاسم</label>
                    <input name="name" defaultValue={editingMember?.name} required className="input-clean" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-stone-500 mr-1">المسئولية</label>
                    <input name="responsibility" defaultValue={editingMember?.responsibility} required className="input-clean" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-stone-500 mr-1">الرتبة / الدور</label>
                    <select name="role" defaultValue={editingMember?.role || 'المدرسين'} className="input-clean">
                      <option value="القمص المسئول">القمص المسئول</option>
                      <option value="القس المسئول">القس المسئول</option>
                      <option value="المنسق">المنسق</option>
                      <option value="المدرسين">مدرس</option>
                      <option value="المتدربين">متدرب</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-stone-500 mr-1">الفرقة</label>
                    <select name="squad" defaultValue={editingMember?.squad || 'عام'} className="input-clean">
                      <option value="الأولى">الفرقة الأولى</option>
                      <option value="الثانية">الفرقة الثانية</option>
                      <option value="عام">عام</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-stone-500 mr-1">التقييم</label>
                    <div className="flex items-center justify-center gap-3 bg-stone-50 py-3 rounded-2xl border border-stone-100">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setRating(star)}
                          className="transition-transform hover:scale-125 focus:outline-none"
                        >
                          <Star 
                            size={28} 
                            fill={star <= rating ? "#D4AF37" : "none"} 
                            className={star <= rating ? "text-gold" : "text-stone-300"}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 pt-6">
                  <button type="submit" className="flex-1 btn-primary shadow-lg shadow-royal-red/20">حفظ البيانات</button>
                  <button type="button" onClick={() => { setIsAdding(false); setEditingMember(null); }} className="flex-1 py-3 text-stone-500 font-bold hover:bg-stone-50 rounded-2xl transition-colors">إلغاء</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

// --- Gallery ---
const Gallery = () => {
  const { user } = useAuth();
  const [images, setImages] = useState<SliderImage[]>([]);
  const [loading, setLoading] = useState(true);

  if (!user || user.role === 'guest') {
    return (
      <div className="p-4 md:p-12 max-w-7xl mx-auto min-h-screen flex items-center justify-center">
        <div className="bg-red-50 text-red-600 p-8 rounded-2xl text-center font-bold text-xl">
          Access Denied
        </div>
      </div>
    );
  }

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'slider_images'), (snapshot) => {
      setImages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SliderImage)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'slider_images');
    });
    return () => unsubscribe();
  }, []);

  return (
    <div className="p-4 md:p-12 max-w-7xl mx-auto min-h-screen">
      <h1 className="text-3xl md:text-4xl font-bold text-royal-red mb-8 md:mb-12 text-center">المعرض</h1>
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-royal-red"></div>
        </div>
      ) : images.length === 0 ? (
        <div className="text-center text-stone-500 py-12">لا توجد صور في المعرض حالياً</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {images.map(img => (
            <div key={img.id} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-stone-100 group">
              <div className="aspect-video relative overflow-hidden">
                <img 
                  src={img.imageUrl} 
                  alt={img.caption || 'صورة المعرض'} 
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  referrerPolicy="no-referrer"
                />
              </div>
              {img.caption && (
                <div className="p-4">
                  <h3 className="font-bold text-stone-800 text-center">{img.caption}</h3>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};



// --- Main Hub ---
const MainHub = ({ setActiveTab }: { setActiveTab: (t: string) => void }) => {
  const { user, canAccess } = useAuth();
  
  const cards = [
    { id: 'dashboard', label: 'لوحة التحكم', icon: LayoutDashboard },
    { id: 'students', label: 'معرض الطلاب', icon: Users },
    { id: 'attendance', label: 'تسجيل الحضور', icon: Calendar },
    { id: 'tayo', label: 'تسجيل الطايو', icon: GraduationCap },
    { id: 'practical', label: 'الخدمة العملية', icon: Heart },
    { id: 'library', label: 'مكتبة الموارد', icon: BookOpen },
    { id: 'staff', label: 'الهيكل التنظيمي', icon: Users },
    { id: 'events', label: 'الأحداث القادمة', icon: Calendar },
    { id: 'reports', label: 'صندوق التقارير', icon: FileText },
    { id: 'gallery', label: 'معرض الصور', icon: ImageIcon },
    { id: 'resource-mgmt', label: 'إدارة الموارد', icon: Save },
    { id: 'slider-mgmt', label: 'إدارة الصور', icon: Save },
  ];

  const visibleCards = cards.filter(card => canAccess(card.id));

  return (
    <div className="p-4 md:p-12 max-w-7xl mx-auto min-h-screen">
      <div className="mb-12">
        <HeroSlider />
      </div>

      <h1 className="text-3xl md:text-4xl font-bold text-royal-red mb-8 md:mb-12 text-center">مرحباً بك في خدمة البراعم</h1>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-8">
        {visibleCards.map(card => (
          <motion.button
            key={card.id}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setActiveTab(card.id)}
            className="bg-white dark:bg-dark-surface p-8 rounded-3xl shadow-md hover:shadow-xl transition-all border border-stone-100 dark:border-dark-border flex flex-col items-center gap-4 group"
          >
            <div className="w-16 h-16 bg-royal-red/5 dark:bg-royal-red/10 rounded-2xl flex items-center justify-center group-hover:bg-royal-red/10 dark:group-hover:bg-royal-red/20 transition-colors">
              <card.icon size={32} className="text-royal-red dark:text-gold" />
            </div>
            <span className="text-xl font-bold text-stone-800 dark:text-dark-text">{card.label}</span>
          </motion.button>
        ))}
      </div>
    </div>
  );
};

// --- Events Manager (Admin) ---
export const EventsManager = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const { user } = useAuth();
  const { addToast } = useToast();
  const { confirm } = useConfirm();

  useEffect(() => {
    const q = query(collection(db, 'events'), orderBy('date', 'asc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      const list: Event[] = [];
      snap.forEach(doc => list.push({ id: doc.id, ...doc.data() } as Event));
      setEvents(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'events');
    });
    return unsubscribe;
  }, []);

  const handleAddEvent = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newEvent = {
      name: formData.get('name') as string,
      date: formData.get('date') as string,
      time: formData.get('time') as string,
      location: formData.get('location') as string,
      createdAt: new Date().toISOString(),
    };

    try {
      const docRef = doc(collection(db, 'events'));
      await setDoc(docRef, { ...newEvent, id: docRef.id });
      setIsAdding(false);
      addToast('تم إضافة الحدث بنجاح', 'success');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'events');
      addToast('فشل إضافة الحدث', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    confirm({
      title: 'حذف حدث',
      message: 'هل أنت متأكد من حذف هذا الحدث؟ لا يمكن التراجع عن هذا الإجراء.',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'events', id));
          addToast('تم حذف الحدث بنجاح', 'success');
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, 'events');
          addToast('فشل حذف الحدث', 'error');
        }
      }
    });
  };

  return (
    <div className="p-4 md:p-12 max-w-7xl mx-auto min-h-screen">
      <header className="flex flex-col md:flex-row items-center justify-between mb-8 md:mb-12 gap-4 text-center md:text-right">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-royal-red mb-2">إدارة الأحداث</h1>
          <p className="text-stone-500 italic">تنظيم مواعيد الأنشطة والفعاليات</p>
        </div>
        <button onClick={() => setIsAdding(true)} className="btn-primary flex items-center justify-center gap-2 w-full md:w-auto">
          <Plus size={20} />
          إضافة حدث
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {events.map((event) => (
          <div key={event.id} className="card-clean p-6 group">
            <div className="flex items-start justify-between mb-4">
              <div className="p-2 bg-stone-50 rounded-lg text-gold">
                <Calendar size={20} />
              </div>
              <button onClick={() => handleDelete(event.id)} className="p-2 text-stone-300 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100">
                <Trash2 size={18} />
              </button>
            </div>
            <h3 className="font-bold text-stone-900 mb-2">{event.name}</h3>
            <div className="space-y-2">
              <p className="text-xs text-stone-500 flex items-center gap-2">
                <Clock size={14} />
                {new Date(event.date).toLocaleDateString('ar-EG')} | {event.time}
              </p>
              <p className="text-xs text-stone-500 flex items-center gap-2">
                <Search size={14} />
                {event.location}
              </p>
            </div>
          </div>
        ))}
        {events.length === 0 && (
          <div className="col-span-full py-20 text-center text-stone-400 italic bg-white rounded-3xl border-2 border-dashed border-stone-100">
            لا توجد أحداث حالياً.
          </div>
        )}
      </div>

      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-[2.5rem] p-10 max-w-md w-full shadow-2xl border border-stone-100">
              <h2 className="text-3xl font-serif font-bold text-royal-red mb-8 text-center">إضافة حدث جديد</h2>
              <form onSubmit={handleAddEvent} className="space-y-6">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-500 mr-1">اسم الحدث</label>
                  <input name="name" placeholder="مثلاً: رحلة ترفيهية" required className="input-clean" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-500 mr-1">التاريخ</label>
                  <input name="date" type="date" required className="input-clean" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-500 mr-1">الوقت</label>
                  <input name="time" placeholder="مثلاً: 6:00 م" required className="input-clean" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-500 mr-1">المكان</label>
                  <input name="location" placeholder="مثلاً: مبنى الخدمات" required className="input-clean" />
                </div>
                <div className="flex gap-4 pt-6">
                  <button type="submit" className="flex-1 btn-primary shadow-lg shadow-royal-red/20">حفظ الحدث</button>
                  <button type="button" onClick={() => setIsAdding(false)} className="flex-1 py-3 text-stone-500 font-bold hover:bg-stone-50 rounded-2xl transition-colors">إلغاء</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const DashboardNew = ({ setActiveTab }: { setActiveTab: (t: string) => void }) => {
  const [activeTab, setActiveTabLocal] = useState('analytics');
  const [stats, setStats] = useState({ 
    students: 0, 
    attendanceToday: 0, 
    tayoBreakdown: { attendance: 0, behavior: 0, interaction: 0, practical: 0 },
    totalTayo: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const studentsSnap = await getDocs(collection(db, 'students'));
        const today = new Date().toISOString().split('T')[0];
        const attendanceSnap = await getDocs(query(collection(db, 'attendance'), where('date', '==', today), where('status', '==', 'present')));
        const gradesSnap = await getDocs(collection(db, 'grades'));
        
        let totalTayo = 0;
        let tayoBreakdown = { attendance: 0, behavior: 0, interaction: 0, practical: 0 };
        
        gradesSnap.forEach(doc => {
          const data = doc.data();
          totalTayo += data.score;
          if (data.subject === 'حضور') tayoBreakdown.attendance += data.score;
          else if (data.subject === 'سلوك') tayoBreakdown.behavior += data.score;
          else if (data.subject === 'تفاعل') tayoBreakdown.interaction += data.score;
          else if (data.subject === 'خدمة عملية') tayoBreakdown.practical += data.score;
        });
        
        setStats({ students: studentsSnap.size, attendanceToday: attendanceSnap.size, tayoBreakdown, totalTayo });
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'dashboard_stats');
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const tabs = [
    { id: 'analytics', label: 'تحليلات', icon: LayoutDashboard },
    { id: 'slider', label: 'الصور', icon: ImageIcon },
    { id: 'staff', label: 'الخدام', icon: UserCog },
    { id: 'students', label: 'الطلاب', icon: Users },
    { id: 'exams', label: 'روابط الامتحانات', icon: BookOpen },
    { id: 'events', label: 'الأحداث', icon: Calendar },
    { id: 'curricula', label: 'المناهج', icon: BookOpen },
  ];

  if (loading) return <div className="p-8 animate-pulse text-royal-red font-bold">جاري تحميل لوحة التحكم...</div>;

  return (
    <div className="p-4 md:p-12 max-w-7xl mx-auto">
      <div className="flex gap-4 mb-8 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTabLocal(tab.id)}
            className={`flex items-center gap-2 px-6 py-3 rounded-full font-bold transition-all ${
              activeTab === tab.id 
                ? 'bg-royal-red text-white shadow-lg' 
                : 'bg-white text-stone-600 hover:bg-stone-100'
            }`}
          >
            <tab.icon size={20} />
            {tab.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
        >
          {activeTab === 'analytics' && (
            <div>
              <motion.header 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
                className="flex flex-col items-center text-center mb-8 md:mb-16"
              >
                <img 
                  src={logo} 
                  alt="Baraem Orthodox Logo" 
                  className="h-32 md:h-48 w-auto mb-6 md:mb-8 drop-shadow-2xl"
                  referrerPolicy="no-referrer"
                />
                <h1 className="text-3xl md:text-5xl font-bold text-royal-red mb-2">مرحباً بك من جديد</h1>
                <p className="text-stone-500 text-base md:text-lg italic">لوحة تحكم إدارة خدمة البراعم</p>
              </motion.header>

              <div className="mb-8 md:mb-12">
                <HeroSlider />
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-8 mb-8 md:mb-12">
                <motion.div whileHover={{ y: -5 }} className="card-clean p-8 border-t-4 border-t-royal-red">
                  <div className="w-12 h-12 bg-royal-red text-white rounded-xl flex items-center justify-center mb-6 shadow-md"><Users size={24} /></div>
                  <p className="text-stone-400 font-bold mb-1">إجمالي الطلاب</p>
                  <h3 className="text-4xl font-bold text-stone-900">{stats.students}</h3>
                </motion.div>
                
                <motion.div whileHover={{ y: -5 }} className="card-clean p-8 border-t-4 border-t-gold">
                  <div className="w-12 h-12 bg-gold text-white rounded-xl flex items-center justify-center mb-6 shadow-md"><Calendar size={24} /></div>
                  <p className="text-stone-400 font-bold mb-1">الحضور اليوم</p>
                  <h3 className="text-4xl font-bold text-stone-900">{stats.attendanceToday}</h3>
                </motion.div>
                
                <motion.div whileHover={{ y: -5 }} className="card-clean p-8 border-t-4 border-t-royal-red">
                  <div className="w-12 h-12 bg-royal-red text-white rounded-xl flex items-center justify-center mb-6 shadow-md"><GraduationCap size={24} /></div>
                  <p className="text-stone-400 font-bold mb-1">إجمالي نقاط الطايو</p>
                  <h3 className="text-4xl font-bold text-stone-900 mb-4">{stats.totalTayo}</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="bg-stone-50 p-2 rounded-lg text-center"><span className="block text-stone-500 text-xs mb-1">حضور</span><span className="font-bold text-stone-700">{stats.tayoBreakdown.attendance}</span></div>
                    <div className="bg-stone-50 p-2 rounded-lg text-center"><span className="block text-stone-500 text-xs mb-1">سلوك</span><span className="font-bold text-stone-700">{stats.tayoBreakdown.behavior}</span></div>
                    <div className="bg-stone-50 p-2 rounded-lg text-center"><span className="block text-stone-500 text-xs mb-1">تفاعل</span><span className="font-bold text-stone-700">{stats.tayoBreakdown.interaction}</span></div>
                    <div className="bg-stone-50 p-2 rounded-lg text-center"><span className="block text-stone-500 text-xs mb-1">خدمة عملية</span><span className="font-bold text-stone-700">{stats.tayoBreakdown.practical}</span></div>
                  </div>
                </motion.div>
              </div>
            </div>
          )}
          {activeTab === 'slider' && <div className="p-8 bg-white rounded-3xl"><SliderManager /></div>}
          {activeTab === 'staff' && <div className="p-8 bg-white rounded-3xl"><StaffManager /></div>}
          {activeTab === 'students' && <div className="p-8 bg-white rounded-3xl"><StudentListNew isDashboard={true} /></div>}
          {activeTab === 'exams' && <div className="p-8 bg-white rounded-3xl"><MonthlyExamCenter user={null} /></div>}
          {activeTab === 'events' && <div className="p-8 bg-white rounded-3xl"><EventsManager /></div>}
          {activeTab === 'curricula' && <div className="p-8 bg-white rounded-3xl"><CurriculumManager /></div>}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

const AppContent = () => {
  const { user, loading, canAccess } = useAuth();
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState('hub');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBtn, setShowInstallBtn] = useState(false);

  useEffect(() => {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBtn(true);
    });

    window.addEventListener('appinstalled', () => {
      setShowInstallBtn(false);
      setDeferredPrompt(null);
    });

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowInstallBtn(false);
    }
    setDeferredPrompt(null);
  };

  useEffect(() => {
    // If user is logged in and tries to access login, redirect to hub
    if (user && activeTab === 'login') {
      setActiveTab('hub');
      return;
    }
    // If user is logged in and cannot access the current tab, redirect
    if (user && !canAccess(activeTab)) {
      setActiveTab('hub');
      addToast('عذراً، ليس لديك صلاحية الوصول لهذه الصفحة.', 'error');
    }
    // If user is NOT logged in and tries to access any tab other than login, redirect to login
    else if (!user && activeTab !== 'login') {
      setActiveTab('login');
    }
  }, [user, activeTab, canAccess, addToast]);

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white">
      <img src={logo} alt="Baraem Logo" className="w-32 h-32 mb-8 animate-pulse" referrerPolicy="no-referrer" />
      <div className="w-12 h-12 border-4 border-stone-200 border-t-[#8B0000] rounded-full animate-spin" />
      <p className="mt-8 text-[#8B0000] font-bold text-lg text-center px-4">
        جاري تحميل خدمة البراعم... يرجى التأكد من اتصال الإنترنت
      </p>
    </div>
  );

  if (!user && activeTab === 'login') {
    return <AuthScreen setActiveTab={setActiveTab} />;
  }

  if (!user && !['hub', 'staff'].includes(activeTab)) {
    return <AuthScreen setActiveTab={setActiveTab} />;
  }

  return (
    <div className="min-h-screen bg-off-white dark:bg-dark-bg flex overflow-x-hidden transition-colors duration-300">
      <ViewOnlyBadge />
      
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white dark:bg-dark-surface border-b border-stone-100 dark:border-dark-border flex items-center justify-between px-6 z-30">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 hover:bg-stone-50 dark:hover:bg-dark-bg rounded-xl text-royal-red dark:text-gold transition-colors"
          >
            <Menu size={24} />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <img src={logo} alt="Logo" className="h-8 w-auto" referrerPolicy="no-referrer" />
          <span className="font-bold text-royal-red">براعم</span>
        </div>
        {user && (
          <div className="w-10 h-10 bg-gold text-white rounded-full flex items-center justify-center font-bold text-xs shadow-sm">
            {user.displayName?.[0]}
          </div>
        )}
      </div>

      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        isOpen={isSidebarOpen} 
        setIsOpen={setIsSidebarOpen} 
      />

      <main className={`flex-1 transition-all duration-300 ${isSidebarOpen ? 'lg:mr-72' : 'lg:mr-72'} pt-16 lg:pt-0`}>
        {showInstallBtn && (
          <div className="bg-gold/10 border-b border-gold/20 p-3 flex items-center justify-between px-8">
            <p className="text-xs font-bold text-stone-700">تثبيت تطبيق البراعم على جهازك لتجربة أفضل</p>
            <button 
              onClick={handleInstall}
              className="bg-gold text-white px-4 py-1.5 rounded-full text-xs font-bold shadow-sm hover:bg-gold/90 transition-colors"
            >
              تثبيت الآن
            </button>
          </div>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.2 }}
            className="pb-20 lg:pb-0"
          >
            {activeTab === 'hub' && <MainHub setActiveTab={setActiveTab} />}
            {activeTab === 'dashboard' && <DashboardNew setActiveTab={setActiveTab} />}
            {activeTab === 'reports' && <ReportsInbox />}
            {activeTab === 'students' && <StudentListNew />}
            {activeTab === 'attendance' && <AttendanceTracker />}
            {activeTab === 'tayo' && <TayoScoring />}
            {activeTab === 'practical' && <PracticalService />}
            {activeTab === 'acceptance' && <AcceptanceEvaluation />}
            {activeTab === 'exam_center' && <MonthlyExamCenter user={user} />}
            {activeTab === 'staff' && <StaffPage />}
            {activeTab === 'events' && <EventsPage />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [firebaseReady, setFirebaseReady] = useState(false);

  useEffect(() => {
    document.documentElement.style.setProperty('--logo-url', `url(${logo})`);
    
    // Listen for Firebase Auth state changes
    const unsubscribe = auth.onAuthStateChanged((u) => {
      setFirebaseReady(true);
    });
    
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      const savedUser = localStorage.getItem('baraem_user');
      if (savedUser && firebaseReady) {
        const parsedUser = JSON.parse(savedUser);
        
        // Ensure we are signed in to Firebase if we have a local user
        let currentUser = auth.currentUser;
        if (!currentUser) {
          try {
            const cred = await signInAnonymously(auth);
            currentUser = cred.user;
          } catch (authError) {
            console.warn("Initial anonymous auth failed:", authError);
          }
        }

        if (currentUser) {
          // Sync to Firestore
          const userRef = doc(db, 'users', currentUser.uid);
          try {
            await setDoc(userRef, {
              uid: currentUser.uid,
              displayName: parsedUser.displayName,
              email: currentUser.email || `${parsedUser.id}@baraem.local`,
              role: parsedUser.role,
              createdAt: new Date().toISOString()
            }, { merge: true });
            
            // Update local user with Firebase UID if it changed
            if (parsedUser.id !== currentUser.uid) {
              const updatedUser = { ...parsedUser, id: currentUser.uid };
              setUser(updatedUser);
              localStorage.setItem('baraem_user', JSON.stringify(updatedUser));
            } else {
              setUser(parsedUser);
            }
          } catch (err: any) {
            console.error("Initial sync failed:", err);
            if (err.message?.includes('offline') || err.message?.includes('Failed to fetch') || err.name === 'FirebaseError') {
              console.warn("Firebase request blocked. Please disable adblockers (e.g., Brave Shields, uBlock Origin) if you experience issues.");
            }
            setUser(parsedUser);
          }
        } else {
          setUser(parsedUser);
        }
      }
      setLoading(false);
    };

    if (firebaseReady) {
      initAuth();
    }
  }, [firebaseReady]);

  const login = async (username: string, password: string) => {
    let profile: UserProfile | null = null;
    
    if (username === 'guest') {
      profile = { id: 'guest', username: 'زائر', displayName: 'زائر', role: 'guest' };
    } else if (username === 'المنسق' && password === 'AA_2026') {
      profile = { id: 'admin', username: 'المنسق', displayName: 'المنسق', role: 'admin' };
    } else if (username === 'الحضور' && password === 'MM_2026') {
      profile = { id: 'attendance', username: 'الحضور', displayName: 'الحضور', role: 'attendance' };
    } else if (username === 'الطايو' && password === 'TT_2026') {
      profile = { id: 'tayo', username: 'الطايو', displayName: 'الطايو', role: 'tayo' };
    }

    if (profile) {
      try {
        // Ensure we are signed in to Firebase
        let currentUser = auth.currentUser;
        if (!currentUser) {
          try {
            const cred = await signInAnonymously(auth);
            currentUser = cred.user;
          } catch (authError) {
            console.warn("Anonymous auth failed, proceeding without Firebase UID:", authError);
            // If anonymous auth is disabled, we can't sync to Firestore securely
            // but we should still allow the user to log in locally
          }
        }
        
        if (currentUser) {
          // Sync role to Firestore so security rules can see it
          const userRef = doc(db, 'users', currentUser.uid);
          await setDoc(userRef, {
            uid: currentUser.uid,
            displayName: profile.displayName,
            email: currentUser.email || `${profile.id}@baraem.local`,
            role: profile.role,
            createdAt: new Date().toISOString()
          }, { merge: true });
          
          // Update profile with Firebase UID
          const updatedProfile = { ...profile, id: currentUser.uid };
          setUser(updatedProfile);
          localStorage.setItem('baraem_user', JSON.stringify(updatedProfile));
          return true;
        }
      } catch (error) {
        console.error("Login sync failed:", error);
        // Fallback to local only if Firestore fails (though rules will still fail)
        setUser(profile);
        localStorage.setItem('baraem_user', JSON.stringify(profile));
        return true;
      }
    }
    return false;
  };

  const logout = async () => {
    localStorage.removeItem('baraem_user');
    setUser(null);
  };

  const canAccess = useCallback((tab: string) => {
    // Always allowed
    if (['hub', 'staff', 'login'].includes(tab)) return true;
    
    // Admin allowed everywhere
    if (user?.role === 'admin') return true;

    // Guest restrictions
    if (user?.role === 'guest') {
      if (['attendance', 'tayo', 'practical'].includes(tab)) return false;
    }

    // Role-based restrictions
    if (user?.role === 'attendance') {
      if (['tayo'].includes(tab)) return false;
    }
    if (user?.role === 'tayo') {
      if (['attendance'].includes(tab)) return false;
    }
    if (user?.role === 'practical') {
      if (['attendance'].includes(tab)) return false;
    }

    // General restricted tabs for non-admins
    const restrictedTabs = ['dashboard', 'reports', 'staff_manager', 'events_manager', 'resource-mgmt', 'curriculum-mgmt', 'slider-mgmt', 'acceptance'];
    if (restrictedTabs.includes(tab) && user?.role !== 'coordinator') return false;
    
    return true;
  }, [user]);

  const authValue = {
    user,
    loading,
    login,
    logout,
    canAccess,
  };

  if (loading || !firebaseReady) return <div className="min-h-screen flex items-center justify-center text-royal-red font-bold animate-pulse">جاري التحميل...</div>;

  return (
    <ErrorBoundary>
      <ToastProvider>
        <ConfirmProvider>
          <AuthContext.Provider value={authValue}>
            <AppContent />
          </AuthContext.Provider>
        </ConfirmProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}
