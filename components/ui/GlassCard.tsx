import React from 'react';
import { StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';

interface GlassCardProps {
    /** Título da seção (opcional) */
    title?: string;
    /** Conteúdo do card */
    children: React.ReactNode;
    /** Estilos customizados para o container externo */
    style?: ViewStyle;
    /** Estilos customizados para o card */
    cardStyle?: ViewStyle;
    /** Estilos customizados para o conteúdo interno */
    contentStyle?: ViewStyle;
    /** Estilos customizados para o título */
    titleStyle?: TextStyle;
    /** Cor de fundo do card (padrão: #30302E) */
    backgroundColor?: string;
    /** Cor da borda (padrão: rgba(255, 255, 255, 0.08)) */
    borderColor?: string;
    /** Largura da borda (padrão: 1) */
    borderWidth?: number;
    /** Raio da borda (padrão: 16) */
    borderRadius?: number;
    /** Padding interno (padrão: 16) */
    padding?: number;
    /** Padding horizontal interno */
    paddingHorizontal?: number;
    /** Padding vertical interno */
    paddingVertical?: number;
    /** Mostrar sombra (padrão: true) */
    showShadow?: boolean;
    /** Opacidade da sombra (padrão: 0.2) */
    shadowOpacity?: number;
    /** Componente à direita do título */
    titleRight?: React.ReactNode;
    /** Ocultar borda (padrão: false) */
    noBorder?: boolean;
}

export const GlassCard: React.FC<GlassCardProps> = ({
    title,
    children,
    style,
    cardStyle,
    contentStyle,
    titleStyle,
    backgroundColor = '#30302E',
    borderColor = 'rgba(255, 255, 255, 0.08)',
    borderWidth = 1,
    borderRadius = 16,
    padding = 16,
    paddingHorizontal,
    paddingVertical,
    showShadow = true,
    shadowOpacity = 0.2,
    titleRight,
    noBorder = false,
}) => {
    const cardStyles: ViewStyle = {
        backgroundColor,
        borderRadius,
        borderWidth: noBorder ? 0 : borderWidth,
        borderColor: noBorder ? 'transparent' : borderColor,
        ...(showShadow && {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity,
            shadowRadius: 20,
            elevation: 5,
        }),
    };

    const contentStyles: ViewStyle = {
        padding,
        ...(paddingHorizontal !== undefined && { paddingHorizontal }),
        ...(paddingVertical !== undefined && { paddingVertical }),
    };

    return (
        <View style={style}>
            {title && (
                <View style={styles.titleContainer}>
                    <Text style={[styles.sectionTitle, titleStyle]}>{title}</Text>
                    {titleRight}
                </View>
            )}

            <View style={[cardStyles, cardStyle]}>
                <View style={[contentStyles, contentStyle]}>
                    {children}
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    titleContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#E0E0E0',
    },
});

export default GlassCard;
