import { motion } from 'framer-motion';

interface GlassPanelProps {
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  animate?: boolean;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
}

export default function GlassPanel({
  children,
  className = '',
  style = {},
  animate = true,
  ...props
}: GlassPanelProps) {
  if (!animate) {
    return (
      <div className={`glass-panel ${className}`} style={style} {...props}>
        {children}
      </div>
    );
  }

  return (
    <motion.div
      className={`glass-panel ${className}`}
      style={style}
      initial={{ opacity: 0, y: 20, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 280, damping: 24 }}
      {...props}
    >
      {children}
    </motion.div>
  );
}
