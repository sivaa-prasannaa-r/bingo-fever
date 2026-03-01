import { motion, AnimatePresence } from 'framer-motion';
import useGameStore from '../store/gameStore';

export default function ConnectionStatus() {
  const state = useGameStore((s) => s.connectionState);
  const show = state !== 'connected';

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="conn-status"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
        >
          <span className="conn-dot" data-state={state} />
          {state === 'connecting' ? 'Connecting…' : 'Reconnecting…'}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
