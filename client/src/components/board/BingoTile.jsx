import { motion, AnimatePresence } from 'framer-motion';

export default function BingoTile({
  number,
  isMarked,
  isInLine,
  isCalled,
  isPickable,
  isJustCalled,
  onTap,
  size = 'md',
  'data-cell-index': cellIndex,
}) {
  const handleTap = () => {
    if (isPickable || (isCalled && !isMarked)) onTap?.(number);
  };

  return (
    <motion.div
      className={`bingo-tile bingo-tile--${size}
        ${isMarked    ? 'bingo-tile--marked'   : ''}
        ${isInLine    ? 'bingo-tile--in-line'  : ''}
        ${isPickable  ? 'bingo-tile--pickable' : (isCalled && !isMarked ? 'bingo-tile--callable' : '')}
      `}
      data-cell-index={cellIndex}
      onClick={handleTap}
      onTouchEnd={(e) => { e.preventDefault(); handleTap(); }}
      whileTap={{ scale: 0.88 }}
      animate={
        isJustCalled
          ? { boxShadow: [
              'inset 0 0 0 0px rgba(255,215,0,0)',
              'inset 0 0 0 5px rgba(255,215,0,1)',
              'inset 0 0 0 4px rgba(255,215,0,0.6)',
              'inset 0 0 0 0px rgba(255,215,0,0)',
            ] }
          : isInLine
            ? { boxShadow: ['0 0 0px #ffe66d', '0 0 24px #ffe66d', '0 0 8px #ffe66d'] }
            : isPickable
              ? { boxShadow: ['0 0 0px #ffe66d33', '0 0 10px #ffe66d77', '0 0 0px #ffe66d33'] }
              : {}
      }
      transition={
        isJustCalled
          ? { duration: 3, times: [0, 0.08, 0.4, 1] }
          : isInLine || isPickable
            ? { repeat: Infinity, duration: 1.4, ease: 'easeInOut' }
            : { type: 'spring', stiffness: 400, damping: 20 }
      }
    >
      {/* 3-second highlight when a number is just called */}
      <AnimatePresence>
        {isJustCalled && (
          <motion.div
            className="tile-just-called"
            initial={{ opacity: 1 }}
            animate={{ opacity: [1, 1, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 3, times: [0, 0.55, 1] }}
          />
        )}
      </AnimatePresence>

      <motion.span
        className="tile-number"
        initial={false}
        animate={isMarked ? { scale: [1, 1.3, 1], opacity: 1 } : { scale: 1, opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        {number}
      </motion.span>

      {isMarked && (
        <motion.div
          className="tile-mark-sweep"
          initial={{ scaleX: 0, opacity: 1 }}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
        />
      )}

      {isMarked && (
        <>
          <motion.div
            className="sparkle sparkle--tl"
            initial={{ scale: 0, opacity: 1 }}
            animate={{ scale: 1.5, opacity: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          />
          <motion.div
            className="sparkle sparkle--br"
            initial={{ scale: 0, opacity: 1 }}
            animate={{ scale: 1.5, opacity: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
          />
        </>
      )}
    </motion.div>
  );
}
