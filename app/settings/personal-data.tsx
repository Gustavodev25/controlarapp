import { UniversalBackground } from '@/components/UniversalBackground';
import { useAuthContext } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { databaseService } from '@/services/firebase';
import { Stack, useRouter } from 'expo-router';
import { Calendar, ChevronRight, Crown, Mail, Phone, User } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Keyboard, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// --- Components mimicking financial.tsx ---

const SectionHeader = ({ title }: { title: string }) => (
    <Text style={styles.sectionHeader}>{title}</Text>
);

const InputRow = ({
    icon: Icon,
    title,
    value,
    onChangeText,
    placeholder,
    keyboardType = 'default',
    editable = true,
    isLast = false
}: {
    icon: React.ElementType,
    title: string,
    value: string,
    onChangeText?: (text: string) => void,
    placeholder?: string,
    keyboardType?: any,
    editable?: boolean,
    isLast?: boolean
}) => (
    <View style={styles.itemContainer}>
        <View style={styles.itemIconContainer}>
            <Icon size={20} color="#E0E0E0" />
        </View>
        <View style={styles.itemRightContainer}>
            <View style={styles.itemContent}>
                <Text style={styles.itemTitle}>{title}</Text>
                <TextInput
                    style={[styles.inputRight, !editable && { opacity: 0.5 }]}
                    value={value}
                    onChangeText={onChangeText}
                    placeholder={placeholder}
                    placeholderTextColor="#555"
                    keyboardType={keyboardType}
                    textAlign="right"
                    editable={editable}
                />
            </View>
        </View>
        {!isLast && <View style={styles.itemSeparator} />}
    </View>
);

const ListRow = ({
    icon: Icon,
    title,
    value,
    onPress,
    color = '#E0E0E0',
    showChevron = false,
    isLast = false
}: {
    icon: React.ElementType,
    title: string,
    value?: string,
    onPress?: () => void,
    color?: string,
    showChevron?: boolean,
    isLast?: boolean
}) => (
    <TouchableOpacity
        style={styles.itemContainer}
        onPress={onPress}
        disabled={!onPress}
        activeOpacity={0.7}
    >
        <View style={styles.itemIconContainer}>
            <Icon size={20} color={color} />
        </View>
        <View style={styles.itemRightContainer}>
            <View style={styles.itemContent}>
                <Text style={styles.itemTitle}>{title}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {value && <Text style={styles.valueText}>{value}</Text>}
                    {showChevron && <ChevronRight size={20} color="#666" />}
                </View>
            </View>
        </View>
        {!isLast && <View style={styles.itemSeparator} />}
    </TouchableOpacity>
);

export default function PersonalDataScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { user, profile, refreshProfile } = useAuthContext();
    const { showToast } = useToast();

    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (profile) {
            setName(profile.name || '');
            setPhone(profile.phone || '');
        } else if (user?.displayName) {
            setName(user.displayName);
        }
    }, [profile, user]);

    const handleSave = async () => {
        if (!user) return;
        if (!name.trim()) {
            showToast('O nome é obrigatório', 'error');
            return;
        }

        setLoading(true);
        try {
            const result = await databaseService.setUserProfile(user.uid, {
                name: name.trim(),
                phone: phone.trim() || null,
            });

            if (result.success) {
                await refreshProfile();
                showToast('Dados atualizados com sucesso!', 'success');
                router.back();
            } else {
                showToast(result.error || 'Erro ao atualizar perfil', 'error');
            }
        } catch (error) {
            showToast('Erro ao atualizar perfil', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.mainContainer}>
                <Stack.Screen options={{ headerShown: false }} />
                <UniversalBackground
                    backgroundColor="#0C0C0C"
                    glowSize={350}
                    height={280}
                    showParticles={true}
                    particleCount={15}
                />
                <View style={[styles.container, { paddingTop: insets.top + 20 }]}>
                    <View style={styles.header}>
                        <TouchableOpacity
                            onPress={() => router.back()}
                            style={styles.backButton}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <ChevronRight size={24} color="#E0E0E0" style={{ transform: [{ rotate: '180deg' }] }} />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>Dados Pessoais</Text>

                        <TouchableOpacity
                            onPress={handleSave}
                            disabled={loading}
                            style={styles.headerSaveButton}
                        >
                            {loading ? (
                                <ActivityIndicator size="small" color="#d97757" />
                            ) : (
                                <Text style={styles.headerSaveText}>Salvar</Text>
                            )}
                        </TouchableOpacity>
                    </View>

                    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                        <View style={styles.infoBlock}>
                            <Text style={styles.cardTitle}>Suas Informações</Text>
                            <Text style={styles.cardSubtitle}>Mantenha seus dados atualizados para facilitar o contato.</Text>
                        </View>

                        <SectionHeader title="DADOS GERAIS" />
                        <View style={styles.sectionCard}>
                            <InputRow
                                icon={User}
                                title="Nome Completo"
                                value={name}
                                onChangeText={setName}
                                placeholder="Seu nome"
                            />

                            <InputRow
                                icon={Mail}
                                title="E-mail"
                                value={user?.email || ''}
                                placeholder="Seu e-mail"
                                editable={false}
                            />

                            <InputRow
                                icon={Phone}
                                title="Telefone"
                                value={phone}
                                onChangeText={setPhone}
                                placeholder="(00) 00000-0000"
                                keyboardType="phone-pad"
                                isLast={true}
                            />
                        </View>

                        <SectionHeader title="MEU PLANO" />
                        <View style={styles.sectionCard}>
                            <ListRow
                                icon={Crown}
                                title="Plano Atual"
                                value={profile?.subscription?.plan === 'pro' ? 'Pro' : 'Starter'}
                                color="#d97757"
                            />
                            <ListRow
                                icon={Calendar}
                                title="Status"
                                value={profile?.subscription?.status === 'active' ? 'Ativo' : 'Inativo'}
                            />
                            <ListRow
                                icon={Calendar}
                                title="Ciclo"
                                value={profile?.subscription?.billingCycle === 'yearly' ? 'Anual' : 'Mensal'}
                                isLast={true}
                            />
                        </View>

                        <Text style={styles.sectionFooterText}>
                            Para alterar seu plano, acesse Configurações {'>'} Meu Plano.
                        </Text>
                    </ScrollView>
                </View>
            </View>
        </TouchableWithoutFeedback>
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
        marginBottom: 10,
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
    headerSaveButton: {
        padding: 8,
    },
    headerSaveText: {
        color: '#d97757',
        fontWeight: '600',
        fontSize: 16,
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingBottom: 40,
    },
    infoBlock: {
        marginBottom: 10,
        marginTop: 10,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#FFFFFF',
        marginBottom: 8,
    },
    cardSubtitle: {
        fontSize: 14,
        color: '#A0A0A0',
        lineHeight: 20,
    },
    // Styles from financial.tsx
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
    itemTitle: {
        fontSize: 16,
        color: '#FFFFFF',
        fontWeight: '500',
    },
    itemSeparator: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
    },
    inputRight: {
        fontSize: 16,
        color: '#FFF',
        fontWeight: '500',
        minWidth: 100,
        padding: 0, // Reset padding for TextInput
    },
    valueText: {
        fontSize: 16,
        color: '#8E8E93',
        marginRight: 8,
    },
    sectionFooterText: {
        fontSize: 12,
        color: '#666',
        marginTop: 8,
        marginLeft: 16,
        lineHeight: 16,
    },
});
