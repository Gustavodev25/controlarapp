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
        title: '1. Dados que coletamos',
        body: 'Coletamos dados fornecidos por voce, como nome, e-mail e informacoes da conta. Tambem podemos processar dados financeiros cadastrados no app, dados de uso, identificadores do dispositivo e informacoes tecnicas necessarias para seguranca e funcionamento.',
    },
    {
        title: '2. Como usamos os dados',
        body: 'Usamos os dados para criar e proteger sua conta, organizar informacoes financeiras, sincronizar servicos contratados, oferecer suporte, enviar avisos importantes, melhorar o app e cumprir obrigacoes legais.',
    },
    {
        title: '3. Assinaturas e pagamentos',
        body: 'Em compras feitas no iOS, o pagamento da assinatura e processado pela App Store. O app recebe apenas as informacoes necessarias para confirmar o status da assinatura, liberar recursos Pro e manter o historico da conta.',
    },
    {
        title: '4. Compartilhamento',
        body: 'Nao vendemos seus dados pessoais. Podemos compartilhar dados somente com provedores necessarios para operar o app, como infraestrutura, autenticacao, banco de dados, notificacoes, suporte, integracoes autorizadas por voce e processamento de assinaturas.',
    },
    {
        title: '5. Retencao e seguranca',
        body: 'Mantemos os dados enquanto sua conta estiver ativa ou pelo periodo necessario para fins legais, operacionais e de seguranca. Usamos medidas tecnicas e organizacionais para proteger suas informacoes.',
    },
    {
        title: '6. Seus direitos',
        body: 'Voce pode solicitar acesso, correcao, portabilidade ou exclusao dos seus dados, quando aplicavel. Tambem pode revogar permissoes e encerrar integracoes autorizadas no app.',
    },
    {
        title: '7. Contato',
        body: `Para duvidas sobre privacidade ou exercicio de direitos, entre em contato pelo e-mail ${APP_LEGAL.supportEmail}.`,
    },
];

export default function PrivacyPolicyScreen() {
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
                    <Text style={styles.headerTitle}>{APP_LEGAL.privacyTitle}</Text>
                    <View style={styles.backButton} />
                </View>

                <ScrollView
                    contentContainerStyle={styles.content}
                    showsVerticalScrollIndicator={false}
                >
                    <Text style={styles.updatedText}>Ultima atualizacao: {APP_LEGAL.lastUpdated}</Text>
                    <Text style={styles.introText}>
                        Esta Politica de Privacidade explica como o Controlar+ coleta, usa, armazena
                        e protege dados pessoais quando voce utiliza o aplicativo e seus servicos.
                    </Text>

                    {sections.map((section) => (
                        <View key={section.title} style={styles.section}>
                            <Text style={styles.sectionTitle}>{section.title}</Text>
                            <Text style={styles.sectionBody}>{section.body}</Text>
                        </View>
                    ))}

                    <TouchableOpacity
                        style={styles.websiteButton}
                        onPress={() => Linking.openURL(APP_LEGAL.websiteUrl)}
                        activeOpacity={0.75}
                    >
                        <Text style={styles.websiteButtonText}>Abrir site do Controlar+</Text>
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
