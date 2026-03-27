import React, { useState, useEffect } from 'react';
import { db, collection, doc, setDoc, onSnapshot, query, orderBy } from '../firebase';
import { motion } from 'motion/react';
import { Save, AlertCircle } from 'lucide-react';

interface ExamLink {
  id: string;
  month: string;
  link: string;
  updatedAt: string;
  updatedBy: string;
}

const months = [
  'June', 'July', 'August', 'September', 'October', 'November', 
  'December', 'January', 'February', 'March', 'April'
];

export const MonthlyExamCenter = ({ user }: { user: any }) => {
  const [examLinks, setExamLinks] = useState<Record<string, ExamLink>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const isCoordinator = user?.role === 'admin' || user?.role === 'coordinator';

  useEffect(() => {
    const q = query(collection(db, 'exam_links'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const links: Record<string, ExamLink> = {};
      snapshot.forEach((doc) => {
        links[doc.id] = doc.data() as ExamLink;
      });
      setExamLinks(links);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSave = async (month: string, link: string) => {
    setSaving(month);
    try {
      await setDoc(doc(db, 'exam_links', month), {
        month,
        link,
        updatedAt: new Date().toISOString(),
        updatedBy: user.displayName
      });
    } catch (error) {
      console.error('Error saving exam link:', error);
    } finally {
      setSaving(null);
    }
  };

  if (loading) return <div>جاري التحميل...</div>;

  return (
    <div className="p-6 bg-stone-50 min-h-screen">
      <h1 className="text-3xl font-bold mb-8 text-royal-red">مركز الامتحانات الشهرية</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {months.map((month) => (
          <motion.div
            key={month}
            whileHover={{ scale: 1.02 }}
            className="bg-white/50 backdrop-blur-lg p-6 rounded-3xl shadow-lg border border-white/50"
          >
            <h2 className="text-xl font-bold mb-4 text-stone-800">{month}</h2>
            {isCoordinator ? (
              <div className="space-y-2">
                <input
                  type="text"
                  defaultValue={examLinks[month]?.link || ''}
                  onChange={(e) => examLinks[month] = { ...examLinks[month], link: e.target.value }}
                  className="w-full p-2 rounded-lg border border-stone-200"
                  placeholder="رابط Google Form"
                />
                <button
                  onClick={() => handleSave(month, examLinks[month]?.link || '')}
                  disabled={saving === month}
                  className="w-full py-2 bg-royal-red text-white rounded-lg flex items-center justify-center gap-2"
                >
                  <Save size={16} />
                  {saving === month ? 'جاري الحفظ...' : 'حفظ'}
                </button>
              </div>
            ) : (
              <a
                href={examLinks[month]?.link || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className={`block w-full py-3 text-center rounded-lg ${
                  examLinks[month]?.link ? 'bg-royal-red text-white' : 'bg-stone-200 text-stone-500 cursor-not-allowed'
                }`}
              >
                {examLinks[month]?.link ? 'فتح الامتحان' : 'لا يوجد رابط'}
              </a>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
};
