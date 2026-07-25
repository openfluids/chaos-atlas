import { useState, useCallback, useRef, useEffect } from 'react';

interface ViewTransform {
  x: number;
  y: number;
  scale: number;
}

interface PlotBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

interface UsePlotTransformOptions {
  width: number;
  height: number;
  bounds?: PlotBounds;
  minScale?: number;
  maxScale?: number;
  initialTransform?: ViewTransform;
  enableConstraints?: boolean;
}

export const usePlotTransform = ({
  width,
  height,
  bounds = { minX: -2, maxX: 2, minY: -2, maxY: 2 },
  minScale = 0.1,
  maxScale = 10,
  initialTransform = { x: 0, y: 0, scale: 1 },
  enableConstraints = true,
}: UsePlotTransformOptions) => {
  const [transform, setTransform] = useState<ViewTransform>(initialTransform);
  const svgRef = useRef<SVGSVGElement>(null);

  // Transform coordinates from screen to data space
  const screenToData = useCallback((screenX: number, screenY: number) => {
    if (!svgRef.current) return { x: 0, y: 0 };

    const pt = svgRef.current.createSVGPoint();
    pt.x = screenX;
    pt.y = screenY;

    const screenCTM = svgRef.current.getScreenCTM();
    if (!screenCTM) return { x: 0, y: 0 };

    const svgP = pt.matrixTransform(screenCTM.inverse());

    return {
      x: (svgP.x - transform.x) / transform.scale,
      y: (svgP.y - transform.y) / transform.scale,
    };
  }, [transform]);

  // Calculate data bounds based on transform
  const getDataBounds = useCallback((): PlotBounds => {
    const dataTopLeft = screenToData(0, 0);
    const dataBottomRight = screenToData(width, height);

    return {
      minX: dataTopLeft.x,
      maxX: dataBottomRight.x,
      minY: dataTopLeft.y,
      maxY: dataBottomRight.y,
    };
  }, [width, height, screenToData]);

  // Transform coordinates from data to screen space
  const dataToScreen = useCallback((dataX: number, dataY: number) => {
    return {
      x: dataX * transform.scale + transform.x,
      y: dataY * transform.scale + transform.y,
    };
  }, [transform]);

  // Transform coordinates from data to SVG space (0,0 to width,height)
  const dataToSVG = useCallback((dataX: number, dataY: number) => {
    const screenX = dataX * transform.scale + transform.x;
    const screenY = dataY * transform.scale + transform.y;

    // Normalize to SVG coordinates
    const svgX = (screenX / width) * 100; // SVG viewBox is 0-100
    const svgY = (screenY / height) * 100;

    return { x: svgX, y: svgY };
  }, [transform, width, height]);

  // Apply constraints to keep data within view
  const applyConstraints = useCallback((newTransform: ViewTransform): ViewTransform => {
    if (!enableConstraints) return newTransform;

    const constrained = { ...newTransform };

    // Calculate the visible data bounds at this transform
    const visibleWidth = width / newTransform.scale;
    const visibleHeight = height / newTransform.scale;

    const dataMinX = -newTransform.x / newTransform.scale;
    const dataMaxX = dataMinX + visibleWidth;
    const dataMinY = -newTransform.y / newTransform.scale;
    const dataMaxY = dataMinY + visibleHeight;

    // Constrain panning to keep some data visible
    const padding = Math.min(visibleWidth, visibleHeight) * 0.1;

    if (dataMinX > bounds.minX + padding) {
      constrained.x = -(bounds.minX + padding) * newTransform.scale;
    }
    if (dataMaxX < bounds.maxX - padding) {
      constrained.x = width - (bounds.maxX - padding) * newTransform.scale;
    }
    if (dataMinY > bounds.minY + padding) {
      constrained.y = -(bounds.minY + padding) * newTransform.scale;
    }
    if (dataMaxY < bounds.maxY - padding) {
      constrained.y = height - (bounds.maxY - padding) * newTransform.scale;
    }

    return constrained;
  }, [enableConstraints, width, height, bounds]);

  // Update transform with constraints
  const updateTransform = useCallback((newTransform: ViewTransform) => {
    const constrained = applyConstraints(newTransform);
    setTransform(constrained);
    return constrained;
  }, [applyConstraints]);

  // Pan by relative amount
  const pan = useCallback((dx: number, dy: number) => {
    const newTransform: ViewTransform = {
      x: transform.x + dx,
      y: transform.y + dy,
      scale: transform.scale,
    };
    return updateTransform(newTransform);
  }, [transform, updateTransform]);

  // Zoom towards a point
  const zoomTowards = useCallback((scaleFactor: number, centerX: number, centerY: number) => {
    const newScale = Math.min(Math.max(transform.scale * scaleFactor, minScale), maxScale);

    if (newScale === transform.scale) return transform;

    // Calculate new position to zoom towards the center point
    const scaleChange = newScale - transform.scale;
    const newX = transform.x - centerX * scaleChange / transform.scale;
    const newY = transform.y - centerY * scaleChange / transform.scale;

    const newTransform: ViewTransform = {
      x: newX,
      y: newY,
      scale: newScale,
    };

    return updateTransform(newTransform);
  }, [transform, minScale, maxScale, updateTransform]);

  // Fit data bounds to view
  const fitToData = useCallback((dataBounds?: PlotBounds) => {
    const targetBounds = dataBounds || bounds;
    const dataWidth = targetBounds.maxX - targetBounds.minX;
    const dataHeight = targetBounds.maxY - targetBounds.minY;

    const scaleX = width / dataWidth;
    const scaleY = height / dataHeight;
    const scale = Math.min(scaleX, scaleY) * 0.9; // 90% to add some padding

    const centerX = (targetBounds.minX + targetBounds.maxX) / 2;
    const centerY = (targetBounds.minY + targetBounds.maxY) / 2;

    const newTransform: ViewTransform = {
      x: width / 2 - centerX * scale,
      y: height / 2 - centerY * scale,
      scale: Math.min(Math.max(scale, minScale), maxScale),
    };

    return updateTransform(newTransform);
  }, [width, height, bounds, minScale, maxScale, updateTransform]);

  // Reset to initial transform
  const reset = useCallback(() => {
    return updateTransform(initialTransform);
  }, [updateTransform, initialTransform]);

  // Get optimal scale to fit all data
  const getOptimalScale = useCallback((dataBounds?: PlotBounds) => {
    const targetBounds = dataBounds || bounds;
    const dataWidth = targetBounds.maxX - targetBounds.minX;
    const dataHeight = targetBounds.maxY - targetBounds.minY;

    const scaleX = width / dataWidth;
    const scaleY = height / dataHeight;

    return Math.min(scaleX, scaleY) * 0.9;
  }, [width, height, bounds]);

  // Convert array of data points to SVG path
  const dataToPath = useCallback((points: Array<{x: number, y: number}>, closePath = false) => {
    if (points.length === 0) return '';

    const svgPoints = points.map(point => dataToSVG(point.x, point.y));
    const path = svgPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');

    return closePath ? path + ' Z' : path;
  }, [dataToSVG]);

  
  return {
    // State
    transform,
    svgRef,

    // Coordinate transformations
    screenToData,
    dataToScreen,
    dataToSVG,
    dataToPath,

    // Transform operations
    updateTransform,
    pan,
    zoomTowards,
    fitToData,
    reset,

    // Utilities
    getDataBounds,
    getOptimalScale,

    // Current state
    currentScale: transform.scale,
    isZoomedIn: transform.scale > 1.1,
    isZoomedOut: transform.scale < 0.9,
  };
};