import React, { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { AnimatePresence, motion } from 'motion/react';

export interface SliderImage {
  id: string;
  imageUrl: string;
  caption?: string;
}

export const HeroSlider = () => {
  const [images, setImages] = useState<SliderImage[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'slider_images'), (snapshot) => {
      const imgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SliderImage));
      setImages(imgs);
      setCurrentIndex(prev => (prev >= imgs.length ? 0 : prev));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'slider_images');
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (images.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % images.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [images]);

  if (loading) return <div className="h-[250px] md:h-[400px] w-full bg-stone-100 animate-pulse rounded-3xl" />;
  if (images.length === 0 || !images[currentIndex]) return (
    <div className="h-[250px] md:h-[400px] w-full bg-off-white rounded-3xl flex items-center justify-center border-2 border-dashed border-stone-200">
      <p className="text-stone-400">لا توجد صور في المعرض</p>
    </div>
  );

  const currentImage = images[currentIndex];

  return (
    <div className="relative h-[250px] md:h-[400px] w-full overflow-hidden rounded-3xl shadow-2xl">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentImage.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1 }}
          className="absolute inset-0"
        >
          <img 
            src={currentImage.imageUrl} 
            alt={currentImage.caption || 'Slider Image'} 
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          {currentImage.caption && (
            <div className="absolute bottom-6 md:bottom-8 right-6 md:right-8 text-white">
              <h2 className="text-xl md:text-3xl font-bold">{currentImage.caption}</h2>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
      
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
        {images.map((_, i) => (
          <div 
            key={i} 
            className={`w-2 h-2 rounded-full transition-all ${i === currentIndex ? 'bg-white w-6' : 'bg-white/50'}`} 
          />
        ))}
      </div>
    </div>
  );
};
