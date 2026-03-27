import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
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
  const [evaluation, setEvaluation] = useState<any | null>(null);
  const [annualNotes, setAnnualNotes] = useState(student.annualNotes || '');
  const [chartData, setChartData] = useState<any[]>([]);
  const [isDownloading, setIsDownloading] = useState(false);

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
        const reportsQ = query(collection(db, 'reports'), where('studentId', '==', student.id));
        const reportsSnap = await getDocs(reportsQ);
        
        if (reportsSnap.empty) {
          setChartData([]);
          return;
        }

        const reportsList: any[] = [];
        reportsSnap.forEach(doc => reportsList.push({ id: doc.id, ...doc.data() }));

        const currentYear = new Date().getFullYear();
        const startYear = 2025;
        const years = [];
        for (let y = startYear; y <= Math.max(currentYear, startYear); y++) {
          years.push(y);
        }
        
        const yearlyData = years.map((year) => {
          const yearReports = reportsList.filter(r => {
            const dateStr = r.date || r.createdAt;
            if (!dateStr) return false;
            return new Date(dateStr).getFullYear() === year;
          });

          if (yearReports.length === 0) {
            return { 
              name: year.toString(), 
              attendance: 0, 
              behavior: 0, 
              practical: 0, 
              exam: 0 
            };
          }

          let attTotal = 0, behTotal = 0, pracTotal = 0, examTotal = 0;
          let attCount = 0, behCount = 0, pracCount = 0, examCount = 0;

          yearReports.forEach(r => {
            if (r.attendance !== undefined && r.attendance !== null) { attTotal += Number(r.attendance); attCount++; }
            if (r.behavior !== undefined && r.behavior !== null) { behTotal += Number(r.behavior); behCount++; }
            if (r.practical !== undefined && r.practical !== null) { pracTotal += Number(r.practical); pracCount++; }
            if (r.exam !== undefined && r.exam !== null) { examTotal += Number(r.exam); examCount++; }
          });

          return { 
            name: year.toString(), 
            attendance: attCount > 0 ? Math.round(attTotal / attCount) : 0, 
            behavior: behCount > 0 ? Math.round(behTotal / behCount) : 0, 
            practical: pracCount > 0 ? Math.round(pracTotal / pracCount) : 0, 
            exam: examCount > 0 ? Math.round(examTotal / examCount) : 0 
          };
        });
        
        setChartData(yearlyData);
        
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'student_profile_data');
      }
    };
    fetchChartData();
  }, [student.id]);

  const handleDownloadPDF = async () => {
    const element = document.getElementById('pdf-content');
    if (!element) return;
    
    setIsDownloading(true);
    try {
      const canvas = await html2canvas(element, { 
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });
      const imgData = canvas.toDataURL('image/png');
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`ملف_الطالب_${student.name.replace(/\s+/g, '_')}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-dark-surface rounded-3xl w-full max-w-5xl max-h-[90vh] overflow-y-auto p-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-royal-red">{student.name}</h2>
          <div className="flex gap-2">
            <button 
              onClick={handleDownloadPDF} 
              disabled={isDownloading}
              className="flex items-center gap-2 px-4 py-2 bg-royal-red text-white rounded-xl hover:bg-royal-red/90 transition-colors disabled:opacity-50"
            >
              {isDownloading ? <Loader2 className="animate-spin" size={20} /> : <Download size={20} />}
              <span>تحميل الملف</span>
            </button>
            <button onClick={onClose} className="p-2 hover:bg-stone-100 rounded-full transition-colors"><X /></button>
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
              <div className="flex-1 min-h-[300px] w-full flex items-center justify-center">
                {chartData.length === 0 ? (
                  <p className="text-stone-500 font-bold text-lg">لا توجد بيانات مسجلة بعد لهذا الطالب</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="name" stroke="#6b7280" tick={{ fill: '#6b7280' }} />
                      <YAxis domain={[0, 100]} stroke="#6b7280" tick={{ fill: '#6b7280' }} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      />
                      <Legend wrapperStyle={{ paddingTop: '20px' }} />
                      <Line type="monotone" dataKey="attendance" name="الحضور" stroke="#D4AF37" strokeWidth={3} activeDot={{ r: 8 }} />
                      <Line type="monotone" dataKey="behavior" name="السلوك" stroke="#8B0000" strokeWidth={3} />
                      <Line type="monotone" dataKey="practical" name="الخدمة العملية" stroke="#F59E0B" strokeWidth={3} />
                      <Line type="monotone" dataKey="exam" name="الامتحانات" stroke="#10B981" strokeWidth={3} />
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
        </div>
      </div>
    </div>
  );
};
