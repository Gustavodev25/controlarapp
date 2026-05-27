import React, { useEffect, useState } from 'react';
import { InteractionManager, StyleProp, Text, TextStyle, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

interface AnimatedCurrencyProps {
  value: number;
  isVisible?: boolean;
  style?: StyleProp<TextStyle>;
  prefix?: string;
  prefixStyle?: StyleProp<TextStyle>;
  tight?: boolean;
}

export function AnimatedCurrency({
  value,
  isVisible = true,
  style,
  prefix = 'R$ ',
  prefixStyle,
  tight = false
}: AnimatedCurrencyProps) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      // Adiciona um pequeno delay (50ms) para acomodar processamentos da UI thread
      setTimeout(() => {
        setDisplayValue(value);
      }, 50);
    });

    return () => task.cancel();
  }, [value]);

  if (!isVisible) {
    return (
      <Animated.Text
        entering={FadeIn.duration(300)}
        exiting={FadeOut.duration(300)}
        style={style}
      >
        {prefix}••••
      </Animated.Text>
    );
  }

  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
      {prefix ? <Text style={prefixStyle || style}>{prefix}</Text> : null}
      <Animated.Text
        entering={FadeIn.duration(300)}
        exiting={FadeOut.duration(300)}
        style={style}
      >
        {new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(displayValue)}
      </Animated.Text>
    </View>
  );
}
