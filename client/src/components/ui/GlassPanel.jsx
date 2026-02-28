import { motion } from 'framer-motion';

export default function GlassPanel({
  children,
  className = '',
  style = {},
  animate = true,
  ...props
}) {
  const Tag = animate ? motion.div : 'div';
  const motionProps = animate
    ? {
        initial: { opacity: 0, y: 20, scale: 0.97 },
        animate: { opacity: 1, y: 0, scale: 1 },
        transition: { type: 'spring', stiffness: 280, damping: 24 },
      }
    : {};

  return (
    <Tag className={`glass-panel ${className}`} style={style} {...motionProps} {...props}>
      {children}
    </Tag>
  );
}
