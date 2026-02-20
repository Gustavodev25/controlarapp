import { usePerformanceBudget } from '@/hooks/usePerformanceBudget';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

const EDGE_MARGIN = 10;
const TOP_MARGIN = 48;
const BOTTOM_MARGIN = 20;
const DRAG_THRESHOLD = 4;
const SHORTCUT_SIZE = 46;
const PANEL_WIDTH = 232;
const PANEL_HEIGHT = 124;
const DRAG_INERTIA = 120;

interface Position {
  x: number;
  y: number;
}

function clampPosition(raw: Position, width: number, height: number, isOpen: boolean): Position {
  const elementWidth = isOpen ? PANEL_WIDTH : SHORTCUT_SIZE;
  const elementHeight = isOpen ? PANEL_HEIGHT : SHORTCUT_SIZE;

  const minX = EDGE_MARGIN;
  const maxX = Math.max(EDGE_MARGIN, width - elementWidth - EDGE_MARGIN);
  const minY = TOP_MARGIN;
  const maxY = Math.max(TOP_MARGIN, height - elementHeight - BOTTOM_MARGIN);

  return {
    x: Math.min(maxX, Math.max(minX, raw.x)),
    y: Math.min(maxY, Math.max(minY, raw.y)),
  };
}

export function PerformanceHUD() {
  const { flags, config, latestSample, lod, tierInfo, budget, activeAnimationCount } = usePerformanceBudget();
  const { width, height } = useWindowDimensions();
  const [isOpen, setIsOpen] = useState(false);

  const position = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const dragProgress = useRef(new Animated.Value(0)).current;
  const currentPositionRef = useRef<Position>({ x: 0, y: 0 });
  const gestureStartRef = useRef<Position>({ x: 0, y: 0 });
  const initializedRef = useRef(false);

  const setPosition = useCallback(
    (next: Position) => {
      currentPositionRef.current = next;
      position.setValue(next);
    },
    [position]
  );

  const springToPosition = useCallback(
    (next: Position, velocity?: { x: number; y: number }) => {
      const resolvedVelocity = velocity ?? { x: 0, y: 0 };
      currentPositionRef.current = next;
      Animated.spring(position, {
        toValue: next,
        tension: 130,
        friction: 12,
        useNativeDriver: false,
        velocity: resolvedVelocity,
      }).start();
    },
    [position]
  );

  const setDragging = useCallback(
    (active: boolean) => {
      Animated.spring(dragProgress, {
        toValue: active ? 1 : 0,
        tension: 220,
        friction: 18,
        useNativeDriver: false,
      }).start();
    },
    [dragProgress]
  );

  useEffect(() => {
    const defaultPosition = {
      x: Math.max(EDGE_MARGIN, width - SHORTCUT_SIZE - EDGE_MARGIN),
      y: TOP_MARGIN,
    };

    if (!initializedRef.current) {
      initializedRef.current = true;
      setPosition(defaultPosition);
      return;
    }

    const clamped = clampPosition(currentPositionRef.current, width, height, isOpen);
    if (clamped.x !== currentPositionRef.current.x || clamped.y !== currentPositionRef.current.y) {
      springToPosition(clamped);
    }
  }, [height, isOpen, setPosition, springToPosition, width]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dx) > DRAG_THRESHOLD || Math.abs(gestureState.dy) > DRAG_THRESHOLD,
        onPanResponderGrant: () => {
          setDragging(true);
          position.stopAnimation((value) => {
            const raw = value as Partial<Position> | undefined;
            const basePosition =
              typeof raw?.x === 'number' && typeof raw?.y === 'number'
                ? { x: raw.x, y: raw.y }
                : currentPositionRef.current;
            const clamped = clampPosition(basePosition, width, height, isOpen);
            setPosition(clamped);
            gestureStartRef.current = clamped;
          });
        },
        onPanResponderStart: () => {
          gestureStartRef.current = { ...currentPositionRef.current };
        },
        onPanResponderMove: (_, gestureState) => {
          const raw = {
            x: gestureStartRef.current.x + gestureState.dx,
            y: gestureStartRef.current.y + gestureState.dy,
          };
          setPosition(clampPosition(raw, width, height, isOpen));
        },
        onPanResponderRelease: (_, gestureState) => {
          setDragging(false);
          const projected = {
            x: currentPositionRef.current.x + gestureState.vx * DRAG_INERTIA,
            y: currentPositionRef.current.y + gestureState.vy * DRAG_INERTIA,
          };
          const final = clampPosition(projected, width, height, isOpen);
          springToPosition(final, { x: gestureState.vx, y: gestureState.vy });
        },
        onPanResponderTerminate: () => {
          setDragging(false);
          springToPosition(clampPosition(currentPositionRef.current, width, height, isOpen));
        },
      }),
    [height, isOpen, position, setDragging, setPosition, springToPosition, width]
  );

  const scale = useMemo(
    () =>
      dragProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 1.06],
      }),
    [dragProgress]
  );

  const opacity = useMemo(
    () =>
      dragProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 0.95],
      }),
    [dragProgress]
  );

  if (!flags.perfV2Enabled || !config.realtimeHud || !latestSample) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.anchor,
        {
          opacity,
          transform: [{ translateX: position.x }, { translateY: position.y }, { scale }],
        },
      ]}
      {...panResponder.panHandlers}
    >
      {isOpen ? (
        <View style={[styles.container, styles.dragGlow]}>
          <Pressable onPress={() => setIsOpen(false)} style={styles.header} hitSlop={8}>
            <Text style={styles.title}>PERF</Text>
            <Text style={styles.collapse}>minimizar</Text>
          </Pressable>
          <Text style={styles.line}>
            {tierInfo.tier} LOD{lod} @{budget.targetFps}fps
          </Text>
          <Text style={styles.line}>
            UI {latestSample.uiFps.toFixed(1)} | JS {latestSample.jsFps.toFixed(1)}
          </Text>
          <Text style={styles.line}>
            p95 {latestSample.p95FrameMs.toFixed(1)}ms | Drop {latestSample.droppedFramesPct.toFixed(1)}%
          </Text>
          <Text style={styles.line}>Lag {latestSample.jsLagP95Ms.toFixed(1)}ms | Lottie {activeAnimationCount}</Text>
          <Text numberOfLines={1} style={styles.screen}>
            {latestSample.screen}
          </Text>
        </View>
      ) : (
        <Pressable onPress={() => setIsOpen(true)} style={[styles.shortcut, styles.dragGlow]} hitSlop={8}>
          <Text style={styles.shortcutLabel}>PERF</Text>
        </Pressable>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  anchor: {
    position: 'absolute',
    left: 0,
    top: 0,
    zIndex: 9999,
  },
  shortcut: {
    width: SHORTCUT_SIZE,
    height: SHORTCUT_SIZE,
    borderRadius: SHORTCUT_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.78)',
    borderColor: 'rgba(217,119,87,0.75)',
    borderWidth: 1,
  },
  dragGlow: {
    shadowColor: '#D97757',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 8,
  },
  shortcutLabel: {
    color: '#D97757',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  container: {
    width: PANEL_WIDTH,
    backgroundColor: 'rgba(0,0,0,0.72)',
    borderColor: 'rgba(217,119,87,0.6)',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  title: {
    color: '#D97757',
    fontSize: 10,
    fontWeight: '700',
  },
  collapse: {
    color: '#B8B8B8',
    fontSize: 9,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  line: {
    color: '#E9E9E9',
    fontSize: 10,
    fontWeight: '600',
    lineHeight: 13,
  },
  screen: {
    color: '#B8B8B8',
    fontSize: 9,
    marginTop: 2,
  },
});
