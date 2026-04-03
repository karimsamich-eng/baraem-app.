import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, setDoc, getDoc, updateDoc, increment } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Student, AttendanceRecord, GradeRecord } from '../types';
import { X, Download, Loader2 } from 'lucide-react';
import { exportToPdf } from '../utils';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

export const StudentProfileNew = ({ student, onClose }: { student: Student, onClose: () => void }) => {
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [grades, setGrades] = useState<GradeRecord[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [tyoEvaluations, setTyoEvaluations] = useState<any[]>([]);
  const [evaluation, setEvaluation] = useState<any | null>(null);
  const [annualNotes, setAnnualNotes] = useState(student.annualNotes || '');
  const [chartData, setChartData] = useState<any[]>([]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isAddingTyo, setIsAddingTyo] = useState(false);
  const [isSavingTyo, setIsSavingTyo] = useState(false);

  useEffect(() => {
    const fetchAllData = async () => {
      try {
        // Attendance
        const attQ = query(collection(db, 'attendance'), where('studentId', '==', student.id));
        const attSnap = await getDocs(attQ);
        const attList: AttendanceRecord[] = [];
        attSnap.forEach(doc => attList.push({ id: doc.id, ...doc.data() } as AttendanceRecord));
        setAttendance(attList);

        // Grades
        const gradeQ = query(collection(db, 'grades'), where('studentId', '==', student.id));
        const gradeSnap = await getDocs(gradeQ);
        const gradeList: GradeRecord[] = [];
        gradeSnap.forEach(doc => gradeList.push({ id: doc.id, ...doc.data() } as GradeRecord));
        setGrades(gradeList);

        // Services
        const servQ = query(collection(db, 'practical_service'), where('studentId', '==', student.id));
        const servSnap = await getDocs(servQ);
        const servList: any[] = [];
        servSnap.forEach(doc => servList.push({ id: doc.id, ...doc.data() }));
        setServices(servList);

        // Tyo Evaluations
        const tyoQ = query(collection(db, 'tyo_evaluations'), where('studentId', '==', student.id));
        const tyoSnap = await getDocs(tyoQ);
        const tyoList: any[] = [];
        tyoSnap.forEach(doc => tyoList.push({ id: doc.id, ...doc.data() }));
        setTyoEvaluations(tyoList);

        // Evaluation
        const evalQ = query(collection(db, 'acceptance_evaluations'), where('studentId', '==', student.id));
        const evalSnap = await getDocs(evalQ);
        if (!evalSnap.empty) {
          setEvaluation(evalSnap.docs[0].data());
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'student_profile_data');
      }
    };
    fetchAllData();
  }, [student.id]);

  useEffect(() => {
    const fetchChartData = async () => {
      try {
        // Fetch all necessary data
        const [attendanceSnap, gradesSnap, servicesSnap] = await Promise.all([
          getDocs(query(collection(db, 'attendance'), where('studentId', '==', student.id))),
          getDocs(query(collection(db, 'grades'), where('studentId', '==', student.id))),
          getDocs(query(collection(db, 'practical_service'), where('studentId', '==', student.id)))
        ]);

        const attendance = attendanceSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const grades = gradesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const services = servicesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Aggregate by date (Saturdays only)
        const dataMap = new Map<string, any>();

        const getSaturday = (dateStr: string) => {
          const date = new Date(dateStr);
          const dayOfWeek = date.getDay(); // 0 (Sun), 1 (Mon), ..., 6 (Sat)
          const daysToSubtract = (dayOfWeek + 1) % 7;
          const result = new Date(date);
          result.setDate(date.getDate() - daysToSubtract);
          return result.toISOString().split('T')[0];
        };

        const addData = (date: string, key: string, value: number) => {
          const saturday = getSaturday(date);
          if (!dataMap.has(saturday)) {
            dataMap.set(saturday, { 
              date: saturday, 
              displayDate: `Sat ${new Date(saturday).getDate()}/${new Date(saturday).getMonth() + 1}`,
              attendance: 0, 
              practical: 0, 
              interaction: 0, 
              exams: 0 
            });
          }
          const current = dataMap.get(saturday);
          if (key === 'attendance') {
            current[key] = value;
          } else {
            current[key] += value; // Sum points for the same Saturday
          }
        };

        attendance.forEach((a: any) => addData(a.date, 'attendance', (a.status === 'present' || a.status === 'late') ? 100 : 0));
        services.forEach((s: any) => {
          addData(s.date, 'practical', Number(s.points || 0));
          addData(s.date, 'interaction', Number(s.interactionPoints || 0));
        });
        grades.forEach((g: any) => addData(g.date, 'exams', Number(g.score || 0)));

        const sortedData = Array.from(dataMap.values()).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        setChartData(sortedData);
        
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'student_analytics_data');
      }
    };
    fetchChartData();
  }, [student.id]);

  const handleDownloadPDF = async () => {
    console.log('Download Triggered for:', student.name);
    const element = document.getElementById('pdf-content');
    if (!element) {
      console.error('PDF element not found');
      return;
    }
    
    setIsDownloading(true);
    try {
      console.log('Starting html2canvas...');
      const canvas = await html2canvas(element, { 
        scale: 2,
        useCORS: true,
        logging: true,
        backgroundColor: '#ffffff',
        onclone: (clonedDoc) => {
          const head = clonedDoc.getElementsByTagName('head')[0];
          if (head) {
            head.innerHTML = '';
          }
        }
      });
      console.log('html2canvas finished');
      const imgData = canvas.toDataURL('image/png');
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      
      // Blob approach
      const pdfBlob = pdf.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);
      
      const link = document.createElement('a');
      link.href = pdfUrl;
      link.download = `${student.name.replace(/\s+/g, '_')}_Report.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(pdfUrl);
      console.log('PDF downloaded successfully');
    } catch (error) {
      console.error('Error generating PDF:', error);
    } finally {
      setIsDownloading(false);
    }
  };

  const getButtonText = () => {
    return isDownloading ? 'جاري التحميل...' : 'تحميل الملف';
  };

  return (
    <div className="modal-overlay">
      <div className="bg-white dark:bg-dark-surface rounded-3xl w-full max-w-5xl max-h-[90vh] overflow-y-auto p-8">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-bold text-[#800000]">{student.name}</h2>
            <span className="bg-gold/20 text-gold px-3 py-1 rounded-full text-sm font-bold border border-gold/30">
              تقييم القبول: {evaluation?.totalScore || 'لم يتم التقييم'}
            </span>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => setIsAddingTyo(true)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors"
            >
              <span>إضافة تقييم تايو</span>
            </button>
            <button 
              onClick={handleDownloadPDF} 
              disabled={isDownloading}
              className="flex items-center gap-2 px-4 py-2 bg-[#800000] text-white rounded-xl hover:bg-[#800000]/90 transition-colors disabled:opacity-50"
            >
              {isDownloading ? <Loader2 className="animate-spin" size={20} /> : <Download size={20} />}
              <span>{getButtonText()}</span>
            </button>
            <button onClick={onClose} className="p-2 hover:bg-red-50 hover:text-red-500 rounded-full transition-colors"><X /></button>
          </div>
        </div>
        
        <div id="pdf-content" className="p-4 bg-white dark:bg-dark-surface">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Right Column: Notes (in RTL, first item is right) */}
            <div className="card-clean p-6 h-full flex flex-col">
              <h3 className="font-bold text-lg mb-4 text-stone-800">ملاحظات المنسق السنوية</h3>
              <textarea 
                value={annualNotes}
                onChange={(e) => setAnnualNotes(e.target.value)}
                className="w-full flex-1 min-h-[200px] p-4 rounded-xl border border-stone-200 dark:border-dark-border bg-stone-50 dark:bg-dark-bg focus:ring-2 focus:ring-gold focus:border-transparent outline-none resize-none"
                placeholder="اكتب ملاحظاتك هنا..."
              />
            </div>

            {/* Left Column: Performance Chart */}
            <div className="card-clean p-6 h-full flex flex-col">
              <h3 className="font-bold text-lg mb-4 text-stone-800">الأداء خلال 5 سنوات</h3>
              <div className="h-[300px] w-full flex items-center justify-center">
                {chartData.length === 0 ? (
                  <p className="text-stone-500 font-bold text-lg">لا توجد بيانات مسجلة بعد لهذا الطالب</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="displayDate" stroke="#6b7280" tick={{ fill: '#6b7280' }} />
                      <YAxis domain={[0, 100]} stroke="#6b7280" tick={{ fill: '#6b7280' }} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      />
                      <Legend wrapperStyle={{ paddingTop: '20px' }} />
                      <Line type="monotone" dataKey="attendance" name="الحضور" stroke="#800000" strokeWidth={3} />
                      <Line type="monotone" dataKey="practical" name="طايو الخدمة" stroke="#FFD700" strokeWidth={3} />
                      <Line type="monotone" dataKey="interaction" name="طايو التفاعل" stroke="#F59E0B" strokeWidth={3} />
                      <Line type="monotone" dataKey="exams" name="الامتحانات" stroke="#10B981" strokeWidth={3} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
            {/* Grades */}
            <div className="card-clean p-6">
              <h3 className="font-bold text-lg mb-4 text-stone-800">الدرجات</h3>
              {grades.length === 0 ? (
                <p className="text-stone-500">لا توجد درجات مسجلة</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-right">
                    <thead>
                      <tr className="border-b border-stone-200">
                        <th className="py-2 px-4">المادة</th>
                        <th className="py-2 px-4">الدرجة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {grades.map(g => (
                        <tr key={g.id} className="border-b border-stone-100">
                          <td className="py-2 px-4">{g.subject}</td>
                          <td className="py-2 px-4">{g.score}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Services */}
            <div className="card-clean p-6">
              <h3 className="font-bold text-lg mb-4 text-stone-800">الخدمة العملية</h3>
              {services.length === 0 ? (
                <p className="text-stone-500">لا توجد خدمات مسجلة</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-right">
                    <thead>
                      <tr className="border-b border-stone-200">
                        <th className="py-2 px-4">نوع الخدمة</th>
                        <th className="py-2 px-4">التاريخ</th>
                        <th className="py-2 px-4">النقاط</th>
                      </tr>
                    </thead>
                    <tbody>
                      {services.map(s => (
                        <tr key={s.id} className="border-b border-stone-100">
                          <td className="py-2 px-4">{s.serviceType}</td>
                          <td className="py-2 px-4">{s.date}</td>
                          <td className="py-2 px-4">{s.points}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
            {/* Tyo Evaluations */}
            <div className="card-clean p-6">
              <h3 className="font-bold text-lg mb-4 text-stone-800">تقييم تايو</h3>
              {tyoEvaluations.length === 0 ? (
                <p className="text-stone-500">لا توجد تقييمات تايو مسجلة</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-right">
                    <thead>
                      <tr className="border-b border-stone-200">
                        <th className="py-2 px-4">ملاحظات</th>
                        <th className="py-2 px-4">التاريخ</th>
                        <th className="py-2 px-4">التقييم</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tyoEvaluations.map(t => (
                        <tr key={t.id} className="border-b border-stone-100">
                          <td className="py-2 px-4">{t.notes}</td>
                          <td className="py-2 px-4">{t.date}</td>
                          <td className="py-2 px-4">{t.rating}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {isAddingTyo && (
        <div className="modal-overlay">
          <div className="bg-white dark:bg-dark-surface rounded-3xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-[#800000]">إضافة تقييم تايو</h2>
              <button onClick={() => setIsAddingTyo(false)} className="p-2 hover:bg-red-50 hover:text-red-500 rounded-full transition-colors">
                <X size={24} className="text-stone-400" />
              </button>
            </div>
            
            <form onSubmit={async (e) => {
              e.preventDefault();
              setIsSavingTyo(true);
              const formData = new FormData(e.currentTarget);
              const savePromise = (async () => {
                const tyoRef = doc(collection(db, 'tyo_evaluations'));
                const newTyo = {
                  id: tyoRef.id,
                  studentId: student.id,
                  date: formData.get('date'),
                  notes: formData.get('notes'),
                  rating: Number(formData.get('rating')),
                  createdAt: new Date().toISOString()
                };
                await setDoc(tyoRef, newTyo);
                
                // Update group_analytics
                const studentSnap = await getDoc(doc(db, 'students', student.id));
                const grade = studentSnap.data()?.gradeLevel;
                if (grade) {
                  const analyticsRef = doc(db, 'group_analytics', `grade_${grade}`);
                  await updateDoc(analyticsRef, {
                    total_tyo_points: increment(newTyo.rating),
                    interaction: increment(newTyo.rating), // Assuming Tyo points are interaction
                    updatedAt: new Date().toISOString()
                  });
                }

                // Update student points
                const studentRef = doc(db, 'students', student.id);
                await updateDoc(studentRef, {
                  interactionPoints: increment(newTyo.rating) // Assuming Tyo points are interaction
                });
                
                setTyoEvaluations([...tyoEvaluations, newTyo]);
              })();
              const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 5000));
              
              try {
                await Promise.race([savePromise, timeoutPromise]);
                setIsAddingTyo(false);
              } catch (error: any) {
                handleFirestoreError(error, OperationType.WRITE, 'tyo_evaluations');
                alert(`فشل حفظ التقييم: ${error.message}`);
              } finally {
                setIsSavingTyo(false);
              }
            }} className="space-y-5">
              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-700 uppercase tracking-wider mr-1">الطالب</label>
                <input type="text" value={student.name} readOnly className="input-clean bg-stone-50" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-700 uppercase tracking-wider mr-1">نوع الخدمة</label>
                <input type="text" value="تقييم تايو" readOnly className="input-clean bg-stone-50" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-700 uppercase tracking-wider mr-1">ملاحظات (الوصف)</label>
                <input name="notes" required className="input-clean" placeholder="ماذا فعل الطالب؟" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-700 uppercase tracking-wider mr-1">التقييم (النقاط)</label>
                  <input name="rating" type="number" min="20" max="20" required className="input-clean bg-stone-50" readOnly defaultValue={20} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-700 uppercase tracking-wider mr-1">التاريخ</label>
                  <input name="date" type="date" defaultValue={new Date().toISOString().split('T')[0]} required className="input-clean" />
                </div>
              </div>
              <div className="pt-4 flex gap-4">
                <button 
                  type="button"
                  onClick={() => setIsAddingTyo(false)}
                  className="flex-1 py-3 rounded-xl font-bold text-stone-700 hover:bg-stone-50 transition-colors"
                >
                  إلغاء
                </button>
                <button 
                  type="submit"
                  disabled={isSavingTyo}
                  className="flex-1 btn-primary py-3 flex items-center justify-center gap-2 disabled:opacity-70"
                >
                  {isSavingTyo ? (
                    <>
                      <Loader2 size={20} className="animate-spin" />
                      جاري الحفظ...
                    </>
                  ) : (
                    'حفظ التقييم'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
