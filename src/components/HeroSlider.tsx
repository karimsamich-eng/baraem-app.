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

  if (loading) return <div className="h-[250px] md:h-[400px] w-full bg-main animate-pulse rounded-3xl" />;
  if (images.length === 0 || !images[currentIndex]) return (
    <div className="h-[250px] md:h-[400px] w-full bg-main rounded-3xl flex items-center justify-center border-2 border-dashed border-maroon/20">
      <p className="text-maroon/40">لا توجد صور في المعرض</p>
    </div>
  );

  const currentImage = images[currentIndex];

  return (
    <div className="relative h-64 md:h-[40vh] w-full overflow-hidden rounded-3xl shadow-2xl">
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
          <div className="absolute inset-0 bg-black/40" />
          {currentImage.caption && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
              <h2 className="text-lg md:text-3xl font-bold text-white">{currentImage.caption}</h2>
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
