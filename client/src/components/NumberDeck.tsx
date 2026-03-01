import { useRef, useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import { audioEngine } from '../audio/audioEngine';

interface DragState {
  number: number;
  x: number;
  y: number;
}

interface NumberDeckProps {
  deck: number[];
  onPlace: (number: number, cellIndex: number) => void;
}

export default function NumberDeck({ deck, onPlace }: NumberDeckProps) {
  const [dragging, setDragging] = useState<DragState | null>(null);
  const numberRef = useRef<number | null>(null);

  const startDrag = useCallback((number: number, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();

    numberRef.current = number;
    audioEngine.playDragLift();
    setDragging({ number, x: e.clientX, y: e.clientY });

    const onMove = (me: PointerEvent) => {
      setDragging({ number: numberRef.current!, x: me.clientX, y: me.clientY });
    };

    const onUp = (ue: PointerEvent) => {
      const el = document.elementFromPoint(ue.clientX, ue.clientY);
      const cell = el?.closest('[data-cell-index]') as HTMLElement | null;
      if (cell) {
        const idx = parseInt(cell.dataset.cellIndex!, 10);
        audioEngine.playSnap();
        onPlace(numberRef.current!, idx);
      }
      numberRef.current = null;
      setDragging(null);
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onUp);
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onUp);
  }, [onPlace]);

  return (
    <>
      <div className="number-deck">
        {deck.map((num) => (
          <motion.div
            key={num}
            className={`number-card ${dragging?.number === num ? 'number-card--lifted' : ''}`}
            onPointerDown={(e) => startDrag(num, e)}
            whileHover={{ scale: 1.08, y: -4 }}
            whileTap={{ scale: 1.12 }}
            transition={{ type: 'spring', stiffness: 380, damping: 22 }}
            style={{ touchAction: 'none', userSelect: 'none' }}
            layout
          >
            {num}
          </motion.div>
        ))}
      </div>

      {dragging && (
        <div
          className="number-card number-card--ghost"
          style={{
            position: 'fixed',
            left: dragging.x - 22,
            top: dragging.y - 22,
            pointerEvents: 'none',
            zIndex: 9999,
            transform: 'scale(1.15)',
            transition: 'none',
          }}
        >
          {dragging.number}
        </div>
      )}
    </>
  );
}
