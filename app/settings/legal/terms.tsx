import { UniversalBackground } from '@/components/UniversalBackground';
import { APP_LEGAL } from '@/constants/legal';
import { safeBack } from '@/utils/navigation';
import { Stack, useRouter } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import React from 'react';
import {
    Linking,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const sections = [
    {
        title: '1. Licenca do aplicativo',
        body: 'O uso do app Controlar+ distribuido pela App Store segue o Contrato de Licenca Padrao da Apple para Aplicativos Licenciados (EULA), salvo se houver um EULA personalizado publicado no App Store Connect.',
    },
    {
        title: '2. Uso do servico',
        body: 'Voce deve usar o app de forma licita, manter suas credenciais protegidas e fornecer informacoes corretas. O app oferece ferramentas de organizacao financeira e nao substitui consultoria financeira, contabil, juridica ou tributaria.',
    },
    {
        title: '3. Plano Pro',
        body: 'O Plano Pro e uma assinatura com renovacao automatica mensal. A cobranca, renovacao, cancelamento e reembolso das compras feitas no iOS sao gerenciados pela App Store e pelas regras da Apple.',
    },
    {
        title: '4. Renovacao e cancelamento',
        body: 'A assinatura renova automaticamente, salvo cancelamento pelo menos 24 horas antes do fim do periodo atual. Voce pode gerenciar ou cancelar a assinatura nos Ajustes do dispositivo, na conta Apple ID, em Assinaturas.',
    },
    {
        title: '5. Disponibilidade',
        body: 'Podemos atualizar, alterar ou descontinuar funcionalidades para melhorar o app, cumprir requisitos tecnicos, atender obrigacoes legais ou proteger usuarios e servicos.',
    },
    {
        title: '6. Suporte',
        body: `Para duvidas sobre o app, sua conta ou assinatura, entre em contato pelo e-mail ${APP_LEGAL.supportEmail}.`,
    },
];

export default function TermsOfUseScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />
            <View style={styles.backgroundLayer} pointerEvents="none">
                <UniversalBackground
                    backgroundColor="#0C0C0C"
                    glowSize={350}
                    height={280}
                    showParticles={true}
                    particleCount={12}
                />
            </View>

            <View style={[styles.contentLayer, { paddingTop: insets.top + 12 }]}>
                <View style={styles.header}>
                    <TouchableOpacity
                        onPress={() => safeBack(router)}
                        style={styles.backButton}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <ChevronRight size={24} color="#E0E0E0" style={{ transform: [{ rotate: '180deg' }] }} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>{APP_LEGAL.termsTitle}</Text>
                    <View style={styles.backButton} />
                </View>

                <ScrollView
                    contentContainerStyle={styles.content}
                    showsVerticalScrollIndicator={false}
                >
                    <Text style={styles.updatedText}>Ultima atualizacao: {APP_LEGAL.lastUpdated}</Text>
                    <Text style={styles.introText}>
                        Estes termos resumem as condicoes de uso do Controlar+ e indicam o EULA
                        aplicavel para compras feitas pela App Store.
                    </Text>

                    {sections.map((section) => (
                        <View key={section.title} style={styles.section}>
                            <Text style={styles.sectionTitle}>{section.title}</Text>
                            <Text style={styles.sectionBody}>{section.body}</Text>
                        </View>
                    ))}

                    <TouchableOpacity
                        style={styles.websiteButton}
                        onPress={() => Linking.openURL(APP_LEGAL.appleStandardEulaUrl)}
                        activeOpacity={0.75}
                    >
                        <Text style={styles.websiteButtonText}>Abrir EULA padrao da Apple</Text>
                    </TouchableOpacity>
                </ScrollView>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0C0C0C',
    },
    backgroundLayer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
    },
    contentLayer: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 2,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 12,
        zIndex: 2,
    },
    backButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'flex-start',
    },
    headerTitle: {
        flex: 1,
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
        textAlign: 'center',
    },
    content: {
        paddingHorizontal: 22,
        paddingTop: 18,
        paddingBottom: 48,
    },
    updatedText: {
        color: '#8E8E93',
        fontSize: 12,
        marginBottom: 14,
    },
    introText: {
        color: '#F5F5F7',
        fontSize: 16,
        lineHeight: 24,
        marginBottom: 22,
    },
    section: {
        marginBottom: 22,
    },
    sectionTitle: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '700',
        marginBottom: 8,
    },
    sectionBody: {
        color: '#B0B0B5',
        fontSize: 14,
        lineHeight: 21,
    },
    websiteButton: {
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: 'rgba(217, 119, 87, 0.35)',
        backgroundColor: 'rgba(217, 119, 87, 0.12)',
        paddingVertical: 14,
        paddingHorizontal: 16,
        marginTop: 4,
    },
    websiteButtonText: {
        color: '#d97757',
        fontSize: 14,
        fontWeight: '700',
    },
});
