import { DeleteConfirmCard } from '@/components/DeleteConfirmCard';
import { UniversalBackground } from '@/components/UniversalBackground';
import { ModalPadrao } from '@/components/ui/ModalPadrao';
import { CategoryGroup, DEFAULT_CATEGORIES } from '@/constants/defaultCategories';
import { useAuthContext } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useCategories } from '@/hooks/use-categories';
import { CategoryService } from '@/services/categoryService';
import { animationScheduler } from '@/services/performance';
import { useRouter } from 'expo-router';
import LottieView from 'lottie-react-native';
import { ChevronDown, ChevronLeft, Pencil, Save, Search, Trash2 } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    LayoutAnimation,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    UIManager,
    View,
} from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function CategoriesScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { user } = useAuthContext();
    const { showToast } = useToast();

    // Use the hook to get real-time categories from Firestore
    const { categories: serverCategories, loading: serverLoading } = useCategories();

    const [categories, setCategories] = useState<CategoryGroup[]>(DEFAULT_CATEGORIES);
    const [saving, setSaving] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
    const nameInputRefs = React.useRef<Record<string, TextInput | null>>({});
    const [newCategoryModalVisible, setNewCategoryModalVisible] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [newCategoryGroupIndex, setNewCategoryGroupIndex] = useState<number | null>(null);
    const addLottieRef = React.useRef<LottieView>(null);
    const addButtonLottieRefs = React.useRef<Record<string, LottieView | null>>({});
    const [pendingDelete, setPendingDelete] = useState<{ groupIndex: number; itemIndex: number } | null>(null);

    const newCategoryGroupTitle = newCategoryGroupIndex !== null
        ? (categories[newCategoryGroupIndex]?.title ?? '')
        : '';

    // Sync local state with server state when server updates (and user is not actively editing? 
    // For simplicity, we sync always, assuming collisions are rare or user sees update)
    // Actually, to avoid overwriting user's typing, we might want to check if editing.
    // But for this implementation, let's sync.
    useEffect(() => {
        if (!serverLoading) {
            setCategories(serverCategories);
        }
    }, [serverCategories, serverLoading]);

    // Helper to extract Doc ID from key
    const getDocIdFromKey = (key: string) => {
        if (key.startsWith('custom_')) {
            return key.substring(7); // Remove 'custom_' prefix
        }
        return key;
    };

    const handleSave = async () => {
        if (!user) return;
        setSaving(true);
        try {
            // Find changed categories and update them
            // We compare current 'categories' with 'serverCategories' (or just update all distinct?)
            // Comparing deep objects is expensive. 
            // Let's just iterate and update those that are different from DEFAULT + Custom defaults?
            // Better: We really should track dirty fields.
            // But let's verify what changed against serverCategories.

            const updates = [];

            for (let g = 0; g < categories.length; g++) {
                const group = categories[g];
                const serverGroup = serverCategories.find(sg => sg.title === group.title);
                if (!serverGroup) continue;

                for (let i = 0; i < group.items.length; i++) {
                    const item = group.items[i];
                    const serverItem = serverGroup.items.find(si => si.key === item.key);

                    if (serverItem && serverItem.label !== item.label) {
                        // Found a change
                        const docId = getDocIdFromKey(item.key);
                        updates.push(CategoryService.updateCategoryMapping(user.uid, docId, item.label));
                    }
                }
            }

            if (updates.length > 0) {
                await Promise.all(updates);
                showToast('Categorias salvas com sucesso!', 'success');
            } else {
                showToast('Nenhuma alteração encontrada.', 'info');
            }
        } catch (error) {
            console.error('Error saving categories:', error);
            showToast('Erro ao salvar categorias', 'error');
        } finally {
            setSaving(false);
        }
    };

    const toggleGroup = (title: string) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        const newExpanded = new Set(expandedGroups);
        if (newExpanded.has(title)) {
            newExpanded.delete(title);
        } else {
            newExpanded.add(title);
        }
        setExpandedGroups(newExpanded);
    };

    const updateCategoryName = (groupIndex: number, itemIndex: number, newName: string) => {
        const newCategories = JSON.parse(JSON.stringify(categories));
        newCategories[groupIndex].items[itemIndex].label = newName;
        setCategories(newCategories);
    };

    const addNewCategory = (groupIndex: number) => {
        setNewCategoryGroupIndex(groupIndex);
        setNewCategoryName('');
        setNewCategoryModalVisible(true);
    };

    const handleCreateCategory = async () => {
        if (!user) return;
        const name = newCategoryName.trim();
        if (!name || newCategoryGroupIndex === null) {
            showToast('Digite um nome para a categoria', 'error');
            return;
        }

        const groupTitle = categories[newCategoryGroupIndex].title;
        setSaving(true);
        try {
            await CategoryService.createCustomCategory(user.uid, name, groupTitle);
            showToast('Categoria adicionada!', 'success');
            setNewCategoryModalVisible(false);
            // newCategories will automatically update via hook

            // Ensure group stays expanded
            setExpandedGroups(prev => new Set(prev).add(groupTitle));
        } catch (error) {
            console.error('Error creating category:', error);
            showToast('Erro ao criar categoria', 'error');
        } finally {
            setSaving(false);
        }
    };

    useEffect(() => {
        if (!newCategoryModalVisible) return;

        const play = () => {
            addLottieRef.current?.play();
        };

        const startDisposer = animationScheduler.scheduleOnce('categories:add-modal:start', play, 100);
        const intervalDisposer = animationScheduler.scheduleInterval('categories:add-modal:loop', play, 3000, { jitterRatio: 0.15 });

        return () => {
            startDisposer();
            intervalDisposer();
        };
    }, [newCategoryModalVisible]);

    useEffect(() => {
        if (serverLoading) return;

        const play = () => {
            Object.values(addButtonLottieRefs.current).forEach((ref) => {
                ref?.play();
            });
        };

        const startDisposer = animationScheduler.scheduleOnce('categories:add-button:start', play, 100);
        const intervalDisposer = animationScheduler.scheduleInterval('categories:add-button:loop', play, 2000, { jitterRatio: 0.2 });

        return () => {
            startDisposer();
            intervalDisposer();
        };
    }, [serverLoading, categories, expandedGroups]);

    const removeCategory = (groupIndex: number, itemIndex: number) => {
        setPendingDelete({ groupIndex, itemIndex });
    };

    const handleConfirmRemoveCategory = async (groupIndex: number, itemIndex: number) => {
        if (!user) return;
        const group = categories[groupIndex];
        const item = group.items[itemIndex];
        const docId = getDocIdFromKey(item.key);

        setSaving(true); // global saving or local loading?
        try {
            await CategoryService.deleteCategoryMapping(user.uid, docId);
            showToast('Categoria removida!', 'success');
            setPendingDelete(null);
            // newCategories will automatically update via hook
        } catch (error) {
            console.error('Error deleting category:', error);
            showToast('Erro ao remover categoria', 'error');
        } finally {
            setSaving(false);
        }
    };

    const totalCategories = categories.reduce((acc, group) => acc + group.items.length, 0);
    const customCategories = categories.reduce((acc, group) =>
        acc + group.items.filter((item: any) => item.isCustom).length, 0);

    const filteredCategories = categories.map(group => ({
        ...group,
        items: group.items.filter(item =>
            item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.key.toLowerCase().includes(searchQuery.toLowerCase())
        )
    })).filter(group => group.items.length > 0);

    // If searching, auto-expand all
    useEffect(() => {
        if (searchQuery) {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            const allTitles = new Set(filteredCategories.map(g => g.title));
            setExpandedGroups(allTitles);
        }
    }, [searchQuery]);

    return (
        <View style={styles.mainContainer}>
            <View style={styles.backgroundLayer} pointerEvents="none">
                <UniversalBackground
                    backgroundColor="#0C0C0C"
                    glowSize={350}
                    height={280}
                    showParticles={true}
                    particleCount={15}
                />
            </View>

            <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
                <TouchableOpacity
                    onPress={() => router.back()}
                    style={styles.backButton}
                >
                    <ChevronLeft size={24} color="#E0E0E0" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Gestão de Categorias</Text>
                <TouchableOpacity
                    onPress={handleSave}
                    style={styles.saveButton}
                    disabled={saving}
                >
                    {saving ? (
                        <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                        <Save size={20} color="#D97757" />
                    )}
                </TouchableOpacity>
            </View>

            <View style={styles.summarySection}>
                <Text style={styles.summarySubtitle}>Aplica em todas as transações</Text>
                <Text style={styles.summaryDescription}>Personalize os nomes das categorias das suas transações</Text>

                <View style={styles.statsRow}>
                    <View style={styles.statItem}>
                        <Text style={styles.statLabel}>TOTAL</Text>
                        <Text style={styles.statValue}>{totalCategories}</Text>
                    </View>
                    <View style={styles.statItem}>
                        <Text style={styles.statLabel}>CUSTOMIZADAS</Text>
                        <Text style={styles.statValue}>{customCategories}</Text>
                    </View>
                </View>

                <View style={styles.searchContainer}>
                    <Search size={16} color="#666" style={styles.searchIcon} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Buscar categoria..."
                        placeholderTextColor="#666"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                </View>
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {serverLoading ? (
                        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 40 }}>
                            <LottieView
                                source={require('@/assets/carregando.json')}
                                autoPlay
                                loop
                                style={{ width: 50, height: 50 }}
                            />
                            <Text style={{ color: '#888', fontSize: 14, marginTop: 12 }}>Carregando categorias...</Text>
                        </View>
                    ) : (
                        filteredCategories.map((group) => {
                            const isExpanded = expandedGroups.has(group.title);
                            const realGroupIndex = categories.findIndex(g => g.title === group.title);

                            return (
                                <View key={group.title} style={styles.groupCard}>
                                    <TouchableOpacity
                                        style={styles.groupHeader}
                                        onPress={() => toggleGroup(group.title)}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={styles.groupTitle}>{group.title}</Text>
                                        <ChevronDown
                                            size={20}
                                            color="#D97757"
                                            style={{
                                                transform: [{ rotate: isExpanded ? '180deg' : '0deg' }]
                                            }}
                                        />
                                    </TouchableOpacity>

                                    {isExpanded && (
                                        <Animated.View entering={FadeIn} exiting={FadeOut}>
                                            <View style={styles.groupContent}>
                                                {group.items.map((item, itemIndex) => {
                                                    const realItemIndex = categories[realGroupIndex].items.findIndex(i => i.key === item.key);
                                                    const isFirst = itemIndex === 0;
                                                    const isLast = itemIndex === group.items.length - 1;
                                                    const isPendingDelete = pendingDelete?.groupIndex === realGroupIndex && pendingDelete?.itemIndex === realItemIndex;

                                                    if (isPendingDelete) {
                                                        return (
                                                            <View key={item.key} style={[
                                                                styles.itemContainer,
                                                                styles.deleteConfirmWrapper,
                                                                isFirst && styles.itemFirst,
                                                                isLast && styles.itemLast,
                                                                !isLast && styles.itemSeparator
                                                            ]}>
                                                                <DeleteConfirmCard
                                                                    title="Remover categoria?"
                                                                    cancelText="Cancelar"
                                                                    confirmText="Remover"
                                                                    onCancel={() => setPendingDelete(null)}
                                                                    onConfirm={() => handleConfirmRemoveCategory(realGroupIndex, realItemIndex)}
                                                                    style={styles.deleteConfirmCard}
                                                                />
                                                            </View>
                                                        );
                                                    }

                                                    return (
                                                        <View key={item.key} style={[
                                                            styles.itemContainer,
                                                            isFirst && styles.itemFirst,
                                                            isLast && styles.itemLast,
                                                            !isLast && styles.itemSeparator
                                                        ]}>
                                                            <View style={styles.itemContent}>
                                                                <Text style={styles.keyLabel}>CHAVE ORIGINAL</Text>
                                                                <Text style={styles.keyValue}>{item.key}</Text>

                                                                <TouchableOpacity
                                                                    style={styles.nameHeader}
                                                                    onPress={() => {
                                                                        nameInputRefs.current[`${realGroupIndex}-${realItemIndex}`]?.focus();
                                                                    }}
                                                                    activeOpacity={0.7}
                                                                >
                                                                    <Text style={[styles.keyLabel, styles.nameLabel]}>NOME DE EXIBIÇÃO</Text>
                                                                    <Pencil size={12} color="#8E8E93" />
                                                                </TouchableOpacity>
                                                                <TextInput
                                                                    ref={(ref) => {
                                                                        nameInputRefs.current[`${realGroupIndex}-${realItemIndex}`] = ref;
                                                                    }}
                                                                    style={styles.nameInput}
                                                                    value={item.label}
                                                                    onChangeText={(text) => updateCategoryName(realGroupIndex, realItemIndex, text)}
                                                                    placeholder="Nome da categoria"
                                                                    placeholderTextColor="#555"
                                                                />
                                                            </View>

                                                            {(item as any).isCustom && (
                                                                <TouchableOpacity
                                                                    style={styles.deleteButton}
                                                                    onPress={() => removeCategory(realGroupIndex, realItemIndex)}
                                                                >
                                                                    <Trash2 size={20} color="#FF453A" />
                                                                </TouchableOpacity>
                                                            )}
                                                        </View>
                                                    );
                                                })}

                                                <TouchableOpacity
                                                    style={styles.addCategoryButton}
                                                    onPress={() => addNewCategory(realGroupIndex)}
                                                >
                                                    <LottieView
                                                        ref={(ref) => {
                                                            addButtonLottieRefs.current[`${realGroupIndex}`] = ref;
                                                        }}
                                                        source={require('@/assets/adicionar.json')}
                                                        autoPlay={false}
                                                        loop={false}
                                                        style={styles.addCategoryLottie}
                                                    />
                                                    <Text style={styles.addCategoryText}>Adicionar Categoria</Text>
                                                </TouchableOpacity>
                                            </View>
                                        </Animated.View>
                                    )}
                                </View>
                            );
                        })
                    )}
                    <View style={{ height: 40 }} />
                </ScrollView>
            </KeyboardAvoidingView>

            <ModalPadrao
                visible={newCategoryModalVisible}
                onClose={() => setNewCategoryModalVisible(false)}
                title="Nova Categoria"
                headerRight={
                    <TouchableOpacity
                        onPress={handleCreateCategory}
                        disabled={saving || !newCategoryName.trim()}
                        style={styles.headerSaveButton}
                    >
                        {saving ? (
                            <ActivityIndicator size="small" color="#D97757" />
                        ) : (
                            <>
                                <Save size={18} color={newCategoryName.trim() ? '#D97757' : '#666'} />
                                <Text style={[styles.headerSaveText, !newCategoryName.trim() && { color: '#666' }]}>Salvar</Text>
                            </>
                        )}
                    </TouchableOpacity>
                }
            >
                <ScrollView contentContainerStyle={styles.modalContainer} showsVerticalScrollIndicator={false}>
                    <View style={styles.modalHeaderRow}>
                        <Text style={styles.modalHeaderTitle}>NOVA CATEGORIA</Text>
                        {newCategoryGroupTitle ? (
                            <View style={styles.modalHeaderGroup}>
                                <View style={styles.modalHeaderDot} />
                                <Text style={styles.modalHeaderGroupText}>{newCategoryGroupTitle}</Text>
                            </View>
                        ) : null}
                    </View>
                    <View style={styles.sectionCard}>
                        <View style={styles.modalItemContainer}>
                            <View style={styles.modalItemIconContainer}>
                                <LottieView
                                    ref={addLottieRef}
                                    source={require('@/assets/adicionar.json')}
                                    autoPlay={false}
                                    loop={false}
                                    style={styles.modalIconLottie}
                                />
                            </View>
                            <View style={styles.modalItemRightContainer}>
                                <View style={styles.modalItemContent}>
                                    <Text style={styles.modalItemTitle}>Nome da categoria</Text>
                                    <TextInput
                                        style={styles.modalInput}
                                        value={newCategoryName}
                                        onChangeText={setNewCategoryName}
                                        placeholder="Ex: Café"
                                        placeholderTextColor="#666"
                                        returnKeyType="done"
                                        onSubmitEditing={handleCreateCategory}
                                    />
                                </View>
                            </View>
                        </View>
                    </View>
                </ScrollView>
            </ModalPadrao>
        </View >
    );
}

const styles = StyleSheet.create({
    mainContainer: {
        flex: 1,
        backgroundColor: '#0C0C0C',
    },
    backgroundLayer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 280,
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
        fontSize: 18,
        fontWeight: '700',
        color: '#E0E0E0',
    },
    saveButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'flex-end',
    },
    summarySection: {
        paddingHorizontal: 20,
        marginBottom: 10,
    },
    summarySubtitle: {
        fontSize: 14,
        color: '#FFFFFF',
        fontWeight: '600',
        marginBottom: 4,
    },
    summaryDescription: {
        fontSize: 13,
        color: '#FFFFFF',
        marginBottom: 20,
    },
    statsRow: {
        flexDirection: 'row',
        backgroundColor: 'transparent',
        paddingVertical: 4,
        paddingHorizontal: 0,
        marginBottom: 16,
        alignItems: 'flex-start',
        justifyContent: 'space-between',
    },
    statItem: {
        flex: 1,
        alignItems: 'flex-start',
    },
    statLabel: {
        fontSize: 11,
        color: '#9AA0A6',
        marginBottom: 4,
        fontWeight: '600',
        letterSpacing: 0.5,
    },
    statValue: {
        fontSize: 26,
        fontWeight: '700',
        color: '#FFFFFF',
        lineHeight: 30,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#151515',
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 46,
        borderWidth: 1,
        borderColor: '#252525',
    },
    searchIcon: {
        marginRight: 10,
    },
    searchInput: {
        flex: 1,
        color: '#FFF',
        fontSize: 15,
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingBottom: 40,
    },
    groupCard: {
        marginBottom: 16,
    },
    groupHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
    },
    groupTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    groupContent: {
        marginTop: 8,
        backgroundColor: '#151515',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#252525',
        overflow: 'hidden',
    },
    itemContainer: {
        backgroundColor: 'transparent',
        paddingVertical: 12,
        paddingHorizontal: 14,
        marginBottom: 0,
        borderWidth: 0,
        borderColor: 'transparent',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    itemFirst: {
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
    },
    itemLast: {
        borderBottomLeftRadius: 16,
        borderBottomRightRadius: 16,
    },
    itemSeparator: {
        borderBottomWidth: 1,
        borderBottomColor: '#252525',
    },
    deleteConfirmWrapper: {
        paddingVertical: 0,
        paddingHorizontal: 0,
        backgroundColor: 'transparent',
    },
    deleteConfirmCard: {
        backgroundColor: '#141414',
        borderRadius: 0,
        borderWidth: 0,
        paddingVertical: 12,
        paddingHorizontal: 14,
        width: '100%',
    },
    itemContent: {
        flex: 1,
    },
    keyLabel: {
        fontSize: 9,
        color: '#70757A',
        textTransform: 'uppercase',
        fontWeight: '600',
        marginBottom: 2,
    },
    nameHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 12,
        marginBottom: 2,
    },
    nameLabel: {
        marginBottom: 0,
    },
    keyValue: {
        fontSize: 12,
        color: '#8E8E93',
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
        marginBottom: 6,
    },
    nameInput: {
        fontSize: 15,
        color: '#FFFFFF',
        fontWeight: '600',
        padding: 0,
        marginTop: 2,
    },
    deleteButton: {
        padding: 6,
        backgroundColor: 'transparent',
        borderRadius: 6,
        marginLeft: 8,
    },
    addCategoryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        backgroundColor: 'transparent',
        borderRadius: 0,
        borderWidth: 0,
        borderColor: 'transparent',
        marginTop: 2,
        marginBottom: 6,
    },
    addCategoryLottie: {
        width: 16,
        height: 16,
    },
    addCategoryText: {
        fontSize: 13,
        color: '#FFFFFF',
        fontWeight: '600',
        marginLeft: 8,
    },
    headerSaveButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        padding: 4,
        paddingHorizontal: 8,
    },
    headerSaveText: {
        color: '#D97757',
        fontSize: 14,
        fontWeight: '600',
    },
    modalContainer: {
        paddingBottom: 0,
    },
    modalHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 10,
        marginBottom: 8,
        marginLeft: 4,
    },
    modalHeaderTitle: {
        fontSize: 12,
        fontWeight: '600',
        color: '#8E8E93',
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },
    modalHeaderGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    modalHeaderDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#D97757',
    },
    modalHeaderGroupText: {
        fontSize: 12,
        color: '#E0E0E0',
        fontWeight: '600',
    },
    sectionHeader: {
        fontSize: 12,
        fontWeight: '600',
        color: '#8E8E93',
        marginTop: 10,
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
        marginBottom: 10,
    },
    modalItemContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#151515',
        minHeight: 52,
        position: 'relative',
    },
    modalItemIconContainer: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: '#252525',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
        marginLeft: 16,
    },
    modalIconLottie: {
        width: 20,
        height: 20,
    },
    modalItemRightContainer: {
        flex: 1,
    },
    modalItemContent: {
        flex: 1,
        flexDirection: 'column',
    },
    modalItemTitle: {
        fontSize: 12,
        color: '#888',
        marginBottom: 2,
    },
    modalInput: {
        color: '#FFF',
        fontSize: 16,
        padding: 0,
        height: 24,
    },
});
