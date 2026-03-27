import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Save, Plus, Trash2, Upload, Eye, X, Star, Calendar, Clock, Search } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, doc, setDoc, deleteDoc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { Curriculum, SliderImage, StaffMember, Event } from '../types';
import { useAuth, useToast, useConfirm } from '../contexts';
import { fileToBase64 } from '../utils';

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

  if (loading) return <div className="p-12 animate-pulse text-royal-red font-bold">جاري تحميل المناهج...</div>;

  return (
    <div className="p-12 max-w-4xl mx-auto">
      <header className="mb-12">
        <h1 className="text-4xl font-bold text-royal-red mb-2">إدارة المناهج</h1>
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

  if (loading) return <div className="p-12 animate-pulse text-royal-red font-bold">جاري تحميل الصور...</div>;

  return (
    <div className="p-12 max-w-6xl mx-auto">
      <header className="mb-12">
        <h1 className="text-4xl font-bold text-royal-red mb-2">إدارة الصور</h1>
        <p className="text-stone-500 italic">إدارة صور شريط العرض في الصفحة الرئيسية</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div className="lg:col-span-1">
          <div className="card-clean p-8 sticky top-8">
            <h3 className="text-xl font-bold text-royal-red mb-6">إضافة صورة جديدة</h3>
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
                    className="absolute top-2 left-2 p-2 bg-white/90 text-red-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
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
// --- Staff Manager (Admin) ---
// --- Events Manager (Admin) ---
