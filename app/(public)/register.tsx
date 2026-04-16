import { useRouter } from 'expo-router';
import { ArrowLeft, Lock, Mail, User as UserIcon, Eye, EyeOff } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { UniversalBackground } from '@/components/UniversalBackground';
import { AuthButton } from '@/components/ui/AuthButton';
import { AuthInput } from '@/components/ui/AuthInput';
import { ShiningText } from '@/components/ui/ShiningText';
import { useAuthContext } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';

const KEYBOARD_BEHAVIOR = Platform.OS === 'ios' ? 'padding' : 'height';

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
                if (Platform.OS === 'ios') {
                    router.replace('/settings/plans');
                } else {
                    router.replace('/(tabs)/dashboard');
                }
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
            <KeyboardAvoidingView behavior={KEYBOARD_BEHAVIOR} style={styles.keyboardView}>
                <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity onPress={goBack} style={styles.backButton}>
                            <ArrowLeft size={20} color="#faf9f5" />
                        </TouchableOpacity>
                        <View style={styles.headerRight}>
                            <Text style={styles.headerText}>Cadastro seguro</Text>
                        </View>
                    </View>

                    <View style={styles.spacer} />

                    {/* Card Container Principal */}
                    <View style={styles.cardContainer}>
                        <View style={styles.card}>
                            <View style={styles.cardContent}>
                                <View style={styles.titleContainer}>
                                    <Text style={styles.title}>Crie sua conta no </Text>
                                    <ShiningText text="Controlar+" textStyle={styles.shiningText} />
                                </View>
                                <Text style={styles.subtitle}>Comece a organizar sua vida financeira hoje.</Text>

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

                                    {/* Terms of Use */}
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
                                            {' '}e a{' '}
                                            <Text style={styles.termsLink}>Política de Privacidade</Text>
                                        </Text>
                                    </TouchableOpacity>

                                    {Platform.OS === 'ios' && (
                                        <View style={styles.iosNote}>
                                            <Text style={styles.iosNoteText}>
                                                Após o cadastro, você será direcionado para escolher seu plano via Apple Pay.
                                            </Text>
                                        </View>
                                    )}

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
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 50, paddingHorizontal: 24, zIndex: 10 },
    headerRight: { flexDirection: 'row', alignItems: 'center' },
    headerText: { fontSize: 13, color: '#9ca3af' },
    backButton: { width: 32, height: 32, justifyContent: 'center', alignItems: 'center' },
    spacer: { height: 40 },
    cardContainer: { position: 'relative' },
    card: { backgroundColor: '#141414', borderTopLeftRadius: 32, borderTopRightRadius: 32, minHeight: '100%' },
    cardContent: { padding: 24, paddingBottom: 100 },
    titleContainer: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 },
    title: { fontSize: 26, fontWeight: 'bold', color: '#faf9f5' },
    shiningText: { fontSize: 26, fontWeight: 'bold', color: '#d97757' },
    subtitle: { fontSize: 16, color: '#9ca3af', marginBottom: 24 },
    form: { gap: 8 },
    button: { marginTop: 16 },
    loginLink: { marginTop: 24, alignItems: 'center' },
    loginLinkText: { color: '#9ca3af', fontSize: 14 },
    loginLinkHighlight: { color: '#d97757', fontWeight: 'bold' },

    // Terms
    termsRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginTop: 8 },
    checkbox: {
        width: 20,
        height: 20,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: '#4b5563',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        marginTop: 1,
    },
    checkboxChecked: {
        backgroundColor: '#d97757',
        borderColor: '#d97757',
    },
    checkmark: { fontSize: 12, color: '#fff', fontWeight: 'bold' },
    termsText: { flex: 1, fontSize: 13, color: '#9ca3af', lineHeight: 20 },
    termsLink: { color: '#d97757', fontWeight: '600' },

    // iOS note
    iosNote: {
        backgroundColor: 'rgba(217, 119, 87, 0.1)',
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 16,
        marginTop: 4,
        borderWidth: 1,
        borderColor: 'rgba(217, 119, 87, 0.2)',
    },
    iosNoteText: { fontSize: 13, color: '#d97757', textAlign: 'center', lineHeight: 18 },
});
