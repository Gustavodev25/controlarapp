import React, { useCallback, useEffect, useState } from 'react';
import { Dimensions, StyleSheet, View, ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
    Extrapolation,
    interpolate,
    runOnJS,
    SharedValue,
    useAnimatedStyle,
    useSharedValue,
    withSpring
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SPACING = 12;

const SWIPE_THRESHOLD = 50;
const VELOCITY_THRESHOLD = 500;

const SPRING_CONFIG = {
    damping: 15,
    stiffness: 120,
    mass: 0.8,
    overshootClamping: false,
    restDisplacementThreshold: 0.01,
    restSpeedThreshold: 0.01,
};

export interface StackCarouselRenderItemInfo<T> {
    item: T;
    index: number;
    animatedIndex: SharedValue<number>;
    translateX: SharedValue<number>;
    totalCards: number;
}

export interface StackCarouselProps<T> {
    data: T[];
    renderItem: (info: StackCarouselRenderItemInfo<T>) => React.ReactElement;
    onSnapToItem?: (index: number) => void;
    initialIndex?: number;
    containerStyle?: ViewStyle;
    cardHeight?: number;
    cardWidth?: number;
}

export function StackCarousel<T extends { key: string }>({
    data,
    renderItem,
    onSnapToItem,
    initialIndex = 0,
    containerStyle,
    cardHeight = 115,
    cardWidth = SCREEN_WIDTH - 32
}: StackCarouselProps<T>) {
    const [currentIndex, setCurrentIndex] = useState(initialIndex);

    // Reset index if data length changes drastically, but try to keep it stable
    useEffect(() => {
        if (currentIndex >= data.length && data.length > 0) {
            setCurrentIndex(data.length - 1);
        }
    }, [data.length]);

    const animatedIndex = useSharedValue(initialIndex);
    const translateX = useSharedValue(0);

    const updateIndex = useCallback((newIndex: number) => {
        setCurrentIndex(newIndex);
        if (onSnapToItem) {
            onSnapToItem(newIndex);
        }
    }, [onSnapToItem]);

    const goToNextCard = useCallback(() => {
        if (currentIndex < data.length - 1) {
            const newIndex = currentIndex + 1;
            animatedIndex.value = withSpring(newIndex, SPRING_CONFIG);
            updateIndex(newIndex);
        }
    }, [currentIndex, data.length, animatedIndex, updateIndex]);

    const goToPrevCard = useCallback(() => {
        if (currentIndex > 0) {
            const newIndex = currentIndex - 1;
            animatedIndex.value = withSpring(newIndex, SPRING_CONFIG);
            updateIndex(newIndex);
        }
    }, [currentIndex, animatedIndex, updateIndex]);

    const panGesture = Gesture.Pan()
        .onUpdate((event) => {
            const maxDrag = cardWidth * 0.5;
            translateX.value = Math.max(-maxDrag, Math.min(maxDrag, event.translationX));
        })
        .onEnd((event) => {
            const { translationX: tx, velocityX } = event;
            if (tx < -SWIPE_THRESHOLD || velocityX < -VELOCITY_THRESHOLD) {
                runOnJS(goToNextCard)();
            } else if (tx > SWIPE_THRESHOLD || velocityX > VELOCITY_THRESHOLD) {
                runOnJS(goToPrevCard)();
            }
            translateX.value = withSpring(0, SPRING_CONFIG);
        });

    if (data.length === 0) return null;

    return (
        <View style={[styles.container, containerStyle]}>
            <View style={[styles.stackContainer, { height: cardHeight + 30 }]}>
                <GestureDetector gesture={panGesture}>
                    <Animated.View style={[styles.gestureContainer, { height: cardHeight, width: cardWidth }]}>
                        {data.map((item, index) => (
                            <View key={item.key} style={StyleSheet.absoluteFill} pointerEvents="box-none">
                                <ItemRenderer
                                    item={item}
                                    index={index}
                                    animatedIndex={animatedIndex}
                                    translateX={translateX}
                                    totalCards={data.length}
                                    renderItem={renderItem}
                                />
                            </View>
                        ))}
                    </Animated.View>
                </GestureDetector>
            </View>
        </View>
    );
}

// Helper component to render item and allow hooks inside renderItem
function ItemRenderer<T>({
    item,
    index,
    animatedIndex,
    translateX,
    totalCards,
    renderItem
}: StackCarouselRenderItemInfo<T> & { renderItem: (info: StackCarouselRenderItemInfo<T>) => React.ReactElement }) {
    return renderItem({
        item,
        index,
        animatedIndex,
        translateX,
        totalCards
    });
}

// Exporting a helper to create the card animation style easily
// Exporting a helper to create the card animation style easily
export const useStackCardStyle = (
    index: number,
    animatedIndex: SharedValue<number>,
    translateX: SharedValue<number>,
    totalCards: number,
    cardWidth?: number,
    spacing: number = 0,
    forceAllStack: boolean = false
) => {
    // Determine separation distance
    const safeCardWidth = cardWidth || Dimensions.get('window').width * 0.78;
    const separationDist = safeCardWidth + spacing;

    return useAnimatedStyle(() => {
        // Hybrid Logic:
        // Index 0 is the "Account" - it behaves like a standard horizontal slide.
        // Index > 0 are "Cards" - they behave as a stack.

        if (index === 0 && !forceAllStack) {
            // Account Card Logic
            // It simply slides based on its distance from 0.
            const visualPos = (index - animatedIndex.value) * separationDist;

            return {
                zIndex: 100,
                opacity: 1,
                transform: [
                    { translateX: visualPos },
                    { scale: 1 },
                ]
            };
        } else {
            // Credit Cards (Stack Group)
            // effectiveStackRefIndex is the "Start" of the stack logic (Index 1).
            // If locking index 0 (account), we start stack at 1. If forcing all stack, we follow the index.
            const effectiveStackRefIndex = forceAllStack ? animatedIndex.value : Math.max(1, animatedIndex.value);

            // diff relative to the stack's current active card
            const diff = index - effectiveStackRefIndex;

            // Standard Stack Styles based on `diff`
            const zIndex = totalCards - Math.abs(Math.round(diff));

            // Flattened translateY to keep cards vertically aligned
            const translateY = 0;

            // Flattened scale to keep cards the same size
            const scale = 1;

            const rotateZ = interpolate(
                diff,
                [-1, -0.2, 0, 0.2, 1],
                [-2, 0, 0, 0, 2], // Reduced rotation slightly for cleaner look
                Extrapolation.CLAMP
            );

            const opacity = interpolate(
                diff,
                [-1, 0, 1],
                [0, 1, 1],
                Extrapolation.CLAMP
            );

            // Global Slide Offset:
            // If animatedIndex < 1, shifting right (only if NOT forcing all stack).
            const globalSlideOffset = forceAllStack ? 0 : Math.max(0, 1 - animatedIndex.value) * separationDist;

            // Stack offset for items behind the active one
            // When diff > 0, we want them slightly offset to the right so they are visible
            const stackOffset = interpolate(
                diff,
                [0, 1],
                [0, 10], // 10px visual offset for stacked cards
                Extrapolation.CLAMP
            );

            return {
                zIndex,
                opacity,
                transform: [
                    { translateX: globalSlideOffset + stackOffset },
                    { translateY },
                    { scale },
                    { rotateZ: `${rotateZ}deg` }
                ]
            };
        }
    });
};

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
    },
    stackContainer: {
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
        paddingBottom: 0
    },
    gestureContainer: {
        justifyContent: 'center',
        alignItems: 'center'
    },
    dotTouchable: {
        padding: 5
    },
    paginationDot: {
        width: 5,
        height: 5,
        borderRadius: 2.5,
    },
});
