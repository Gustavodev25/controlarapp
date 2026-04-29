import { useRouter } from 'expo-router';
import { ArrowLeft, Eye, EyeOff, Lock, Mail } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View, Image } from 'react-native';

import { UniversalBackground } from '@/components/UniversalBackground';
import { AuthButton } from '@/components/ui/AuthButton';
import { AuthInput } from '@/components/ui/AuthInput';
import { useAuthContext } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';

const KEYBOARD_BEHAVIOR = Platform.select({ ios: 'padding', android: 'height' });

export default function LoginScreen() {
    const router = useRouter();
    const { signIn, profile } = useAuthContext();
    const { showError } = useToast();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const handleNewAccount = useCallback(() => {
        if (Platform.OS === 'android') {
            Linking.openURL('https://www.controlarmais.com.br/');
        } else {
            router.push('/(public)/register');
        }
    }, [router]);

    const handleLogin = useCallback(async () => {
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
    }, [email, password, signIn, showError, router]);

    const goBack = () => router.back();
    const togglePasswordVisibility = () => setShowPassword(prev => !prev);

    return (
        <UniversalBackground>
            <KeyboardAvoidingView
                behavior={KEYBOARD_BEHAVIOR}
                style={styles.keyboardView}
                keyboardVerticalOffset={0}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                    bounces={false}
                >
                    {/* Header - Minimalist */}
                    <View style={styles.header}>
                        <TouchableOpacity onPress={goBack} style={styles.backButton}>
                            <ArrowLeft size={24} color="#faf9f5" />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.centerContainer}>
                        <View style={styles.titleSection}>
                            <View style={styles.logoContainer}>
                                <Image 
                                    source={require('@/assets/images/android-icon-foreground.png')} 
                                    style={styles.logo}
                                    resizeMode="contain"
                                />
                            </View>
                            <Text style={styles.subtitle}>Faça login para continuar</Text>
                        </View>

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
                            <AuthInput 
                                label="Senha" 
                                placeholder="••••••••" 
                                icon={Lock} 
                                value={password} 
                                onChangeText={setPassword} 
                                secureTextEntry={!showPassword} 
                                rightIcon={
                                    <TouchableOpacity onPress={togglePasswordVisibility}>
                                        {showPassword ? <EyeOff size={20} color="#9ca3af" /> : <Eye size={20} color="#9ca3af" />}
                                    </TouchableOpacity>
                                } 
                            />
                            
                            <AuthButton 
                                title="Entrar" 
                                onPress={handleLogin} 
                                isLoading={isLoading} 
                                style={styles.button} 
                            />

                            <TouchableOpacity onPress={handleNewAccount} style={styles.registerLink}>
                                <Text style={styles.registerLinkText}>
                                    {Platform.OS === 'android' ? 'Assinar no site' : 'Não tem uma conta? Cadastre-se'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </UniversalBackground>
    );
}

const styles = StyleSheet.create({
    keyboardView: { flex: 1 },
    scrollContent: { flexGrow: 1 },
    header: {
        paddingTop: Platform.OS === 'ios' ? 60 : 50,
        paddingHorizontal: 24,
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10
    },
    backButton: { width: 44, height: 44, justifyContent: 'center' },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: 32,
        paddingBottom: 40,
    },
    titleSection: {
        alignItems: 'center',
        marginBottom: 40,
    },
    logoContainer: {
        width: 80,
        height: 80,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    logo: {
        width: 60,
        height: 60,
        borderRadius: 12,
    },
    subtitle: { 
        fontSize: 15, 
        color: '#9ca3af', 
        fontWeight: '400',
    },
    form: { 
        width: '100%',
        gap: 16,
    },
    button: { 
        marginTop: 12,
    },
    registerLink: { 
        marginTop: 24,
        alignItems: 'center',
    },
    registerLinkText: { 
        fontSize: 14, 
        color: '#9ca3af', 
        fontWeight: '500' 
    },
});