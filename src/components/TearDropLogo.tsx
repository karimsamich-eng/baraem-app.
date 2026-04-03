import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Camera, Users, Music, Mic, BookOpen, GraduationCap, 
  Image as ImageIcon 
} from 'lucide-react';
import { useBranding } from '../contexts';

const iconMap: Record<string, React.ElementType> = {
  'students': Users,
  'gallery': Camera,
  'anthem': Mic,
  'slider': Music,
  'curriculum': BookOpen,
  'graduation': GraduationCap,
};

export const TearDropLogo = () => {
  const { logoUrl, activeIcon } = useBranding();
  
  const IconComponent = activeIcon ? iconMap[activeIcon] : null;

  return (
    <motion.div
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ 
        type: 'spring', 
        stiffness: 100, 
        damping: 15,
        delay: 0.5 
      }}
      className="relative z-50 flex flex-col items-center"
    >
      {/* The Logo Container */}
      <div 
        className="w-16 h-16 md:w-20 md:h-20 bg-[#800000] shadow-[0_0_30px_rgba(255,215,0,0.4)] flex items-center justify-center relative overflow-hidden rounded-full"
        style={{
          border: '3px solid #FFD700'
        }}
      >
        {/* Inner Content */}
        <div 
          className="w-full h-full flex items-center justify-center"
        >
          <AnimatePresence mode="wait">
            {IconComponent ? (
              <motion.div
                key={activeIcon}
                initial={{ rotateY: 90, opacity: 0 }}
                animate={{ rotateY: 0, opacity: 1 }}
                exit={{ rotateY: -90, opacity: 0 }}
                transition={{ duration: 0.4 }}
              >
                <IconComponent className="text-[#FFD700] w-8 h-8 md:w-10 md:h-10" />
              </motion.div>
            ) : (
              <motion.div
                key="default-logo"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="w-full h-full p-2 flex items-center justify-center"
              >
                {logoUrl ? (
                  <img 
                    src={logoUrl} 
                    alt="" 
                    className="logo-image logo-header w-full h-full object-contain rounded-full"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <ImageIcon className="text-[#FFD700] w-8 h-8 md:w-10 md:h-10" />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      
      {/* Decorative Drop Shadow / Glow */}
      <div className="absolute -bottom-2 w-8 h-1 bg-[#FFD700]/30 blur-sm rounded-full" />
    </motion.div>
  );
};
