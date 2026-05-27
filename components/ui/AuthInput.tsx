import { LucideIcon } from 'lucide-react-native';
import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';


interface AuthInputProps extends TextInputProps {
    label: string;
    icon?: LucideIcon;
    rightIcon?: React.ReactNode;
    error?: string;
}

export const AuthInput = ({ label, icon: Icon, rightIcon, error, style, ...props }: AuthInputProps) => {
    const [isFocused, setIsFocused] = useState(false);

    return (
        <View style={styles.container}>
            <Text style={styles.label}>{label}</Text>
            <View style={[
                styles.inputContainer,
                isFocused && styles.focusedContainer,
                error ? styles.errorContainer : null
            ]}>
                {Icon && (
                    <View style={styles.iconContainer}>
                        <Icon size={20} color={isFocused ? '#d97757' : '#9ca3af'} />
                    </View>
                )}
                <TextInput
                    style={[
                        styles.input,
                        Icon ? { paddingLeft: 44 } : null,
                        rightIcon ? { paddingRight: 44 } : null,
                        style
                    ]}
                    placeholderTextColor="#6b7280"
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    {...props}
                />
                {rightIcon && (
                    <View style={styles.rightIconContainer}>
                        {rightIcon}
                    </View>
                )}
            </View>
            {error && <ThemedText style={styles.errorText}>{error}</ThemedText>}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: 12,
    },
    label: {
        fontSize: 13,
        fontWeight: '600',
        color: '#faf9f5',
        marginBottom: 8,
        paddingLeft: 2,
    },
    inputContainer: {
        backgroundColor: '#1C1C1E', // iOS Dark Gray
        borderWidth: 1,
        borderColor: '#2C2C2E',
        borderRadius: 14,
        height: 52,
        justifyContent: 'center',
        position: 'relative',
    },
    focusedContainer: {
        borderColor: '#d97757',
        backgroundColor: '#242426',
    },
    errorContainer: {
        borderColor: '#ef4444',
    },
    iconContainer: {
        position: 'absolute',
        left: 14,
        zIndex: 10,
    },
    rightIconContainer: {
        position: 'absolute',
        right: 14,
        zIndex: 10,
    },
    input: {
        flex: 1,
        color: '#faf9f5',
        fontSize: 16,
        paddingHorizontal: 16,
        height: '100%',
    },
    errorText: {
        color: '#ef4444',
        fontSize: 12,
        marginTop: 6,
        paddingLeft: 4,
    }
});
