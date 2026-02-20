import { BlurView, type BlurViewProps } from "expo-blur";
import React, { memo, useCallback, useEffect, useState } from "react";
import {
    Platform,
    StyleSheet,
    Text,
    View,
    type StyleProp,
    type TextStyle,
    type ViewStyle,
} from "react-native";
import Animated, {
    Easing,
    FadeIn,
    FadeInDown,
    FadeInUp,
    FadeOut,
    FadeOutDown,
    FadeOutUp,
    interpolate,
    LinearTransition,
    useAnimatedProps,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming
} from "react-native-reanimated";

// --- Types ---
export interface DynamicTextItem {
    id?: string;
    text: string;
    [key: string]: any;
}

export interface TimingConfig {
    interval?: number;
    animationDuration?: number;
}

export interface DotConfig {
    visible?: boolean;
    size?: number;
    color?: string;
    style?: StyleProp<ViewStyle>;
}

export interface TextConfig {
    fontSize?: number;
    fontWeight?: "normal" | "bold" | "100" | "200" | "300" | "400" | "500" | "600" | "700" | "800" | "900";
    color?: string;
    style?: StyleProp<TextStyle>;
}

export interface IDynamicText {
    items: (string | DynamicTextItem)[];
    loop?: boolean;
    loopCount?: number;
    animationPreset?: "fade" | "slide" | "zoom";
    animationDirection?: "up" | "down";
    customEntering?: any;
    customExiting?: any;
    timing?: TimingConfig;
    dot?: DotConfig;
    text?: TextConfig;
    containerStyle?: StyleProp<ViewStyle>;
    contentStyle?: StyleProp<ViewStyle>;
    onAnimationComplete?: () => void;
    onIndexChange?: (index: number, item: DynamicTextItem) => void;
    paused?: boolean;
    initialIndex?: number;
    accessibilityLabel?: string;
}

// --- Constants ---
const DEFAULT_TIMING: TimingConfig = {
    interval: 3000,
    animationDuration: 500,
};

const DEFAULT_DOT: DotConfig = {
    visible: true,
    size: 6,
    color: "#000",
};

const DEFAULT_TEXT: TextConfig = {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
};

// --- Helpers ---
const normalizeItems = (items: (string | DynamicTextItem)[]): DynamicTextItem[] => {
    return items.map((item, index) => {
        if (typeof item === "string") {
            return { id: `item-${index}`, text: item };
        }
        return { id: item.id || `item-${index}`, ...item };
    });
};

const getAnimationPreset = (
    preset: string,
    direction: "up" | "down",
    duration: number = 500
) => {
    let entering, exiting;

    if (preset === "fade") {
        if (direction === "up") {
            entering = FadeInUp.duration(duration);
            exiting = FadeOutUp.duration(duration);
        } else {
            entering = FadeInDown.duration(duration);
            exiting = FadeOutDown.duration(duration);
        }
    } else {
        // Default fallbacks
        entering = FadeIn.duration(duration);
        exiting = FadeOut.duration(duration);
    }

    return { entering, exiting };
};

const AnimatedBlurView =
    Animated.createAnimatedComponent<BlurViewProps>(BlurView);

const DynamicText = memo<IDynamicText>(
    ({
        items,
        loop = false,
        loopCount = -1,
        animationPreset = "fade",
        animationDirection = "up",
        customEntering,
        customExiting,
        timing,
        dot,
        text,
        containerStyle,
        contentStyle,
        onAnimationComplete,
        onIndexChange,
        paused = false,
        initialIndex = 0,
        accessibilityLabel,
    }: IDynamicText) => {
        const timingConfig: TimingConfig = { ...DEFAULT_TIMING, ...timing };
        const dotConfig: DotConfig = { ...DEFAULT_DOT, ...dot };
        const textConfig: TextConfig = { ...DEFAULT_TEXT, ...text };

        const normalizedItems = normalizeItems(items);

        const [currentIndex, setCurrentIndex] = useState<number>(initialIndex);
        const [isAnimating, setIsAnimating] = useState<boolean>(!paused); // Start animating if not paused
        const [currentLoop, setCurrentLoop] = useState<number>(0);

        const progress = useSharedValue<number>(0);
        const dotOpacity = useSharedValue<number>(1);

        useEffect(() => {
            if (dotConfig.visible) {
                dotOpacity.value = withRepeat(
                    withSequence(
                        withTiming(0.4, { duration: 800, easing: Easing.inOut(Easing.ease) }),
                        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) })
                    ),
                    -1,
                    true
                );
            }
        }, [dotConfig.visible]);

        const animationConfig = getAnimationPreset(
            animationPreset,
            animationDirection,
            timingConfig.animationDuration,
        );

        const entering = customEntering ?? animationConfig.entering;
        const exiting = customExiting ?? animationConfig.exiting;

        const handleIndexChange = useCallback(
            (index: number) => {
                if (onIndexChange && normalizedItems[index]) {
                    onIndexChange(index, normalizedItems[index]);
                }
            },
            [onIndexChange, normalizedItems],
        );

        useEffect(() => {
            setIsAnimating(!paused);
        }, [paused]);

        useEffect(() => {
            if (!isAnimating || paused) return;

            const interval = setInterval(() => {
                setCurrentIndex((prevIndex: number) => {
                    const nextIndex = prevIndex + 1;

                    if (nextIndex >= normalizedItems.length) {
                        if (loop && (loopCount === -1 || currentLoop < loopCount - 1)) {
                            if (loopCount !== -1) setCurrentLoop((prev) => prev + 1);
                            handleIndexChange(0);
                            return 0;
                        }
                        clearInterval(interval);
                        setIsAnimating(false);
                        onAnimationComplete?.();
                        return prevIndex;
                    }

                    handleIndexChange(nextIndex);
                    return nextIndex;
                });

                progress.value = withTiming(
                    1,
                    { duration: timingConfig.animationDuration },
                    () => {
                        progress.value = 0;
                    },
                );
            }, timingConfig.interval);

            return () => clearInterval(interval);
        }, [
            isAnimating,
            paused,
            loop,
            loopCount,
            currentLoop,
            normalizedItems.length,
            timingConfig.interval,
            handleIndexChange,
            onAnimationComplete,
            progress,
        ]);

        const currentItem = normalizedItems[currentIndex];

        // If no current item (e.g. empty list), render nothing
        if (!currentItem) return null;

        const dotStyle = [
            {
                height: dotConfig.size,
                width: dotConfig.size,
                borderRadius: (dotConfig.size || 0) / 2,
                backgroundColor: dotConfig.color,
                opacity: dotOpacity,
            },
            dotConfig.style,
        ] as any;

        const textStyle: StyleProp<TextStyle> = [
            {
                fontSize: textConfig.fontSize,
                fontWeight: textConfig.fontWeight,
                color: textConfig.color,
            },
            textConfig.style,
        ];

        const animatedBlurViewPropz = useAnimatedProps<
            Pick<BlurViewProps, "intensity">
        >(() => {
            const blurIntensity = interpolate(
                progress.value,
                [0, 0.5, 1],
                [0, 10, 0],
            );

            return {
                intensity: blurIntensity,
            };
        });

        return (
            <View
                style={[styles.container, containerStyle]}
                accessibilityLabel={accessibilityLabel}
                accessibilityRole="text"
            >
                <View style={[styles.textContainer, contentStyle]}>
                    {/* Key change triggers re-mount/animation */}
                    <Animated.View
                        key={`dt-${currentItem.id}-${currentIndex}`}
                        entering={entering}
                        exiting={exiting}
                        layout={LinearTransition}
                        style={styles.content}
                    >
                        {dotConfig.visible && <Animated.View style={dotStyle} />}
                        <Text style={textStyle}>{currentItem.text}</Text>
                        {Platform.OS === "ios" && (
                            <AnimatedBlurView
                                animatedProps={animatedBlurViewPropz}
                                style={[StyleSheet.absoluteFillObject]}
                            />
                        )}
                    </Animated.View>
                </View>
            </View>
        );
    }
);

const styles = StyleSheet.create({
    container: {
        // Removed minHeight: 200 to be more flexible
        alignItems: "center",
        justifyContent: "center",
    },
    textContainer: {
        // Removed fixed height/width to be flexible
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
    },
    content: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4, // Reduced gap further to bring dot closer
    },
});

export { DynamicText };

