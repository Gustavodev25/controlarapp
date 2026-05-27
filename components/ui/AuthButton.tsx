import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, TouchableOpacityProps } from 'react-native';

interface AuthButtonProps extends TouchableOpacityProps {
    title: string;
    isLoading?: boolean;
    variant?: 'primary' | 'secondary' | 'outline';
}

export const AuthButton = ({ title, isLoading, variant = 'primary', style, ...props }: AuthButtonProps) => {
    return (
        <TouchableOpacity
            style={[
                styles.button,
                variant === 'primary' && styles.primaryButton,
                variant === 'secondary' && styles.secondaryButton,
                variant === 'outline' && styles.outlineButton,
                (props.disabled || isLoading) && styles.disabledButton,
                style
            ]}
            disabled={isLoading || props.disabled}
            activeOpacity={0.8}
            {...props}
        >
            {isLoading ? (
                <ActivityIndicator color={variant === 'outline' ? '#faf9f5' : '#fff'} size="small" />
            ) : (
                <Text style={[
                    styles.text,
                    variant === 'primary' && styles.primaryText,
                    variant === 'secondary' && styles.secondaryText,
                    variant === 'outline' && styles.outlineText,
                ]}>
                    {title}
                </Text>
            )}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    button: {
        height: 52,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'row',
        width: '100%',
    },
    primaryButton: {
        backgroundColor: '#d97757',
    },
    secondaryButton: {
        backgroundColor: '#1C1C1E',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    outlineButton: {
        backgroundColor: 'transparent',
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    disabledButton: {
        opacity: 0.5,
    },
    text: {
        fontSize: 17,
        fontWeight: '600',
        letterSpacing: 0,
    },
    primaryText: {
        color: '#fff',
    },
    secondaryText: {
        color: '#fff',
    },
    outlineText: {
        color: '#fff',
    },
});

