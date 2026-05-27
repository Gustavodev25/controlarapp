import { ChevronRight } from 'lucide-react-native';
import React from 'react';
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
  withSpring,
} from 'react-native-reanimated';
import { formatCurrencyAmount, type BankAccountOverviewData } from './types';

interface MinhasContasProps {
  bankAccountData: BankAccountOverviewData;
  isValuesVisible: boolean;
  onPress: () => void;
}

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

interface MorphCardProps extends TouchableOpacityProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

function MorphCard({
  children,
  style,
  onPressIn,
  onPressOut,
  ...props
}: MorphCardProps) {
  const pressProgress = useSharedValue(0);
  const morphProgress = useSharedValue(0);

  const cardAnimatedStyle = useAnimatedStyle(() => {
    const pressed = pressProgress.value;
    const morph = morphProgress.value;

    return {
      borderRadius: 20 + morph * 4 - pressed * 1.2,
      transform: [
        { translateY: pressed * 1.4 },
        { scaleX: 1 + morph * 0.012 - pressed * 0.012 },
        { scaleY: 1 + morph * 0.016 + pressed * 0.008 },
      ],
    };
  });

  const contentAnimatedStyle = useAnimatedStyle(() => {
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
      style={[styles.card, style, cardAnimatedStyle]}
    >
      <Animated.View style={[styles.cardContent, contentAnimatedStyle]}>
        {children}
      </Animated.View>
    </AnimatedTouchableOpacity>
  );
}

const MinhasContas = React.memo(({
  bankAccountData,
  isValuesVisible,
  onPress,
}: MinhasContasProps) => {
  const chevronPress = useSharedValue(0);

  const chevronAnimatedStyle = useAnimatedStyle(() => {
    const pressed = chevronPress.value;

    return {
      transform: [
        { translateX: pressed * 2 },
        { scaleX: 1 + pressed * 0.06 },
        { scaleY: 1 - pressed * 0.03 },
      ],
    };
  });

  return (
    <View>
      <Text style={styles.title}>
        Minhas Contas
      </Text>

      <MorphCard
        onPress={onPress}
        onPressIn={() => {
          chevronPress.value = withSpring(1, {
            damping: 16,
            stiffness: 250,
            mass: 0.42,
          });
        }}
        onPressOut={() => {
          chevronPress.value = withSpring(0, {
            damping: 15,
            stiffness: 215,
            mass: 0.45,
          });
        }}
      >
        <View style={styles.row}>
          <View style={styles.content}>
            <View style={styles.labelRow}>
              <Text
                numberOfLines={1}
                ellipsizeMode="tail"
                style={styles.label}
              >
                Saldos Disponíveis
              </Text>
            </View>

            <View style={styles.amountRow}>
              <Text style={styles.currency}>
                {bankAccountData.totalBalance < 0 ? '-R$' : 'R$'}
              </Text>

              {isValuesVisible ? (
                <Text style={styles.amount}>
                  {formatCurrencyAmount(bankAccountData.totalBalance)}
                </Text>
              ) : (
                <Text style={styles.amount}>
                  ••••
                </Text>
              )}
            </View>
          </View>

          <View style={styles.trailing}>
            <View style={styles.countBadge}>
              <Text style={styles.countText}>
                {bankAccountData.count} {bankAccountData.count === 1 ? 'CONTA' : 'CONTAS'}
              </Text>
            </View>

            <Animated.View style={chevronAnimatedStyle}>
              <ChevronRight size={14} color="#444444" />
            </Animated.View>
          </View>
        </View>
      </MorphCard>
    </View>
  );
});

const styles = StyleSheet.create({
  title: {
    fontSize: 17,
    fontFamily: 'AROneSans_400Regular',
    color: '#808080',
    marginBottom: 12,
    marginTop: 24,
    marginLeft: 4,
  },

  card: {
    marginTop: 0,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#111111',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#161616',
    height: 96,
    justifyContent: 'center',
    overflow: 'hidden',
  },

  cardContent: {
    flex: 1,
    justifyContent: 'center',
  },

  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },

  content: {
    flex: 1,
  },

  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },

  label: {
    fontSize: 15,
    fontFamily: 'AROneSans_400Regular',
    color: '#909090',
    flex: 1,
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

  trailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  countBadge: {
    backgroundColor: '#181818',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#222',
  },

  countText: {
    fontSize: 10,
    color: '#909090',
    fontFamily: 'AROneSans_400Regular',
  },
});

MinhasContas.displayName = 'MinhasContas';

export default MinhasContas;