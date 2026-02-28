import { motion } from 'framer-motion';
import { audioEngine } from '../../audio/audioEngine';

export default function Button({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  disabled = false,
  className = '',
  style = {},
  ...props
}) {
  const handleClick = (e) => {
    if (disabled) return;
    audioEngine.playClick();
    onClick?.(e);
  };

  return (
    <motion.button
      className={`btn btn--${variant} btn--${size} ${className}`}
      onClick={handleClick}
      disabled={disabled}
      whileTap={disabled ? {} : { scale: 0.93 }}
      whileHover={disabled ? {} : { scale: 1.04, y: -2 }}
      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
      style={style}
      {...props}
    >
      {children}
    </motion.button>
  );
}
