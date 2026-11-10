import type { CSSProperties } from 'react';
import { PX, type Palette, type Sprite } from './pixel-sprites';

interface PixelArtProps {
  sprite: Sprite;
  palette?: Palette;
  /** Position when nested inside another SVG, in the parent's units. */
  x?: number;
  y?: number;
  /** Rendered size of one sprite pixel; ignored when width/height are set. */
  scale?: number;
  width?: number | string;
  height?: number | string;
  /** Accessible name. Without one the sprite is decorative. */
  label?: string;
  className?: string;
  style?: CSSProperties;
}

/** Renders a sprite as SVG, one <rect> per horizontal run of identical pixels. */
export function PixelArt({ sprite, palette = PX, x, y, scale = 1, width, height, label, className, style }: PixelArtProps) {
  const cols = Math.max(...sprite.map((row) => row.length));
  const rects = [];
  for (let j = 0; j < sprite.length; j++) {
    const row = sprite[j]!;
    for (let i = 0; i < row.length; ) {
      const c = row[i]!;
      let n = 1;
      while (row[i + n] === c) n++;
      if (c !== '.') rects.push(<rect key={`${j}.${i}`} x={i} y={j} width={n} height={1} fill={palette[c] ?? 'currentColor'} />);
      i += n;
    }
  }
  return (
    <svg
      x={x}
      y={y}
      width={width ?? cols * scale}
      height={height ?? sprite.length * scale}
      viewBox={`0 0 ${cols} ${sprite.length}`}
      shapeRendering="crispEdges"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={className}
      style={style}
    >
      {rects}
    </svg>
  );
}
