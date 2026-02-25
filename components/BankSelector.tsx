import { CreditCardAccount } from '@/services/invoiceBuilder';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import React, { useCallback, useMemo } from 'react';
import { StyleProp, StyleSheet, Text, TouchableOpacity, ViewStyle } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';

interface BankSelectorProps {
    currentCardId: string | null;
    cards: CreditCardAccount[];
    onSelectCard: (cardId: string | null) => void;
    style?: StyleProp<ViewStyle>;
}

export default function BankSelector({
    currentCardId,
    cards,
    onSelectCard,
    style,
}: BankSelectorProps) {

    // Current Index in the cards array. -1 means "All" (null).
    const currentIndex = useMemo(() => {
        if (!currentCardId) return -1;
        return cards.findIndex(c => c.id === currentCardId);
    }, [currentCardId, cards]);

    const handlePrevious = useCallback(() => {
        if (currentIndex <= -1) {
            if (cards.length > 0) {
                onSelectCard(cards[cards.length - 1].id);
            }
        } else if (currentIndex === 0) {
            onSelectCard(null);
        } else {
            onSelectCard(cards[currentIndex - 1].id);
        }
    }, [currentIndex, cards, onSelectCard]);

    const handleNext = useCallback(() => {
        if (currentIndex === -1) {
            if (cards.length > 0) {
                onSelectCard(cards[0].id);
            }
        } else if (currentIndex === cards.length - 1) {
            onSelectCard(null);
        } else {
            onSelectCard(cards[currentIndex + 1].id);
        }
    }, [currentIndex, cards, onSelectCard]);

    const displayName = useMemo(() => {
        if (currentIndex === -1 || !currentCardId) return 'Todas as Faturas';
        const card = cards[currentIndex];
        const name = card?.name || 'Cartão';

        // Limita o tamanho para manter o componente contido, 
        // mas permitindo a variação de tamanho para o efeito morph
        if (name.length > 12) {
            return name.substring(0, 12) + '...';
        }
        return name;
    }, [currentIndex, currentCardId, cards]);

    return (
        <Animated.View
            style={[styles.container, style]}
            // Aqui acontece a mágica do "Physics-based Expansion / Fluid Morphing":
            // Sempre que o tamanho do texto mudar, o container vai adaptar a largura 
            // usando um efeito de "mola" (spring) elástico e orgânico.
            layout={LinearTransition.springify().damping(14).stiffness(120).mass(0.8)}
        >
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
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#141414',
        borderColor: '#2B2B2B',
        borderWidth: 1,
        borderRadius: 24,
        paddingVertical: 4,
        paddingHorizontal: 6,
        gap: 4,
        height: 32,
        // Remover larguras fixas no container permite que ele abrace o conteúdo (hug contents)
        // e possibilita a animação física de expansão.
        alignSelf: 'flex-start',
    },
    navButton: {
        padding: 2,
    },
    label: {
        color: '#FFF',
        fontSize: 12,
        fontWeight: '600',
        textAlign: 'center',
        // O minWidth garante que ele não fique pequeno demais entre transições curtas
        minWidth: 40,
        marginHorizontal: 4,
    },
});