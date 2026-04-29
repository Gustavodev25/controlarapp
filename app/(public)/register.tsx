import { useRouter } from 'expo-router';
import { ArrowLeft, Eye, EyeOff, Lock, Mail, User as UserIcon } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View, Image } from 'react-native';

import { UniversalBackground } from '@/components/UniversalBackground';
import { AuthButton } from '@/components/ui/AuthButton';
import { AuthInput } from '@/components/ui/AuthInput';
import { useAuthContext } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';

const KEYBOARD_BEHAVIOR = Platform.select({ ios: 'padding', android: 'height' });

export default function RegisterScreen() {
    const router = useRouter();
    const { signUp } = useAuthContext();
    const { showError, showToast } = useToast();

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [termsAccepted, setTermsAccepted] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const handleRegister = useCallback(async () => {
        if (!name || !email || !password) {
            showError('Por favor, preencha todos os campos.');
            return;
        }

        if (password.length < 6) {
            showError('A senha deve ter pelo menos 6 caracteres.');
            return;
        }

        if (!termsAccepted) {
            showError('Você precisa aceitar os Termos de Uso para continuar.');
            return;
        }

        setIsLoading(true);
        try {
            const result = await signUp(email, password, name);

            if (result.success) {
                showToast('Conta criada com sucesso!', 'success');
                router.replace('/settings/plans?forced=true');
            } else {
                showError(result.error || 'Erro ao criar conta.');
                setIsLoading(false);
            }
        } catch (error) {
            showError('Ocorreu um erro inesperado.');
            setIsLoading(false);
        }
    }, [name, email, password, termsAccepted, signUp, showError, showToast, router]);

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
                            <Text style={styles.subtitle}>Crie sua conta para começar</Text>
                        </View>

                        <View style={styles.form}>
                            <AuthInput
                                label="Nome Completo"
                                placeholder="Seu nome"
                                icon={UserIcon}
                                value={name}
                                onChangeText={setName}
                            />
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
                                placeholder="Mínimo 6 caracteres"
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

                            <TouchableOpacity
                                style={styles.termsRow}
                                onPress={() => setTermsAccepted(prev => !prev)}
                                activeOpacity={0.7}
                            >
                                <View style={[styles.checkbox, termsAccepted && styles.checkboxChecked]}>
                                    {termsAccepted && <Text style={styles.checkmark}>✓</Text>}
                                </View>
                                <Text style={styles.termsText}>
                                    Eu li e concordo com os{' '}
                                    <Text style={styles.termsLink}>Termos de Uso</Text>
                                </Text>
                            </TouchableOpacity>

                            <AuthButton
                                title={Platform.OS === 'ios' ? 'Continuar para o Plano' : 'Criar Conta'}
                                onPress={handleRegister}
                                isLoading={isLoading}
                                style={styles.button}
                            />

                            <TouchableOpacity onPress={goBack} style={styles.loginLink}>
                                <Text style={styles.loginLinkText}>Já tem uma conta? <Text style={styles.loginLinkHighlight}>Entrar</Text></Text>
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
        paddingVertical: 100,
    },
    titleSection: {
        alignItems: 'center',
        marginBottom: 32,
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
    loginLink: { 
        marginTop: 24,
        alignItems: 'center',
    },
    loginLinkText: { 
        fontSize: 14, 
        color: '#9ca3af', 
    },
    loginLinkHighlight: { 
        color: '#d97757', 
        fontWeight: 'bold' 
    },
    termsRow: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        gap: 10, 
        marginVertical: 4 
    },
    checkbox: {
        width: 18,
        height: 18,
        borderRadius: 4,
        borderWidth: 1.5,
        borderColor: '#4b5563',
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkboxChecked: {
        backgroundColor: '#d97757',
        borderColor: '#d97757',
    },
    checkmark: { fontSize: 10, color: '#fff', fontWeight: 'bold' },
    termsText: { fontSize: 13, color: '#9ca3af' },
    termsLink: { color: '#d97757', fontWeight: '600' },
});
