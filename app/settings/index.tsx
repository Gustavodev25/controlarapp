import { ModernSwitch } from '@/components/ui/ModernSwitch';
import { UniversalBackground } from '@/components/UniversalBackground';
import { useAuthContext } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useBiometricAuth } from '@/hooks/use-biometric-auth';
import { databaseService } from '@/services/firebase';
import { notificationService } from '@/services/notifications';

import Avvvatars from '@/components/ui/Avvvatars';
import { Stack, useRouter } from 'expo-router';
import {
    AlertTriangle,
    Bell,
    ChevronRight,
    Crown,
    Fingerprint,
    Lightbulb,
    ScanFace,
    Shapes,
    User,
    Wallet
} from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
    Extrapolation,
    interpolate,
    useAnimatedScrollHandler,
    useAnimatedStyle,
    useSharedValue
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const getInitials = (name?: string) => {
    if (!name) return 'U';
    const names = name.trim().split(' ');
    if (names.length === 0) return 'U';
    if (names.length === 1) {
        if (name.includes('@')) {
            return name.substring(0, 2).toUpperCase();
        }
        return names[0].substring(0, 2).toUpperCase();
    }
    return (names[0][0] + names[names.length - 1][0]).toUpperCase();
};

const getAvatarGradient = (name?: string): [string, string] => {
    if (!name) return ['#e0e0e0', '#f5f5f5'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = Math.abs(hash) % 360;
    return [
        `hsl(${h}, 75%, 85%)`,
        `hsl(${(h + 40) % 360}, 75%, 80%)`
    ];
};

interface SettingsItemProps {
    icon: React.ElementType;
    title: string;
    subtitle?: string;
    rightElement?: React.ReactNode;
    color?: string;
    onPress?: () => void;
    isLast?: boolean;
    showDivider?: boolean;
}

const SettingsItem = ({
    icon: Icon,
    title,
    subtitle,
    rightElement,
    color = '#E0E0E0',
    onPress,
    isLast = false,
    showDivider = true
}: SettingsItemProps) => (
    <TouchableOpacity
        style={styles.itemContainer}
        activeOpacity={0.7}
        onPress={onPress}
        disabled={!onPress}
    >
        <View style={styles.itemIconContainer}>
            <Icon size={20} color={color} />
        </View>
        <View style={styles.itemRightContainer}>
            <View style={styles.itemContent}>
                <View>
                    <Text style={styles.itemTitle}>{title}</Text>
                    {subtitle && <Text style={styles.itemSubtitle}>{subtitle}</Text>}
                </View>
                {rightElement || <ChevronRight size={20} color="#666" />}
            </View>
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

    // Passa o userId para vincular biometria à conta específica
    const {
        isBiometricAvailable,
        isBiometricEnabled,
        biometricType,
        enableBiometric,
        disableBiometric,
        getBiometricTypeName,
    } = useBiometricAuth(user?.uid, false);

    const [paymentAlertsEnabled, setPaymentAlertsEnabled] = useState(
        ((profile?.preferences as any)?.paymentAlertsEnabled ?? true) as boolean
    );
    const [biometricLoading, setBiometricLoading] = useState(false);

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
    }, [paymentAlertsEnabled, profile?.preferences, showToast, user?.uid]);

    // Avatar Morph Animation Constants
    const { width } = React.useMemo(() => Dimensions.get('window'), []);
    const HEADER_HEIGHT = 50;
    const BIG_AVATAR_SIZE = 80;
    const SMALL_AVATAR_SIZE = 28;
    const SCALE_FACTOR = BIG_AVATAR_SIZE / SMALL_AVATAR_SIZE;

    // Exact calculation for the center position relative to the header container
    // Screen Center - (Header Padding Left + Back Button Width + Left Margin) - Half Small Avatar
    // Header Content starts at 60px (20px pad + 40px back btn)
    // Small Avatar is at left: 0 of Header Content.
    // So Small Avatar Center X = 60 + 16 = 76.
    // Big Avatar Center X = Width / 2.
    // TranslateX needed = (Width / 2) - 76.
    const START_X = (width / 2) - 76;

    // Start Y Calculation
    // We want to align the centers of the Big Avatar and the Small Avatar at scrollY = 0.
    // 1. Small Avatar Center Y (in Header):
    //    Header Height = 50. Small Avatar is centered vertically.
    //    Small Center Y = 50 / 2 = 25.
    // 2. Big Avatar Center Y (relative to Header Top):
    //    ScrollView starts at Header Bottom (Top + 50).
    //    Big Avatar is at top of ScrollView.
    //    Big Avatar Top = 50.
    //    Big Avatar Center = 50 + (100 / 2) = 100.
    // 3. Translation needed = Big Center Y - Small Center Y
    //    But we also need to account for scaling which happens from the center.
    //    At Scale = SCALE_FACTOR, the element takes Big Avatar Size but is anchored at Small Avatar Center.
    //    So we strictly need to translate the Centers.
    //    TranslateY = 100 - 25 = 75.
    const START_Y = 75;

    // Animation values
    const scrollY = useSharedValue(0);
    const profileContentHeight = useSharedValue(0);

    const scrollHandler = useAnimatedScrollHandler({
        onScroll: (event) => {
            scrollY.value = event.contentOffset.y;
        },
    });

    // Move sections up while profile fades, without changing ScrollView layout height.
    const sectionsCollapseStyle = useAnimatedStyle(() => {
        const profileHeight = profileContentHeight.value > 0 ? profileContentHeight.value : 180;
        const collapseDistance = Math.max(0, profileHeight - 70);

        const translateY = -interpolate(
            scrollY.value,
            [0, 80], // Synced with avatar animation
            [0, collapseDistance],
            Extrapolation.CLAMP
        );

        return {
            transform: [{ translateY }],
        };
    });

    // Big profile animation (fade out and scale down, sticky and scale up on pull-down)
    const avatarMorphStyle = useAnimatedStyle(() => {
        const range = [0, 80];

        const scale = interpolate(
            scrollY.value,
            range,
            [SCALE_FACTOR, 1],
            Extrapolation.CLAMP
        );

        const translateX = interpolate(
            scrollY.value,
            range,
            [START_X, 0],
            Extrapolation.CLAMP
        );

        const translateY = interpolate(
            scrollY.value,
            range,
            [START_Y, 0],
            Extrapolation.CLAMP
        );

        return {
            transform: [
                { translateX },
                { translateY },
                { scale }
            ],
            // Ensure it's always visible and on top during transition
            zIndex: 100,
        };
    });

    // Container for the header profile elements
    const smallProfileContainerStyle = useAnimatedStyle(() => {
        return { opacity: 1 };
    });

    // Fade in text info in header
    const smallInfoStyle = useAnimatedStyle(() => {
        const opacity = interpolate(
            scrollY.value,
            [60, 90],
            [0, 1],
            Extrapolation.CLAMP
        );
        const translateX = interpolate(
            scrollY.value,
            [60, 90],
            [-10, 0],
            Extrapolation.CLAMP
        );
        return {
            opacity,
            transform: [{ translateX }]
        };
    });

    // Fade out big user info (Name/Email) roughly as the avatar moves up
    const bigUserInfoStyle = useAnimatedStyle(() => {
        const opacity = interpolate(
            scrollY.value,
            [0, 50],
            [1, 0],
            Extrapolation.CLAMP
        );
        return { opacity };
    });

    // Hide the big avatar in scrollview (opacity 0) but keep layout
    const bigAvatarStyle = useAnimatedStyle(() => {
        return { opacity: 0 };
    });

    const bigProfileContainerStyle = useAnimatedStyle(() => {
        return { opacity: 1 };
    });



    // Title animation (fade out when scrolling down)
    const titleStyle = useAnimatedStyle(() => {
        const opacity = interpolate(
            scrollY.value,
            [0, 30],
            [1, 0],
            Extrapolation.CLAMP
        );

        return {
            opacity,
        };
    });



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

    const getBiometricIcon = () => {
        if (biometricType === 'facial') {
            return ScanFace;
        }
        return Fingerprint;
    };

    const displayName = profile?.name || user?.displayName || 'Usuário';
    const email = user?.email || '';
    const initials = getInitials(displayName);
    const gradientColors = getAvatarGradient(user?.email || displayName);

    return (
        <View style={styles.mainContainer}>
            <Stack.Screen options={{ headerShown: false }} />
            <UniversalBackground
                backgroundColor="#0C0C0C"
                glowSize={350}
                height={280}
                showParticles={true}
                particleCount={15}
            />
            <View style={styles.container}>
                <Animated.ScrollView
                    contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 50 }]}
                    showsVerticalScrollIndicator={false}
                    onScroll={scrollHandler}
                    scrollEventThrottle={16}
                    bounces={true}
                    overScrollMode="always"
                >
                    {/* PROFILE HEADER */}
                    <Animated.View
                        style={[styles.profileSection, bigProfileContainerStyle]}
                        onLayout={(event) => {
                            const measuredHeight = event.nativeEvent.layout.height;
                            if (measuredHeight > profileContentHeight.value) {
                                profileContentHeight.value = measuredHeight;
                            }
                        }}
                    >
                        <Animated.View style={[bigAvatarStyle]}>
                            <View style={styles.avatar}>
                                <Avvvatars value={email || displayName || 'Guest'} size={80} style="shape" />
                            </View>
                        </Animated.View>
                        <Animated.View style={[styles.userInfo, bigUserInfoStyle]}>
                            <Text style={styles.name}>{displayName}</Text>
                            <Text style={styles.email}>{email}</Text>
                        </Animated.View>
                    </Animated.View>

                    <Animated.View style={sectionsCollapseStyle}>
                        {/* PERFIL SECTION */}
                        <SectionHeader title="PERFIL" />
                        <View style={styles.sectionCard}>
                            <SettingsItem
                                icon={User}
                                title="Dados Pessoais"
                                isLast={true}
                                onPress={() => router.push('/settings/personal-data')}
                            />

                        </View>



                        {/* FINANÇAS SECTION */}
                        <SectionHeader title="FINANÇAS" />
                        <View style={styles.sectionCard}>
                            <SettingsItem
                                icon={Wallet}
                                title="Financeiro"
                                onPress={() => router.push('/settings/financial')}
                            />
                            <SettingsItem
                                icon={Shapes}
                                title="Categorias"
                                isLast={true}
                                onPress={() => router.push('/settings/categories')}
                            />
                        </View>

                        {/* SEGURANÇA SECTION */}
                        <SectionHeader title="SEGURANÇA" />
                        <View style={styles.sectionCard}>

                            <SettingsItem
                                icon={getBiometricIcon()}
                                title="Acesso Rápido"
                                subtitle={`Usar ${getBiometricTypeName()}`}
                                rightElement={
                                    isBiometricAvailable ? (
                                        <ModernSwitch
                                            value={isBiometricEnabled}
                                            onValueChange={biometricLoading ? () => { } : handleBiometricToggle}
                                            activeColor="#d97757"
                                            width={46}
                                            height={26}
                                        />
                                    ) : (
                                        <View style={styles.badge}>
                                            <Text style={styles.badgeText}>Indisponível</Text>
                                        </View>
                                    )
                                }
                                isLast={true}
                                onPress={isBiometricAvailable ? handleBiometricToggle : undefined}
                            />
                        </View>

                        {/* NOTIFICAÇÕES SECTION */}
                        <SectionHeader title="NOTIFICAÇÕES" />
                        <View style={styles.sectionCard}>
                            <SettingsItem
                                icon={Bell}
                                title="Alertas de Pagamento"
                                rightElement={
                                    <ModernSwitch
                                        value={paymentAlertsEnabled}
                                        onValueChange={handlePaymentAlertsToggle}
                                        activeColor="#d97757"
                                        width={46}
                                        height={26}
                                    />
                                }
                                onPress={() => handlePaymentAlertsToggle(!paymentAlertsEnabled)}
                            />
                            <SettingsItem
                                icon={Lightbulb}
                                title="Dicas Financeiras"
                                rightElement={
                                    <View style={styles.badge}>
                                        <Text style={styles.badgeText}>Em breve</Text>
                                    </View>
                                }
                                isLast={true}
                                onPress={() => { }}
                            />
                        </View>

                        <View style={styles.footer}>
                            <Text style={styles.versionText}>Versão 1.0.0</Text>
                        </View>
                    </Animated.View>
                </Animated.ScrollView>

                <View style={[styles.header, { top: insets.top, position: 'absolute', width: '100%' }]} pointerEvents="box-none">

                    <TouchableOpacity
                        onPress={() => router.back()}
                        style={styles.backButton}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <ChevronRight size={24} color="#E0E0E0" style={{ transform: [{ rotate: '180deg' }] }} />
                    </TouchableOpacity>

                    <View style={styles.headerContent}>
                        {/* Title - fades out on scroll */}
                        <Animated.Text style={[styles.headerTitle, titleStyle, { position: 'absolute', width: '100%', textAlign: 'center' }]}>
                            Configurações
                        </Animated.Text>

                        {/* Morphing Profile Container */}
                        <Animated.View style={[styles.smallProfileContainer, smallProfileContainerStyle]}>
                            {/* Avatar - Morphs from Big to Small */}
                            <Animated.View style={[avatarMorphStyle]}>
                                <View style={styles.smallAvatar}>
                                    <Avvvatars value={email || displayName || 'Guest'} size={28} style="shape" />
                                </View>
                            </Animated.View>

                            {/* Info Text - Fades in */}
                            <Animated.View style={[styles.smallUserInfo, smallInfoStyle]}>
                                <Text style={styles.smallName} numberOfLines={1}>{displayName}</Text>
                                <Text style={styles.smallEmail} numberOfLines={1}>{email}</Text>
                            </Animated.View>
                        </Animated.View>
                    </View>

                    <View style={{ width: 40 }} />
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    mainContainer: {
        flex: 1,
        backgroundColor: '#0C0C0C',
    },
    container: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 100,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        marginBottom: 0,
        height: 50,
        zIndex: 1000,
    },
    backButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'flex-start',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#E0E0E0',
    },
    pageTitle: {
        fontSize: 32,
        fontWeight: '700',
        color: '#FFFFFF',
        marginBottom: 20,
        marginTop: 10,
        textAlign: 'center',
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingBottom: 40,
    },
    profileSection: {
        flexDirection: 'column',
        alignItems: 'center',
        marginTop: 0,
        marginBottom: 20,
    },
    userInfo: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatar: {
        width: 80,
        height: 80,
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 8,
        },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 12,
    },
    avatarText: {
        color: '#FFFFFF',
        fontSize: 36,
        fontWeight: '600',
    },
    name: {
        fontSize: 22,
        fontWeight: '700',
        color: '#FFFFFF',
        marginBottom: 4,
        textAlign: 'center',
    },
    email: {
        fontSize: 14,
        color: '#A0A0A0',
        textAlign: 'center',
    },
    sectionHeader: {
        fontSize: 12,
        fontWeight: '600',
        color: '#8E8E93',
        marginTop: 24,
        marginBottom: 8,
        marginLeft: 4,
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },
    sectionCard: {
        backgroundColor: '#151515',
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#252525',
    },
    itemContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#151515',
        minHeight: 56,
        position: 'relative',
    },
    itemIconContainer: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: '#252525',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
        marginLeft: 16,
    },
    itemRightContainer: {
        flex: 1,
    },
    itemContent: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingRight: 16,
        paddingVertical: 16,
    },
    itemSeparator: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
    },
    itemTitle: {
        fontSize: 16,
        color: '#FFFFFF',
        fontWeight: '500',
    },
    itemSubtitle: {
        fontSize: 12,
        color: '#8E8E93',
        marginTop: 2,
    },
    badge: {
        backgroundColor: 'rgba(217, 119, 87, 0.15)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(217, 119, 87, 0.3)',
    },
    badgeText: {
        fontSize: 12,
        color: '#d97757',
        fontWeight: '600',
    },
    valueText: {
        fontSize: 15,
        color: '#8E8E93',
        marginRight: 8,
    },
    footer: {
        marginTop: 40,
        alignItems: 'center',
    },
    versionText: {
        color: '#555',
        fontSize: 12,
    },
    headerContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        height: 40, // Fixed height for alignment
    },
    smallProfileContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
    },
    smallAvatar: {
        width: 28,
        height: 28,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    smallAvatarText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    smallUserInfo: {
        justifyContent: 'center',
        marginLeft: 8,
    },
    smallName: {
        fontSize: 14,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    smallEmail: {
        fontSize: 10,
        color: '#A0A0A0',
    },
    // Expired Plan Warning
    expiredWarning: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: 'rgba(255, 69, 58, 0.08)',
        borderWidth: 1,
        borderColor: 'rgba(255, 69, 58, 0.25)',
        borderRadius: 12,
        padding: 14,
        marginTop: 10,
    },
    expiredWarningText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#FF453A',
    },
    expiredWarningSubtext: {
        fontSize: 12,
        color: '#FF8A80',
        marginTop: 2,
    },
});
