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

export interface ViewportInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
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
    private readonly insets: () => ViewportInsets = () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  ) {}

  get(): CameraState {
    return { ...this.state };
  }

  private visibleArea(): { x: number; y: number; w: number; h: number } {
    const vp = this.viewport();
    const ins = this.insets();
    const x = ins.left;
    const y = ins.top;
    const w = Math.max(10, vp.w - ins.left - ins.right);
    const h = Math.max(10, vp.h - ins.top - ins.bottom);
    return { x, y, w, h };
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
    const vis = this.visibleArea();
    const pad = vis.w < 500 ? 12 : 28;
    const k = clamp(
      Math.min((vis.w - pad * 2) / this.sceneSize.w, (vis.h - pad * 2) / this.sceneSize.h, 1.4) * scale,
      MIN_K,
      MAX_K,
    );
    return {
      x: vis.x + (vis.w - this.sceneSize.w * k) / 2,
      y: vis.y + (vis.h - this.sceneSize.h * k) / 2,
      k,
    };
  }

  fit(animate = false): void {
    this.set(this.fitState(), animate);
  }

  /** Frame a world rect at a comfortable zoom. */
  flyTo(rect: WorldRect): void {
    const vis = this.visibleArea();
    const k = clamp(
      vis.w < 500
        ? Math.min((vis.w - 32) / (rect.w * 2.2), (vis.h - 32) / (rect.h * 2.4), 1.25)
        : Math.min(vis.w / (rect.w * 4.5), vis.h / (rect.h * 4), 1.35),
      0.65,
      MAX_K,
    );
    this.animateTo(
      {
        x: vis.x + vis.w / 2 - (rect.x + rect.w / 2) * k,
        y: vis.y + vis.h / 2 - (rect.y + rect.h / 2) * k,
        k,
      },
      520,
    );
  }

  /** Re-center the viewport on a world rect without altering the zoom level unless needed. */
  reCenter(rect: WorldRect, animate = false): void {
    const vis = this.visibleArea();
    const k = this.state.k;
    const target: CameraState = {
      x: vis.x + vis.w / 2 - (rect.x + rect.w / 2) * k,
      y: vis.y + vis.h / 2 - (rect.y + rect.h / 2) * k,
      k,
    };
    if (!animate) {
      this.cancelAnim();
      this.state = target;
      this.apply();
      return;
    }
    this.animateTo(target, 280);
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
