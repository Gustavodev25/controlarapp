import { ModernSwitch } from '@/components/ui/ModernSwitch';
import { UniversalBackground } from '@/components/UniversalBackground';
import { useAuthContext } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useBiometricAuth } from '@/hooks/use-biometric-auth';
import { databaseService } from '@/services/firebase';
import { notificationService } from '@/services/notifications';
import { safeBack } from '@/utils/navigation';

import Avvvatars from '@/components/ui/Avvvatars';
import { Stack, useRouter } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface SettingsItemProps {
    title: string;
    subtitle?: string;
    rightElement?: React.ReactNode;
    onPress?: () => void;
    isLast?: boolean;
    showDivider?: boolean;
}

const SettingsItem = ({
    title,
    subtitle,
    rightElement,
    onPress,
    isLast = false,
    showDivider = true
}: SettingsItemProps) => (
    <TouchableOpacity
        style={styles.itemContainer}
        activeOpacity={0.72}
        onPress={onPress}
        disabled={!onPress}
    >
        <View style={styles.itemContent}>
            <View style={styles.itemTextBlock}>
                <Text style={styles.itemTitle} numberOfLines={1}>{title}</Text>
                {subtitle && <Text style={styles.itemSubtitle} numberOfLines={1}>{subtitle}</Text>}
            </View>
            {rightElement || <ChevronRight size={20} color="#5F5F63" />}
        </View>
        {!isLast && showDivider && <View style={styles.itemSeparator} />}
    </TouchableOpacity>
);

const SectionHeader = ({ title }: { title: string }) => (
    <Text style={styles.sectionHeader}>{title}</Text>
);

export default function SettingsScreen() {
    const router = useRouter();
    const { user, profile } = useAuthContext();
    const { showToast } = useToast();
    const insets = useSafeAreaInsets();

    const {
        isBiometricAvailable,
        isBiometricEnabled,
        enableBiometric,
        disableBiometric,
        getBiometricTypeName,
    } = useBiometricAuth(user?.uid, false);

    const [paymentAlertsEnabled, setPaymentAlertsEnabled] = useState(
        ((profile?.preferences as any)?.paymentAlertsEnabled ?? true) as boolean
    );
    const [biometricLoading, setBiometricLoading] = useState(false);
    const [showHeaderGlass, setShowHeaderGlass] = useState(false);

    useEffect(() => {
        const nextValue = ((profile?.preferences as any)?.paymentAlertsEnabled ?? true) as boolean;
        setPaymentAlertsEnabled(nextValue);
    }, [profile?.preferences]);

    const handlePaymentAlertsToggle = useCallback(async (nextValue: boolean) => {
        const previous = paymentAlertsEnabled;
        setPaymentAlertsEnabled(nextValue);

        if (!user?.uid) return;

        try {
            await databaseService.updatePreference(user.uid, {
                paymentAlertsEnabled: nextValue,
            });

            if (nextValue) {
                await notificationService.reschedulePaymentAlerts({
                    userId: user.uid,
                    enabled: true
                });
            } else {
                await notificationService.disablePaymentAlerts();
            }
        } catch (error) {
            console.error('Error updating payment alerts preference:', error);
            setPaymentAlertsEnabled(previous);
            showToast('Erro ao atualizar alertas de pagamento', 'error');
        }
    }, [paymentAlertsEnabled, showToast, user?.uid]);

    const handleBiometricToggle = async () => {
        if (biometricLoading) return;
        setBiometricLoading(true);

        try {
            if (isBiometricEnabled) {
                await disableBiometric();
                showToast(`${getBiometricTypeName()} desativado`, 'info');
            } else {
                const success = await enableBiometric();
                if (success) {
                    showToast(`${getBiometricTypeName()} ativado com sucesso!`, 'success');
                } else {
                    showToast('Falha ao ativar biometria', 'error');
                }
            }
        } catch {
            showToast('Erro ao alterar configuração', 'error');
        } finally {
            setBiometricLoading(false);
        }
    };

    const handleScroll = useCallback((event: any) => {
        const offsetY = event.nativeEvent.contentOffset.y;
        setShowHeaderGlass((current) => {
            if (!current && offsetY < -8) return true;
            if (current && offsetY > -2) return false;
            return current;
        });
    }, []);

    const displayName = profile?.name || user?.displayName || 'Usuário';
    const email = user?.email || '';
    const avatarValue = email || displayName || 'Guest';

    return (
        <View style={styles.mainContainer}>
            <Stack.Screen options={{ headerShown: false }} />
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0 }} pointerEvents="none">
                <UniversalBackground backgroundColor="#0C0C0C" glowSize={350} height={280} />
            </View>

            <View style={[styles.headerWrapper, { paddingTop: insets.top }]}>
                {showHeaderGlass && (
                    <View style={StyleSheet.absoluteFill} pointerEvents="none">
                        <View style={styles.headerGlassTint} />
                    </View>
                )}
                <View style={styles.header}>
                    <TouchableOpacity
                        onPress={() => safeBack(router)}
                        style={styles.backButton}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <ChevronRight size={24} color="#E0E0E0" style={{ transform: [{ rotate: '180deg' }] }} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Configurações</Text>
                    <View style={styles.headerSpacer} />
                </View>
            </View>

            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                bounces
                overScrollMode="always"
                onScroll={handleScroll}
                scrollEventThrottle={16}
            >
                <View style={styles.profileHeader}>
                    <View style={styles.profileAvatar}>
                        <Avvvatars value={avatarValue} size={52} style="shape" />
                    </View>
                    <View style={styles.profileInfo}>
                        <Text style={styles.name} numberOfLines={1}>{displayName}</Text>
                        <Text style={styles.email} numberOfLines={1}>{email}</Text>
                    </View>
                </View>

                <SectionHeader title="ASSINATURA" />
                <View style={styles.sectionCard}>
                    <SettingsItem
                        title="Meu Plano"
                        isLast
                        onPress={() => router.push('/settings/subscription')}
                    />
                </View>

                <SectionHeader title="PERFIL" />
                <View style={styles.sectionCard}>
                    <SettingsItem
                        title="Dados Pessoais"
                        isLast
                        onPress={() => router.push('/settings/personal-data')}
                    />
                </View>

                <SectionHeader title="FINANÇAS" />
                <View style={styles.sectionCard}>
                    <SettingsItem
                        title="Financeiro"
                        onPress={() => router.push('/settings/financial')}
                    />
                    <SettingsItem
                        title="Categorias"
                        isLast
                        onPress={() => router.push('/settings/categories')}
                    />
                </View>

                <SectionHeader title="SEGURANÇA" />
                <View style={styles.sectionCard}>
                    <SettingsItem
                        title="Acesso Rápido"
                        subtitle={`Usar ${getBiometricTypeName()}`}
                        rightElement={
                            isBiometricAvailable ? (
                                <ModernSwitch
                                    value={isBiometricEnabled}
                                    onValueChange={biometricLoading ? () => { } : handleBiometricToggle}
                                />
                            ) : (
                                <View style={styles.badge}>
                                    <Text style={styles.badgeText}>Indisponível</Text>
                                </View>
                            )
                        }
                        isLast
                        onPress={isBiometricAvailable ? handleBiometricToggle : undefined}
                    />
                </View>

                <SectionHeader title="NOTIFICAÇÕES" />
                <View style={styles.sectionCard}>
                    <SettingsItem
                        title="Alertas de Pagamento"
                        rightElement={
                            <ModernSwitch
                                value={paymentAlertsEnabled}
                                onValueChange={handlePaymentAlertsToggle}
                            />
                        }
                        onPress={() => handlePaymentAlertsToggle(!paymentAlertsEnabled)}
                    />
                    <SettingsItem
                        title="Dicas Financeiras"
                        rightElement={
                            <View style={styles.badge}>
                                <Text style={styles.badgeText}>Em breve</Text>
                            </View>
                        }
                        isLast
                        onPress={() => { }}
                    />
                </View>

                <View style={styles.footer}>
                    <Text style={styles.versionText}>Versão 1.0.0</Text>
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    mainContainer: {
        flex: 1,
        backgroundColor: '#0C0C0C',
    },
    headerWrapper: {
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(255,255,255,0.08)',
        overflow: 'hidden',
    },
    headerGlassTint: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(12, 12, 12, 0.72)',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 52,
        paddingHorizontal: 20,
    },
    backButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'flex-start',
    },
    headerTitle: {
        flex: 1,
        fontSize: 18,
        fontWeight: '600',
        color: '#E8E8EA',
        textAlign: 'center',
    },
    headerSpacer: {
        width: 40,
        height: 40,
    },
    scroll: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingBottom: 40,
    },
    profileHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 20,
        marginBottom: 4,
    },
    profileAvatar: {
        width: 52,
        height: 52,
        borderRadius: 26,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
    },
    profileInfo: {
        flex: 1,
        minWidth: 0,
    },
    name: {
        fontSize: 20,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    email: {
        fontSize: 14,
        color: '#8E8E93',
        marginTop: 3,
    },
    sectionHeader: {
        fontSize: 12,
        fontWeight: '500',
        color: '#8E8E93',
        marginTop: 24,
        marginBottom: 8,
        marginLeft: 2,
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },
    sectionCard: {
        backgroundColor: '#111111',
        borderRadius: 12,
        overflow: 'hidden',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#161616',
    },
    itemContainer: {
        backgroundColor: '#111111',
        minHeight: 54,
        position: 'relative',
    },
    itemContent: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 13,
        paddingHorizontal: 16,
        minHeight: 54,
    },
    itemTextBlock: {
        flex: 1,
        minWidth: 0,
        paddingRight: 12,
    },
    itemSeparator: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: StyleSheet.hairlineWidth,
        backgroundColor: '#161616',
    },
    itemTitle: {
        fontSize: 16,
        color: '#FFFFFF',
        fontWeight: '400',
    },
    itemSubtitle: {
        fontSize: 13,
        color: '#8E8E93',
        marginTop: 2,
    },
    badge: {
        backgroundColor: 'rgba(255,255,255,0.08)',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 999,
    },
    badgeText: {
        fontSize: 12,
        color: '#D0D0D2',
        fontWeight: '500',
    },
    footer: {
        marginTop: 36,
        alignItems: 'center',
    },
    versionText: {
        color: '#555',
        fontSize: 12,
    },
});
