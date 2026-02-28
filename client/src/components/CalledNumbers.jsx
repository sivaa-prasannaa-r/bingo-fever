import { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import useGameStore from '../store/gameStore';

export default function CalledNumbers() {
  const calledNumbers = useGameStore((s) => s.calledNumbers);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ left: scrollRef.current.scrollWidth, behavior: 'smooth' });
    }
  }, [calledNumbers.length]);

  return (
    <div className="called-numbers-bar" ref={scrollRef}>
      {calledNumbers.map((num, i) => (
        <motion.div
          key={`${num}-${i}`}
          className="called-chip"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 25 }}
        >
          {num}
        </motion.div>
      ))}
    </div>
  );
}
