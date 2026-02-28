import { motion } from 'framer-motion';

/**
 * A draggable number card used in Manual Placement Mode.
 * The parent handles pointer events and passes transform via style.
 */
export default function NumberCard({
  number,
  isDragging = false,
  isPlaced = false,
  style = {},
  onPointerDown,
}) {
  if (isPlaced) return null;

  return (
    <motion.div
      className={`number-card ${isDragging ? 'number-card--dragging' : ''}`}
      style={style}
      onPointerDown={onPointerDown}
      animate={isDragging ? { scale: 1.15, rotate: 4 } : { scale: 1, rotate: 0 }}
      transition={{ type: 'spring', stiffness: 380, damping: 22 }}
      layout
    >
      {number}
    </motion.div>
  );
}
