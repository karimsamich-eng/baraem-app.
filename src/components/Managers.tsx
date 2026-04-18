import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Save, Plus, Trash2, Edit2, Upload, Eye, X, Star, Calendar, Clock, Search, RotateCw, Crop as CropIcon, Image as ImageIcon, ShieldAlert, Users, Lock, Key } from 'lucide-react';
import { db, handleFirestoreError, OperationType, storage, ref, uploadBytes, getDownloadURL, deleteObject, uploadString } from '../firebase';
import { collection, doc, setDoc, deleteDoc, onSnapshot, query, orderBy, getDoc } from 'firebase/firestore';
import { Curriculum, SliderImage, StaffMember, Event, Settings, SecuritySettings, SystemAccount } from '../types';
import { useAuth, useToast, useConfirm, useBranding } from '../contexts';
import { fileToBase64 } from '../utils';
import ReactCrop, { centerCrop, makeAspectCrop, Crop, PixelCrop, convertToPixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';


// --- Slider Manager ---
export const SliderManager = () => {
  const { user } = useAuth();
  const { addToast } = useToast();
  const { confirm } = useConfirm();
  const [images, setImages] = useState<SliderImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [editingImage, setEditingImage] = useState<SliderImage | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'slider_images'), (snapshot) => {
      setImages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SliderImage)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'slider_images');
    });
    return () => unsubscribe();
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const base64 = await fileToBase64(file);
        setPreview(base64);
      } catch (error) {
        console.error('Error processing file:', error);
      }
    }
  };

  const handleAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!preview) return;
    
    setUploading(true);
    const form = e.currentTarget;
    const formData = new FormData(form);
    const caption = formData.get('caption') as string;

    const savePromise = (async () => {
      const docRef = doc(collection(db, 'slider_images'));
      let imageUrl = preview;
      
      // Upload to storage if it's a new image
      if (preview && preview.startsWith('data:image')) {
        const response = await fetch(preview);
        const blob = await response.blob();
        const storageRef = ref(storage, `slider/${docRef.id}`);
        await uploadBytes(storageRef, blob);
        imageUrl = await getDownloadURL(storageRef);
      }

      await setDoc(docRef, {
        imageUrl,
        caption,
        createdAt: new Date().toISOString(),
        createdBy: user?.username || ''
      });
    })();
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 5000));
    
    try {
      await Promise.race([savePromise, timeoutPromise]);
      form.reset();
      setPreview(null);
      addToast('تم إضافة الصورة بنجاح', 'success');
    } catch (error: any) {
      handleFirestoreError(error, OperationType.CREATE, 'slider_images');
      alert(`فشل إضافة الصورة: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string, imageUrl?: string) => {
    confirm({
      title: 'حذف صورة',
      message: 'هل أنت متأكد من حذف هذه الصورة؟ لا يمكن التراجع عن هذا الإجراء.',
      onConfirm: async () => {
        setIsDeleting(id);
        try {
          // Delete from Storage if it's a storage URL
          if (imageUrl && imageUrl.includes('firebasestorage.googleapis.com')) {
            try {
              const storageRef = ref(storage, imageUrl);
              await deleteObject(storageRef);
            } catch (e) {
              console.warn('Storage deletion failed or file not found:', e);
            }
          }
          await deleteDoc(doc(db, 'slider_images', id));
          addToast('تم حذف الصورة بنجاح', 'success');
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, 'slider_images');
          addToast('فشل حذف الصورة', 'error');
        } finally {
          setIsDeleting(null);
        }
      }
    });
  };

  const handleUpdateImage = async (id: string, newBase64: string) => {
    try {
      console.log('Direct gallery image update started:', id);
      const storageRef = ref(storage, `slider/${id}`);
      await uploadString(storageRef, newBase64, 'data_url', {
        contentType: 'image/jpeg'
      });
      const imageUrl = await getDownloadURL(storageRef);
      
      await setDoc(doc(db, 'slider_images', id), { imageUrl }, { merge: true });
      addToast('تم تحديث الصورة بنجاح', 'success');
      setEditingImage(null);
    } catch (error) {
      console.error('Update image failed:', error);
      addToast('فشل تحديث الصورة', 'error');
    }
  };

  if (loading) return <div className="p-12 animate-pulse text-[#800000] font-bold">جاري تحميل الصور...</div>;

  return (
    <div className="p-12 max-w-6xl mx-auto">
      <header className="mb-12">
        <h1 className="text-4xl font-bold text-[#800000] mb-2">إدارة الصور</h1>
        <p className="text-stone-500 italic">إدارة صور شريط العرض في الصفحة الرئيسية</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div className="lg:col-span-1">
          <div className="interactive-card card-clean p-8 sticky top-8">
            <h3 className="text-xl font-bold text-[#800000] mb-6">إضافة صورة جديدة</h3>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#333333] uppercase tracking-wider">صورة العرض</label>
                <div className="relative h-40 bg-stone-50 rounded-2xl border-2 border-dashed border-stone-200 flex items-center justify-center overflow-hidden group">
                  {preview ? (
                    <img src={preview} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-center">
                      <Upload className="mx-auto text-stone-300 mb-2" size={32} />
                      <p className="text-[10px] text-stone-400">اختر ملف صورة</p>
                    </div>
                  )}
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleFileChange} 
                    disabled={uploading}
                    className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed" 
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#333333] uppercase tracking-wider">عنوان (اختياري)</label>
                <input 
                  name="caption" 
                  className="input-clean" 
                  placeholder="أدخل عنواناً للصورة" 
                  disabled={uploading}
                />
              </div>
              <button 
                type="submit" 
                disabled={uploading || !preview}
                className="w-full btn-primary flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {uploading ? (
                  <>
                    <RotateCw className="w-5 h-5 animate-spin" />
                    جاري الحفظ...
                  </>
                ) : (
                  <>
                    <Plus size={18} />
                    إضافة للمعرض
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {images.map(img => (
              <div key={img.id} className="interactive-card card-clean overflow-hidden group relative">
                <div className="relative h-48">
                  <img src={img.imageUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  
                  {/* Floating Icons for Coordinator */}
                  { (user?.role === 'coordinator' || user?.role === 'admin') && (
                    <div className="absolute top-3 left-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                      <button 
                        onClick={() => setEditingImage(img)}
                        className="w-10 h-10 bg-black/60 backdrop-blur-md rounded-full flex items-center justify-center text-[#FFD700] hover:bg-black/80 transition-all"
                        title="تعديل الصورة"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button 
                        onClick={() => handleDelete(img.id, img.imageUrl)}
                        className="w-10 h-10 bg-black/60 backdrop-blur-md rounded-full flex items-center justify-center text-red-400 hover:bg-black/80 transition-all"
                        title="حذف الصورة"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  )}

                  {isDeleting === img.id && (
                    <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] flex items-center justify-center z-20">
                      <div className="w-8 h-8 border-4 border-[#800000]/30 border-t-[#800000] rounded-full animate-spin" />
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <p className="font-bold text-stone-900 truncate">{img.caption || 'بدون عنوان'}</p>
                  <p className="text-[10px] text-stone-400 mt-1">أضيفت في: {new Date(img.createdAt).toLocaleDateString('ar-EG')}</p>
                </div>
              </div>
            ))}
            {images.length === 0 && (
              <div className="col-span-2 py-20 text-center text-stone-400 italic bg-white rounded-3xl border-2 border-dashed border-stone-100">
                لا توجد صور حالياً
              </div>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {editingImage && (
          <LogoEditorModal 
            isOpen={!!editingImage}
            initialImage={editingImage.imageUrl}
            onSave={async (newImg) => handleUpdateImage(editingImage.id, newImg)}
            onClose={() => setEditingImage(null)}
            title="تعديل صورة السلايدر"
          />
        )}
      </AnimatePresence>
    </div>
  );
};
// --- Settings Manager (Logo CMS) ---
export const SettingsManager = () => {
  const { user } = useAuth();
  const { addToast } = useToast();
  const { confirm } = useConfirm();
  const { refreshLogo } = useBranding();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'identity' | 'security'>('identity');

  // Security State
  const [securitySettings, setSecuritySettings] = useState<SecuritySettings | null>(null);
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [newUser, setNewUser] = useState<Partial<SystemAccount>>({ username: '', password: '', role: 'guest', displayName: '' });
  const [editingUser, setEditingUser] = useState<Partial<SystemAccount>>({ username: '', password: '', role: 'guest', displayName: '' });
  const [masterPasswordInput, setMasterPasswordInput] = useState('');

  useEffect(() => {
    // Load both site settings and security settings
    const unsubSite = onSnapshot(doc(db, 'settings', 'site_settings'), (doc) => {
      if (doc.exists()) {
        setSettings({ id: doc.id, ...doc.data() } as Settings);
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'site_settings');
    });

    const unsubSecurity = onSnapshot(doc(db, 'settings', 'security'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as SecuritySettings;
        setSecuritySettings(data);
        if (data.masterPassword) {
          setMasterPasswordInput(data.masterPassword);
        }
      } else {
        // Explicit default creation if doesn't exist
        const defaultAccounts: SystemAccount[] = [
          { id: 'admin', username: 'المنسق', password: 'AA_2026', displayName: 'المنسق', role: 'admin' },
          { id: 'attendance', username: 'الحضور', password: 'MM_2026', displayName: 'الحضور', role: 'attendance' },
          { id: 'tayo', username: 'الطايو', password: 'TT_2026', displayName: 'الطايو', role: 'tayo' }
        ];
        // Don't set state indefinitely, wait for onSnapshot to trigger after we manually set it if needed
        // We shouldn't automatically write to DB in onSnapshot to prevent loops. Just set memory default.
        setSecuritySettings({ accounts: defaultAccounts, masterPassword: 'AA_2026', updatedAt: new Date().toISOString(), updatedBy: 'system' });
        setMasterPasswordInput('AA_2026');
      }
    }, (error) => {
      console.error("Failed to load security settings:", error);
    });

    return () => {
      unsubSite();
      unsubSecurity();
    }
  }, []);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const base64 = await fileToBase64(file);
      setSelectedImage(base64);
      setIsEditorOpen(true);
    }
  };

  const handleExternalUrlSave = async (url: string) => {
    if (!url.trim()) return;
    setLoading(true);
    const savePromise = (async () => {
      await setDoc(doc(db, 'settings', 'site_settings'), {
        logoUrl: url.trim(),
        updatedAt: new Date().toISOString(),
        updatedBy: user?.username || ''
      });
      refreshLogo();
    })();
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 5000));
    
    try {
      await Promise.race([savePromise, timeoutPromise]);
      addToast('تم تحديث الشعار بنجاح', 'success');
    } catch (error: any) {
      console.error("External URL save failed:", error);
      alert(`فشل تحديث الشعار: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAnthemPptxSave = async (url: string) => {
    if (!url.trim()) return;
    setLoading(true);
    try {
      await setDoc(doc(db, 'settings', 'site_settings'), {
        anthemPptxUrl: url.trim(),
        updatedAt: new Date().toISOString(),
        updatedBy: user?.username || ''
      }, { merge: true });
      addToast('تم تحديث رابط ملف الشعار بنجاح', 'success');
    } catch (error) {
      console.error("Anthem PPTX URL save failed:", error);
      addToast('فشل تحديث رابط ملف الشعار', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveLogo = async (processedImage: string) => {
    console.log("1. handleSaveLogo START - Image length:", processedImage.length);
    const timeout = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('TIMEOUT')), 15000)
    );

    try {
      console.log("2. Converting base64 to blob...");
      const res = await fetch(processedImage);
      const blob = await res.blob();
      console.log("3. Blob created - Size:", blob.size);
      
      // Upload to storage with timeout
      const storageRef = ref(storage, 'branding/logo.png');
      
      console.log("4. Firebase Storage Upload START...");
      try {
        await Promise.race([
          uploadBytes(storageRef, blob),
          timeout
        ]);
        console.log("5. Firebase Storage Upload SUCCESS");
        
        console.log("6. Getting download URL...");
        const downloadUrl = await getDownloadURL(storageRef);
        console.log("7. Download URL obtained:", downloadUrl);

        console.log("8. Saving URL to Firestore site_settings...");
        await setDoc(doc(db, 'settings', 'site_settings'), {
          logoUrl: downloadUrl,
          updatedAt: new Date().toISOString(),
          updatedBy: user?.username || '',
          storageMethod: 'firebase_storage'
        });
      } catch (storageError: any) {
        console.error("!!! FIREBASE STORAGE FAILED - FALLING BACK TO BASE64 !!!", storageError);
        alert(`Storage Error: ${storageError.message || 'Unknown'}. Switching to Base64 fallback...`);
        
        console.log("9. Saving BASE64 directly to Firestore...");
        // Firestore has a 1MB limit. A typical cropped logo should be well under that.
        await setDoc(doc(db, 'settings', 'site_settings'), {
          logoUrl: processedImage, // Save the actual base64 string
          updatedAt: new Date().toISOString(),
          updatedBy: user?.username || '',
          storageMethod: 'base64_fallback'
        });
      }
      
      console.log("10. handleSaveLogo SUCCESS - Refreshing UI");
      refreshLogo(); 
      addToast('تم تحديث الشعار بنجاح', 'success');
      setIsEditorOpen(false);
      setSelectedImage(null);
    } catch (error: any) {
      console.error("CRITICAL: Logo save failed completely:", error);
      const errorMsg = error.message === 'TIMEOUT' 
        ? 'انتهت مهلة الرفع (15 ثانية). يرجى التحقق من اتصالك بالإنترنت.' 
        : `فشل تحديث الشعار: ${error.message || 'خطأ غير معروف'}`;
      
      alert(`CRITICAL ERROR: ${errorMsg}`);
      addToast(errorMsg, 'error');
      throw error;
    }
  };

  const handleUpdateSecurity = async (updates: Partial<SecuritySettings>) => {
    try {
      const current = securitySettings || { accounts: [], masterPassword: 'AA_2026' };
      const merged = { ...current, ...updates, updatedAt: new Date().toISOString(), updatedBy: user?.username || '' };
      await setDoc(doc(db, 'settings', 'security'), merged);
      addToast('تم حفظ إعدادات الأمان بنجاح', 'success');
    } catch(err: any) {
      console.error(err);
      addToast('فشل التحديث: ' + err.message, 'error');
    }
  };

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.username || !newUser.password || !newUser.displayName) {
      addToast('يرجى ملء جميع البيانات', 'error');
      return;
    }
    const accounts = [...(securitySettings?.accounts || [])];
    if (accounts.some(a => a.username === newUser.username)) {
      addToast('اسم المستخدم موجود مسبقاً', 'error');
      return;
    }
    accounts.push({
      id: Date.now().toString(),
      username: newUser.username!,
      password: newUser.password!,
      displayName: newUser.displayName!,
      role: newUser.role as any
    });
    handleUpdateSecurity({ accounts });
    setIsAddingUser(false);
    setNewUser({ username: '', password: '', role: 'guest', displayName: '' });
  };

  const handleDeleteUser = (accountId: string) => {
    confirm({
      title: 'حذف مستخدم',
      message: 'هل أنت متأكد من حذف هذا المستخدم؟',
      onConfirm: () => {
        const accounts = (securitySettings?.accounts || []).filter(a => a.id !== accountId);
        handleUpdateSecurity({ accounts });
      }
    });
  };

  const handleStartEditUser = (account: SystemAccount) => {
    setEditingUserId(account.id);
    setEditingUser({ ...account });
  };

  const handleSaveEditUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser.username || !editingUser.password || !editingUser.displayName) {
      addToast('يرجى ملء جميع البيانات', 'error');
      return;
    }
    const accounts = [...(securitySettings?.accounts || [])];
    const index = accounts.findIndex(a => a.id === editingUserId);
    if (index !== -1) {
      // Check if username changed and belongs to someone else
      if (accounts.some(a => a.username === editingUser.username && a.id !== editingUserId)) {
        addToast('اسم المستخدم موجود مسبقاً', 'error');
        return;
      }
      accounts[index] = { ...accounts[index], ...editingUser } as SystemAccount;
      handleUpdateSecurity({ accounts });
    }
    setEditingUserId(null);
  };


  const handleUpdateMasterPassword = () => {
    if (!masterPasswordInput || masterPasswordInput.length < 4) {
      addToast('يجب أن تتكون كلمة المرور من 4 أحرف على الأقل', 'error');
      return;
    }
    handleUpdateSecurity({ masterPassword: masterPasswordInput });
  };

  const handleDeleteLogo = () => {
    confirm({
      title: 'حذف الشعار',
      message: 'هل أنت متأكد من حذف الشعار الحالي؟ سيتم استخدام الشعار الافتراضي.',
      onConfirm: async () => {
        setLoading(true);
        try {
          // Delete from storage if it exists
          if (settings?.logoUrl) {
            const storageRef = ref(storage, 'branding/logo.png');
            try {
              await deleteObject(storageRef);
            } catch (e) {
              console.warn("Storage object not found or already deleted");
            }
          }
          await deleteDoc(doc(db, 'settings', 'site_settings'));
          refreshLogo();
          addToast('تم حذف الشعار بنجاح', 'success');
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, 'settings');
          addToast('فشل حذف الشعار', 'error');
        } finally {
          setLoading(false);
        }
      }
    });
  };

  if (loading) return <div className="p-12 animate-pulse text-[#800000] font-bold">جاري تحميل الإعدادات...</div>;

  return (
    <div className="p-12 max-w-4xl mx-auto">
      <header className="mb-8">
        <h1 className="text-4xl font-bold text-[#800000] mb-2">إعدادات النظام</h1>
        <p className="text-stone-500">إدارة شعار الخدمة والخصوصية والأمان</p>
      </header>
      
      <div className="flex gap-4 mb-8">
        <button 
          onClick={() => setActiveTab('identity')}
          className={`flex-1 py-3 font-bold rounded-2xl flex items-center justify-center gap-2 transition-colors ${activeTab === 'identity' ? 'bg-[#800000] text-white shadow-md' : 'bg-white text-stone-500 hover:bg-stone-50'}`}
        >
          <ImageIcon size={20} /> الهوية المرجئية
        </button>
        <button 
          onClick={() => setActiveTab('security')}
          className={`flex-1 py-3 font-bold rounded-2xl flex items-center justify-center gap-2 transition-colors ${activeTab === 'security' ? 'bg-[#800000] text-white shadow-md' : 'bg-white text-stone-500 hover:bg-stone-50'}`}
        >
          <ShieldAlert size={20} /> الخصوصية والأمان
        </button>
      </div>

      {activeTab === 'identity' && (
        <motion.div initial={{opacity: 0}} animate={{opacity: 1}} className="bg-white rounded-3xl shadow-xl border border-stone-100 overflow-hidden">
          <div className="p-8">
            <h2 className="text-xl font-bold text-stone-800 mb-6 flex items-center gap-2">
              <ImageIcon size={24} className="text-[#800000]" />
              شعار الخدمة
            </h2>

          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="w-48 h-48 bg-stone-50 rounded-full border-2 border-dashed border-stone-200 flex items-center justify-center overflow-hidden relative group">
              {settings?.logoUrl ? (
                <>
                  <img 
                    src={settings.logoUrl} 
                    alt="" 
                    className="w-full h-full object-contain rounded-full bg-transparent" 
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button 
                      onClick={handleDeleteLogo}
                      className="p-2 bg-white text-red-600 rounded-full hover:bg-red-50 transition-colors"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-center p-4">
                  <ImageIcon size={48} className="mx-auto text-stone-300 mb-2" />
                  <p className="text-xs text-stone-400 font-bold">لا يوجد شعار مخصص</p>
                </div>
              )}
            </div>

            <div className="flex-1 space-y-6">
              <p className="text-sm text-stone-600 leading-relaxed">
                هذا الشعار سيظهر في الهيدر، صفحة تسجيل الدخول، والتقارير المطبوعة. يفضل استخدام صورة بخلفية شفافة (PNG) وبأبعاد مربعة.
              </p>
              
              <div className="space-y-4">
                <div className="flex gap-4">
                  <label className={`btn-primary flex items-center gap-2 cursor-pointer ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    {loading ? <RotateCw className="w-5 h-5 animate-spin" /> : <Upload size={18} />}
                    <span>{settings?.logoUrl ? 'تغيير الشعار' : 'رفع شعار جديد'}</span>
                    <input type="file" accept="image/*" onChange={handleFileSelect} className="hidden" disabled={loading} />
                  </label>
                  {settings?.logoUrl && (
                    <button 
                      onClick={handleDeleteLogo}
                      disabled={loading}
                      className="px-6 py-2.5 rounded-xl font-bold text-red-600 hover:bg-red-50 transition-colors border border-red-100 disabled:opacity-50"
                    >
                      {loading ? 'جاري الحذف...' : 'حذف الحالي'}
                    </button>
                  )}
                </div>

                <div className="pt-4 border-t border-stone-100">
                  <label className="block text-sm font-bold text-[#333333] mb-2">رابط شعار خارجي (حل بديل)</label>
                  <div className="flex gap-2">
                    <input 
                      type="url" 
                      placeholder="https://example.com/logo.png"
                      className="flex-1 px-4 py-2 rounded-xl border border-stone-200 text-sm focus:ring-2 focus:ring-[#800000] outline-none disabled:bg-stone-50"
                      disabled={loading}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleExternalUrlSave((e.target as HTMLInputElement).value);
                        }
                      }}
                    />
                    <button 
                      onClick={(e) => {
                        const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                        handleExternalUrlSave(input.value);
                      }}
                      disabled={loading}
                      className="px-4 py-2 bg-stone-800 text-white rounded-xl text-sm font-bold hover:bg-stone-900 transition-colors disabled:opacity-50"
                    >
                      {loading ? <RotateCw className="w-4 h-4 animate-spin" /> : 'حفظ الرابط'}
                    </button>
                  </div>
                </div>

                <div className="pt-4 border-t border-stone-100">
                  <label className="block text-sm font-bold text-[#333333] mb-2">رابط ملف الشعار (PPTX)</label>
                  <div className="flex gap-2">
                    <input 
                      type="url" 
                      defaultValue={settings?.anthemPptxUrl}
                      placeholder="https://example.com/anthem.pptx"
                      className="flex-1 px-4 py-2 rounded-xl border border-stone-200 text-sm focus:ring-2 focus:ring-[#800000] outline-none disabled:bg-stone-50"
                      disabled={loading}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleAnthemPptxSave((e.target as HTMLInputElement).value);
                        }
                      }}
                    />
                    <button 
                      onClick={(e) => {
                        const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                        handleAnthemPptxSave(input.value);
                      }}
                      disabled={loading}
                      className="px-4 py-2 bg-[#800000] text-white rounded-xl text-sm font-bold hover:bg-[#FFD700] hover:text-[#800000] transition-colors disabled:opacity-50"
                    >
                      {loading ? <RotateCw className="w-4 h-4 animate-spin" /> : 'حفظ الرابط'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          </div>
        </motion.div>
      )}

      {activeTab === 'security' && (
        <motion.div initial={{opacity: 0}} animate={{opacity: 1}} className="space-y-8">
          <div className="bg-white rounded-3xl shadow-xl border border-stone-100 overflow-hidden">
            <div className="p-8">
              <h2 className="text-xl font-bold text-stone-800 mb-6 flex items-center gap-2 border-b pb-4">
                <Lock size={24} className="text-[#800000]" />
                كلمة مرور الترقية وبدء عام جديد
              </h2>
              <div className="flex gap-4 items-center">
                <div className="flex-1">
                  <label className="text-xs font-bold text-stone-500 uppercase tracking-wide">كلمة السر</label>
                  <input type="text" value={masterPasswordInput} onChange={(e) => setMasterPasswordInput(e.target.value)} className="w-full input-clean mt-1 bg-stone-50" placeholder="أدخل كلمة المرور المشفرة" />
                </div>
                <button onClick={handleUpdateMasterPassword} className="btn-primary mt-5 px-8">حفظ</button>
              </div>
              <p className="text-xs text-stone-400 mt-3 flex items-center gap-1">
                <ShieldAlert size={14} /> سيتم طلب كلمة المرور هذه عند ترقية الطلاب لعام جديد.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-3xl shadow-xl border border-stone-100 overflow-hidden">
            <div className="p-8 flex items-center justify-between border-b border-stone-100 bg-stone-50/50">
              <h2 className="text-xl font-bold text-stone-800 flex items-center gap-2">
                <Users size={24} className="text-[#800000]" />
                إدارة المستخدمين والصلاحيات
              </h2>
              <button onClick={() => setIsAddingUser(true)} className="btn-primary flex items-center gap-2 text-sm">
                <Plus size={16} /> إضافة مستخدم
              </button>
            </div>
            <div className="p-8">
              {isAddingUser && (
                <div className="mb-6 p-6 bg-stone-50 rounded-2xl border border-stone-200">
                  <h3 className="font-bold text-[#800000] mb-4">تفاصيل المستخدم الجديد</h3>
                  <form onSubmit={handleAddUser} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-stone-500 uppercase">اسم المستخدم الفريد (الدخول)</label>
                      <input type="text" value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value})} required className="w-full input-clean mt-1" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-stone-500 uppercase">كلمة المرور</label>
                      <input type="text" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} required className="w-full input-clean mt-1" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-stone-500 uppercase">الاسم المعروض</label>
                      <input type="text" value={newUser.displayName} onChange={e => setNewUser({...newUser, displayName: e.target.value})} required className="w-full input-clean mt-1" placeholder="مثال: المنسق" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-stone-500 uppercase">الصلاحية</label>
                      <select value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value as any})} required className="w-full input-clean mt-1">
                        <option value="admin">منسق / Admin</option>
                        <option value="attendance">خادم الحضور</option>
                        <option value="tayo">خادم الطايو</option>
                        <option value="practical">خادم العملي</option>
                        <option value="servant">خادم</option>
                      </select>
                    </div>
                    <div className="md:col-span-2 flex gap-2 justify-end mt-2">
                      <button type="button" onClick={() => setIsAddingUser(false)} className="px-6 py-2 rounded-xl text-stone-500 hover:bg-stone-200 font-bold transition-all">إلغاء</button>
                      <button type="submit" className="btn-primary">حفظ المستخدم</button>
                    </div>
                  </form>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(securitySettings?.accounts || []).map(account => (
                  <div key={account.id} className="relative flex flex-col p-4 border border-stone-200 rounded-2xl hover:border-maroon/30 transition-all group overflow-hidden">
                    {editingUserId === account.id ? (
                      <form onSubmit={handleSaveEditUser} className="space-y-3 z-10 w-full relative bg-white">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] font-bold text-stone-500 uppercase">اسم المستخدم</label>
                            <input type="text" value={editingUser.username} onChange={e => setEditingUser({...editingUser, username: e.target.value})} required className="w-full input-clean mt-1 font-mono text-sm py-1.5 px-2" />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-stone-500 uppercase">كلمة المرور</label>
                            <input type="text" value={editingUser.password} onChange={e => setEditingUser({...editingUser, password: e.target.value})} required className="w-full input-clean mt-1 font-mono text-sm py-1.5 px-2" />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-stone-500 uppercase">الاسم المعروض</label>
                            <input type="text" value={editingUser.displayName} onChange={e => setEditingUser({...editingUser, displayName: e.target.value})} required className="w-full input-clean mt-1 text-sm py-1.5 px-2" />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-stone-500 uppercase">الصلاحية</label>
                            <select value={editingUser.role} onChange={e => setEditingUser({...editingUser, role: e.target.value as any})} required className="w-full input-clean mt-1 text-sm py-1.5 px-2">
                              <option value="admin">منسق / Admin</option>
                              <option value="attendance">خادم الحضور</option>
                              <option value="tayo">خادم الطايو</option>
                              <option value="practical">خادم العملي</option>
                              <option value="servant">خادم</option>
                            </select>
                          </div>
                        </div>
                        <div className="flex gap-2 justify-end pt-2 border-t border-stone-100">
                          <button type="button" onClick={() => setEditingUserId(null)} className="px-3 py-1.5 rounded-lg text-xs font-bold text-stone-500 hover:bg-stone-100">إلغاء</button>
                          <button type="submit" className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#800000] text-white hover:bg-red-800 shadow-sm">حفظ</button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-10 h-10 rounded-full bg-gold/20 text-[#800000] flex items-center justify-center font-bold">
                              {account.displayName[0]}
                            </div>
                            <div>
                              <h4 className="font-bold text-[#333333]">{account.displayName}</h4>
                              <span className="text-[10px] bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full inline-block mt-0.5 uppercase tracking-wide">
                                {account.role}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => handleStartEditUser(account)}
                              className="p-1.5 text-stone-400 hover:text-[#800000] hover:bg-[#800000]/10 rounded-full transition-all drop-shadow-sm"
                              title="تعديل المستخدم"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button 
                              onClick={() => handleDeleteUser(account.id)}
                              className="p-1.5 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all drop-shadow-sm"
                              title="حذف المستخدم"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                        
                        <div className="mt-4 space-y-2 text-sm bg-stone-50 p-3 rounded-xl border border-stone-100">
                          <div className="flex items-center gap-2 text-stone-600">
                            <Users size={14} className="text-stone-400" />
                            <span className="font-mono">{account.username}</span>
                          </div>
                          <div className="flex items-center gap-2 text-stone-600">
                            <Key size={14} className="text-stone-400" />
                            <span className="font-mono truncate">{account.password || '******'}</span>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ))}
                {(!securitySettings?.accounts || securitySettings.accounts.length === 0) && (
                   <div className="col-span-2 text-center py-12 text-stone-400 bg-stone-50 rounded-2xl border-2 border-dashed border-stone-200">
                     لا يوجد مستخدمين مسجلين
                   </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      <AnimatePresence>
        {isEditorOpen && selectedImage && (
          <LogoEditorModal 
            isOpen={isEditorOpen}
            initialImage={selectedImage} 
            onSave={handleSaveLogo} 
            onClose={() => {
              setIsEditorOpen(false);
              setSelectedImage(null);
            }} 
            title="تعديل الشعار"
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// --- Anthem Manager ---
export const AnthemManager = () => {
  const [slides, setSlides] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const { user } = useAuth();
  const { addToast } = useToast();
  const { confirm } = useConfirm();

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'anthem_slides'), (snapshot) => {
      const s = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      s.sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
      setSlides(s);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'anthem_slides');
    });
    return () => unsubscribe();
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const base64 = await fileToBase64(file);
        setPreview(base64);
      } catch (error) {
        console.error('Error processing file:', error);
      }
    }
  };

  const handleAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!preview) return;
    
    setUploading(true);
    const form = e.currentTarget;
    const formData = new FormData(form);
    const order = parseInt(formData.get('order') as string) || 0;

    const savePromise = (async () => {
      const docRef = doc(collection(db, 'anthem_slides'));
      await setDoc(docRef, {
        imageUrl: preview,
        order,
        createdAt: new Date().toISOString(),
        createdBy: user?.username || ''
      });
    })();
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 5000));
    
    try {
      await Promise.race([savePromise, timeoutPromise]);
      form.reset();
      setPreview(null);
      addToast('تم إضافة الشريحة بنجاح', 'success');
    } catch (error: any) {
      handleFirestoreError(error, OperationType.CREATE, 'anthem_slides');
      alert(`فشل إضافة الشريحة: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    confirm({
      title: 'حذف شريحة',
      message: 'هل أنت متأكد من حذف هذه الشريحة؟ لا يمكن التراجع عن هذا الإجراء.',
      onConfirm: async () => {
        setIsDeleting(id);
        try {
          await deleteDoc(doc(db, 'anthem_slides', id));
          addToast('تم حذف الشريحة بنجاح', 'success');
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, 'anthem_slides');
          addToast('فشل حذف الشريحة', 'error');
        } finally {
          setIsDeleting(null);
        }
      }
    });
  };

  if (loading) return <div className="p-12 animate-pulse text-[#800000] font-bold">جاري تحميل الشرائح...</div>;

  return (
    <div className="p-12 max-w-6xl mx-auto">
      <header className="mb-12">
        <h1 className="text-4xl font-bold text-[#800000] mb-2">إدارة شعار الخدمة</h1>
        <p className="text-stone-500 italic">إدارة شرائح شعار خدمة البراعم</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div className="lg:col-span-1">
          <div className="interactive-card card-clean p-8 sticky top-8">
            <h3 className="text-xl font-bold text-[#800000] mb-6">إضافة شريحة جديدة</h3>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#333333] uppercase tracking-wider">صورة الشريحة</label>
                <div className="relative h-40 bg-stone-50 rounded-2xl border-2 border-dashed border-stone-200 flex items-center justify-center overflow-hidden group">
                  {preview ? (
                    <img src={preview} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-center">
                      <Upload className="mx-auto text-stone-300 mb-2" size={32} />
                      <p className="text-[10px] text-stone-400">اختر ملف صورة</p>
                    </div>
                  )}
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleFileChange} 
                    disabled={uploading}
                    className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed" 
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#333333] uppercase tracking-wider">الترتيب</label>
                <input 
                  name="order" 
                  type="number" 
                  className="input-clean" 
                  placeholder="أدخل رقم الترتيب" 
                  disabled={uploading}
                />
              </div>
              <button 
                type="submit" 
                disabled={uploading || !preview}
                className="w-full btn-primary flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {uploading ? (
                  <>
                    <RotateCw className="w-5 h-5 animate-spin" />
                    جاري الحفظ...
                  </>
                ) : (
                  <>
                    <Plus size={18} />
                    إضافة الشريحة
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {slides.map(slide => (
              <div key={slide.id} className="interactive-card card-clean overflow-hidden group">
                <div className="relative h-48">
                  <img src={slide.imageUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  <button 
                    onClick={() => handleDelete(slide.id)}
                    disabled={!!isDeleting}
                    className="absolute top-2 left-2 p-2 bg-white/90 text-red-600 rounded-full opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-700 transition-all shadow-lg disabled:opacity-50"
                  >
                    {isDeleting === slide.id ? <RotateCw className="w-4 h-4 animate-spin" /> : <Trash2 size={18} />}
                  </button>
                  <div className="absolute bottom-2 right-2 px-3 py-1 bg-black/60 text-white rounded-full text-xs font-bold">
                    ترتيب: {slide.order}
                  </div>
                </div>
              </div>
            ))}
            {slides.length === 0 && (
              <div className="col-span-2 py-20 text-center text-stone-400 italic bg-white rounded-3xl border-2 border-dashed border-stone-100">
                لا توجد شرائح حالياً
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
interface LogoEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (base64: string) => Promise<void>;
  initialImage?: string;
  title?: string;
  aspectRatio?: number;
  circular?: boolean;
}

export const LogoEditorModal = ({ 
  isOpen, 
  onClose, 
  onSave, 
  initialImage, 
  title = "تعديل الصورة", 
  aspectRatio = 1,
  circular = false
}: LogoEditorModalProps) => {
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [rotation, setRotation] = useState(0);
  const [aspect, setAspect] = useState<number | undefined>(aspectRatio);
  const [saving, setSaving] = useState(false);
  const [imgSrc, setImgSrc] = useState<string>(initialImage || '');
  const imgRef = useRef<HTMLImageElement>(null);

  const onSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setCrop(undefined);
      const reader = new FileReader();
      reader.addEventListener('load', () => setImgSrc(reader.result?.toString() || ''));
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    const initialCrop = centerCrop(
      makeAspectCrop(
        { unit: '%', width: 90 },
        aspect || 1,
        width,
        height
      ),
      width,
      height
    );
    setCrop(initialCrop);
    setCompletedCrop(convertToPixelCrop(initialCrop, width, height));
  };

  const getCroppedImg = useCallback(async () => {
    if (!imgRef.current || !completedCrop) return;

    const canvas = document.createElement('canvas');
    const scaleX = imgRef.current.naturalWidth / imgRef.current.width;
    const scaleY = imgRef.current.naturalHeight / imgRef.current.height;
    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    canvas.width = completedCrop.width;
    canvas.height = completedCrop.height;

    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.translate(-canvas.width / 2, -canvas.height / 2);

    ctx.drawImage(
      imgRef.current,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY,
      0,
      0,
      completedCrop.width,
      completedCrop.height
    );

    ctx.restore();

    return canvas.toDataURL('image/png');
  }, [completedCrop, rotation]);

  const handleConfirm = async () => {
    if (!imgSrc || !completedCrop || saving) return;
    setSaving(true);
    try {
      const croppedImg = await getCroppedImg();
      if (croppedImg) {
        await onSave(croppedImg);
      }
    } catch (error) {
      console.error("Error saving cropped image:", error);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-[2.5rem] w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
      >
        <div className="p-8 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
          <div>
            <h3 className="text-2xl font-serif font-bold text-[#800000]">{title}</h3>
            <p className="text-stone-500 text-sm mt-1">قم بقص الصورة وتعديلها بالشكل المناسب</p>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-white rounded-2xl text-stone-400 hover:text-[#800000] transition-all shadow-sm">
            <X size={24} />
          </button>
        </div>

        <div className="p-8 overflow-y-auto flex-1 custom-scrollbar">
          {!imgSrc ? (
            <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-stone-200 rounded-[2rem] bg-stone-50">
              <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center text-gold shadow-sm mb-6">
                <Upload size={40} />
              </div>
              <p className="text-stone-600 font-bold mb-2">لم يتم اختيار صورة</p>
              <p className="text-stone-400 text-sm mb-8">اختر صورة للبدء في التعديل</p>
              <label className="btn-royal cursor-pointer">
                <span>اختر صورة</span>
                <input type="file" className="hidden" accept="image/*" onChange={onSelectFile} />
              </label>
            </div>
          ) : (
            <div className="space-y-8">
              <div className="flex justify-center bg-stone-100 rounded-[2rem] p-8 min-h-[300px] items-center">
                <ReactCrop
                  crop={crop}
                  onChange={c => setCrop(c)}
                  onComplete={c => setCompletedCrop(c)}
                  aspect={aspect}
                  circularCrop={circular}
                  className="max-h-[500px]"
                >
                  <img
                    ref={imgRef}
                    alt="Crop me"
                    src={imgSrc}
                    style={{ transform: `rotate(${rotation}deg)`, maxWidth: '100%' }}
                    onLoad={onImageLoad}
                  />
                </ReactCrop>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <label className="text-sm font-bold text-stone-600 flex items-center gap-2">
                    <RotateCw size={16} className="text-gold" />
                    تدوير الصورة ({rotation}°)
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="360"
                    value={rotation}
                    onChange={(e) => setRotation(Number(e.target.value))}
                    className="w-full h-2 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-gold"
                  />
                </div>

                <div className="flex items-end gap-4">
                  <label className="btn-outline flex-1 cursor-pointer text-center">
                    <span>تغيير الصورة</span>
                    <input type="file" className="hidden" accept="image/*" onChange={onSelectFile} />
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-8 bg-stone-50/50 border-t border-stone-100 flex gap-4">
          <button 
            onClick={handleConfirm}
            disabled={!imgSrc || !completedCrop || saving}
            className="btn-royal flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>جاري الحفظ...</span>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2">
                <Save size={20} />
                <span>حفظ التعديلات</span>
              </div>
            )}
          </button>
          <button onClick={onClose} className="btn-outline flex-1">إلغاء</button>
        </div>
      </motion.div>
    </div>
  );
};
