import React, { forwardRef, type MouseEvent, type ReactNode } from 'react';

type KonvaMockProps = {
  children?: ReactNode;
  name?: string;
  points?: number[];
  closed?: boolean;
  text?: string;
  radius?: number;
  draggable?: boolean;
  listening?: boolean;
  scaleX?: number;
  scaleY?: number;
  fontSize?: number;
  fontStyle?: string;
  strokeWidth?: number;
  dash?: number[];
  onClick?: (event: KonvaMockEvent) => void;
  onMouseDown?: (event: KonvaMockEvent) => void;
  onMouseMove?: (event: KonvaMockEvent) => void;
  onMouseUp?: (event: KonvaMockEvent) => void;
  onMouseLeave?: (event: KonvaMockEvent) => void;
  onDragStart?: (event: KonvaMockEvent) => void;
  onDragMove?: (event: KonvaMockEvent) => void;
  onDragEnd?: (event: KonvaMockEvent) => void;
  onContextMenu?: (event: KonvaMockEvent) => void;
  [key: string]: unknown;
};

type KonvaMockEvent = {
  evt: MouseEvent<SVGElement>;
  target: {
    getStage(): KonvaStageMock;
    x(): number;
    y(): number;
    position(value: { x: number; y: number }): void;
  };
};

type KonvaStageMock = {
  getPointerPosition(): { x: number; y: number };
};

function createEvent(event: MouseEvent<SVGElement>, props: KonvaMockProps, usePointerPosition = false): KonvaMockEvent {
  const dragX = Number(event.currentTarget.getAttribute('data-konva-drag-x') ?? event.clientX ?? props.x ?? 0);
  const dragY = Number(event.currentTarget.getAttribute('data-konva-drag-y') ?? event.clientY ?? props.y ?? 0);
  const stage = {
    getPointerPosition: () => ({
      x: event.clientX,
      y: event.clientY,
    }),
  };

  return {
    evt: event,
    target: {
      getStage: () => stage,
      x: () => usePointerPosition ? dragX : Number(props.x ?? 0),
      y: () => usePointerPosition ? dragY : Number(props.y ?? 0),
      position: () => undefined,
    },
  };
}

function eventProps(props: KonvaMockProps) {
  return {
    onClick: props.onClick
      ? (event: MouseEvent<SVGElement>) => props.onClick?.(createEvent(event, props))
      : undefined,
    onMouseDown: props.onMouseDown
      ? (event: MouseEvent<SVGElement>) => props.onMouseDown?.(createEvent(event, props))
      : undefined,
    onMouseMove: props.onMouseMove
      ? (event: MouseEvent<SVGElement>) => props.onMouseMove?.(createEvent(event, props))
      : undefined,
    onMouseUp: props.onMouseUp
      ? (event: MouseEvent<SVGElement>) => props.onMouseUp?.(createEvent(event, props))
      : undefined,
    onMouseLeave: props.onMouseLeave
      ? (event: MouseEvent<SVGElement>) => props.onMouseLeave?.(createEvent(event, props))
      : undefined,
    onDragStart: props.onDragStart
      ? (event: MouseEvent<SVGElement>) => props.onDragStart?.(createEvent(event, props, true))
      : undefined,
    onDrag: props.onDragMove
      ? (event: MouseEvent<SVGElement>) => props.onDragMove?.(createEvent(event, props, true))
      : undefined,
    onDragEnd: props.onDragEnd
      ? (event: MouseEvent<SVGElement>) => props.onDragEnd?.(createEvent(event, props, true))
      : undefined,
    onContextMenu: props.onContextMenu
      ? (event: MouseEvent<SVGElement>) => props.onContextMenu?.(createEvent(event, props))
      : undefined,
  };
}

function presentationProps(props: KonvaMockProps) {
  return {
    className: props.name,
    fill: props.fill as string | undefined,
    stroke: props.stroke as string | undefined,
    strokeWidth: props.strokeWidth,
    strokeDasharray: props.dash?.join(' '),
    opacity: props.opacity as number | undefined,
  };
}

export const Stage = forwardRef<SVGSVGElement, KonvaMockProps>(function Stage(
  { children, width, height, ...props },
  ref,
) {
  return (
    <svg
      ref={ref}
      width={Number(width)}
      height={Number(height)}
      {...eventProps(props)}
    >
      {children as ReactNode}
    </svg>
  );
});

export function Layer({ children, ...props }: KonvaMockProps) {
  return <g {...presentationProps(props)}>{children}</g>;
}

export function Group({ children, ...props }: KonvaMockProps) {
  return <g {...presentationProps(props)}>{children}</g>;
}

export function Line(props: KonvaMockProps) {
  const points = (props.points ?? []).reduce<string[]>((result, value, index) => {
    if (index % 2 === 0) {
      result.push(`${value},${props.points?.[index + 1] ?? 0}`);
    }
    return result;
  }, []).join(' ');
  const commonProps = {
    ...presentationProps(props),
    ...eventProps(props),
    points,
  };

  return props.closed ? <polygon {...commonProps} /> : <polyline {...commonProps} />;
}

export function Rect(props: KonvaMockProps) {
  return (
    <rect
      {...presentationProps(props)}
      {...eventProps(props)}
      x={Number(props.x ?? 0)}
      y={Number(props.y ?? 0)}
      width={Number(props.width ?? 0)}
      height={Number(props.height ?? 0)}
    />
  );
}

export function Circle(props: KonvaMockProps) {
  return (
    <circle
      {...presentationProps(props)}
      {...eventProps(props)}
      cx={Number(props.x ?? 0)}
      cy={Number(props.y ?? 0)}
      r={props.radius ?? 0}
    />
  );
}

export function Text(props: KonvaMockProps) {
  return (
    <text
      {...presentationProps(props)}
      x={Number(props.x ?? 0)}
      y={Number(props.y ?? 0)}
      fontSize={props.fontSize}
      fontStyle={props.fontStyle}
    >
      {props.text}
    </text>
  );
}
