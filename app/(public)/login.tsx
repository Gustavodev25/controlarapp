import { useRouter } from 'expo-router';
import { ArrowLeft, Eye, EyeOff, Lock, Mail } from 'lucide-react-native';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { UniversalBackground } from '@/components/UniversalBackground';
import { AuthButton } from '@/components/ui/AuthButton';
import { AuthInput } from '@/components/ui/AuthInput';
import { ShiningText } from '@/components/ui/ShiningText';
import { useAuthContext } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';



export default function LoginScreen() {
    const router = useRouter();
    const { signIn } = useAuthContext();
    const { showError } = useToast();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const handleLogin = async () => {
        if (!email || !password) {
            showError('Por favor, preencha todos os campos.');
            return;
        }

        setIsLoading(true);

        const result = await signIn(email, password);

        if (result.success) {
            router.replace('/(tabs)/dashboard');
        } else {
            showError(result.error || 'Erro ao fazer login.');
            setIsLoading(false);
        }
    };


    return (
        <UniversalBackground>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
            >
                <ScrollView
                    contentContainerStyle={{ flexGrow: 1 }}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    {/* Header with back button */}
                    <View style={styles.header}>
                        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                            <ArrowLeft size={20} color="#faf9f5" />
                        </TouchableOpacity>
                        <View style={styles.headerRight}>
                            <Text style={styles.headerText}>Ainda não tem conta? </Text>
                            <TouchableOpacity>
                                <Text style={styles.headerLink}>Criar</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Spacer */}
                    <View style={styles.spacer} />

                    {/* Card Container */}
                    <View style={styles.cardContainer}>
                        <View style={styles.card}>
                            <View style={styles.cardContent}>
                                <View style={styles.titleContainer}>
                                    <Text style={styles.title}>Boas-vindas ao </Text>
                                    <ShiningText
                                        text="Controlar+"
                                        textStyle={{ fontSize: 26, fontWeight: 'bold', color: '#d97757' }}
                                    />
                                </View>

                                <Text style={styles.subtitle}>
                                    Acesse sua conta para continuar.
                                </Text>

                                <View style={styles.form}>
                                    <AuthInput
                                        label="E-mail"
                                        placeholder="seu@email.com"
                                        icon={Mail}
                                        value={email}
                                        onChangeText={setEmail}
                                        autoCapitalize="none"
                                        keyboardType="email-address"
                                    />

                                    <View>
                                        <AuthInput
                                            label="Senha"
                                            placeholder="••••••••"
                                            icon={Lock}
                                            value={password}
                                            onChangeText={setPassword}
                                            secureTextEntry={!showPassword}
                                            rightIcon={
                                                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                                                    {showPassword ? (
                                                        <EyeOff size={20} color="#9ca3af" />
                                                    ) : (
                                                        <Eye size={20} color="#9ca3af" />
                                                    )}
                                                </TouchableOpacity>
                                            }
                                        />
                                        <TouchableOpacity style={styles.forgotPassword}>
                                            <Text style={styles.forgotPasswordText}>Esqueceu?</Text>
                                        </TouchableOpacity>
                                    </View>

                                    <AuthButton
                                        title="Entrar"
                                        onPress={handleLogin}
                                        isLoading={isLoading}
                                        style={styles.button}
                                    />
                                </View>
                            </View>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </UniversalBackground>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0C0C0C',
    },
    keyboardView: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 50,
        paddingHorizontal: 24,
        zIndex: 10,
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerText: {
        fontSize: 13,
        color: '#9ca3af',
    },
    headerLink: {
        fontSize: 13,
        fontWeight: '600',
        color: '#d97757',
    },
    backButton: {
        width: 32,
        height: 32,
        justifyContent: 'center',
        alignItems: 'center',
    },
    spacer: {
        flex: 1,
    },
    cardContainer: {
        position: 'relative',
        marginBottom: -100,
        paddingBottom: 100,
    },
    card: {
        backgroundColor: '#141414',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
    },

    cardContent: {
        padding: 24,
        paddingBottom: 32,
    },
    titleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    title: {
        fontSize: 26,
        fontWeight: 'bold',
        color: '#faf9f5',
    },
    highlight: {
        color: '#d97757',
    },
    subtitle: {
        fontSize: 16,
        color: '#9ca3af',
        marginBottom: 20,
    },
    form: {
        gap: 8,
    },
    forgotPassword: {
        position: 'absolute',
        right: 0,
        top: 0,
        zIndex: 10,
    },
    forgotPasswordText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#d97757',
    },
    button: {
        marginTop: 6,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 6,
        marginTop: 32,
    },
    footerText: {
        color: '#9ca3af',
        fontSize: 14,
    },
    linkText: {
        color: '#faf9f5',
        fontSize: 14,
        fontWeight: 'bold',
    },
    errorText: {
        color: '#ef4444',
        fontSize: 13,
        textAlign: 'center',
        marginTop: 8,
    }
});
