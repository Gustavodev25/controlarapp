import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import React, { useEffect, useMemo } from 'react';
import {
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableOpacityProps,
  View,
  ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { VictoryLabel, VictoryPie } from 'victory-native';
import type { CategoryExpenseDatum, ExpenseSource } from './types';

interface DespesasPorCategoriaProps {
  pieData: CategoryExpenseDatum[];
  expenseSource: ExpenseSource;
  chartAnimationMs: number;
  onCycleExpenseSource: (direction: number) => void;
}

interface MorphTouchableProps extends TouchableOpacityProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  radius?: number;
}

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

const getExpenseSourceLabel = (expenseSource: ExpenseSource) => {
  switch (expenseSource) {
    case 'credit':
      return 'Cartão';
    case 'checking':
      return 'Conta';
    default:
      return 'Cartão';
  }
};

function MorphTouchable({
  children,
  style,
  radius = 12,
  onPressIn,
  onPressOut,
  ...props
}: MorphTouchableProps) {
  const pressProgress = useSharedValue(0);
  const morphProgress = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => {
    const pressed = pressProgress.value;
    const morph = morphProgress.value;

    return {
      borderRadius: radius + morph * 3 - pressed * 0.8,
      transform: [
        { translateY: pressed * 1.1 },
        { scaleX: 1 + morph * 0.01 - pressed * 0.01 },
        { scaleY: 1 + morph * 0.014 + pressed * 0.006 },
      ],
    };
  });

  const contentStyle = useAnimatedStyle(() => {
    const pressed = pressProgress.value;
    const morph = morphProgress.value;

    return {
      transform: [
        { scaleX: 1 + morph * 0.004 - pressed * 0.003 },
        { scaleY: 1 - morph * 0.003 + pressed * 0.003 },
      ],
    };
  });

  return (
    <AnimatedTouchableOpacity
      {...props}
      activeOpacity={1}
      onPressIn={(event) => {
        pressProgress.value = withSpring(1, {
          damping: 16,
          stiffness: 250,
          mass: 0.42,
        });

        morphProgress.value = withSpring(1, {
          damping: 13,
          stiffness: 190,
          mass: 0.48,
        });

        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        pressProgress.value = withSpring(0, {
          damping: 15,
          stiffness: 215,
          mass: 0.45,
        });

        morphProgress.value = withSpring(0, {
          damping: 11,
          stiffness: 145,
          mass: 0.52,
        });

        onPressOut?.(event);
      }}
      style={[style, animatedStyle]}
    >
      <Animated.View style={contentStyle}>
        {children}
      </Animated.View>
    </AnimatedTouchableOpacity>
  );
}

const DespesasPorCategoria = React.memo(({
  pieData,
  expenseSource,
  chartAnimationMs,
  onCycleExpenseSource,
}: DespesasPorCategoriaProps) => {
  const selectorMorph = useSharedValue(0);
  const cardMorph = useSharedValue(0);
  const contentMorph = useSharedValue(0);

  const dataPulseKey = useMemo(() => {
    return `${expenseSource}-${pieData.length}-${pieData.map(item => `${item.x}:${item.y}`).join('|')}`;
  }, [expenseSource, pieData]);

  useEffect(() => {
    selectorMorph.value = 0;
    selectorMorph.value = withSequence(
      withTiming(1, { duration: 140 }),
      withSpring(0, {
        damping: 11,
        stiffness: 150,
        mass: 0.55,
      })
    );

    cardMorph.value = 0;
    cardMorph.value = withSequence(
      withTiming(1, { duration: 165 }),
      withSpring(0, {
        damping: 12,
        stiffness: 145,
        mass: 0.62,
      })
    );

    contentMorph.value = 0;
    contentMorph.value = withSequence(
      withTiming(1, { duration: 155 }),
      withSpring(0, {
        damping: 12,
        stiffness: 150,
        mass: 0.58,
      })
    );
  }, [dataPulseKey, selectorMorph, cardMorph, contentMorph]);

  const selectorAnimatedStyle = useAnimatedStyle(() => {
    const morph = selectorMorph.value;

    return {
      borderRadius: 20 + morph * 5,
      transform: [
        { translateY: -morph * 0.8 },
        { scaleX: 1 + morph * 0.018 },
        { scaleY: 1 - morph * 0.006 },
      ],
    };
  });

  const cardAnimatedStyle = useAnimatedStyle(() => {
    const morph = cardMorph.value;

    return {
      borderRadius: 24 + morph * 6,
      transform: [
        { translateY: -morph * 1.4 },
        { scaleX: 1 + morph * 0.012 },
        { scaleY: 1 - morph * 0.005 },
      ],
    };
  });

  const contentAnimatedStyle = useAnimatedStyle(() => {
    const morph = contentMorph.value;

    return {
      transform: [
        { translateY: -morph * 0.7 },
        { scaleX: 1 + morph * 0.004 },
        { scaleY: 1 - morph * 0.003 },
      ],
    };
  });

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.title}>
          Despesas por Categoria
        </Text>

        <Animated.View style={[styles.sourceSelector, selectorAnimatedStyle]}>
          <MorphTouchable
            radius={10}
            onPress={() => onCycleExpenseSource(-1)}
            style={styles.sourceButton}
          >
            <ChevronLeft size={14} color="#666666" />
          </MorphTouchable>

          <Animated.View style={contentAnimatedStyle}>
            <Text style={styles.sourceLabel}>
              {getExpenseSourceLabel(expenseSource)}
            </Text>
          </Animated.View>

          <MorphTouchable
            radius={10}
            onPress={() => onCycleExpenseSource(1)}
            style={styles.sourceButton}
          >
            <ChevronRight size={14} color="#666666" />
          </MorphTouchable>
        </Animated.View>
      </View>

      {pieData.length > 0 ? (
        <Animated.View style={[styles.chartCard, cardAnimatedStyle]}>
          <Animated.View style={[styles.chartInner, contentAnimatedStyle]}>
            <View style={styles.chartContainer}>
              <VictoryPie
                key={expenseSource}
                animate={{
                  duration: chartAnimationMs,
                  easing: 'exp',
                }}
                data={pieData}
                width={124}
                height={124}
                padding={{ top: 6, bottom: 6, left: 6, right: 6 }}
                colorScale={pieData.map(d => d.color)}
                innerRadius={30}
                cornerRadius={6}
                padAngle={3}
                style={{
                  data: { fillOpacity: 0.9, stroke: 'none' },
                  labels: {
                    fill: '#1A1A1A',
                    fontSize: 10,
                    fontFamily: 'AROneSans_400Regular',
                  },
                }}
                labelRadius={({ innerRadius }) => (
                  typeof innerRadius === 'number' ? innerRadius + 18 : 50
                )}
                labelComponent={
                  <VictoryLabel
                    angle={0}
                    textAnchor="middle"
                    verticalAnchor="middle"
                    style={{
                      fill: '#FFFFFF',
                      fontSize: 10,
                      fontFamily: 'AROneSans_400Regular',
                    }}
                  />
                }
                labels={({ datum }) => `${Math.round(datum.percent)}%`}
              />
            </View>

            <View style={styles.legend}>
              {pieData.map((item, index) => (
                <View key={`${item.x}-${index}`} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: item.color }]} />

                  <Text
                    style={styles.legendLabel}
                    numberOfLines={1}
                  >
                    {item.x}
                  </Text>
                </View>
              ))}
            </View>
          </Animated.View>
        </Animated.View>
      ) : (
        <Animated.View style={[styles.emptyCard, cardAnimatedStyle]}>
          <Animated.View style={contentAnimatedStyle}>
            <Text style={styles.emptyText}>
              Nenhuma despesa encontrada
            </Text>
          </Animated.View>
        </Animated.View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  section: {
    marginTop: 24,
    paddingHorizontal: 0,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },

  title: {
    fontSize: 17,
    fontFamily: 'AROneSans_400Regular',
    color: '#808080',
    marginLeft: 4,
  },

  sourceSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#161616',
    gap: 4,
    overflow: 'hidden',
  },

  sourceButton: {
    padding: 2,
    borderRadius: 10,
  },

  sourceLabel: {
    color: '#909090',
    fontSize: 11,
    fontFamily: 'AROneSans_400Regular',
    minWidth: 60,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  chartCard: {
    flexDirection: 'row',
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    backgroundColor: '#111111',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#161616',
    width: '100%',
    gap: 12,
    minHeight: 148,
    justifyContent: 'center',
    overflow: 'hidden',
  },

  chartInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    justifyContent: 'center',
  },

  chartContainer: {
    width: '44%',
    minWidth: 124,
    maxWidth: 150,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },

  legend: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'center',
    gap: 8,
    paddingLeft: 8,
  },

  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  legendLabel: {
    color: '#909090',
    fontSize: 12,
    fontFamily: 'AROneSans_400Regular',
    flex: 1,
  },

  emptyCard: {
    justifyContent: 'center',
    padding: 32,
    alignItems: 'center',
    backgroundColor: '#111111',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#161616',
    width: '100%',
    overflow: 'hidden',
  },

  emptyText: {
    color: '#909090',
    fontFamily: 'AROneSans_400Regular',
  },
});

DespesasPorCategoria.displayName = 'DespesasPorCategoria';

export default DespesasPorCategoria;