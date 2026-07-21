/** Pan/zoom camera over the `.m-camera` group. World→screen: s = w·k + t. */

export interface CameraState {
  x: number;
  y: number;
  k: number;
}

export interface WorldRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const MIN_K = 0.06;
const MAX_K = 4;

export class Camera {
  private state: CameraState = { x: 0, y: 0, k: 1 };
  private raf = 0;
  private anim: number | undefined;

  constructor(
    private readonly group: SVGGElement,
    private readonly viewport: () => { w: number; h: number },
    private readonly sceneSize: { w: number; h: number },
    private readonly onChange: (state: CameraState) => void,
  ) {}

  get(): CameraState {
    return { ...this.state };
  }

  set(next: Partial<CameraState>, animate = false): void {
    const target: CameraState = {
      x: next.x ?? this.state.x,
      y: next.y ?? this.state.y,
      k: clamp(next.k ?? this.state.k, MIN_K, MAX_K),
    };
    if (!animate) {
      this.cancelAnim();
      this.state = target;
      this.apply();
      return;
    }
    this.animateTo(target, 620);
  }

  fitState(scale = 1): CameraState {
    const vp = this.viewport();
    const pad = 28;
    const k = clamp(
      Math.min((vp.w - pad * 2) / this.sceneSize.w, (vp.h - pad * 2) / this.sceneSize.h, 1.4) * scale,
      MIN_K,
      MAX_K,
    );
    return {
      x: (vp.w - this.sceneSize.w * k) / 2,
      y: (vp.h - this.sceneSize.h * k) / 2,
      k,
    };
  }

  fit(animate = false): void {
    this.set(this.fitState(), animate);
  }

  /** Frame a world rect at a comfortable zoom. */
  flyTo(rect: WorldRect): void {
    const vp = this.viewport();
    const k = clamp(Math.min(vp.w / (rect.w * 6), vp.h / (rect.h * 5), 1.35), 0.5, MAX_K);
    this.animateTo(
      {
        x: vp.w / 2 - (rect.x + rect.w / 2) * k,
        y: vp.h / 2 - (rect.y + rect.h / 2) * k,
        k,
      },
      620,
    );
  }

  zoomAt(screenX: number, screenY: number, factor: number): void {
    const { x, y, k } = this.state;
    const nk = clamp(k * factor, MIN_K, MAX_K);
    const wx = (screenX - x) / k;
    const wy = (screenY - y) / k;
    this.cancelAnim();
    this.state = { x: screenX - wx * nk, y: screenY - wy * nk, k: nk };
    this.apply();
  }

  panBy(dx: number, dy: number): void {
    this.cancelAnim();
    this.state = { ...this.state, x: this.state.x + dx, y: this.state.y + dy };
    this.apply();
  }

  private animateTo(target: CameraState, ms: number): void {
    this.cancelAnim();
    const from = { ...this.state };
    const start = performance.now();
    const tick = (now: number): void => {
      const t = Math.min(1, (now - start) / ms);
      const e = 1 - Math.pow(1 - t, 3); // easeOutCubic
      this.state = {
        x: from.x + (target.x - from.x) * e,
        y: from.y + (target.y - from.y) * e,
        k: from.k + (target.k - from.k) * e,
      };
      this.apply();
      if (t < 1) this.anim = requestAnimationFrame(tick);
      else this.anim = undefined;
    };
    this.anim = requestAnimationFrame(tick);
  }

  private cancelAnim(): void {
    if (this.anim !== undefined) cancelAnimationFrame(this.anim);
    this.anim = undefined;
  }

  private apply(): void {
    if (this.raf) return;
    this.raf = requestAnimationFrame(() => {
      this.raf = 0;
      const { x, y, k } = this.state;
      this.group.setAttribute('transform', `translate(${x} ${y}) scale(${k})`);
      this.onChange(this.state);
    });
  }
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
