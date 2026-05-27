import { CategoryGroup } from '@/constants/defaultCategories';
import { IosCoreLoader } from '@/components/ui/IosCoreLoader';
import { BlurView } from 'expo-blur';
import React, { useEffect, useState } from 'react';
import {
    Dimensions,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { ModalPadrao } from './ui/ModalPadrao';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface CategorySelectorModalProps {
    visible: boolean;
    onClose: () => void;
    onSelect: (categoryKey: string) => void;
    categories: CategoryGroup[];
    loading?: boolean;
}

export function CategorySelectorModal({
    visible,
    onClose,
    onSelect,
    categories,
    loading
}: CategorySelectorModalProps) {
    const [search, setSearch] = useState('');

    useEffect(() => {
        if (!visible) {
            setSearch('');
        }
    }, [visible]);

    const normalizedSearch = search.trim().toLowerCase();
    const filteredCategories = categories.map(group => ({
        ...group,
        items: group.items.filter(item =>
            item.label.toLowerCase().includes(normalizedSearch) ||
            group.title.toLowerCase().includes(normalizedSearch)
        )
    })).filter(group => group.items.length > 0);

    return (
        <ModalPadrao
            visible={visible}
            onClose={onClose}
            title="Mudar categoria"
            titleAlign="start"
            maxHeightRatio={0.82}
        >
            <View style={styles.container}>
                <Text style={styles.description}>
                    Escolha uma nova categoria para esta transação.
                </Text>

                <View style={styles.searchBar}>
                    <TextInput
                        style={styles.searchInput}
                        value={search}
                        onChangeText={setSearch}
                        placeholder="Buscar categoria"
                        placeholderTextColor="#8E8E93"
                        autoCorrect={false}
                    />
                </View>

                <Text style={styles.sectionTitle}>CATEGORIAS</Text>
                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    {filteredCategories.length === 0 ? (
                        <View style={styles.groupCard}>
                            <View style={styles.emptyContainer}>
                                <Text style={styles.emptyText}>Nenhuma categoria encontrada</Text>
                            </View>
                        </View>
                    ) : (
                        filteredCategories.map((group) => (
                            <View key={group.title} style={styles.groupContainer}>
                                <Text style={styles.groupTitle}>{group.title}</Text>
                                <View style={styles.groupCard}>
                                    {group.items.map((item, index) => (
                                        <React.Fragment key={item.key}>
                                            <TouchableOpacity
                                                style={styles.categoryRow}
                                                activeOpacity={0.72}
                                                onPress={() => onSelect(item.key)}
                                            >
                                                <Text style={styles.categoryLabel} numberOfLines={1}>
                                                    {item.label}
                                                </Text>
                                            </TouchableOpacity>
                                            {index < group.items.length - 1 && <View style={styles.separator} />}
                                        </React.Fragment>
                                    ))}
                                </View>
                            </View>
                        ))
                    )}
                </ScrollView>
            </View>

            {loading && (
                <View style={styles.loadingOverlay}>
                    <BlurView
                        intensity={40}
                        tint="dark"
                        style={StyleSheet.absoluteFill}
                    />
                    <IosCoreLoader fill={false} style={styles.loaderContainer} />
                </View>
            )}
        </ModalPadrao>
    );
}

const styles = StyleSheet.create({
    container: {
        maxHeight: SCREEN_HEIGHT * 0.74,
        paddingTop: 12,
    },
    description: {
        fontSize: 14,
        color: '#8E8E93',
        marginBottom: 20,
        lineHeight: 18,
    },
    searchBar: {
        backgroundColor: '#1C1C1E',
        borderRadius: 12,
        height: 48,
        justifyContent: 'center',
        paddingHorizontal: 16,
        marginBottom: 24,
    },
    searchInput: {
        color: '#FFFFFF',
        fontSize: 17,
        height: '100%',
        padding: 0,
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: '500',
        color: '#8E8E93',
        marginBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    scrollView: {
        flexGrow: 0,
        maxHeight: SCREEN_HEIGHT * 0.52,
    },
    scrollContent: {
        paddingBottom: 20,
    },
    groupContainer: {
        marginBottom: 24,
    },
    groupTitle: {
        fontSize: 12,
        fontWeight: '500',
        color: '#8E8E93',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 8,
    },
    groupCard: {
        backgroundColor: '#1C1C1E',
        borderRadius: 12,
        overflow: 'hidden',
    },
    categoryRow: {
        minHeight: 48,
        justifyContent: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    categoryLabel: {
        color: '#FFFFFF',
        fontSize: 17,
        fontWeight: '400',
    },
    separator: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: '#38383A',
    },
    emptyContainer: {
        paddingVertical: 24,
        paddingHorizontal: 16,
        alignItems: 'center',
    },
    emptyText: {
        color: '#8E8E93',
        fontSize: 15,
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 28,
        overflow: 'hidden',
        zIndex: 999
    },
    loaderContainer: {
        alignItems: 'center',
        backgroundColor: 'rgba(26, 26, 26, 0.8)',
        padding: 24,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#2A2A2A',
    },
});
