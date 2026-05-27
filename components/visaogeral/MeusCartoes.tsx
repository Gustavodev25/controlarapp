import { StackCarousel } from '@/components/ui/StackCarousel';
import React, { useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { formatCurrencyAmount, type CreditCardCarouselItem, type InvoicePeriod } from './types';

const CREDIT_CARD_STACK_DEPTH = 3;

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

interface CreditCardStackItemProps {
  item: CreditCardCarouselItem;
  index: number;
  animatedIndex: SharedValue<number>;
  translateX: SharedValue<number>;
  totalCards: number;
  cardWidth: number;
  isValuesVisible: boolean;
  getCardInvoicePeriod: (cardId?: string | null) => InvoicePeriod;
  onPressCard: (card: CreditCardCarouselItem) => void;
}

interface MeusCartoesProps {
  data: CreditCardCarouselItem[];
  currentCardIndex: number;
  onSnapToItem: (index: number) => void;
  isValuesVisible: boolean;
  getCardInvoicePeriod: (cardId?: string | null) => InvoicePeriod;
  onPressCard: (card: CreditCardCarouselItem) => void;
}

const useCreditCardStackStyle = (
  index: number,
  animatedIndex: SharedValue<number>,
  translateX: SharedValue<number>,
  totalCards: number,
  cardWidth: number
) => {
  return useAnimatedStyle(() => {
    const dragIndexOffset = -translateX.value / cardWidth;
    const effectiveIndex = animatedIndex.value + dragIndexOffset;
    const diff = index - effectiveIndex;
    const clampedDiff = Math.min(Math.max(diff, -1), CREDIT_CARD_STACK_DEPTH);

    const absoluteDiff = Math.abs(diff);

    const translateXStack = interpolate(
      clampedDiff,
      [-1, 0, 1, 2, CREDIT_CARD_STACK_DEPTH],
      [-cardWidth * 0.78, 0, 14, 23, 30],
      Extrapolation.CLAMP
    );

    const translateY = interpolate(
      clampedDiff,
      [-1, 0, 1, 2, CREDIT_CARD_STACK_DEPTH],
      [10, 0, 8, 16, 24],
      Extrapolation.CLAMP
    );

    const baseScale = interpolate(
      clampedDiff,
      [-1, 0, 1, 2, CREDIT_CARD_STACK_DEPTH],
      [0.94, 1, 0.965, 0.93, 0.9],
      Extrapolation.CLAMP
    );

    const opacity = interpolate(
      clampedDiff,
      [-1, -0.2, 0, 1, 2, CREDIT_CARD_STACK_DEPTH],
      [0, 0.7, 1, 0.92, 0.72, 0],
      Extrapolation.CLAMP
    );

    const rotateZ = interpolate(
      clampedDiff,
      [-1, 0, 1, 2, CREDIT_CARD_STACK_DEPTH],
      [-7, 0, 1.5, 2.2, 2.8],
      Extrapolation.CLAMP
    );

    const transitionMorph = interpolate(
      absoluteDiff,
      [0, 0.5, 1],
      [0, 1, 0],
      Extrapolation.CLAMP
    );

    return {
      zIndex: Math.round((totalCards - Math.abs(diff)) * 100),
      opacity,
      transform: [
        { translateX: translateXStack },
        { translateY },
        { scaleX: baseScale + transitionMorph * 0.014 },
        { scaleY: baseScale - transitionMorph * 0.008 },
        { rotateZ: `${rotateZ}deg` },
      ],
    };
  });
};

const useCreditCardSurfaceStyle = (
  index: number,
  animatedIndex: SharedValue<number>,
  translateX: SharedValue<number>,
  cardWidth: number,
  pressProgress: SharedValue<number>
) => {
  return useAnimatedStyle(() => {
    const dragIndexOffset = -translateX.value / cardWidth;
    const effectiveIndex = animatedIndex.value + dragIndexOffset;
    const diff = index - effectiveIndex;
    const absoluteDiff = Math.abs(diff);

    const transitionMorph = interpolate(
      absoluteDiff,
      [0, 0.5, 1],
      [0, 1, 0],
      Extrapolation.CLAMP
    );

    const focusProgress = interpolate(
      absoluteDiff,
      [0, 0.75, 1],
      [1, 0.25, 0],
      Extrapolation.CLAMP
    );

    const pressed = pressProgress.value;

    return {
      borderRadius: 24 + focusProgress * 1.5 + transitionMorph * 3 - pressed * 1.2,
      transform: [
        { translateY: -focusProgress * 0.6 + pressed * 1.4 },
        { scaleX: 1 + transitionMorph * 0.012 - pressed * 0.012 },
        { scaleY: 1 - transitionMorph * 0.006 + pressed * 0.012 },
      ],
    };
  });
};

const useCreditCardContentStyle = (
  index: number,
  animatedIndex: SharedValue<number>,
  translateX: SharedValue<number>,
  cardWidth: number,
  pressProgress: SharedValue<number>
) => {
  return useAnimatedStyle(() => {
    const dragIndexOffset = -translateX.value / cardWidth;
    const effectiveIndex = animatedIndex.value + dragIndexOffset;
    const diff = index - effectiveIndex;
    const absoluteDiff = Math.abs(diff);

    const transitionMorph = interpolate(
      absoluteDiff,
      [0, 0.5, 1],
      [0, 1, 0],
      Extrapolation.CLAMP
    );

    const pressed = pressProgress.value;

    return {
      transform: [
        { translateY: -transitionMorph * 0.6 },
        { scaleX: 1 + transitionMorph * 0.004 - pressed * 0.003 },
        { scaleY: 1 - transitionMorph * 0.003 + pressed * 0.003 },
      ],
    };
  });
};

function PaginationDot({ active }: { active: boolean }) {
  const progress = useSharedValue(active ? 1 : 0);
  const impulse = useSharedValue(0);

  useEffect(() => {
    progress.value = withSpring(active ? 1 : 0, {
      damping: 14,
      stiffness: 190,
      mass: 0.65,
    });

    if (active) {
      impulse.value = 0;
      impulse.value = withSequence(
        withTiming(1, { duration: 120 }),
        withSpring(0, {
          damping: 10,
          stiffness: 150,
          mass: 0.52,
        })
      );
    }
  }, [active, progress, impulse]);

  const dotStyle = useAnimatedStyle(() => {
    const value = progress.value;
    const morph = impulse.value;

    return {
      width: 5 + value * 9 + morph * 2,
      height: 5,
      borderRadius: 2.5 + value * 2,
      backgroundColor: interpolateColor(
        value,
        [0, 1],
        ['#1A1A1A', '#D97757']
      ),
      transform: [
        { scaleX: 1 + morph * 0.16 },
        { scaleY: 1 - morph * 0.06 },
      ],
    };
  });

  return <Animated.View style={[styles.paginationDot, dotStyle]} />;
}

const CreditCardStackItem = React.memo(({
  item,
  index,
  animatedIndex,
  translateX,
  totalCards,
  cardWidth,
  isValuesVisible,
  getCardInvoicePeriod,
  onPressCard,
}: CreditCardStackItemProps) => {
  const pressProgress = useSharedValue(0);

  const animatedStyle = useCreditCardStackStyle(
    index,
    animatedIndex,
    translateX,
    totalCards,
    cardWidth
  );

  const cardSurfaceStyle = useCreditCardSurfaceStyle(
    index,
    animatedIndex,
    translateX,
    cardWidth,
    pressProgress
  );

  const cardContentStyle = useCreditCardContentStyle(
    index,
    animatedIndex,
    translateX,
    cardWidth,
    pressProgress
  );

  const selectedPeriod = getCardInvoicePeriod(item.id);

  const selectedRawValue =
    selectedPeriod === 'past' ? item.past :
      selectedPeriod === 'next' ? item.next :
        selectedPeriod === 'total_used' ? item.used :
          selectedPeriod === 'none' ? 0 :
            item.current;

  const selectedValue = Math.abs(selectedRawValue);

  const percentage = item.limit > 0
    ? Math.min((selectedValue / item.limit) * 100, 100)
    : 0;

  const progressColor = percentage > 90 ? '#FF4C4C' : percentage > 75 ? '#D97757' : '#4CAF50';

  return (
    <Animated.View style={[styles.stackCardWrapper, animatedStyle, styles.stackCardPosition]}>
      <AnimatedTouchableOpacity
        activeOpacity={1}
        style={[styles.card, cardSurfaceStyle]}
        onPress={() => onPressCard(item)}
        onPressIn={() => {
          pressProgress.value = withSpring(1, {
            damping: 16,
            stiffness: 250,
            mass: 0.42,
          });
        }}
        onPressOut={() => {
          pressProgress.value = withSpring(0, {
            damping: 15,
            stiffness: 215,
            mass: 0.45,
          });
        }}
      >
        <Animated.View style={[styles.cardAnimatedContent, cardContentStyle]}>
          <View style={styles.cardMainRow}>
            <View style={styles.cardInfo}>
              <View style={styles.nameRow}>
                <Text
                  numberOfLines={1}
                  ellipsizeMode="tail"
                  style={styles.cardName}
                >
                  {item.name}
                </Text>

                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: percentage > 85 ? '#FF4C4C' : '#444' }
                  ]}
                />
              </View>

              <View style={styles.amountRow}>
                <Text style={styles.currency}>
                  {selectedRawValue < 0 ? '-R$' : 'R$'}
                </Text>

                {isValuesVisible ? (
                  <Text style={styles.amount}>
                    {formatCurrencyAmount(selectedValue)}
                  </Text>
                ) : (
                  <Text style={styles.amount}>
                    ••••
                  </Text>
                )}
              </View>
            </View>

            <View style={styles.periodInfo}>
              <View style={styles.periodBadge}>
                <Text style={styles.periodText}>
                  {
                    selectedPeriod === 'past' ? 'ANTERIOR' :
                      selectedPeriod === 'next' ? 'PRÓXIMA' :
                        selectedPeriod === 'total_used' ? 'TOTAL USADO' :
                          selectedPeriod === 'none' ? 'OCULTO' : 'ATUAL'
                  }
                </Text>
              </View>

              {item.dueDate && (
                <Text style={styles.dueDate}>
                  {new Date(item.dueDate).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit'
                  })}
                </Text>
              )}
            </View>
          </View>

          <View style={styles.progressContainer}>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${percentage}%`,
                    backgroundColor: progressColor
                  }
                ]}
              />
            </View>

            <View style={styles.limitRow}>
              <View style={styles.limitItem}>
                <Text style={styles.limitLabel}>USADO</Text>
                <Text style={styles.limitValue}>
                  {isValuesVisible
                    ? `R$ ${item.used.toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}`
                    : '••••'}
                </Text>
              </View>

              <View style={styles.limitItem}>
                <Text style={styles.limitLabel}>LIMITE</Text>
                <Text style={styles.limitValue}>
                  {isValuesVisible
                    ? `R$ ${item.limit.toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}`
                    : '••••'}
                </Text>
              </View>
            </View>
          </View>
        </Animated.View>
      </AnimatedTouchableOpacity>
    </Animated.View>
  );
});

const MeusCartoes = React.memo(({
  data,
  currentCardIndex,
  onSnapToItem,
  isValuesVisible,
  getCardInvoicePeriod,
  onPressCard,
}: MeusCartoesProps) => {
  const { width } = useWindowDimensions();
  const cardWidth = width - 32;

  if (data.length === 0) {
    return null;
  }

  return (
    <View style={styles.section}>
      <Text style={styles.title}>
        Meus Cartões
      </Text>

      <StackCarousel
        data={data}
        onSnapToItem={onSnapToItem}
        cardHeight={120}
        cardWidth={cardWidth}
        renderItem={({ item, index, animatedIndex, translateX, totalCards }) => (
          <CreditCardStackItem
            item={item}
            index={index}
            animatedIndex={animatedIndex}
            translateX={translateX}
            totalCards={totalCards}
            cardWidth={cardWidth}
            isValuesVisible={isValuesVisible}
            getCardInvoicePeriod={getCardInvoicePeriod}
            onPressCard={onPressCard}
          />
        )}
      />

      <View style={styles.pagination}>
        {data.map((item, index) => (
          <PaginationDot
            key={item.key}
            active={currentCardIndex === index}
          />
        ))}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  section: {
    marginTop: 24,
  },

  title: {
    fontSize: 17,
    fontFamily: 'AROneSans_400Regular',
    color: '#808080',
    marginBottom: 12,
    marginLeft: 4,
  },

  stackCardWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  stackCardPosition: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },

  card: {
    marginTop: 0,
    width: '100%',
    height: '100%',
    paddingHorizontal: 20,
    paddingVertical: 14,
    flexDirection: 'column',
    alignItems: 'stretch',
    backgroundColor: '#111111',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#161616',
    overflow: 'hidden',
  },

  cardAnimatedContent: {
    flex: 1,
    width: '100%',
    height: '100%',
  },

  cardMainRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },

  cardInfo: {
    flex: 1,
  },

  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },

  cardName: {
    fontSize: 15,
    fontFamily: 'AROneSans_400Regular',
    color: '#909090',
    maxWidth: '70%',
  },

  statusDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    flexShrink: 0,
  },

  amountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },

  currency: {
    fontSize: 16,
    fontFamily: 'AROneSans_400Regular',
    color: '#909090',
    marginRight: 2,
  },

  amount: {
    fontSize: 24,
    fontFamily: 'AROneSans_400Regular',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },

  periodInfo: {
    alignItems: 'flex-end',
    gap: 6,
  },

  periodBadge: {
    backgroundColor: '#181818',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#222',
  },

  periodText: {
    fontSize: 9,
    fontFamily: 'AROneSans_400Regular',
    color: '#909090',
    letterSpacing: 0.5,
  },

  dueDate: {
    fontSize: 9,
    fontFamily: 'AROneSans_400Regular',
    color: '#444444',
  },

  progressContainer: {
    width: '100%',
    marginTop: 10,
  },

  progressTrack: {
    width: '100%',
    height: 2,
    backgroundColor: '#1A1A1A',
    borderRadius: 1,
  },

  progressFill: {
    height: '100%',
    borderRadius: 1,
  },

  limitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },

  limitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  limitLabel: {
    fontSize: 10,
    color: '#444444',
    fontFamily: 'AROneSans_400Regular',
    letterSpacing: 0.5,
  },

  limitValue: {
    fontSize: 11,
    color: '#808080',
    fontFamily: 'AROneSans_400Regular',
  },

  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
    marginTop: 10,
    marginBottom: 16,
  },

  paginationDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#1A1A1A',
  },
});

CreditCardStackItem.displayName = 'CreditCardStackItem';
MeusCartoes.displayName = 'MeusCartoes';

export type { CreditCardCarouselItem };
export default MeusCartoes;