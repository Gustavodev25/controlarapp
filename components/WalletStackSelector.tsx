import { CreditCardAccount } from '@/services/invoiceBuilder';
import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
    Extrapolation,
    interpolate,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    type SharedValue
} from 'react-native-reanimated';
import { SwipeTutorial } from './SwipeTutorial';

// Visual helper for bank cards (Kept from original)
export const getBankVisuals = (name: string) => {
    const lower = name.toLowerCase();

    if (lower.includes('nubank')) return { color: ['#820AD1', '#4F0685'], label: 'Nu' };
    if (lower.includes('itaú') || lower.includes('itau')) return { color: ['#EC7000', '#D65F00'], label: 'Itaú' };
    if (lower.includes('bradesco')) return { color: ['#CC092F', '#990522'], label: 'Bra' };
    if (lower.includes('santander')) return { color: ['#EC0000', '#B30000'], label: 'San' };
    if (lower.includes('inter')) return { color: ['#FF7A00', '#E56D00'], label: 'Inter' };
    if (lower.includes('c6')) return { color: ['#242424', '#000000'], label: 'C6' };
    if (lower.includes('btg')) return { color: ['#0038A8', '#00256E'], label: 'BTG' };
    if (lower.includes('xp')) return { color: ['#000000', '#333333'], label: 'XP' };
    if (lower.includes('neon')) return { color: ['#00A4D3', '#007CA3'], label: 'Neon' };
    if (lower.includes('original')) return { color: ['#176940', '#0E4228'], label: 'Original' };
    if (lower.includes('banco do brasil') || lower.includes('bb') || lower.includes('ourocard')) return { color: ['#F8D117', '#0038A8'], label: 'BB', textColor: '#0038A8' };
    if (lower.includes('caixa')) return { color: ['#005CA9', '#F6841F'], label: 'Caixa' };

    // Default gradient
    return { color: ['#3A3A3A', '#1F1F1F'], label: name ? name.substring(0, 3).toUpperCase() : 'BCO' };
};

// Dimensions will be dynamic now
const DEFAULT_CARD_HEIGHT = 60;
const DEFAULT_CARD_WIDTH = 160;
const SMALL_CARD_HEIGHT = 40;
const SMALL_CARD_WIDTH = 100;

const MAX_VISIBLE_CARDS = 5;

const VerticalWalletCard = React.memo(({
    card,
    index,
    animatedIndex,
    totalCards,
    onPress,
    isSmall
}: {
    card: CreditCardAccount;
    index: number;
    animatedIndex: SharedValue<number>;
    totalCards: number;
    onPress: () => void;
    isSmall?: boolean;
}) => {
    const visuals = getBankVisuals(card.name || card.connector?.name || '');

    const cardHeight = isSmall ? SMALL_CARD_HEIGHT : DEFAULT_CARD_HEIGHT;
    const cardWidth = isSmall ? SMALL_CARD_WIDTH : DEFAULT_CARD_WIDTH;

    const animatedStyle = useAnimatedStyle(() => {
        const activeIndex = animatedIndex.value;
        const diff = index - activeIndex;

        // Vertical Stack Logic
        // Active card (diff=0) is centered
        // Next cards (diff > 0) are stacked below
        // Prev cards (diff < 0) are stacked above/behind

        // Limit visibility
        if (Math.abs(diff) > MAX_VISIBLE_CARDS) {
            return { opacity: 0 };
        }

        const zIndex = totalCards - Math.abs(Math.round(diff)); // Center is highest

        // Scale
        // Active: 1
        // Neighbors: smaller
        const scale = interpolate(
            diff,
            [-2, -1, 0, 1, 2],
            [0.85, 0.9, 1.1, 0.9, 0.85],
            Extrapolation.CLAMP
        );

        // Opacity
        const opacity = interpolate(
            diff,
            [-2, -1, 0, 1, 2],
            [0.5, 0.7, 1, 0.7, 0.5],
            Extrapolation.CLAMP
        );

        // diff=0 -> 0
        // diff=1 -> 35 (below)
        // diff=-1 -> -35 (above)
        const separation = isSmall ? 20 : 35;
        const translateY = interpolate(
            diff,
            [-5, 0, 5],
            [-separation * 1.5, 0, separation * 1.5], // Non-linear stacking could be cool, but linear is safer for now
            Extrapolation.CLAMP
        );

        // Rotate X for 3D effect
        const rotateX = `${interpolate(diff, [-2, 0, 2], [20, 0, -20], Extrapolation.CLAMP)}deg`;

        return {
            zIndex,
            opacity,
            transform: [
                { translateY },
                { scale },
                { perspective: 500 },
                { rotateX }
            ]
        };
    });

    return (
        <Animated.View style={[
            styles.cardContainer,
            { width: cardWidth, height: cardHeight },
            animatedStyle
        ]}>
            <TouchableOpacity
                activeOpacity={0.9}
                onPress={onPress}
                style={styles.touchableArea}
            >
                <View style={styles.walletCard}>
                    <Text style={[styles.cardLabel, visuals.textColor ? { color: visuals.textColor } : {}]} numberOfLines={1}>
                        {card.name || card.connector?.name || visuals.label}
                    </Text>
                </View>
            </TouchableOpacity>
        </Animated.View>
    );
});

export const WalletStackSelector = ({
    cards,
    selectedCardId,
    onSelectCard,
    small = false
}: {
    cards: CreditCardAccount[];
    selectedCardId: string;
    onSelectCard: (id: string) => void;
    small?: boolean;
}) => {
    // Determine initial index
    const initialIndex = cards.findIndex(c => c.id === selectedCardId);
    const safeInitialIndex = initialIndex >= 0 ? initialIndex : 0;

    const animatedIndex = useSharedValue(safeInitialIndex);
    const [currentIndex, setCurrentIndex] = useState(safeInitialIndex);
    const [showTutorial, setShowTutorial] = useState(true);

    // Sync external selection if it changes from outside
    useEffect(() => {
        const idx = cards.findIndex(c => c.id === selectedCardId);
        if (idx >= 0 && idx !== currentIndex) {
            setCurrentIndex(idx);
            animatedIndex.value = withSpring(idx, { damping: 14, stiffness: 100 });
        }
    }, [selectedCardId, cards]);

    const handleSelect = useCallback((index: number) => {
        if (index >= 0 && index < cards.length) {
            setCurrentIndex(index);
            onSelectCard(cards[index].id); // Trigger external change
            animatedIndex.value = withSpring(index, { damping: 14, stiffness: 100 });
        }
    }, [cards, onSelectCard, animatedIndex]);

    const dismissTutorial = useCallback(() => {
        setShowTutorial(false);
    }, []);

    // Gesture Handling
    const panGesture = Gesture.Pan()
        .onStart(() => {
            runOnJS(dismissTutorial)();
        })
        .onUpdate((e) => {
            // Drag UP (-y) -> NEXT card (Index + 1)
            // Drag DOWN (+y) -> PREV card (Index - 1)
            // Sensitivity: 1 index per 50px
            const indexChange = -(e.translationY / (small ? 30 : 50));
            animatedIndex.value = currentIndex + indexChange;
        })
        .onEnd((e) => {
            // Snap to nearest index
            const velocityAdjustment = -(e.velocityY / 500); // Velocity boost
            const targetIndex = Math.round(animatedIndex.value + velocityAdjustment);
            const clampedIndex = Math.max(0, Math.min(cards.length - 1, targetIndex));

            runOnJS(handleSelect)(clampedIndex);
        });

    const cardWidth = small ? SMALL_CARD_WIDTH : DEFAULT_CARD_WIDTH;
    const wrapperHeight = small ? 80 : 120;

    return (
        <View style={[styles.container, small && styles.containerSmall]}>
            <View style={[styles.stackWrapper, { height: wrapperHeight }]}>
                <GestureDetector gesture={panGesture}>
                    <Animated.View style={[styles.touchArea, { width: cardWidth, height: wrapperHeight }]}>
                        {cards.map((card, index) => (
                            <VerticalWalletCard
                                key={card.id}
                                card={card}
                                index={index}
                                animatedIndex={animatedIndex}
                                totalCards={cards.length}
                                onPress={() => {
                                    dismissTutorial();
                                    handleSelect(index);
                                }}
                                isSmall={small}
                            />
                        ))}
                        <SwipeTutorial
                            visible={showTutorial && cards.length > 1}
                            onDismiss={dismissTutorial}
                            style={{ borderRadius: 12, width: cardWidth, height: small ? 40 : 60, zIndex: 999 }}
                            size={small ? 24 : 48}
                            absoluteFill={false}
                        />
                    </Animated.View>
                </GestureDetector>

                {/* Visual Height Indicator or Arrows could be added here */}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        marginTop: 10,
        marginBottom: 20,
        zIndex: 100
    },
    containerSmall: {
        marginTop: 0,
        marginBottom: 0,
    },
    stackWrapper: {
        height: 120, // Adjusted for shorter cards
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    touchArea: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardContainer: {
        position: 'absolute',
        alignItems: 'center',
        justifyContent: 'center',
    },
    touchableArea: {
        width: '100%',
        height: '100%',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 6,
    },
    walletCard: {
        width: '100%',
        height: '100%',
        borderRadius: 12,
        padding: 12,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#141414',
        borderWidth: 1,
        borderColor: '#2B2B2B',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 4,
    },
    cardLabel: {
        fontSize: 14,
        fontWeight: '700',
        color: '#FFF',
        textAlign: 'center',
        letterSpacing: 0.5,
    }
});
