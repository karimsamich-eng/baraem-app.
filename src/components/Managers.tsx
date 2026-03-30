import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Save, Plus, Trash2, Upload, Eye, X, Star, Calendar, Clock, Search, RotateCw, Crop as CropIcon, Image as ImageIcon } from 'lucide-react';
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
            <div key={squad} className="card-clean p-8">
              <h3 className="text-xl font-bold text-stone-900 mb-6">{squad}</h3>
              <form onSubmit={(e) => handleUpdate(e, squad)} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-500 uppercase tracking-wider">رابط ملف PDF</label>
                  <input 
                    name="pdfUrl" 
                    defaultValue={curr?.pdfUrl} 
                    required 
                    className="input-clean" 
                    placeholder="https://example.com/curriculum.pdf"
                  />
                </div>
                <button type="submit" className="w-full btn-primary flex items-center justify-center gap-2">
                  <Save size={18} />
                  تحديث المنهج
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
      await setDoc(docRef, {
        imageUrl: preview || null,
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

  const handleDelete = async (id: string) => {
    confirm({
      title: 'حذف صورة',
      message: 'هل أنت متأكد من حذف هذه الصورة؟ لا يمكن التراجع عن هذا الإجراء.',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'slider_images', id));
          addToast('تم حذف الصورة بنجاح', 'success');
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, 'slider_images');
          addToast('فشل حذف الصورة', 'error');
        }
      }
    });
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
          <div className="card-clean p-8 sticky top-8">
            <h3 className="text-xl font-bold text-[#800000] mb-6">إضافة صورة جديدة</h3>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-500 uppercase tracking-wider">صورة العرض</label>
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
                    className="absolute inset-0 opacity-0 cursor-pointer" 
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-500 uppercase tracking-wider">عنوان (اختياري)</label>
                <input name="caption" className="input-clean" placeholder="أدخل عنواناً للصورة" />
              </div>
              <button 
                type="submit" 
                disabled={uploading || !preview}
                className="w-full btn-primary flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {uploading ? 'جاري الحفظ...' : (
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
              <div key={img.id} className="card-clean overflow-hidden group">
                <div className="relative h-48">
                  <img src={img.imageUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  <button 
                    onClick={() => handleDelete(img.id)}
                    className="absolute top-2 left-2 p-2 bg-white/90 text-red-600 rounded-full opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-700 transition-all shadow-lg"
                  >
                    <Trash2 size={18} />
                  </button>
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
                    alt="Logo" 
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
                  <label className="btn-primary flex items-center gap-2 cursor-pointer">
                    <Upload size={18} />
                    <span>{settings?.logoUrl ? 'تغيير الشعار' : 'رفع شعار جديد'}</span>
                    <input type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
                  </label>
                  {settings?.logoUrl && (
                    <button 
                      onClick={handleDeleteLogo}
                      className="px-6 py-2.5 rounded-xl font-bold text-red-600 hover:bg-red-50 transition-colors border border-red-100"
                    >
                      حذف الحالي
                    </button>
                  )}
                </div>

                <div className="pt-4 border-t border-stone-100">
                  <label className="block text-sm font-bold text-stone-700 mb-2">رابط شعار خارجي (حل بديل)</label>
                  <div className="flex gap-2">
                    <input 
                      type="url" 
                      placeholder="https://example.com/logo.png"
                      className="flex-1 px-4 py-2 rounded-xl border border-stone-200 text-sm focus:ring-2 focus:ring-[#800000] outline-none"
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
                      className="px-4 py-2 bg-stone-800 text-white rounded-xl text-sm font-bold hover:bg-stone-900 transition-colors"
                    >
                      حفظ الرابط
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
            image={selectedImage} 
            onSave={handleSaveLogo} 
            onClose={() => {
              setIsEditorOpen(false);
              setSelectedImage(null);
            }} 
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// --- Logo Editor Modal ---
const LogoEditorModal = ({ image, onSave, onClose }: { image: string, onSave: (img: string) => Promise<void>, onClose: () => void }) => {
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [rotation, setRotation] = useState(0);
  const [aspect, setAspect] = useState<number | undefined>(1);
  const [saving, setSaving] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

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
    // Initialize completedCrop so the save button works even if user doesn't touch the crop area
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
    if (!completedCrop || saving) return;
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

  return (
    <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full border border-stone-100 overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="p-6 border-b border-stone-100 flex items-center justify-between bg-stone-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#800000] text-white rounded-full flex items-center justify-center">
              <CropIcon size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-stone-900">تعديل الشعار</h2>
              <p className="text-xs text-stone-500 font-bold">قم بقص وتدوير الشعار قبل الحفظ</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white rounded-full transition-colors">
            <X size={24} className="text-stone-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 flex flex-col items-center bg-stone-100/50">
          <div className="max-w-full overflow-hidden rounded-2xl shadow-inner bg-white p-4">
            <ReactCrop
              crop={crop}
              onChange={(c) => setCrop(c)}
              onComplete={(c) => setCompletedCrop(c)}
              aspect={aspect}
              circularCrop={false}
            >
              <img
                ref={imgRef}
                src={image}
                alt="Crop me"
                style={{ transform: `rotate(${rotation}deg)`, maxHeight: '50vh' }}
                onLoad={onImageLoad}
              />
            </ReactCrop>
          </div>

          <div className="mt-8 flex flex-wrap justify-center gap-4 w-full max-w-md">
            <div className="flex items-center gap-2 bg-white p-2 rounded-xl shadow-sm border border-stone-100">
              <button 
                onClick={() => setRotation(r => (r - 90) % 360)}
                className="p-2 hover:bg-stone-50 rounded-lg text-stone-600 transition-colors"
                title="تدوير لليسار"
              >
                <RotateCw size={20} className="scale-x-[-1]" />
              </button>
              <span className="text-xs font-bold text-stone-400 px-2">التدوير</span>
              <button 
                onClick={() => setRotation(r => (r + 90) % 360)}
                className="p-2 hover:bg-stone-50 rounded-lg text-stone-600 transition-colors"
                title="تدوير لليمين"
              >
                <RotateCw size={20} />
              </button>
            </div>

            <div className="flex items-center gap-2 bg-white p-2 rounded-xl shadow-sm border border-stone-100">
              <button 
                onClick={() => setAspect(1)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${aspect === 1 ? 'bg-[#800000] text-white' : 'text-stone-500 hover:bg-stone-50'}`}
              >
                1:1
              </button>
              <button 
                onClick={() => setAspect(undefined)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${aspect === undefined ? 'bg-[#800000] text-white' : 'text-stone-500 hover:bg-stone-50'}`}
              >
                حر
              </button>
              <span className="text-xs font-bold text-stone-400 px-2">الأبعاد</span>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-stone-100 bg-stone-50 flex gap-4">
          <button 
            onClick={handleConfirm}
            disabled={!completedCrop || saving}
            className="flex-1 btn-primary py-3 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Save size={20} />
            )}
            <span>{saving ? 'جاري الحفظ...' : 'حفظ الشعار النهائي'}</span>
          </button>
          <button 
            onClick={onClose}
            className="flex-1 py-3 rounded-xl font-bold text-stone-500 hover:bg-white transition-colors border border-stone-200 z-[110]"
          >
            إلغاء / إغلاق إجباري
          </button>
        </div>
      </motion.div>
    </div>
  );
};
