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
                props.disabled && styles.disabledButton,
                style
            ]}
            disabled={isLoading || props.disabled}
            {...props}
        >
            {isLoading ? (
                <ActivityIndicator color={variant === 'outline' ? '#faf9f5' : '#fff'} />
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
        height: 56,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'row',
        width: '100%',
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 4,
    },
    primaryButton: {
        backgroundColor: '#d97757',
    },
    secondaryButton: {
        backgroundColor: '#27272a',
    },
    outlineButton: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: '#3f3f46',
    },
    disabledButton: {
        opacity: 0.6,
    },
    text: {
        fontSize: 16,
        fontWeight: 'bold',
        letterSpacing: 0.5,
    },
    primaryText: {
        color: '#fff',
    },
    secondaryText: {
        color: '#faf9f5',
    },
    outlineText: {
        color: '#faf9f5',
    },
});
