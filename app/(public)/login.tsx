import { useRouter } from 'expo-router';
import { ArrowLeft, Eye, EyeOff, Lock, Mail } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { UniversalBackground } from '@/components/UniversalBackground';
import { AuthButton } from '@/components/ui/AuthButton';
import { AuthInput } from '@/components/ui/AuthInput';
import { ShiningText } from '@/components/ui/ShiningText';
import { useAuthContext } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';

const KEYBOARD_BEHAVIOR = Platform.select({ ios: 'padding', android: 'height' });

export default function LoginScreen() {
    const router = useRouter();
    const { signIn } = useAuthContext();
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

    // Conectando os valores animados ao estilo do componente


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

                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity onPress={goBack} style={styles.backButton}>
                            <ArrowLeft size={20} color="#faf9f5" />
                        </TouchableOpacity>

                        <TouchableOpacity onPress={handleNewAccount} style={styles.registerLink}>
                            <Text style={styles.registerLinkText}>
                                {Platform.OS === 'android' ? 'Assinar no site' : 'Novo no Controlar?'}
                            </Text>
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
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: Platform.OS === 'ios' ? 60 : 50,
        paddingHorizontal: 24,
        zIndex: 10
    },
    backButton: { width: 44, height: 44, justifyContent: 'center', alignItems: 'flex-start' },
    registerLink: { paddingVertical: 8, paddingHorizontal: 4 },
    registerLinkText: { fontSize: 13, color: '#9ca3af', fontWeight: '500' },
    spacer: { flex: 1, minHeight: 20 },



    cardContainer: { width: '100%' },
    card: {
        backgroundColor: '#141414',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        paddingBottom: 40,
    },
    cardContent: { padding: 24 },
    titleContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    title: { fontSize: 26, fontWeight: 'bold', color: '#faf9f5' },
    shiningText: { fontSize: 26, fontWeight: 'bold', color: '#d97757' },
    subtitle: { fontSize: 16, color: '#9ca3af', marginBottom: 8 },

    form: { gap: 8 },
    button: { marginTop: 6 },
});