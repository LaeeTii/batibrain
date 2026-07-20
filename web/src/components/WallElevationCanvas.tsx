import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Circle, Layer, Line, Rect, Stage, Text } from 'react-konva';
import type { Opening, WallHeightProfilePoint } from '../domain/types';
import { formatLength, type LengthUnit } from '../domain/userPreferences';
import { CanvasScaleIndicator, CanvasZoomControls } from './Canvas2D';

interface WallElevationCanvasProps {
  wallLengthCm: number;
  points: readonly WallHeightProfilePoint[];
  oppositePoints?: readonly WallHeightProfilePoint[];
  openings: readonly Opening[];
  lengthUnit?: LengthUnit;
  editingEnabled?: boolean;
  selectedOpeningId?: string | null;
  selectedPointId?: string | null;
  onSelectOpening?(openingId: string): void;
  onSelectPoint?(pointId: string): void;
  onMovePoint?(pointId: string, positionCm: number, heightCm: number): void;
  onTogglePointLock?(pointId: string): void;
}

const HORIZONTAL_PADDING = 55;
const TOP_PADDING = 55;
const BOTTOM_PADDING = 100;

export function WallElevationCanvas({
  wallLengthCm,
  points,
  oppositePoints = [],
  openings,
  lengthUnit = 'cm',
  editingEnabled = false,
  selectedOpeningId = null,
  selectedPointId = null,
  onSelectOpening,
  onSelectPoint,
  onMovePoint,
  onTogglePointLock,
}: WallElevationCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(900);
  const [zoom, setZoom] = useState(1);
  const height = 620;
  const sortedPoints = useMemo(
    () => [...points].sort((left, right) => left.positionCm - right.positionCm),
    [points],
  );
  const sortedOppositePoints = useMemo(
    () => [...oppositePoints].sort((left, right) => left.positionCm - right.positionCm),
    [oppositePoints],
  );
  const maximumHeightCm = Math.max(
    300,
    ...sortedPoints.map((point) => point.heightCm),
    ...sortedOppositePoints.map((point) => point.heightCm),
    ...openings.map((opening) => opening.bottomCm + opening.heightCm),
  );
  const baseScale = Math.min(
    (width - HORIZONTAL_PADDING * 2) / Math.max(wallLengthCm, 1),
    (height - TOP_PADDING - BOTTOM_PADDING) / maximumHeightCm,
  );
  const scale = baseScale * zoom;
  const originX = HORIZONTAL_PADDING;
  const originY = height - BOTTOM_PADDING;

  useEffect(() => {
    if (!containerRef.current) return undefined;
    const element = containerRef.current;
    const update = () => setWidth(Math.max(360, Math.round(element.getBoundingClientRect().width)));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const toCanvasX = (positionCm: number) => originX + positionCm * scale;
  const toCanvasY = (heightCm: number) => originY - heightCm * scale;
  const profileLine = sortedPoints.flatMap((point) => [
    toCanvasX(point.positionCm),
    toCanvasY(point.heightCm),
  ]);
  const oppositeProfileWatermark = [
    originX,
    originY,
    ...sortedOppositePoints.flatMap((point) => [
      toCanvasX(point.positionCm),
      toCanvasY(point.heightCm),
    ]),
    toCanvasX(wallLengthCm),
    originY,
  ];

  return <div className="wall-elevation-canvas" ref={containerRef}>
    <Stage width={width} height={height}>
      <Layer>
        <Rect x={0} y={0} width={width} height={height} fill="#fff" />
        {sortedOppositePoints.length >= 2 ? <Line
          name="wall-opposite-profile-watermark"
          points={oppositeProfileWatermark}
          closed
          fill="rgba(100, 116, 139, 0.1)"
          stroke="#94a3b8"
          strokeWidth={2}
          dash={[10, 7]}
          listening={false}
        /> : null}
        <Line
          name="wall-elevation-floor"
          points={[originX, originY, toCanvasX(wallLengthCm), originY]}
          stroke="#475569"
          strokeWidth={2}
        />
        <Line points={profileLine} stroke="#0f172a" strokeWidth={3} />
        {sortedPoints.map((point, index) => {
          const endpoint = index === 0 || index === sortedPoints.length - 1;
          return <Line
            key={`guide-${point.id}`}
            name={`wall-profile-guide wall-profile-guide--${endpoint ? 'endpoint' : 'intermediate'}`}
            points={[
              toCanvasX(point.positionCm),
              originY,
              toCanvasX(point.positionCm),
              toCanvasY(point.heightCm),
            ]}
            stroke={endpoint ? '#0f172a' : '#64748b'}
            strokeWidth={endpoint ? 2 : 1.5}
            dash={endpoint ? undefined : [7, 5]}
            listening={false}
          />;
        })}
        {openings.map((opening) => {
          const selected = selectedOpeningId === opening.id;
          return <Rect
            key={opening.id}
            x={toCanvasX(opening.offsetCm)}
            y={toCanvasY(opening.bottomCm + opening.heightCm)}
            width={opening.widthCm * scale}
            height={opening.heightCm * scale}
            fill={opening.type === 'window' ? '#dbeafe' : '#f8fafc'}
            stroke={selected ? '#6757ff' : '#2563eb'}
            strokeWidth={selected ? 4 : 2}
            onClick={() => onSelectOpening?.(opening.id)}
          />;
        })}
        {sortedPoints.map((point, index) => {
          const selected = selectedPointId === point.id;
          const endpoint = index === 0 || index === sortedPoints.length - 1;
          return <React.Fragment key={point.id}>
            <Circle
              x={toCanvasX(point.positionCm)}
              y={toCanvasY(point.heightCm)}
              radius={selected ? 8 : 6}
              fill={point.isLocked ? '#fee2e2' : '#fff'}
              stroke={point.isLocked ? '#dc2626' : selected ? '#6757ff' : '#0f172a'}
              strokeWidth={2}
              draggable={editingEnabled && !point.isLocked}
              onClick={() => onSelectPoint?.(point.id)}
              onContextMenu={(event) => {
                event.evt.preventDefault();
                if (editingEnabled) onTogglePointLock?.(point.id);
              }}
              onDragMove={(event) => {
                if (!editingEnabled || point.isLocked) return;
                const previous = sortedPoints[index - 1];
                const next = sortedPoints[index + 1];
                const positionCm = endpoint
                  ? point.positionCm
                  : Math.max(
                    (previous?.positionCm ?? 0) + 0.01,
                    Math.min((next?.positionCm ?? wallLengthCm) - 0.01, (event.target.x() - originX) / scale),
                  );
                const heightCm = Math.max(0.01, (originY - event.target.y()) / scale);
                event.target.position({ x: toCanvasX(positionCm), y: toCanvasY(heightCm) });
                onMovePoint?.(point.id, positionCm, heightCm);
              }}
            />
            <Text
              x={toCanvasX(point.positionCm) - 36}
              y={toCanvasY(point.heightCm) - 28}
              width={72}
              align="center"
              text={`${formatLength(point.positionCm, lengthUnit)} · ${formatLength(point.heightCm, lengthUnit)}`}
              fontSize={11}
              fill="#475569"
              listening={false}
            />
          </React.Fragment>;
        })}
        <Text
          x={originX}
          y={originY + 14}
          text={`Longueur ${formatLength(wallLengthCm, lengthUnit)}`}
          fontSize={12}
          fill="#334155"
        />
      </Layer>
    </Stage>
    <CanvasZoomControls
      onZoomIn={() => setZoom((value) => Math.min(3, value * 1.25))}
      onZoomOut={() => setZoom((value) => Math.max(0.5, value * 0.8))}
      onReset={() => setZoom(1)}
    />
    <CanvasScaleIndicator
      viewportWidth={wallLengthCm / zoom}
      renderedWidth={Math.max(1, wallLengthCm * baseScale)}
      lengthUnit={lengthUnit}
    />
  </div>;
}
