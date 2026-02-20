import { BottomModal } from '@/components/ui/BottomModal';
import { databaseService } from '@/services/firebase';
import { AlertCircle, Clock, Zap } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface CreditsModalProps {
    visible: boolean;
    onClose: () => void;
    credits: number;
    userId: string;
}

export function CreditsModal({ visible, onClose, credits, userId }: CreditsModalProps) {
    const [timeUntilReset, setTimeUntilReset] = useState<string>('');

    useEffect(() => {
        const updateTimer = () => {
            const reset = databaseService.getTimeUntilReset();
            setTimeUntilReset(reset.formatted);
        };

        updateTimer();
        const interval = setInterval(updateTimer, 60000); // Update every minute
        return () => clearInterval(interval);
    }, []);

    return (
        <BottomModal
            visible={visible}
            onClose={onClose}
            title="Créditos de Sincronização"
            height="auto"
        >
            <View style={styles.container}>
                <Text style={styles.sectionHeader}>STATUS DA CONTA</Text>
                <View style={styles.sectionCard}>
                    <View style={styles.itemContainer}>
                        <View style={styles.itemIconContainer}>
                            <Zap size={20} color="#D97757" />
                        </View>
                        <View style={styles.itemRightContainer}>
                            <View style={styles.itemContent}>
                                <Text style={styles.itemTitle}>Créditos Disponíveis</Text>
                                <Text style={styles.valueText}>{credits} <Text style={{ color: '#666' }}>/ 3</Text></Text>
                            </View>
                        </View>
                    </View>

                    <View style={styles.separator} />

                    <View style={styles.itemContainer}>
                        <View style={styles.itemIconContainer}>
                            <Clock size={20} color="#D97757" />
                        </View>
                        <View style={styles.itemRightContainer}>
                            <View style={styles.itemContent}>
                                <Text style={styles.itemTitle}>Próxima Renovação</Text>
                                <Text style={styles.valueText}>{timeUntilReset}</Text>
                            </View>
                        </View>
                    </View>
                </View>

                <View style={styles.helpContainer}>
                    <View style={styles.helpHeaderRow}>
                        <AlertCircle size={18} color="#D97757" />
                        <Text style={styles.helpTitle}>Como funciona?</Text>
                    </View>

                    <View style={styles.ruleRow}>
                        <Text style={styles.ruleBullet}>•</Text>
                        <Text style={styles.helpText}>
                            Você recebe <Text style={styles.helpTextBold}>3 créditos diários</Text> para conectar ou sincronizar contas.
                        </Text>
                    </View>

                    <View style={styles.ruleRow}>
                        <Text style={styles.ruleBullet}>•</Text>
                        <Text style={styles.helpText}>
                            A sincronização de cada banco custa <Text style={styles.helpTextBold}>1 crédito</Text>.
                        </Text>
                    </View>

                    <View style={styles.ruleRow}>
                        <Text style={styles.ruleBullet}>•</Text>
                        <Text style={styles.helpText}>
                            Renovação automática todos os dias à <Text style={styles.helpTextBold}>meia-noite</Text>.
                        </Text>
                    </View>
                </View>
            </View>
        </BottomModal>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingBottom: 20
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
        marginBottom: 10
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
    valueText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '500',
        textAlign: 'right',
    },
    separator: {
        height: 1,
        backgroundColor: '#252525',
        width: '100%',
    },
    helpContainer: {
        backgroundColor: '#1A1A1A',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#333',
        marginTop: 4
    },
    helpHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8
    },
    helpTitle: {
        fontSize: 14,
        color: '#D97757',
        fontWeight: '600'
    },
    ruleRow: {
        flexDirection: 'row',
        marginBottom: 8,
        paddingRight: 8
    },
    ruleBullet: {
        color: '#666',
        marginRight: 8,
        fontSize: 14,
        lineHeight: 20
    },
    helpText: {
        fontSize: 13,
        color: '#CCC',
        lineHeight: 20,
        flex: 1
    },
    helpTextBold: {
        fontWeight: '700',
        color: '#FFF'
    }
});
