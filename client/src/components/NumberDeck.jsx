import { useRef, useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import { audioEngine } from '../audio/audioEngine';

/**
 * Physics-driven drag-and-drop number deck for Manual Placement Mode.
 * Props:
 *   deck          number[]        — unplaced numbers
 *   onPlace       (num, cellIdx)  — called when card dropped on a cell
 */
export default function NumberDeck({ deck, onPlace }) {
  const [dragging, setDragging] = useState(null); // { number, x, y }
  const ghostRef = useRef(null);
  const lastPos  = useRef({ x: 0, y: 0 });
  const vel      = useRef({ x: 0, y: 0 });

  const startDrag = useCallback((number, e) => {
    e.preventDefault();
    const pt = e.touches ? e.touches[0] : e;
    audioEngine.playDragLift();
    setDragging({ number, x: pt.clientX, y: pt.clientY });
    lastPos.current = { x: pt.clientX, y: pt.clientY };

    const onMove = (me) => {
      const p = me.touches ? me.touches[0] : me;
      vel.current = { x: p.clientX - lastPos.current.x, y: p.clientY - lastPos.current.y };
      lastPos.current = { x: p.clientX, y: p.clientY };
      setDragging((d) => d ? { ...d, x: p.clientX, y: p.clientY } : null);
    };

    const onEnd = (ue) => {
      const p = ue.changedTouches ? ue.changedTouches[0] : ue;
      const target = document.elementFromPoint(p.clientX, p.clientY);
      const cell = target?.closest('[data-cell-index]');
      if (cell) {
        const idx = parseInt(cell.dataset.cellIndex, 10);
        audioEngine.playSnap();
        onPlace(dragging?.number ?? number, idx);
      }
      setDragging(null);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onEnd);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
    };

    document.addEventListener('mousemove', onMove, { passive: false });
    document.addEventListener('mouseup', onEnd);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
  }, [onPlace, dragging]);

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
            layout
          >
            {num}
          </motion.div>
        ))}
      </div>

      {/* Ghost card following pointer */}
      {dragging && (
        <div
          ref={ghostRef}
          className="number-card number-card--ghost"
          style={{
            position: 'fixed',
            left: dragging.x - 24,
            top:  dragging.y - 24,
            pointerEvents: 'none',
            zIndex: 9999,
          }}
        >
          {dragging.number}
        </div>
      )}
    </>
  );
}
