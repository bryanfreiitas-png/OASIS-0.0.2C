import React, { useEffect, useRef, useState } from 'react';
import type { ActionId, AvatarConfig, ExpressionId } from '../shared/types.ts';
import {
  drawPixelAvatar,
  onSpriteLoaded,
  type TurnaroundView,
} from '../utils/pixelAvatarRenderer.ts';

interface PixelAvatarPreviewProps {
  avatar: AvatarConfig;
  view?: TurnaroundView;
  expression?: ExpressionId;
  action?: ActionId;
  scale?: number;
  width?: number;
  height?: number;
  animate?: boolean;
  pedestal?: boolean;
  className?: string;
}

export const PixelAvatarPreview: React.FC<PixelAvatarPreviewProps> = ({
  avatar,
  view = 'frente',
  expression = 'normal',
  action = 'parado',
  scale = 3,
  width = 110,
  height = 160,
  animate = true,
  pedestal = false,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [spriteVersion, setSpriteVersion] = useState(0);

  useEffect(() => {
    return onSpriteLoaded(() => setSpriteVersion((v) => v + 1));
  }, []);

  useEffect(() => {
    let rafId = 0;
    let tick = 0;

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = false;

      if (pedestal) {
        const cx = canvas.width / 2;
        const cy = canvas.height - 20;
        const grad = ctx.createRadialGradient(cx, cy, 4, cx, cy, canvas.width * 0.44);
        grad.addColorStop(0, 'rgba(168, 85, 247, 0.72)');
        grad.addColorStop(0.65, 'rgba(109, 40, 217, 0.35)');
        grad.addColorStop(1, 'rgba(76, 29, 149, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(cx, cy, canvas.width * 0.44, 16, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = 'rgba(192, 132, 252, 0.65)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, canvas.width * 0.36, 12, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      const spriteW = 32 * scale;
      const spriteH = 48 * scale;
      const originX = Math.floor((canvas.width - spriteW) / 2);
      const originY = Math.floor(canvas.height - spriteH - (pedestal ? 12 : 4));

      drawPixelAvatar(ctx, originX, originY, {
        avatar,
        view,
        expression,
        action,
        frame: tick,
        scale,
      });

      if (animate) {
        tick += 0.16;
        rafId = requestAnimationFrame(render);
      }
    };

    render();
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [avatar, view, expression, action, scale, animate, pedestal, spriteVersion]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className={`pixelated block ${className}`}
    />
  );
};
