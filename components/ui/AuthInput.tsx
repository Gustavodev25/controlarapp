import { LucideIcon } from 'lucide-react-native';
import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';

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
                        <Icon size={18} color={isFocused ? '#d97757' : '#6b7280'} />
                    </View>
                )}
                <TextInput
                    style={[
                        styles.input,
                        Icon ? { paddingLeft: 40 } : null,
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
            {error && <Text style={styles.errorText}>{error}</Text>}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: 10,
    },
    label: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#9ca3af',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 6,
        paddingLeft: 4,
    },
    inputContainer: {
        backgroundColor: '#1A1A1A',
        borderWidth: 1,
        borderColor: '#2B2B2B',
        borderRadius: 12,
        height: 50,
        justifyContent: 'center',
        position: 'relative',
    },
    focusedContainer: {
        borderColor: '#d97757',
    },
    errorContainer: {
        borderColor: '#ef4444',
    },
    iconContainer: {
        position: 'absolute',
        left: 12,
        zIndex: 10,
    },
    rightIconContainer: {
        position: 'absolute',
        right: 12,
        zIndex: 10,
    },
    input: {
        flex: 1,
        color: '#faf9f5',
        fontSize: 14,
        paddingHorizontal: 12,
        height: '100%',
    },
    errorText: {
        color: '#ef4444',
        fontSize: 12,
        marginTop: 4,
        paddingLeft: 4,
    }
});
