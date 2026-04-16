import { useRouter } from 'expo-router';
import { ArrowLeft, Eye, EyeOff, Lock, Mail, Sparkles } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { UniversalBackground } from '@/components/UniversalBackground';
import { AuthButton } from '@/components/ui/AuthButton';
import { AuthInput } from '@/components/ui/AuthInput';
import { ShiningText } from '@/components/ui/ShiningText';
import { useAuthContext } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';

const KEYBOARD_BEHAVIOR = Platform.OS === 'ios' ? 'padding' : 'height';

export default function LoginScreen() {
    const router = useRouter();
    const { signIn } = useAuthContext();
    const { showError } = useToast();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);



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

    // Conectando os valores animados ao estilo do componente


    return (
        <UniversalBackground>
            <KeyboardAvoidingView behavior={KEYBOARD_BEHAVIOR} style={styles.keyboardView}>
                <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity onPress={goBack} style={styles.backButton}>
                            <ArrowLeft size={20} color="#faf9f5" />
                        </TouchableOpacity>

                    </View>

                    <View style={styles.spacer} />



                    {/* Card Container Principal */}
                    <View style={styles.cardContainer}>
                        <View style={styles.card}>
                            <View style={styles.cardContent}>
                                <View style={styles.titleContainer}>
                                    <Text style={styles.title}>Boas-vindas ao </Text>
                                    <ShiningText text="Controlar+" textStyle={styles.shiningText} />
                                </View>
                                <Text style={styles.subtitle}>Faça login com sua conta existente.</Text>


                                <View style={styles.form}>
                                    <AuthInput label="E-mail" placeholder="seu@email.com" icon={Mail} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
                                    <View>
                                        <AuthInput label="Senha" placeholder="••••••••" icon={Lock} value={password} onChangeText={setPassword} secureTextEntry={!showPassword} rightIcon={<TouchableOpacity onPress={togglePasswordVisibility}>{showPassword ? <EyeOff size={20} color="#9ca3af" /> : <Eye size={20} color="#9ca3af" />}</TouchableOpacity>} />
                                    </View>
                                    <AuthButton title="Entrar" onPress={handleLogin} isLoading={isLoading} style={styles.button} />
                                </View>

                                {/* Divider */}
                                <View style={styles.divider}>
                                    <View style={styles.dividerLine} />
                                    <Text style={styles.dividerText}>ou</Text>
                                    <View style={styles.dividerLine} />
                                </View>

                                {/* Create account section */}
                                <View style={styles.createAccountCard}>
                                    <View style={styles.createAccountHeader}>
                                        <Sparkles size={16} color="#d97757" />
                                        <Text style={styles.createAccountTitle}>Novo no Controlar+?</Text>
                                    </View>
                                    <Text style={styles.createAccountNote}>
                                        Para criar sua conta é necessário assinar um plano.{Platform.OS === 'ios' ? ' O pagamento é feito via Apple Pay.' : ''}
                                    </Text>
                                    <TouchableOpacity
                                        style={styles.createAccountButton}
                                        onPress={() => router.push('/(public)/register')}
                                        activeOpacity={0.8}
                                    >
                                        <Text style={styles.createAccountButtonText}>Criar conta e assinar</Text>
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
    container: { flex: 1, backgroundColor: '#0C0C0C' },
    keyboardView: { flex: 1 },
    scrollContent: { flexGrow: 1 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 50, paddingHorizontal: 24, zIndex: 10 },

    backButton: { width: 32, height: 32, justifyContent: 'center', alignItems: 'center' },
    spacer: { flex: 1 },



    cardContainer: { position: 'relative', marginBottom: -100, paddingBottom: 100 },
    card: { backgroundColor: '#141414', borderTopLeftRadius: 32, borderTopRightRadius: 32 },
    cardContent: { padding: 24, paddingBottom: 32 },
    titleContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    title: { fontSize: 26, fontWeight: 'bold', color: '#faf9f5' },
    shiningText: { fontSize: 26, fontWeight: 'bold', color: '#d97757' },
    subtitle: { fontSize: 16, color: '#9ca3af', marginBottom: 8 },

    form: { gap: 8 },
    button: { marginTop: 6 },

    // Divider
    divider: { flexDirection: 'row', alignItems: 'center', marginTop: 24, marginBottom: 16, gap: 12 },
    dividerLine: { flex: 1, height: 1, backgroundColor: '#2a2a2a' },
    dividerText: { fontSize: 13, color: '#4b5563' },

    // Create account
    createAccountCard: {
        backgroundColor: '#1a1a1a',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#2a2a2a',
        marginBottom: 8,
    },
    createAccountHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
    createAccountTitle: { fontSize: 15, fontWeight: '700', color: '#faf9f5' },
    createAccountNote: { fontSize: 13, color: '#9ca3af', lineHeight: 18, marginBottom: 14 },
    createAccountButton: {
        backgroundColor: 'transparent',
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 16,
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: '#d97757',
    },
    createAccountButtonText: { fontSize: 15, fontWeight: '700', color: '#d97757' },
});