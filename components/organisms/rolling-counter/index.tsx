import { BlurView, type BlurViewProps } from "expo-blur";
import { type FC, memo, useState } from "react";
import { Platform, StyleSheet, Text, View, ViewStyle } from "react-native";
import Animated, {
    Easing,
    interpolate,
    useAnimatedProps,
    useAnimatedReaction,
    useAnimatedStyle,
    useDerivedValue,
    useSharedValue,
    withSpring,
    withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { SPRING_CONFIG } from "./const";
import type { ICounter, IReusableDigit } from "./types";

const AnimatedBlur =
    Animated.createAnimatedComponent<Partial<BlurViewProps>>(BlurView);

const getDigitAtPlace = <T extends number, I extends number>(
    num: T,
    index: I,
): number => {
    "worklet";
    const str = Math.abs(Math.floor(num)).toString();
    return parseInt(str[str.length - 1 - index] || "0", 10);
};

const getDigitCount = <T extends number>(num: T): number => {
    "worklet";
    return Math.max(Math.abs(Math.floor(num)).toString().length, 1);
};

const CounterDigit: FC<IReusableDigit> = memo<IReusableDigit>(
    ({
        place,
        counterValue,
        height,
        width,
        color,
        fontSize,
        fontFamily,
        letterSpacing,
        springConfig,
    }: IReusableDigit):
        | (React.JSX.Element & React.ReactNode & React.ReactElement)
        | null => {
        const currentDigit = useDerivedValue<number>(() =>
            getDigitAtPlace(counterValue.value, place),
        );
        const slideY = useSharedValue<number>(0);
        const digitSlideStylez = useAnimatedStyle<Pick<ViewStyle, "transform">>(
            () => {
                const targetY = -height * currentDigit.value;
                slideY.value = withSpring(targetY, {
                    ...springConfig,
                });
                return {
                    transform: [{ translateY: slideY.value }],
                };
            },
        );
        const blurEffectPropz = useAnimatedProps<Pick<BlurViewProps, "intensity">>(
            () => {
                const targetY = -height * currentDigit.value;
                const delta = Math.abs(slideY.value - targetY);
                const isMoving = delta > 0.5;
                return {
                    intensity: isMoving
                        ? withSpring<number>(interpolate(delta, [0, height], [0, 3.5]))
                        : 0,
                };
            },
        );
        return (
            <View
                style={{
                    height,
                    width,
                    overflow: "hidden",
                }}
            >
                <Animated.View style={digitSlideStylez}>
                    {Array.from({ length: 10 }, (_, i) => (
                        <Text
                            key={i}
                            style={{
                                height,
                                width,
                                textAlign: "center",
                                lineHeight: height,
                                fontSize,
                                fontFamily,
                                fontWeight: fontFamily ? undefined : "bold",
                                color,
                                letterSpacing,
                                fontVariant: fontFamily ? undefined : ["tabular-nums"],
                            }}
                        >
                            {i}
                        </Text>
                    ))}
                    {Platform.OS === "ios" && (
                        <AnimatedBlur
                            animatedProps={blurEffectPropz}
                            style={StyleSheet.absoluteFill}
                            pointerEvents="none"
                            // @ts-ignore
                            tint="default"
                        />
                    )}
                </Animated.View>
            </View>
        );
    },
);

const getSeparatorCount = (digitCount: number): number => {
    "worklet";
    if (digitCount <= 3) return 0;
    return Math.floor((digitCount - 1) / 3);
};

const RollingCounter: FC<ICounter> = memo(
    ({
        value,
        height = 60,
        width = 40,
        fontSize = 48,
        color = "#000",
        fontFamily,
        letterSpacing,
        springConfig = SPRING_CONFIG,
    }: ICounter):
        | (React.JSX.Element & React.ReactNode & React.ReactElement)
        | null => {
        const internalCounter = useSharedValue<number>(0);
        const animatedValue = typeof value === "number" ? internalCounter : value;
        const [totalDigits, setTotalDigits] = useState<number>(() => {
            const initialValue = typeof value === "number" ? value : value.value;
            return getDigitCount<number>(initialValue);
        });
        useDerivedValue<void>(() => {
            if (typeof value === "number") {
                internalCounter.value = value;
            }
        });
        useAnimatedReaction<number>(
            () => getDigitCount<number>(animatedValue.value),
            (newCount, prevCount) => {
                if (newCount !== prevCount) {
                    scheduleOnRN(setTotalDigits, newCount);
                }
            },
            [animatedValue],
        );

        const separatorWidth = width * 0.5;

        const containerAnimStyle = useAnimatedStyle<
            Partial<Pick<ViewStyle, "width">>
        >(() => {
            const digitCount = getDigitCount<number>(animatedValue.value);
            const sepCount = getSeparatorCount(digitCount);
            return {
                width: withTiming<number>(
                    digitCount * width + sepCount * separatorWidth,
                    {
                        duration: 250,
                        easing: Easing.inOut(Easing.ease),
                    },
                ),
            };
        });
        return (
            <Animated.View style={[styles.rowContainer, containerAnimStyle]}>
                {Array.from({ length: totalDigits }, (_, i) => {
                    const placeIndex = totalDigits - 1 - i;
                    const elements: React.ReactNode[] = [];

                    elements.push(
                        <CounterDigit
                            key={placeIndex}
                            springConfig={springConfig}
                            place={placeIndex}
                            counterValue={animatedValue}
                            height={height}
                            width={width}
                            color={color}
                            fontSize={fontSize}
                            fontFamily={fontFamily}
                            letterSpacing={letterSpacing}
                        />
                    );

                    // Add thousand separator dot after this digit if it marks the boundary of a group
                    // e.g. for 1.000: after the digit at placeIndex=3, insert "."
                    // e.g. for 1.000.000: after digits at placeIndex=6 and placeIndex=3
                    if (placeIndex > 0 && placeIndex % 3 === 0) {
                        elements.push(
                            <Text
                                key={`sep-${placeIndex}`}
                                style={{
                                    height,
                                    width: separatorWidth,
                                    textAlign: "center",
                                    lineHeight: height,
                                    fontSize,
                                    fontFamily,
                                    fontWeight: fontFamily ? undefined : "bold",
                                    color,
                                    letterSpacing: 0,
                                }}
                            >
                                .
                            </Text>
                        );
                    }

                    return elements;
                })}
            </Animated.View>
        );
    },
);

const styles = StyleSheet.create({
    rowContainer: {
        flexDirection: "row",
        overflow: "hidden",
    },
});

export { RollingCounter };

