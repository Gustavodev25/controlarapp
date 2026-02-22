import { useRouter } from 'expo-router';
import { ArrowLeft, ExternalLink, Eye, EyeOff, Lock, Mail, X } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import { Dimensions, KeyboardAvoidingView, Linking, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
    FadeIn,
    FadeOut,
    ZoomIn,
    useAnimatedStyle,
    useSharedValue,
    withSpring
} from 'react-native-reanimated';

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

import { UniversalBackground } from '@/components/UniversalBackground';
import { AuthButton } from '@/components/ui/AuthButton';
import { AuthInput } from '@/components/ui/AuthInput';
import { ShiningText } from '@/components/ui/ShiningText';
import { useAuthContext } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';

const REGISTER_URL = 'https://www.controlarmais.com.br/';
const KEYBOARD_BEHAVIOR = Platform.OS === 'ios' ? 'padding' : 'height';
const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Configuração matemática da "mola" (Física exata e rápida)
const springConfig = { damping: 16, stiffness: 120, mass: 0.8 };

export default function LoginScreen() {
    const router = useRouter();
    const { signIn } = useAuthContext();
    const { showError } = useToast();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // Controle simples de Aberto/Fechado
    const [isOpen, setIsOpen] = useState(false);

    // Valores animados para transição fluida
    const islandWidth = useSharedValue(160); // Largura inicial
    const islandHeight = useSharedValue(44); // Altura inicial
    const islandRadius = useSharedValue(999); // Começa como pílula

    const toggleIsland = () => {
        const willOpen = !isOpen;
        setIsOpen(willOpen);

        if (willOpen) {
            // Expande para o cartão inteiro
            islandWidth.value = withSpring(SCREEN_WIDTH * 0.9, springConfig);
            islandHeight.value = withSpring(165, springConfig);
            islandRadius.value = withSpring(24, springConfig);
        } else {
            // Retrai de volta para a pílula
            islandWidth.value = withSpring(160, springConfig);
            islandHeight.value = withSpring(44, springConfig);
            islandRadius.value = withSpring(999, springConfig);
        }
    };

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

    const handleOpenWebsite = useCallback(async () => {
        try {
            await Linking.openURL(REGISTER_URL);
            toggleIsland(); // Fecha a ilha após clicar
        } catch {
            showError('Não foi possível abrir o site.');
        }
    }, [showError]);

    const goBack = () => router.back();
    const togglePasswordVisibility = () => setShowPassword(prev => !prev);

    // Conectando os valores animados ao estilo do componente
    const animatedIslandStyle = useAnimatedStyle(() => ({
        width: islandWidth.value,
        height: islandHeight.value,
        borderRadius: islandRadius.value,
    }));

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
                            <Text style={styles.headerText}>Ainda não tem conta? </Text>
                            <TouchableOpacity onPress={handleOpenWebsite}>
                                <Text style={styles.headerLink}>Criar</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={styles.spacer} />

                    {/* Dynamic Island: Anima direto para o conteúdo total */}
                    <AnimatedTouchableOpacity
                        style={[styles.dynamicIsland, animatedIslandStyle]}
                        onPress={!isOpen ? toggleIsland : undefined} // Evita fechar clicando no fundo se já estiver aberto
                        activeOpacity={0.9}
                        entering={ZoomIn.springify().damping(12).mass(0.9).stiffness(100).delay(100)}
                    >
                        {!isOpen ? (
                            // ESTADO FECHADO: Pílula inicial pequena
                            <Animated.View entering={FadeIn.duration(200).delay(100)} exiting={FadeOut.duration(100)} style={styles.centerContent}>
                                <Lock size={14} color="#9ca3af" />
                                <Text style={styles.recoveryPillText}>Perdeu a senha?</Text>
                            </Animated.View>
                        ) : (
                            // ESTADO ABERTO: Cartão completo com o topo igual ao da sua imagem
                            <Animated.View entering={FadeIn.duration(300).delay(150)} exiting={FadeOut.duration(100)} style={styles.expandedContent}>

                                {/* Topo (Header da imagem) */}
                                <View style={styles.expandedHeader}>
                                    <View style={styles.headerLeftRow}>
                                        <Lock size={18} color="#d97757" />
                                        <Text style={styles.expandedHeaderTitle}>Recuperação de Senha</Text>
                                    </View>
                                    <TouchableOpacity onPress={toggleIsland} style={styles.closeCircleBtn}>
                                        <X size={16} color="#9ca3af" />
                                    </TouchableOpacity>
                                </View>

                                {/* Conteúdo Interno */}
                                <Text style={styles.expandedSubtitle}>
                                    Você será redirecionado para o nosso site para criar uma nova senha com segurança.
                                </Text>

                                <TouchableOpacity onPress={handleOpenWebsite} style={styles.actionButton}>
                                    <Text style={styles.actionButtonText}>Abrir Site de Recuperação</Text>
                                    <ExternalLink size={14} color="#ffffff" />
                                </TouchableOpacity>

                            </Animated.View>
                        )}
                    </AnimatedTouchableOpacity>

                    {/* Card Container Principal */}
                    <View style={styles.cardContainer}>
                        <View style={styles.card}>
                            <View style={styles.cardContent}>
                                <View style={styles.titleContainer}>
                                    <Text style={styles.title}>Boas-vindas ao </Text>
                                    <ShiningText text="Controlar+" textStyle={styles.shiningText} />
                                </View>
                                <Text style={styles.subtitle}>Acesse sua conta para continuar.</Text>

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
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 50, paddingHorizontal: 24, zIndex: 10 },
    headerRight: { flexDirection: 'row', alignItems: 'center' },
    headerText: { fontSize: 13, color: '#9ca3af' },
    headerLink: { fontSize: 13, fontWeight: '600', color: '#d97757' },
    backButton: { width: 32, height: 32, justifyContent: 'center', alignItems: 'center' },
    spacer: { flex: 1 },

    /* === Estilos da Dynamic Island === */
    dynamicIsland: {
        backgroundColor: '#141414',
        alignSelf: 'center',
        marginBottom: 30,
        overflow: 'hidden',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
    },

    // Estado Fechado
    centerContent: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    recoveryPillText: { fontSize: 14, color: '#9ca3af', fontWeight: '500' },

    // Estado Aberto
    expandedContent: {
        flex: 1,
        padding: 16,
        justifyContent: 'space-between',
    },
    expandedHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    headerLeftRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    expandedHeaderTitle: {
        color: '#faf9f5',
        fontWeight: '500',
        fontSize: 16,
    },
    closeCircleBtn: {
        padding: 6,
        backgroundColor: '#2C2C2E', // Círculo escuro igual ao da imagem
        borderRadius: 99,
    },
    expandedSubtitle: {
        color: '#9ca3af',
        fontSize: 13,
        lineHeight: 18,
        marginTop: 12,
    },
    actionButton: {
        backgroundColor: '#d97757',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 12,
        gap: 8,
        marginTop: 16,
    },
    actionButtonText: {
        color: '#ffffff',
        fontWeight: 'bold',
        fontSize: 14,
    },
    /* ================================= */

    cardContainer: { position: 'relative', marginBottom: -100, paddingBottom: 100 },
    card: { backgroundColor: '#141414', borderTopLeftRadius: 32, borderTopRightRadius: 32 },
    cardContent: { padding: 24, paddingBottom: 32 },
    titleContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    title: { fontSize: 26, fontWeight: 'bold', color: '#faf9f5' },
    shiningText: { fontSize: 26, fontWeight: 'bold', color: '#d97757' },
    subtitle: { fontSize: 16, color: '#9ca3af', marginBottom: 20 },
    form: { gap: 8 },
    button: { marginTop: 6 },
});