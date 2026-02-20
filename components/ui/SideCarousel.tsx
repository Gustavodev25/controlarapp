import React, { useCallback, useEffect, useState } from 'react';
import { Dimensions, StyleSheet, TouchableOpacity, View, ViewStyle } from 'react-native';
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
    stiffness: 150,
    mass: 0.8,
    overshootClamping: false,
};

export interface SideCarouselRenderItemInfo<T> {
    item: T;
    index: number;
    animatedIndex: SharedValue<number>;
    totalCards: number;
}

export interface SideCarouselProps<T> {
    data: T[];
    renderItem: (info: SideCarouselRenderItemInfo<T>) => React.ReactElement;
    onSnapToItem?: (index: number) => void;
    initialIndex?: number;
    containerStyle?: ViewStyle;
    cardHeight?: number;
    cardWidth?: number;
}

export function SideCarousel<T extends { key: string }>({
    data,
    renderItem,
    onSnapToItem,
    initialIndex = 0,
    containerStyle,
    cardHeight = 115,
    cardWidth = SCREEN_WIDTH * 0.8, // Default to 80% width
}: SideCarouselProps<T>) {
    const [currentIndex, setCurrentIndex] = useState(initialIndex);

    const animatedIndex = useSharedValue(initialIndex);
    const dragX = useSharedValue(0); // Drag offset

    useEffect(() => {
        if (currentIndex >= data.length && data.length > 0) {
            setCurrentIndex(data.length - 1);
            animatedIndex.value = data.length - 1;
        }
    }, [data.length]);

    const updateIndex = useCallback((newIndex: number) => {
        setCurrentIndex(newIndex);
        if (onSnapToItem) {
            onSnapToItem(newIndex);
        }
    }, [onSnapToItem]);

    const snapTo = useCallback((index: number) => {
        const targetIndex = Math.max(0, Math.min(index, data.length - 1));
        animatedIndex.value = withSpring(targetIndex, SPRING_CONFIG);
        updateIndex(targetIndex);
    }, [data.length, animatedIndex, updateIndex]);

    const panGesture = Gesture.Pan()
        .onUpdate((event) => {
            // Dragging moves the visual index temporarily
            // dragX is pixel translation. Convert to index units.
            // 1 unit = (CARD_WIDTH + SPACING)
            const pixelOffset = event.translationX;
            dragX.value = pixelOffset;

            // We want immediate feedback, so we subtract from animatedIndex
            // (Moving finger Left (negative X) should increase index (move right))
            // But usually in carousel: transform X.
            // Let's keep animatedIndex stable and use dragX for offset in style.
        })
        .onEnd((event) => {
            const { translationX, velocityX } = event;
            // Determine direction
            // negative translation -> moving to next (right)
            // positive translation -> moving to prev (left)

            let targetIndex = currentIndex;

            // Significant swipe or fast flick
            if (translationX < -SWIPE_THRESHOLD || velocityX < -VELOCITY_THRESHOLD) {
                targetIndex = currentIndex + 1;
            } else if (translationX > SWIPE_THRESHOLD || velocityX > VELOCITY_THRESHOLD) {
                targetIndex = currentIndex - 1;
            }

            // Also account for dragging more than one item width? 
            // For now simple next/prev is safer.

            dragX.value = withSpring(0, SPRING_CONFIG); // Reset drag offset

            // If we are just tapping/small drag, we stay.
            // But we must update animatedIndex to the new integer target
            if (targetIndex !== currentIndex && targetIndex >= 0 && targetIndex < data.length) {
                runOnJS(snapTo)(targetIndex);
            } else {
                // Snap back
                runOnJS(snapTo)(currentIndex);
            }
        });

    // We can also support "tap to center" via a helper in renderItem
    const handleTap = useCallback((index: number) => {
        snapTo(index);
    }, [snapTo]);

    if (data.length === 0) return null;

    return (
        <View style={[styles.container, containerStyle]}>
            <View style={[styles.carouselContainer, { height: cardHeight }]}>
                <GestureDetector gesture={panGesture}>
                    <Animated.View style={[styles.trackContainer, { height: cardHeight }]}>
                        {data.map((item, index) => (
                            <View
                                key={item.key}
                                style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}
                                pointerEvents="box-none"
                            >
                                <SideItemRenderer
                                    item={item}
                                    index={index}
                                    animatedIndex={animatedIndex}
                                    dragX={dragX}
                                    totalCards={data.length}
                                    renderItem={renderItem}
                                    onTap={() => handleTap(index)}
                                    cardWidth={cardWidth}
                                    spacing={SPACING}
                                />
                            </View>
                        ))}
                    </Animated.View>
                </GestureDetector>
            </View>
        </View>
    );
}

// Separate component to use hooks
function SideItemRenderer<T>({
    item,
    index,
    animatedIndex,
    dragX,
    totalCards,
    renderItem,
    onTap,
    cardWidth,
    spacing
}: SideCarouselRenderItemInfo<T> & {
    dragX: SharedValue<number>,
    onTap: () => void,
    cardWidth: number,
    spacing: number,
    renderItem: (info: SideCarouselRenderItemInfo<T>) => React.ReactElement
}) {
    const style = useSideCardStyle(index, animatedIndex, dragX, cardWidth, spacing);

    return (
        <Animated.View style={[styles.cardWrapper, style, { width: cardWidth }]}>
            <TouchableOpacity
                activeOpacity={0.9}
                onPress={onTap}
                style={{ flex: 1, width: '100%' }}
            >
                {renderItem({
                    item,
                    index,
                    animatedIndex,
                    totalCards
                })}
            </TouchableOpacity>
        </Animated.View>
    );
}

export const useSideCardStyle = (
    index: number,
    animatedIndex: SharedValue<number>,
    dragX: SharedValue<number>,
    cardWidth: number,
    spacing: number
) => {
    return useAnimatedStyle(() => {
        // Calculate "visual index" which includes the drag offset
        // dragX is in pixels. Convert to index units?
        // Actually, let's keep it simple:
        // Position = (index - animatedIndex) * (width + spacing) + dragX

        const currentPos = (index - animatedIndex.value) * (cardWidth + spacing) + dragX.value;

        // Scale effect for side items
        // We define distance from center in "units" of card width
        const distFromCenter = Math.abs(currentPos / (cardWidth + spacing));

        const scale = interpolate(
            distFromCenter,
            [0, 1],
            [1, 0.9],
            Extrapolation.CLAMP
        );

        const opacity = interpolate(
            distFromCenter,
            [0, 2],
            [1, 0.5],
            Extrapolation.CLAMP
        );

        return {
            transform: [
                { translateX: currentPos },
                { scale }
            ],
            opacity,
            zIndex: 100 - Math.round(distFromCenter * 10)
        };
    });
};

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        width: '100%',
    },
    carouselContainer: {
        width: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'visible' // Allow side cards to be seen
    },
    trackContainer: {
        width: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    cardWrapper: {
        position: 'absolute',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center'
    }
});
