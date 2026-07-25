'use client';

import React, { useRef, useState, useCallback, useEffect, useImperativeHandle, MouseEvent, WheelEvent } from 'react';

interface ViewTransform {
  x: number;
  y: number;
  scale: number;
}

interface InteractiveSVGProps {
  width: number;
  height: number;
  children: React.ReactNode;
  className?: string;
  onTransformChange?: (transform: ViewTransform) => void;
  minScale?: number;
  maxScale?: number;
  enablePan?: boolean;
  enableZoom?: boolean;
  svgRef?: React.RefObject<SVGSVGElement>;
}

export const InteractiveSVG: React.FC<InteractiveSVGProps> = ({
  width,
  height,
  children,
  className = '',
  onTransformChange,
  minScale = 0.1,
  maxScale = 10,
  enablePan = true,
  enableZoom = true,
  svgRef: externalRef,
}) => {
  const internalSvgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState<ViewTransform>({ x: 0, y: 0, scale: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [lastTransform, setLastTransform] = useState<ViewTransform>({ x: 0, y: 0, scale: 1 });

  // Transform coordinates from screen to data space
  const screenToData = useCallback((screenX: number, screenY: number) => {
    if (!internalSvgRef.current) return { x: 0, y: 0 };
    const pt = internalSvgRef.current.createSVGPoint();
    pt.x = screenX;
    pt.y = screenY;
    const svgP = pt.matrixTransform(internalSvgRef.current.getScreenCTM()?.inverse());
    return {
      x: (svgP.x - transform.x) / transform.scale,
      y: (svgP.y - transform.y) / transform.scale,
    };
  }, [transform]);

  // Transform coordinates from data to screen space
  const dataToScreen = useCallback((dataX: number, dataY: number) => {
    return {
      x: dataX * transform.scale + transform.x,
      y: dataY * transform.scale + transform.y,
    };
  }, [transform]);

  // Handle mouse down for panning
  const handleMouseDown = useCallback((e: MouseEvent<SVGSVGElement>) => {
    if (!enablePan) return;

    setIsPanning(true);
    setPanStart({ x: e.clientX, y: e.clientY });
    setLastTransform(transform);

    // Change cursor
    if (internalSvgRef.current) {
      internalSvgRef.current.style.cursor = 'grabbing';
    }
  }, [enablePan, transform]);

  // Handle mouse move for panning
  const handleMouseMove = useCallback((e: MouseEvent<SVGSVGElement>) => {
    if (!isPanning || !enablePan) return;

    const dx = e.clientX - panStart.x;
    const dy = e.clientY - panStart.y;

    const newTransform: ViewTransform = {
      ...lastTransform,
      x: lastTransform.x + dx,
      y: lastTransform.y + dy,
    };

    setTransform(newTransform);
    onTransformChange?.(newTransform);
  }, [isPanning, enablePan, panStart, lastTransform, onTransformChange]);

  // Handle mouse up to end panning
  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
    if (internalSvgRef.current) {
      internalSvgRef.current.style.cursor = enablePan ? 'grab' : 'default';
    }
  }, [enablePan]);

  // Handle wheel for zooming
  const handleWheel = useCallback((e: WheelEvent<SVGSVGElement>) => {
    if (!enableZoom) return;

    e.preventDefault();

    // Get mouse position in SVG coordinates
    const rect = internalSvgRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Calculate zoom factor
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.min(Math.max(transform.scale * zoomFactor, minScale), maxScale);

    // Calculate new transform to zoom towards mouse position
    const scaleChange = newScale - transform.scale;
    const newX = transform.x - mouseX * scaleChange / transform.scale;
    const newY = transform.y - mouseY * scaleChange / transform.scale;

    const newTransform: ViewTransform = {
      x: newX,
      y: newY,
      scale: newScale,
    };

    setTransform(newTransform);
    onTransformChange?.(newTransform);
  }, [enableZoom, transform, minScale, maxScale, onTransformChange]);

  // Reset view to default
  const resetView = useCallback(() => {
    const defaultTransform: ViewTransform = { x: 0, y: 0, scale: 1 };
    setTransform(defaultTransform);
    onTransformChange?.(defaultTransform);
  }, [onTransformChange]);

  // Handle global mouse up to end panning even if mouse leaves SVG
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      setIsPanning(false);
      if (internalSvgRef.current) {
        internalSvgRef.current.style.cursor = enablePan ? 'grab' : 'default';
      }
    };

    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [enablePan]);

  // Set initial cursor style
  useEffect(() => {
    if (internalSvgRef.current) {
      internalSvgRef.current.style.cursor = enablePan ? 'grab' : 'default';
    }
  }, [enablePan]);

  // Update external ref when svgRef changes
  useEffect(() => {
    if (externalRef && internalSvgRef.current) {
      (externalRef as any).current = internalSvgRef.current;
    }
  }, [externalRef, internalSvgRef.current]);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <svg
        ref={internalSvgRef}
        width={width}
        height={height}
        className={`border border-cyan-500/20 rounded-sm ${enablePan ? 'cursor-grab' : ''}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        style={{ touchAction: 'none' }} // Prevent touch scrolling
      >
        <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}>
          {children}
        </g>
      </svg>

      {/* Zoom controls */}
      {enableZoom && (
        <div className="absolute top-2 right-2 flex flex-col gap-1">
          <button
            onClick={() => {
              const newScale = Math.min(transform.scale * 1.2, maxScale);
              const centerX = width / 2;
              const centerY = height / 2;
              const scaleChange = newScale - transform.scale;
              const newTransform: ViewTransform = {
                x: transform.x - centerX * scaleChange / transform.scale,
                y: transform.y - centerY * scaleChange / transform.scale,
                scale: newScale,
              };
              setTransform(newTransform);
              onTransformChange?.(newTransform);
            }}
            className="bg-black/70 text-cyan-400 px-2 py-1 rounded-sm text-xs hover:bg-black/90 border border-cyan-500/30"
            title="Zoom in"
          >
            +
          </button>
          <button
            onClick={() => {
              const newScale = Math.max(transform.scale / 1.2, minScale);
              const centerX = width / 2;
              const centerY = height / 2;
              const scaleChange = newScale - transform.scale;
              const newTransform: ViewTransform = {
                x: transform.x - centerX * scaleChange / transform.scale,
                y: transform.y - centerY * scaleChange / transform.scale,
                scale: newScale,
              };
              setTransform(newTransform);
              onTransformChange?.(newTransform);
            }}
            className="bg-black/70 text-cyan-400 px-2 py-1 rounded-sm text-xs hover:bg-black/90 border border-cyan-500/30"
            title="Zoom out"
          >
            −
          </button>
          <button
            onClick={resetView}
            className="bg-black/70 text-cyan-400 px-2 py-1 rounded-sm text-xs hover:bg-black/90 border border-cyan-500/30"
            title="Reset view"
          >
            ⟲
          </button>
        </div>
      )}

      {/* Transform info */}
      <div className="absolute bottom-2 left-2 bg-black/70 text-cyan-400 px-2 py-1 rounded-sm text-xs border border-cyan-500/30">
        Zoom: {(transform.scale * 100).toFixed(0)}%
      </div>
    </div>
  );
};

export default InteractiveSVG;