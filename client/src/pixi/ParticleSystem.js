import * as PIXI from 'pixi.js';

const PALETTE = [0xff6b9d, 0x4ecdc4, 0xffe66d, 0xff6b6b, 0x6c63ff, 0xa8edea, 0xfed6e3, 0x00d2ff];

export class ParticleSystem {
  constructor(canvas) {
    this.canvas = canvas;
    this.app = null;
    this.particles = [];
    this.confetti = [];
    this.intensity = 1;
  }

  async init() {
    this.app = new PIXI.Application();
    await this.app.init({
      canvas: this.canvas,
      width: window.innerWidth,
      height: window.innerHeight,
      backgroundAlpha: 0,
      antialias: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
    });

    this._createBlobs();
    this.app.ticker.add(this._update.bind(this));
    window.addEventListener('resize', this._onResize.bind(this));
  }

  _onResize() {
    this.app?.renderer.resize(window.innerWidth, window.innerHeight);
  }

  _createBlobs() {
    const count = Math.min(100, Math.floor(window.innerWidth / 12));
    for (let i = 0; i < count; i++) {
      const g = new PIXI.Graphics();
      const color = PALETTE[i % PALETTE.length];
      const r = 14 + Math.random() * 32;
      g.circle(0, 0, r);
      g.fill({ color, alpha: 0.12 + Math.random() * 0.18 });

      const p = {
        gfx: g,
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        vx: (Math.random() - 0.5) * 0.45,
        vy: (Math.random() - 0.5) * 0.45,
        rot: Math.random() * Math.PI * 2,
        rotV: (Math.random() - 0.5) * 0.008,
        sc: 0.6 + Math.random() * 0.6,
        scDir: Math.random() > 0.5 ? 1 : -1,
        scSpd: 0.0008 + Math.random() * 0.0015,
        scMin: 0.3,
        scMax: 1.4,
      };
      g.x = p.x; g.y = p.y; g.scale.set(p.sc);
      this.app.stage.addChild(g);
      this.particles.push(p);
    }
  }

  _update(ticker) {
    const dt = ticker.deltaTime;
    const W = window.innerWidth;
    const H = window.innerHeight;

    for (const p of this.particles) {
      p.x += p.vx * this.intensity * dt;
      p.y += p.vy * this.intensity * dt;
      p.rot += p.rotV * dt;
      p.sc  += p.scDir * p.scSpd * dt;
      if (p.sc > p.scMax || p.sc < p.scMin) p.scDir *= -1;

      if (p.x < -50) p.x = W + 50;
      else if (p.x > W + 50) p.x = -50;
      if (p.y < -50) p.y = H + 50;
      else if (p.y > H + 50) p.y = -50;

      p.gfx.x = p.x;
      p.gfx.y = p.y;
      p.gfx.rotation = p.rot;
      p.gfx.scale.set(p.sc);
    }

    this.confetti = this.confetti.filter((c) => {
      c.x  += c.vx * dt;
      c.y  += c.vy * dt;
      c.vy += 0.12 * dt;
      c.vx *= 0.995;
      c.rot += c.rotV * dt;
      c.life -= dt;
      c.gfx.x = c.x;
      c.gfx.y = c.y;
      c.gfx.rotation = c.rot;
      c.gfx.alpha = Math.max(0, c.life / c.maxLife);
      if (c.life <= 0) {
        this.app.stage.removeChild(c.gfx);
        c.gfx.destroy();
        return false;
      }
      return true;
    });
  }

  spawnConfetti(count = 160) {
    for (let i = 0; i < count; i++) {
      const g = new PIXI.Graphics();
      const color = PALETTE[Math.floor(Math.random() * PALETTE.length)];
      const w = 5 + Math.random() * 9;
      const h = 4 + Math.random() * 5;
      g.rect(-w / 2, -h / 2, w, h);
      g.fill({ color });

      const c = {
        gfx: g,
        x: Math.random() * window.innerWidth,
        y: -15,
        vx: (Math.random() - 0.5) * 7,
        vy: 2 + Math.random() * 5,
        rot: Math.random() * Math.PI * 2,
        rotV: (Math.random() - 0.5) * 0.25,
        life: 130 + Math.random() * 130,
        maxLife: 260,
      };
      g.x = c.x; g.y = c.y;
      this.app.stage.addChild(g);
      this.confetti.push(c);
    }
  }

  setIntensity(v) { this.intensity = v; }

  destroy() {
    window.removeEventListener('resize', this._onResize.bind(this));
    clearInterval(this._bgmTimer);
    this.app?.destroy(false);
  }
}
