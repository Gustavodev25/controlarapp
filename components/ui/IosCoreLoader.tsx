import React from 'react';
import { ActivityIndicator, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

interface IosCoreLoaderProps {
    size?: 'small' | 'large';
    style?: StyleProp<ViewStyle>;
    fill?: boolean;
}

export function IosCoreLoader({ size = 'large', style, fill = true }: IosCoreLoaderProps) {
    return (
        <View style={[styles.container, fill && styles.fill, style]}>
            <ActivityIndicator
                size={size}
                color="#F5F5F7"
                style={styles.spinner}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    fill: {
        flex: 1,
    },
    spinner: {
        transform: [{ scale: 1.15 }],
    },
});
