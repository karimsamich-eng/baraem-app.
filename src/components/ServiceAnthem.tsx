import React, { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, doc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { AnimatePresence, motion } from 'motion/react';
import { Maximize, Minimize, Download, Music } from 'lucide-react';

interface AnthemSlide {
  id: string;
  imageUrl: string;
  order: number;
}

export const ServiceAnthem = () => {
  const [slides, setSlides] = useState<AnthemSlide[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pptxUrl, setPptxUrl] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Fetch slides
    const unsubscribeSlides = onSnapshot(collection(db, 'anthem_slides'), (snapshot) => {
      const s = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AnthemSlide));
      s.sort((a, b) => (a.order || 0) - (b.order || 0));
      setSlides(s);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'anthem_slides');
    });

    // Fetch PPTX URL from site_settings
    const unsubscribeSettings = onSnapshot(doc(db, 'settings', 'site_settings'), (docSnap) => {
      if (docSnap.exists()) {
        setPptxUrl(docSnap.data().anthemPptxUrl || null);
      }
    });

    return () => {
      unsubscribeSlides();
      unsubscribeSettings();
    };
  }, []);

  useEffect(() => {
    if (slides.length <= 1 || isFullscreen) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % slides.length);
    }, 8000);
    return () => clearInterval(interval);
  }, [slides, isFullscreen]);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const nextSlide = () => setCurrentIndex((prev) => (prev + 1) % slides.length);
  const prevSlide = () => setCurrentIndex((prev) => (prev - 1 + slides.length) % slides.length);

  if (loading) return (
    <div className="w-full h-64 bg-[#800000]/10 animate-pulse rounded-3xl flex items-center justify-center">
      <Music className="text-[#800000] animate-bounce" size={48} />
    </div>
  );

  if (slides.length === 0) return null;

  return (
    <section className="py-12 bg-[#800000] rounded-3xl overflow-hidden shadow-2xl border-4 border-[#FFD700]/20 relative">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-[#FFD700] rounded-2xl shadow-lg">
              <Music className="text-[#800000]" size={32} />
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-[#FFD700] font-serif tracking-wide">
              شعار خدمة البراعم
            </h2>
          </div>
          
          <div className="flex items-center gap-3">
            {pptxUrl && (
              <a 
                href={pptxUrl} 
                download 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-2 bg-[#FFD700] text-[#800000] px-4 py-2 rounded-xl font-bold text-sm hover:scale-105 transition-transform shadow-lg"
              >
                <Download size={18} />
                تحميل ملف الشعار (PPTX)
              </a>
            )}
            <button 
              onClick={toggleFullscreen}
              className="p-3 bg-white/10 text-[#FFD700] rounded-xl hover:bg-white/20 transition-colors border border-[#FFD700]/30"
              title="عرض ملء الشاشة"
            >
              {isFullscreen ? <Minimize size={24} /> : <Maximize size={24} />}
            </button>
          </div>
        </div>

        <div 
          ref={containerRef}
          className={`relative aspect-video w-full overflow-hidden rounded-2xl shadow-inner bg-black group ${isFullscreen ? 'rounded-none' : ''}`}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={slides[currentIndex].id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.5 }}
              className="absolute inset-0"
            >
              <motion.img 
                src={slides[currentIndex].imageUrl} 
                alt={`Slide ${currentIndex + 1}`}
                className="w-full h-full object-contain"
                initial={{ scale: 1 }}
                animate={{ scale: 1.1 }}
                transition={{ duration: 10, ease: "linear" }}
                referrerPolicy="no-referrer"
              />
            </motion.div>
          </AnimatePresence>

          {/* Navigation Arrows */}
          <div className="absolute inset-0 flex items-center justify-between px-4 opacity-0 group-hover:opacity-100 transition-opacity">
            <button 
              onClick={prevSlide}
              className="p-2 bg-black/50 text-white rounded-full hover:bg-[#FFD700] hover:text-[#800000] transition-all"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <button 
              onClick={nextSlide}
              className="p-2 bg-black/50 text-white rounded-full hover:bg-[#FFD700] hover:text-[#800000] transition-all"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>

          {/* Progress Indicators */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
            {slides.map((_, i) => (
              <button 
                key={i} 
                onClick={() => setCurrentIndex(i)}
                className={`h-1.5 rounded-full transition-all ${i === currentIndex ? 'bg-[#FFD700] w-8' : 'bg-white/30 w-3'}`} 
              />
            ))}
          </div>
        </div>
        
        <p className="mt-6 text-center text-[#FFD700]/80 font-medium italic font-serif text-lg">
          "نحن براعم الأرثوذكسية.. ننمو في محبة المسيح وكنيسته"
        </p>
      </div>
    </section>
  );
};
