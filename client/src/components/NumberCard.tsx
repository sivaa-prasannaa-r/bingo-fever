import { motion } from 'framer-motion';

interface NumberCardProps {
  number: number;
  isDragging?: boolean;
  isPlaced?: boolean;
  style?: React.CSSProperties;
  onPointerDown?: React.PointerEventHandler<HTMLDivElement>;
}

export default function NumberCard({
  number,
  isDragging = false,
  isPlaced = false,
  style = {},
  onPointerDown,
}: NumberCardProps) {
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
