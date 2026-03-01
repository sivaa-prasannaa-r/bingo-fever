import { motion } from 'framer-motion';
import { audioEngine } from '../../audio/audioEngine';

interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children?: React.ReactNode;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
  type?: 'button' | 'reset' | 'submit';
}

export default function Button({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  disabled = false,
  className = '',
  style = {},
  type = 'button',
}: ButtonProps) {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled) return;
    audioEngine.playClick();
    onClick?.(e);
  };

  return (
    <motion.button
      type={type}
      className={`btn btn--${variant} btn--${size} ${className}`}
      onClick={handleClick}
      disabled={disabled}
      whileTap={disabled ? {} : { scale: 0.93 }}
      whileHover={disabled ? {} : { scale: 1.04, y: -2 }}
      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
      style={style}
    >
      {children}
    </motion.button>
  );
}
