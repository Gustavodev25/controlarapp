import { Link, useRouter } from 'expo-router';
import { ArrowLeft, Calendar, FileText, Home, Lock, Mail, MapPin, Phone, User } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { AuthButton } from '@/components/ui/AuthButton';
import { AuthInput } from '@/components/ui/AuthInput';
import { useAuthContext } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { BlurView } from 'expo-blur';

const TOTAL_STEPS = 2;

export default function RegisterScreen() {
    const router = useRouter();
    const { signUp } = useAuthContext();
    const { showError } = useToast();
    const [currentStep, setCurrentStep] = useState(1);

    // Step 1 fields
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    // Step 2 fields
    const [cpf, setCpf] = useState('');
    const [birthDate, setBirthDate] = useState('');
    const [phone, setPhone] = useState('');
    const [cep, setCep] = useState('');
    const [address, setAddress] = useState('');
    const [city, setCity] = useState('');

    const [isLoading, setIsLoading] = useState(false);

    const handleNext = useCallback(() => {
        if (currentStep < TOTAL_STEPS) {
            setCurrentStep(currentStep + 1);
        }
    }, [currentStep]);

    const handleBack = useCallback(() => {
        if (currentStep > 1) {
            setCurrentStep(currentStep - 1);
        } else {
            router.back();
        }
    }, [currentStep, router]);

    const handleRegister = async () => {
        setIsLoading(true);

        const result = await signUp(email, password, name, phone);

        if (result.success) {
            router.replace('/(tabs)/dashboard');
        } else {
            showError(result.error || 'Erro ao criar conta.');
            setIsLoading(false);
        }
    };

    const isStep1Valid = name.length > 0 && email.length > 0 && password.length >= 6;
    const isStep2Valid = cpf.length > 0 && birthDate.length > 0 && phone.length > 0;

    const renderStepIndicator = () => (
        <View style={styles.stepIndicator}>
            {[1, 2].map((step) => (
                <View key={step} style={styles.stepRow}>
                    <View style={[
                        styles.stepDot,
                        currentStep >= step ? styles.stepDotActive : styles.stepDotInactive
                    ]}>
                        <Text style={[
                            styles.stepNumber,
                            currentStep >= step ? styles.stepNumberActive : styles.stepNumberInactive
                        ]}>
                            {step}
                        </Text>
                    </View>
                    {step < TOTAL_STEPS && (
                        <View style={[
                            styles.stepLine,
                            currentStep > step ? styles.stepLineActive : styles.stepLineInactive
                        ]} />
                    )}
                </View>
            ))}
        </View>
    );

    const renderStep1 = () => (
        <>
            <Text style={styles.stepTitle}>Dados de Acesso</Text>
            <Text style={styles.stepSubtitle}>Informe seus dados básicos para criar sua conta</Text>

            <View style={styles.formContainer}>
                <AuthInput
                    label="Nome Completo"
                    placeholder="Seu nome"
                    icon={User}
                    value={name}
                    onChangeText={setName}
                    autoCapitalize="words"
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
                    placeholder="••••••••"
                    icon={Lock}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                />
            </View>

            <AuthButton
                title="Continuar"
                onPress={handleNext}
                disabled={!isStep1Valid}
                style={styles.button}
            />
        </>
    );

    const renderStep2 = () => (
        <>
            <Text style={styles.stepTitle}>Dados Pessoais</Text>
            <Text style={styles.stepSubtitle}>Complete seu perfil com informações adicionais</Text>

            <View style={styles.formContainer}>
                <View style={styles.row}>
                    <View style={styles.col}>
                        <AuthInput
                            label="CPF"
                            placeholder="000.000.000-00"
                            icon={FileText}
                            value={cpf}
                            onChangeText={setCpf}
                            keyboardType="numeric"
                        />
                    </View>
                    <View style={[styles.col, { marginLeft: 12 }]}>
                        <AuthInput
                            label="Data Nasc."
                            placeholder="dd/mm/aaaa"
                            icon={Calendar}
                            value={birthDate}
                            onChangeText={setBirthDate}
                            keyboardType="numeric"
                        />
                    </View>
                </View>

                <AuthInput
                    label="Telefone / WhatsApp"
                    placeholder="(00) 90000-0000"
                    icon={Phone}
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                />

                <View style={styles.row}>
                    <View style={{ width: '35%' }}>
                        <AuthInput
                            label="CEP"
                            placeholder="00000-000"
                            icon={MapPin}
                            value={cep}
                            onChangeText={setCep}
                            keyboardType="numeric"
                        />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                        <AuthInput
                            label="Cidade"
                            placeholder="Sua cidade"
                            icon={Home}
                            value={city}
                            onChangeText={setCity}
                        />
                    </View>
                </View>

                <AuthInput
                    label="Endereço"
                    placeholder="Rua, número, bairro"
                    icon={Home}
                    value={address}
                    onChangeText={setAddress}
                />
            </View>

            <AuthButton
                title="Criar Conta"
                onPress={handleRegister}
                isLoading={isLoading}
                disabled={!isStep2Valid}
                style={styles.button}
            />
        </>
    );

    return (
        <View style={styles.container}>


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
                        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                            <ArrowLeft size={24} color="#faf9f5" />
                        </TouchableOpacity>
                    </View>

                    {/* Spacer */}
                    <View style={styles.spacer} />

                    {/* Glassmorphism Card */}
                    <BlurView intensity={60} tint="dark" style={styles.card}>
                        <View style={styles.cardContent}>
                            <Text style={styles.title}>Crie sua conta</Text>
                            {currentStep > 1 && renderStepIndicator()}

                            {currentStep === 1 ? renderStep1() : renderStep2()}

                            <View style={styles.footer}>
                                <Text style={styles.footerText}>Já tem uma conta?</Text>
                                <Link href="/(public)/login" asChild>
                                    <TouchableOpacity>
                                        <Text style={styles.linkText}>Fazer login</Text>
                                    </TouchableOpacity>
                                </Link>
                            </View>
                        </View>
                    </BlurView>
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#1D100B',
    },
    keyboardView: {
        flex: 1,
    },
    header: {
        paddingTop: 50,
        paddingHorizontal: 24,
        zIndex: 10,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },

    spacer: {
        flex: 1,
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#faf9f5',
        marginBottom: 16,
    },
    stepIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 24,
    },
    stepRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    stepDot: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    stepDotActive: {
        backgroundColor: '#d97757',
    },
    stepDotInactive: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    stepNumber: {
        fontSize: 14,
        fontWeight: 'bold',
    },
    stepNumberActive: {
        color: '#fff',
    },
    stepNumberInactive: {
        color: '#6b7280',
    },
    stepLine: {
        width: 40,
        height: 2,
        marginHorizontal: 8,
    },
    stepLineActive: {
        backgroundColor: '#d97757',
    },
    stepLineInactive: {
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    card: {
        backgroundColor: 'rgba(38, 38, 36, 0.41)',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        overflow: 'hidden',
    },

    cardContent: {
        padding: 20,
        paddingBottom: 24,
    },
    stepTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#faf9f5',
        marginBottom: 4,
    },
    stepSubtitle: {
        fontSize: 13,
        color: '#9ca3af',
        marginBottom: 20,
    },
    formContainer: {
        gap: 4,
    },
    row: {
        flexDirection: 'row',
    },
    col: {
        flex: 1,
    },
    button: {
        marginTop: 16,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 6,
        marginTop: 24,
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
