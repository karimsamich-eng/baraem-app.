import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Save, Plus, Trash2, Edit2, Upload, Eye, X, Star, Calendar, Clock, Search, RotateCw, Crop as CropIcon, Image as ImageIcon } from 'lucide-react';
import { db, handleFirestoreError, OperationType, storage, ref, uploadBytes, getDownloadURL, deleteObject } from '../firebase';
import { collection, doc, setDoc, deleteDoc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { Curriculum, SliderImage, StaffMember, Event, Settings } from '../types';
import { useAuth, useToast, useConfirm, useBranding } from '../contexts';
import { fileToBase64 } from '../utils';
import ReactCrop, { centerCrop, makeAspectCrop, Crop, PixelCrop, convertToPixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

// --- Curriculum Manager ---
export const CurriculumManager = () => {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [curricula, setCurricula] = useState<Curriculum[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'curriculum'), (snapshot) => {
      setCurricula(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Curriculum)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'curriculum');
    });
    return () => unsubscribe();
  }, []);

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>, squad: string) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const pdfUrl = formData.get('pdfUrl') as string;

    setIsUpdating(squad);
    try {
      await setDoc(doc(db, 'curriculum', squad), {
        pdfUrl,
        updatedAt: new Date().toISOString(),
        updatedBy: user?.username || ''
      });
      addToast('تم تحديث المنهج بنجاح', 'success');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'curriculum');
      addToast('فشل تحديث المنهج', 'error');
    } finally {
      setIsUpdating(null);
    }
  };

  if (loading) return <div className="p-12 animate-pulse text-[#800000] font-bold">جاري تحميل المناهج...</div>;

  return (
    <div className="p-12 max-w-4xl mx-auto">
      <header className="mb-12">
        <h1 className="text-4xl font-bold text-[#800000] mb-2">إدارة المناهج</h1>
        <p className="text-stone-500 italic">تحديث روابط المناهج الدراسية للفرق</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {['الفرقة الأولى', 'الفرقة الثانية'].map(squad => {
          const curr = curricula.find(c => c.id === squad);
          return (
            <div key={squad} className="interactive-card card-clean p-8">
              <h3 className="text-xl font-bold text-stone-900 mb-6">{squad}</h3>
              <form onSubmit={(e) => handleUpdate(e, squad)} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#333333] uppercase tracking-wider">رابط ملف PDF</label>
                  <input 
                    name="pdfUrl" 
                    defaultValue={curr?.pdfUrl} 
                    required 
                    className="input-clean" 
                    placeholder="https://example.com/curriculum.pdf"
                    disabled={isUpdating === squad}
                  />
                </div>
                <button 
                  type="submit" 
                  disabled={isUpdating === squad}
                  className="w-full btn-primary flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isUpdating === squad ? (
                    <>
                      <RotateCw className="w-5 h-5 animate-spin" />
                      جاري التحديث...
                    </>
                  ) : (
                    <>
                      <Save size={18} />
                      تحديث المنهج
                    </>
                  )}
                </button>
              </form>
              {curr && (
                <div className="mt-4 pt-4 border-t border-stone-100 text-xs text-stone-400">
                  آخر تحديث: {new Date(curr.updatedAt).toLocaleString('ar-EG')} بواسطة {curr.updatedBy}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
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

    try {
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
      form.reset();
      setPreview(null);
      addToast('تم إضافة الصورة بنجاح', 'success');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'slider_images');
      addToast('فشل إضافة الصورة', 'error');
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
      const response = await fetch(newBase64);
      const blob = await response.blob();
      const storageRef = ref(storage, `slider/${id}`);
      await uploadBytes(storageRef, blob);
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
                  {user?.role === 'coordinator' && (
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

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'settings', 'site_settings'), (doc) => {
      if (doc.exists()) {
        setSettings({ id: doc.id, ...doc.data() } as Settings);
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'settings');
    });
    return () => unsubscribe();
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
    try {
      await setDoc(doc(db, 'settings', 'site_settings'), {
        logoUrl: url.trim(),
        updatedAt: new Date().toISOString(),
        updatedBy: user?.username || ''
      });
      refreshLogo();
      addToast('تم تحديث الشعار بنجاح', 'success');
    } catch (error) {
      console.error("External URL save failed:", error);
      addToast('فشل تحديث الشعار', 'error');
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
      <header className="mb-12">
        <h1 className="text-4xl font-bold text-[#800000] mb-2">إعدادات الهوية</h1>
        <p className="text-stone-500">إدارة شعار الخدمة والهوية البصرية</p>
      </header>

      <div className="bg-white rounded-3xl shadow-xl border border-stone-100 overflow-hidden">
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
      </div>

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

    try {
      const docRef = doc(collection(db, 'anthem_slides'));
      await setDoc(docRef, {
        imageUrl: preview,
        order,
        createdAt: new Date().toISOString(),
        createdBy: user?.username || ''
      });
      form.reset();
      setPreview(null);
      addToast('تم إضافة الشريحة بنجاح', 'success');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'anthem_slides');
      addToast('فشل إضافة الشريحة', 'error');
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
