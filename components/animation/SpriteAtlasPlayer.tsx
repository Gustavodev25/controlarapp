import { usePerformanceBudget } from '@/hooks/usePerformanceBudget';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, ImageSourcePropType, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

export interface SpriteAtlasMeta {
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
  columns: number;
}

interface SpriteAtlasPlayerProps {
  source: ImageSourcePropType;
  meta: SpriteAtlasMeta;
  style?: StyleProp<ViewStyle>;
  autoPlay?: boolean;
  loop?: boolean;
  qualityScale?: 1 | 0.85 | 0.7;
  onFinish?: () => void;
}

export function SpriteAtlasPlayer({
  source,
  meta,
  style,
  autoPlay = true,
  loop = true,
  qualityScale,
  onFinish,
}: SpriteAtlasPlayerProps) {
  const { budget } = usePerformanceBudget();
  const scale = qualityScale ?? budget.spriteScale;

  const [frame, setFrame] = useState(0);
  const frameRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef(0);
  const playingRef = useRef(autoPlay);

  const frameWidth = Math.round(meta.frameWidth * scale);
  const frameHeight = Math.round(meta.frameHeight * scale);
  const totalRows = Math.ceil(meta.frameCount / meta.columns);
  const atlasWidth = frameWidth * meta.columns;
  const atlasHeight = frameHeight * totalRows;

  useEffect(() => {
    playingRef.current = autoPlay;
  }, [autoPlay]);

  useEffect(() => {
    frameRef.current = frame;
  }, [frame]);

  useEffect(() => {
    const frameIntervalMs = 1000 / budget.targetFps;

    const tick = (ts: number) => {
      if (!playingRef.current) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      if (lastTickRef.current === 0) {
        lastTickRef.current = ts;
      }

      if (ts - lastTickRef.current >= frameIntervalMs) {
        lastTickRef.current = ts;
        const current = frameRef.current;
        const next = current + 1;

        if (next >= meta.frameCount) {
          if (loop) {
            frameRef.current = 0;
            setFrame(0);
          } else {
            frameRef.current = meta.frameCount - 1;
            setFrame(meta.frameCount - 1);
            playingRef.current = false;
            onFinish?.();
          }
        } else {
          frameRef.current = next;
          setFrame(next);
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [budget.targetFps, loop, meta.frameCount, onFinish]);

  const { offsetX, offsetY } = useMemo(() => {
    const col = frame % meta.columns;
    const row = Math.floor(frame / meta.columns);
    return {
      offsetX: -(col * frameWidth),
      offsetY: -(row * frameHeight),
    };
  }, [frame, meta.columns, frameWidth, frameHeight]);

  return (
    <View style={[styles.viewport, { width: frameWidth, height: frameHeight }, style]}>
      <Image
        source={source}
        style={{
          width: atlasWidth,
          height: atlasHeight,
          transform: [{ translateX: offsetX }, { translateY: offsetY }],
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  viewport: {
    overflow: 'hidden',
  },
});
