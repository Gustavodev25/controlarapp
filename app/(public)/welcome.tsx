import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/Button';
import { UniversalBackground } from '@/components/UniversalBackground';

import { useRouter } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import {
    Animated,
    Dimensions,
    FlatList,
    StyleSheet,
    View,
    ViewToken
} from 'react-native';

const { width } = Dimensions.get('window');

const SLIDES = [
    {
        id: '1',
        title: 'Visualize\nSuas Finanças',
        description: 'Transforme a forma como você controla seu dinheiro com gráficos intuitivos e detalhados.',
    },
    {
        id: '2',
        title: 'Planeje\nSeu Futuro',
        description: 'Defina metas, acompanhe seus gastos e alcance sua liberdade financeira com facilidade.',
    },
    {
        id: '3',
        title: 'Tudo em\num só lugar',
        description: 'Gerencie contas, cartões e investimentos em uma plataforma única e segura.',
    },
];

const AnimatedSlide = React.memo(({ item, index, scrollX }: { item: typeof SLIDES[0], index: number, scrollX: Animated.Value }) => {
    const inputRange = [(index - 1) * width, index * width, (index + 1) * width];

    const opacity = scrollX.interpolate({
        inputRange,
        outputRange: [0, 1, 0],
        extrapolate: 'clamp',
    });

    const translateY = scrollX.interpolate({
        inputRange,
        outputRange: [50, 0, 50],
        extrapolate: 'clamp',
    });

    const numberScale = scrollX.interpolate({
        inputRange,
        outputRange: [0.8, 1, 0.8],
        extrapolate: 'clamp',
    });

    const numberOpacity = scrollX.interpolate({
        inputRange,
        outputRange: [0, 0.1, 0], // Very subtle background number
        extrapolate: 'clamp',
    });

    return (
        <View style={styles.slideContainer}>
            {/* Big Background Number */}
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
                <View style={styles.numberWrapper}>
                    <Animated.Text style={[
                        styles.bigNumber,
                        {
                            opacity: numberOpacity,
                            transform: [{ scale: numberScale }]
                        }
                    ]}>
                        0{item.id}
                    </Animated.Text>
                </View>
            </View>

            <Animated.View style={[styles.slideContent, { opacity, transform: [{ translateY }] }]}>
                <View style={styles.textContainer}>
                    <ThemedText type="title" style={styles.title}>{item.title}</ThemedText>
                    <ThemedText style={styles.description}>{item.description}</ThemedText>
                </View>
            </Animated.View>
        </View>
    );
});

const PaginationDot = React.memo(({ index, scrollX }: { index: number, scrollX: Animated.Value }) => {
    const inputRange = [(index - 1) * width, index * width, (index + 1) * width];

    const dotWidth = scrollX.interpolate({
        inputRange,
        outputRange: [8, 32, 8],
        extrapolate: 'clamp',
    });

    const opacity = scrollX.interpolate({
        inputRange,
        outputRange: [0.3, 1, 0.3],
        extrapolate: 'clamp',
    });

    const backgroundColor = scrollX.interpolate({
        inputRange,
        outputRange: ['#6b7280', '#d97757', '#6b7280'],
        extrapolate: 'clamp',
    });

    return (
        <Animated.View style={[
            styles.dot,
            { width: dotWidth, opacity, backgroundColor }
        ]} />
    );
});

const Pagination = React.memo(({ scrollX }: { scrollX: Animated.Value }) => (
    <View style={styles.paginationContainer}>
        {SLIDES.map((_, i) => (
            <PaginationDot key={i} index={i} scrollX={scrollX} />
        ))}
    </View>
));

export default function WelcomeScreen() {
    const router = useRouter();
    const [currentIndex, setCurrentIndex] = useState(0);
    const slidesRef = useRef<FlatList>(null);
    const scrollX = useRef(new Animated.Value(0)).current;

    const viewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken[] }) => {
        if (viewableItems && viewableItems.length > 0 && viewableItems[0].index !== null) {
            setCurrentIndex(viewableItems[0].index);
        }
    }, []);

    const viewConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

    const scrollToNext = useCallback(() => {
        if (currentIndex < SLIDES.length - 1) {
            slidesRef.current?.scrollToIndex({ index: currentIndex + 1 });
        } else {
            router.push('/(public)/login');
        }
    }, [currentIndex, router]);

    const renderItem = useCallback(({ item, index }: { item: typeof SLIDES[0], index: number }) => (
        <AnimatedSlide item={item} index={index} scrollX={scrollX} />
    ), [scrollX]);

    const keyExtractor = useCallback((item: typeof SLIDES[0]) => item.id, []);

    return (
        <UniversalBackground>
            <Animated.FlatList
                data={SLIDES}
                renderItem={renderItem}
                horizontal
                showsHorizontalScrollIndicator={false}
                pagingEnabled
                bounces={false}
                keyExtractor={keyExtractor}
                scrollEventThrottle={32}
                onViewableItemsChanged={viewableItemsChanged}
                viewabilityConfig={viewConfig}
                ref={slidesRef}
                onScroll={Animated.event(
                    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
                    { useNativeDriver: false }
                )}
                removeClippedSubviews={false}
                initialNumToRender={SLIDES.length}
                windowSize={5}
            />

            <View style={styles.footer}>
                <Pagination scrollX={scrollX} />

                <Button
                    title={currentIndex === SLIDES.length - 1 ? 'Começar Agora' : 'Próximo'}
                    onPress={scrollToNext}
                    variant="primary"
                    size="xl"
                    fullWidth
                />
            </View>
        </UniversalBackground>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#1D100B',
    },
    slideContainer: {
        width,
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    slideContent: {
        width: '100%',
        alignItems: 'flex-start', // Changed align to start
        justifyContent: 'center',
        paddingHorizontal: 40,
        zIndex: 10,
    },
    numberWrapper: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        // transform: [{ translateY: -50 }], // Slightly adjust position if needed
    },
    bigNumber: {
        fontSize: 300,
        fontWeight: '900',
        color: '#ffffff',
        includeFontPadding: false,
        textAlign: 'center',
    },
    textContainer: {
        alignItems: 'flex-start', // Align text to left
        width: '100%',
    },
    title: {
        fontSize: 42, // Increased size
        fontWeight: '800', // Extra bold
        marginBottom: 24,
        textAlign: 'left',
        color: '#faf9f5',
        lineHeight: 48,
        letterSpacing: -1,
    },
    description: {
        textAlign: 'left',
        fontSize: 18,
        lineHeight: 28,
        color: '#d1d5db',
        maxWidth: '90%',
    },
    paginationContainer: {
        flexDirection: 'row',
        height: 64,
        justifyContent: 'center',
        alignItems: 'center',
    },
    dot: {
        height: 6,
        borderRadius: 3,
        marginHorizontal: 4,
    },
    footer: {
        width: '100%',
        paddingHorizontal: 40,
        marginBottom: 60,
        alignItems: 'center'
    },
});

