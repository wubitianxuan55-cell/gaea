import { useCallback, useEffect, useRef, useState } from 'react';
import { ViewportState } from './types';

const MIN_SCALE = 0.15;
const MAX_SCALE = 3.5;

export function useCanvasPanZoom(containerRef: React.RefObject<HTMLDivElement | null>) {
  const [viewport, setViewport] = useState<ViewportState>({
    scale: 1,
    translateX: 0,
    translateY: 0,
  });

  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
  const spaceDown = useRef(false);

  const resetView = useCallback(() => {
    setViewport({ scale: 1, translateX: 0, translateY: 0 });
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        spaceDown.current = true;
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spaceDown.current = false;
      }
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      // Trackpad pinch → zoom; normal scroll → pan
      if (e.ctrlKey || e.metaKey) {
        setViewport(prev => {
          const rect = container.getBoundingClientRect();
          const mouseX = e.clientX - rect.left;
          const mouseY = e.clientY - rect.top;
          const zoomFactor = e.deltaY > 0 ? 0.92 : 1.08;
          const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, prev.scale * zoomFactor));
          const scaleRatio = newScale / prev.scale;
          return {
            scale: newScale,
            translateX: mouseX - (mouseX - prev.translateX) * scaleRatio,
            translateY: mouseY - (mouseY - prev.translateY) * scaleRatio,
          };
        });
      } else {
        // Normal scroll → pan vertically; shift+scroll → pan horizontally
        setViewport(prev => ({
          ...prev,
          translateX: prev.translateX - (e.shiftKey ? e.deltaY : e.deltaX),
          translateY: prev.translateY - (e.shiftKey ? e.deltaX : e.deltaY),
        }));
      }
    };

    const onMouseDown = (e: MouseEvent) => {
      // Middle button always pans
      if (e.button === 1) {
        e.preventDefault();
        isPanning.current = true;
        panStart.current = { x: e.clientX, y: e.clientY, tx: viewport.translateX, ty: viewport.translateY };
        return;
      }
      // Left button: pan if clicking empty canvas (not a card), or if holding space
      if (e.button === 0) {
        const target = e.target as HTMLElement;
        const isCard = target.closest('[data-canvas-card]');
        const isControl = target.closest('button, input, [data-no-pan]');
        if (isCard || isControl) return; // let cards and controls handle their own clicks
        // Empty space click → pan
        e.preventDefault();
        isPanning.current = true;
        panStart.current = { x: e.clientX, y: e.clientY, tx: viewport.translateX, ty: viewport.translateY };
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isPanning.current) return;
      const dx = e.clientX - panStart.current.x;
      const dy = e.clientY - panStart.current.y;
      setViewport(prev => ({
        ...prev,
        translateX: panStart.current.tx + dx,
        translateY: panStart.current.ty + dy,
      }));
    };

    const onMouseUp = () => {
      isPanning.current = false;
    };

    // Trackpad pinch gesture
    const onGestureStart = (e: Event) => e.preventDefault();

    container.addEventListener('wheel', onWheel, { passive: false });
    container.addEventListener('mousedown', onMouseDown);
    container.addEventListener('gesturestart', onGestureStart);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    return () => {
      container.removeEventListener('wheel', onWheel);
      container.removeEventListener('mousedown', onMouseDown);
      container.removeEventListener('gesturestart', onGestureStart);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [containerRef, viewport]);

  const viewportStyle: React.CSSProperties = {
    transform: `scale(${viewport.scale}) translate(${viewport.translateX}px, ${viewport.translateY}px)`,
    transformOrigin: '0 0',
  };

  return { ...viewport, viewportStyle, resetView };
}
