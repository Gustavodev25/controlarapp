import { DelayedLoopLottie } from '@/components/ui/DelayedLoopLottie';
import { CreditCardAccount } from '@/services/invoiceBuilder';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import React, { useCallback, useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { StyleProp, ViewStyle } from 'react-native';

interface BankSelectorProps {
    currentCardId: string | null;
    cards: CreditCardAccount[];
    onSelectCard: (cardId: string | null) => void;
    style?: StyleProp<ViewStyle>;
    delay?: number;
}

export default function BankSelector({
    currentCardId,
    cards,
    onSelectCard,
    style,
    delay = 4000,
}: BankSelectorProps) {

    // Current Index in the cards array. -1 means "All" (null).
    const currentIndex = useMemo(() => {
        if (!currentCardId) return -1;
        return cards.findIndex(c => c.id === currentCardId);
    }, [currentCardId, cards]);

    const handlePrevious = useCallback(() => {
        if (currentIndex <= -1) {
            // If currently showing All (-1), go to the Last card
            if (cards.length > 0) {
                onSelectCard(cards[cards.length - 1].id);
            }
        } else if (currentIndex === 0) {
            // If currently showing First card (0), go to All (-1)
            onSelectCard(null);
        } else {
            // Go to previous card
            onSelectCard(cards[currentIndex - 1].id);
        }
    }, [currentIndex, cards, onSelectCard]);

    const handleNext = useCallback(() => {
        if (currentIndex === -1) {
            // If currently showing All, go to First card
            if (cards.length > 0) {
                onSelectCard(cards[0].id);
            }
        } else if (currentIndex === cards.length - 1) {
            // If currently showing Last card, go to All
            onSelectCard(null);
        } else {
            // Go to next card
            onSelectCard(cards[currentIndex + 1].id);
        }
    }, [currentIndex, cards, onSelectCard]);

    const handleReset = useCallback(() => {
        onSelectCard(null);
    }, [onSelectCard]);

    const displayName = useMemo(() => {
        if (currentIndex === -1 || !currentCardId) return 'Todas as Faturas';
        const card = cards[currentIndex];
        const name = card?.name || 'Cartão';
        // Limit text length as requested ("not whole card text")
        if (name.length > 10) {
            return name.substring(0, 10) + '...';
        }
        return name;
    }, [currentIndex, currentCardId, cards]);

    return (
        <View style={[styles.container, style]}>
            {/* Reset Button (Only visible when a specific card is selected) */}
            {currentCardId && (
                <Animated.View
                    entering={FadeIn.duration(200)}
                    exiting={FadeOut.duration(200)}
                    style={styles.resetContainer}
                >
                    <TouchableOpacity
                        onPress={handleReset}
                        activeOpacity={0.7}
                        style={styles.resetButton}
                    >
                        <DelayedLoopLottie
                            source={require('../assets/cartabranco.json')} // Using the requested navbar credit card icon
                            style={{ width: 18, height: 18 }}
                            delay={delay}
                            initialDelay={delay}
                            throttleMultiplier={1}
                        />
                    </TouchableOpacity>
                </Animated.View>
            )}

            {/* Navigation Controls */}
            <TouchableOpacity
                onPress={handlePrevious}
                style={styles.navButton}
                activeOpacity={0.6}
            >
                <ChevronLeft size={16} color="#FFF" />
            </TouchableOpacity>

            <Text style={styles.label} numberOfLines={1}>
                {displayName}
            </Text>

            <TouchableOpacity
                onPress={handleNext}
                style={styles.navButton}
                activeOpacity={0.6}
            >
                <ChevronRight size={16} color="#FFF" />
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#000', // Black pill background
        borderRadius: 24,
        paddingVertical: 4,
        paddingRight: 6,
        paddingLeft: 8, // More padding on left to push icon right
        gap: 2,
        // Minimum height to match MonthSelector feel
        height: 32,
    },
    resetContainer: {
        marginRight: 4, // More space after icon
    },
    resetButton: {
        width: 20,
        height: 20,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'transparent',
    },
    navButton: {
        padding: 2,
    },
    label: {
        color: '#FFF',
        fontSize: 12,
        fontWeight: '600',
        textAlign: 'center',
        minWidth: 40,
        maxWidth: 100,
    },
});
