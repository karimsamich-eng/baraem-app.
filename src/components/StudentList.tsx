import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth, useToast, useConfirm } from '../contexts';
import { fileToBase64 } from '../utils';
import { Student } from '../types';
import { UserPlus, Search, Filter, Trash2, Edit2, X, Save, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { StudentProfileNew } from './StudentProfile';

export const StudentListNew = ({ isDashboard = false }: { isDashboard?: boolean }) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [selectedStudentProfile, setSelectedStudentProfile] = useState<Student | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const { user } = useAuth();
  const { addToast } = useToast();
  const { confirm } = useConfirm();

  useEffect(() => {
    const q = query(collection(db, 'students'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Student[] = [];
      snapshot.forEach(doc => list.push({ id: doc.id, ...doc.data() } as Student));
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
    if (isSaving) return;
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

    setIsSaving(true);
    try {
      const docRef = doc(collection(db, 'students'));
      await setDoc(docRef, { ...newStudent, id: docRef.id });
      setIsAdding(false);
      setPhotoBase64(null);
      addToast('تم إضافة الطالب بنجاح', 'success');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'students');
      addToast('فشل إضافة الطالب', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditStudent = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingStudent || isSaving) return;
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

    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'students', editingStudent.id), updatedStudent);
      setEditingStudent(null);
      setPhotoBase64(null);
      addToast('تم تحديث بيانات الطالب بنجاح', 'success');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'students');
      addToast('فشل تحديث بيانات الطالب', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    confirm({
      title: 'حذف طالب',
      message: 'هل أنت متأكد من حذف هذا الطالب؟ لا يمكن التراجع عن هذا الإجراء.',
      onConfirm: async () => {
        setIsSaving(true);
        try {
          await deleteDoc(doc(db, 'students', id));
          addToast('تم حذف الطالب بنجاح', 'success');
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, 'students');
          addToast('فشل حذف الطالب', 'error');
        } finally {
          setIsSaving(false);
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
          <h1 className="text-3xl md:text-4xl font-bold text-[#800000] mb-2">الطلاب</h1>
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
            className="bg-[#800000] h-1.5 rounded-full" 
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
        <button className="p-3 bg-white dark:bg-dark-surface rounded-2xl text-stone-500 dark:text-dark-muted hover:text-[#800000] dark:hover:text-gold transition-colors border border-stone-200 dark:border-dark-border shadow-sm flex items-center justify-center">
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
            className="interactive-card bg-white dark:bg-dark-surface rounded-3xl shadow-md overflow-hidden border border-stone-100 dark:border-dark-border group hover:shadow-xl transition-all"
          >
            <div className="aspect-square relative overflow-hidden bg-stone-100 dark:bg-dark-bg">
              {student.photoUrl ? (
                <img src={student.photoUrl} alt={student.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-stone-400">لا توجد صورة</div>
              )}
            </div>
            <div className="p-4">
              <h3 className="font-bold text-lg mb-1 text-[#333333]">{student.name}</h3>
              <p className="text-stone-500 text-sm mb-4">{student.gradeLevel}</p>
              <div className="flex gap-2">
                {user && (
                  <button onClick={() => setSelectedStudentProfile(student)} className="flex-1 btn-secondary text-sm py-2">عرض الملف</button>
                )}
                {user && (user.role === 'admin' || user.role === 'coordinator') && (
                  <>
                    <button onClick={() => setEditingStudent(student)} className="p-2 text-stone-400 hover:bg-blue-50 hover:text-blue-600 rounded-full transition-colors"><Edit2 size={18} /></button>
                    <button onClick={() => handleDelete(student.id)} disabled={isSaving} className="p-2 text-[#800000] hover:bg-red-50 hover:text-red-700 rounded-full transition-colors disabled:opacity-50"><Trash2 size={18} /></button>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {(isAdding || editingStudent) && (
          <div className="modal-overlay">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl max-w-md w-full border border-stone-100 overflow-hidden"
            >
              <div className="p-8 border-b border-stone-100 flex items-center justify-between bg-off-white/50">
                <h2 className="text-2xl font-bold text-[#800000]">{editingStudent ? 'تعديل بيانات طالب' : 'إضافة طالب جديد'}</h2>
                <button onClick={() => { setIsAdding(false); setEditingStudent(null); setPhotoBase64(null); }} className="p-2 hover:bg-red-50 hover:text-red-500 rounded-full transition-colors">
                  <X size={24} className="text-stone-400" />
                </button>
              </div>
              
              <form onSubmit={editingStudent ? handleEditStudent : handleAddStudent} className="p-8 space-y-6">
                <div className="flex justify-center mb-6">
                  <div className="relative group">
                    <div className="w-32 h-32 rounded-3xl bg-stone-100 border-2 border-dashed border-stone-200 flex items-center justify-center overflow-hidden">
                      {photoBase64 || editingStudent?.photoUrl ? (
                        <img src={photoBase64 || editingStudent?.photoUrl} alt="Preview" className="w-full h-full object-cover" />
                      ) : (
                        <UserPlus size={40} className="text-stone-300" />
                      )}
                    </div>
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handlePhotoUpload}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                    <div className="absolute -bottom-2 -right-2 bg-gold text-white p-2 rounded-xl shadow-lg group-hover:scale-110 transition-transform">
                      <Edit2 size={16} />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-stone-700 uppercase tracking-wider mr-1">اسم الطالب</label>
                    <input name="name" defaultValue={editingStudent?.name} required className="input-clean text-[#333333]" placeholder="الاسم الرباعي" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-stone-700 uppercase tracking-wider mr-1">المرحلة / الفرقة</label>
                    <select name="gradeLevel" defaultValue={editingStudent?.gradeLevel} required className="input-clean text-[#333333]">
                      <option value="الفرقة الأولى">الفرقة الأولى</option>
                      <option value="الفرقة الثانية">الفرقة الثانية</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-stone-700 uppercase tracking-wider mr-1">رقم الهاتف</label>
                    <input name="phone" defaultValue={editingStudent?.phone} className="input-clean text-[#333333]" placeholder="01..." />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-stone-700 uppercase tracking-wider mr-1">اسم ولي الأمر</label>
                      <input name="parentName" defaultValue={editingStudent?.parentName} className="input-clean text-[#333333]" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-stone-700 uppercase tracking-wider mr-1">هاتف ولي الأمر</label>
                      <input name="parentPhone" defaultValue={editingStudent?.parentPhone} className="input-clean text-[#333333]" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-stone-700 uppercase tracking-wider mr-1">ملاحظات</label>
                    <textarea name="notes" defaultValue={editingStudent?.notes} rows={3} className="input-clean text-[#333333]" />
                  </div>
                </div>
                
                <div className="pt-4 flex gap-4">
                  <button 
                    type="button"
                    onClick={() => { setIsAdding(false); setEditingStudent(null); setPhotoBase64(null); }}
                    className="flex-1 py-4 rounded-xl font-bold text-[#333333] hover:bg-stone-50 transition-colors"
                  >
                    إلغاء
                  </button>
                  <button 
                    type="submit"
                    disabled={isSaving}
                    className="flex-1 btn-primary py-4 flex items-center justify-center gap-2 disabled:opacity-70"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        جاري الحفظ...
                      </>
                    ) : (
                      <>
                        <Save size={20} />
                        {editingStudent ? 'تحديث البيانات' : 'حفظ الطالب'}
                      </>
                    )}
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
