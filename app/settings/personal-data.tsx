import { UniversalBackground } from '@/components/UniversalBackground';
import { useAuthContext } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { databaseService } from '@/services/firebase';
import { safeBack } from '@/utils/navigation';
import { Stack, useRouter } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Keyboard, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// --- Components mimicking financial.tsx ---

const SectionHeader = ({ title }: { title: string }) => (
    <Text style={styles.sectionHeader}>{title}</Text>
);

const InputRow = ({
    title,
    value,
    onChangeText,
    placeholder,
    keyboardType = 'default',
    editable = true,
    isLast = false
}: {
    title: string,
    value: string,
    onChangeText?: (text: string) => void,
    placeholder?: string,
    keyboardType?: any,
    editable?: boolean,
    isLast?: boolean
}) => (
    <View style={styles.itemContainer}>
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
    title,
    value,
    onPress,
    danger = false,
    isLast = false
}: {
    title: string,
    value?: string,
    onPress?: () => void,
    danger?: boolean,
    isLast?: boolean
}) => (
    <TouchableOpacity
        style={styles.itemContainer}
        onPress={onPress}
        disabled={!onPress}
        activeOpacity={0.7}
    >
        <View style={styles.itemContent}>
            <Text style={[styles.itemTitle, danger && styles.dangerText]}>{title}</Text>
            {value && <Text style={styles.valueText}>{value}</Text>}
        </View>
        {!isLast && <View style={styles.itemSeparator} />}
    </TouchableOpacity>
);

export default function PersonalDataScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { user, profile, refreshProfile, deleteAccount, signOut } = useAuthContext();
    const { showToast } = useToast();

    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [originalName, setOriginalName] = useState('');
    const [originalPhone, setOriginalPhone] = useState('');
    const [loading, setLoading] = useState(false);

    const hasChanges = name !== originalName || phone !== originalPhone;

    useEffect(() => {
        if (profile) {
            setName(profile.name || '');
            setPhone(profile.phone || '');
            setOriginalName(profile.name || '');
            setOriginalPhone(profile.phone || '');
        } else if (user?.displayName) {
            setName(user.displayName);
            setOriginalName(user.displayName);
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
                safeBack(router);
            } else {
                showToast(result.error || 'Erro ao atualizar perfil', 'error');
            }
        } catch (error) {
            showToast('Erro ao atualizar perfil', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteAccount = async () => {
        Alert.alert(
            'Excluir Conta',
            'Tem certeza que deseja excluir sua conta permanentemente? Todos os seus dados financeiros serão perdidos e esta ação não pode ser desfeita.',
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Excluir',
                    style: 'destructive',
                    onPress: async () => {
                        setLoading(true);
                        try {
                            const result = await deleteAccount();
                            if (result.success) {
                                showToast('Sua conta foi excluída.', 'info');
                                router.replace('/(public)/welcome');
                            } else {
                                if (result.error === 'REAUTH_REQUIRED') {
                                    showToast('Para excluir sua conta, você precisa ter feito login recentemente. Por favor, saia e entre novamente.', 'error');
                                } else {
                                    showToast(result.error || 'Erro ao excluir conta.', 'error');
                                }
                            }
                        } catch (error) {
                            showToast('Erro ao excluir conta.', 'error');
                        } finally {
                            setLoading(false);
                        }
                    }
                }
            ]
        );
    };

    return (
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.mainContainer}>
                <Stack.Screen options={{ headerShown: false }} />
                <View style={{ position: 'absolute', top: 0, left: 0, right: 0 }} pointerEvents="none">
                    <UniversalBackground backgroundColor="#0C0C0C" glowSize={350} height={280} />
                </View>

                <View style={[styles.headerWrapper, { paddingTop: insets.top }]}>
                    <View style={styles.header}>
                        <TouchableOpacity
                            onPress={() => safeBack(router)}
                            style={styles.backButton}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <ChevronRight size={24} color="#E0E0E0" style={{ transform: [{ rotate: '180deg' }] }} />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>Dados Pessoais</Text>
                        <View style={styles.headerSpacer} />
                    </View>
                </View>

                <ScrollView
                    style={styles.scroll}
                    contentContainerStyle={[styles.scrollContent, { paddingBottom: hasChanges ? 100 : 40 }]}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    <SectionHeader title="PERFIL" />
                    <View style={styles.sectionCard}>
                        <InputRow
                            title="Nome"
                            value={name}
                            onChangeText={setName}
                            placeholder="Seu nome"
                        />
                        <InputRow
                            title="E-mail"
                            value={user?.email || ''}
                            editable={false}
                        />
                        <InputRow
                            title="Telefone"
                            value={phone}
                            onChangeText={setPhone}
                            placeholder="(00) 00000-0000"
                            keyboardType="phone-pad"
                            isLast
                        />
                    </View>

                    <SectionHeader title="ZONA DE PERIGO" />
                    <View style={styles.sectionCard}>
                        <ListRow
                            title="Excluir minha conta"
                            isLast
                            danger
                            onPress={handleDeleteAccount}
                        />
                    </View>
                </ScrollView>

                {hasChanges && (
                    <View style={[styles.saveContainer, { paddingBottom: insets.bottom + 16 }]}>
                        <TouchableOpacity
                            style={styles.saveButton}
                            onPress={handleSave}
                            disabled={loading}
                            activeOpacity={0.85}
                        >
                            {loading ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <Text style={styles.saveButtonText}>Salvar alterações</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        </TouchableWithoutFeedback>
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
    saveContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingHorizontal: 20,
        paddingTop: 12,
        backgroundColor: 'rgba(12,12,12,0.85)',
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: 'rgba(255,255,255,0.08)',
    },
    saveButton: {
        backgroundColor: '#d97757',
        borderRadius: 12,
        height: 50,
        alignItems: 'center',
        justifyContent: 'center',
    },
    saveButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    scroll: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingBottom: 40,
    },
    sectionHeader: {
        fontSize: 11,
        fontWeight: '500',
        color: '#555',
        marginTop: 28,
        marginBottom: 8,
        marginLeft: 2,
        letterSpacing: 0.6,
        textTransform: 'uppercase',
    },
    sectionCard: {
        backgroundColor: '#111111',
        borderRadius: 12,
        overflow: 'hidden',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#1A1A1A',
    },
    itemContainer: {
        backgroundColor: '#111111',
        minHeight: 54,
        position: 'relative',
    },
    itemRightContainer: {
        flex: 1,
    },
    itemContent: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14,
        minHeight: 54,
    },
    itemTitle: {
        fontSize: 16,
        color: '#E8E8EA',
        fontWeight: '400',
    },
    dangerText: {
        color: '#E05C5C',
    },
    itemSeparator: {
        position: 'absolute',
        bottom: 0,
        left: 16,
        right: 0,
        height: StyleSheet.hairlineWidth,
        backgroundColor: '#1A1A1A',
    },
    inputRight: {
        fontSize: 16,
        color: '#8E8E93',
        fontWeight: '400',
        minWidth: 80,
        maxWidth: 200,
        textAlign: 'right',
        padding: 0,
    },
    valueText: {
        fontSize: 16,
        color: '#8E8E93',
    },
});
