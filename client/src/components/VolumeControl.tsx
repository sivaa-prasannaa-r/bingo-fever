import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useGameStore from '../store/gameStore';
import { audioEngine } from '../audio/audioEngine';

interface SliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
}

function Slider({ label, value, onChange }: SliderProps) {
  return (
    <label className="vol-row">
      <span className="vol-label">{label}</span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.02}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="vol-slider"
      />
    </label>
  );
}

export default function VolumeControl() {
  const [open, setOpen] = useState(false);
  const { masterVolume, musicVolume, sfxVolume, setVolumes } = useGameStore();

  const update = (key: 'masterVolume' | 'musicVolume' | 'sfxVolume', value: number) => {
    setVolumes({ [key]: value });
    if (key === 'masterVolume') audioEngine.setMasterVolume(value);
    if (key === 'musicVolume')  audioEngine.setMusicVolume(value);
    if (key === 'sfxVolume')    audioEngine.setSFXVolume(value);
  };

  return (
    <div className="volume-widget">
      <motion.button
        className="volume-btn"
        onClick={() => setOpen((o) => !o)}
        whileTap={{ scale: 0.9 }}
      >
        {masterVolume === 0 ? '🔇' : masterVolume < 0.4 ? '🔈' : '🔊'}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="volume-panel glass-panel"
            initial={{ opacity: 0, scale: 0.8, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 10 }}
            transition={{ type: 'spring', stiffness: 350, damping: 22 }}
          >
            <Slider label="Master" value={masterVolume} onChange={(v) => update('masterVolume', v)} />
            <Slider label="Music"  value={musicVolume}  onChange={(v) => update('musicVolume', v)} />
            <Slider label="SFX"    value={sfxVolume}    onChange={(v) => update('sfxVolume', v)} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
