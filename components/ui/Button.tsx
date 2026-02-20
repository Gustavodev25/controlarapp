import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
    ActivityIndicator,
    Pressable,
    PressableProps,
    StyleSheet,
    Text,
    TextStyle,
    ViewStyle
} from 'react-native';

// Tipos para as variantes do botão
type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';

interface ButtonProps extends PressableProps {
    /** Texto do botão */
    title?: string;
    /** Variante de estilo do botão */
    variant?: ButtonVariant;
    /** Tamanho do botão */
    size?: ButtonSize;
    /** Estado de carregamento */
    isLoading?: boolean;
    /** Ícone à esquerda (nome do Ionicons) */
    leftIcon?: keyof typeof Ionicons.glyphMap;
    /** Ícone à direita (nome do Ionicons) */
    rightIcon?: keyof typeof Ionicons.glyphMap;
    /** Botão ocupa toda a largura disponível */
    fullWidth?: boolean;
    /** Estilos customizados para o container */
    style?: ViewStyle;
    /** Estilos customizados para o texto */
    textStyle?: TextStyle;
    /** Conteúdo customizado (substitui title) */
    children?: React.ReactNode;
    /** Border radius customizado */
    rounded?: 'none' | 'sm' | 'md' | 'lg' | 'full';
}

// Paleta de cores do projeto
const COLORS = {
    primary: '#d97757',
    primaryHover: '#c4684a',
    secondary: '#27272a',
    secondaryHover: '#3f3f46',
    background: '#0C0C0C',
    surface: '#30302E',
    border: 'rgba(255, 255, 255, 0.08)',
    borderLight: '#3f3f46',
    text: '#faf9f5',
    textMuted: '#a1a1aa',
    danger: '#ef4444',
    dangerHover: '#dc2626',
    success: '#22c55e',
    successHover: '#16a34a',
    white: '#ffffff',
};

// Configurações de tamanho
const SIZE_CONFIG: Record<ButtonSize, { height: number; paddingHorizontal: number; fontSize: number; iconSize: number }> = {
    sm: { height: 36, paddingHorizontal: 12, fontSize: 13, iconSize: 16 },
    md: { height: 44, paddingHorizontal: 16, fontSize: 14, iconSize: 18 },
    lg: { height: 52, paddingHorizontal: 20, fontSize: 15, iconSize: 20 },
    xl: { height: 60, paddingHorizontal: 24, fontSize: 16, iconSize: 22 },
};

// Configurações de border radius
const BORDER_RADIUS: Record<string, number> = {
    none: 0,
    sm: 8,
    md: 12,
    lg: 16,
    full: 999,
};

export const Button: React.FC<ButtonProps> = ({
    title,
    variant = 'primary',
    size = 'md',
    isLoading = false,
    leftIcon,
    rightIcon,
    fullWidth = false,
    style,
    textStyle,
    children,
    rounded = 'lg',
    disabled,
    ...props
}) => {
    const sizeConfig = SIZE_CONFIG[size];
    const borderRadius = BORDER_RADIUS[rounded];

    // Estilos base do botão
    const getButtonStyles = (pressed: boolean): ViewStyle => {
        const baseStyles: ViewStyle = {
            height: sizeConfig.height,
            paddingHorizontal: sizeConfig.paddingHorizontal,
            borderRadius,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            ...(fullWidth && { width: '100%' }),
        };

        // Estilos por variante
        switch (variant) {
            case 'primary':
                return {
                    ...baseStyles,
                    backgroundColor: pressed ? COLORS.primaryHover : COLORS.primary,
                    shadowColor: COLORS.primary,
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: pressed ? 0.2 : 0.35,
                    shadowRadius: 12,
                    elevation: pressed ? 2 : 6,
                };
            case 'secondary':
                return {
                    ...baseStyles,
                    backgroundColor: pressed ? COLORS.secondaryHover : COLORS.secondary,
                    borderWidth: 1,
                    borderColor: COLORS.border,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.15,
                    shadowRadius: 6,
                    elevation: pressed ? 1 : 3,
                };
            case 'outline':
                return {
                    ...baseStyles,
                    backgroundColor: pressed ? 'rgba(255, 255, 255, 0.05)' : 'transparent',
                    borderWidth: 1.5,
                    borderColor: pressed ? COLORS.text : COLORS.borderLight,
                };
            case 'ghost':
                return {
                    ...baseStyles,
                    backgroundColor: pressed ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                };
            case 'danger':
                return {
                    ...baseStyles,
                    backgroundColor: pressed ? COLORS.dangerHover : COLORS.danger,
                    shadowColor: COLORS.danger,
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: pressed ? 0.2 : 0.35,
                    shadowRadius: 12,
                    elevation: pressed ? 2 : 6,
                };
            case 'success':
                return {
                    ...baseStyles,
                    backgroundColor: pressed ? COLORS.successHover : COLORS.success,
                    shadowColor: COLORS.success,
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: pressed ? 0.2 : 0.35,
                    shadowRadius: 12,
                    elevation: pressed ? 2 : 6,
                };
            default:
                return baseStyles;
        }
    };

    // Cor do texto por variante
    const getTextColor = (): string => {
        switch (variant) {
            case 'primary':
            case 'danger':
            case 'success':
                return COLORS.white;
            case 'secondary':
            case 'outline':
            case 'ghost':
            default:
                return COLORS.text;
        }
    };

    // Cor do ícone de loading
    const getLoadingColor = (): string => {
        switch (variant) {
            case 'primary':
            case 'danger':
            case 'success':
                return COLORS.white;
            default:
                return COLORS.text;
        }
    };

    const textColor = getTextColor();
    const isDisabled = disabled || isLoading;

    return (
        <Pressable
            disabled={isDisabled}
            style={({ pressed }) => [
                getButtonStyles(pressed),
                isDisabled && styles.disabled,
                style,
            ]}
            {...props}
        >
            {({ pressed }) => (
                <>
                    {isLoading ? (
                        <ActivityIndicator
                            color={getLoadingColor()}
                            size={size === 'sm' ? 'small' : 'small'}
                        />
                    ) : (
                        <>
                            {leftIcon && (
                                <Ionicons
                                    name={leftIcon}
                                    size={sizeConfig.iconSize}
                                    color={textColor}
                                    style={{ opacity: isDisabled ? 0.6 : 1 }}
                                />
                            )}

                            {children ? (
                                children
                            ) : title ? (
                                <Text
                                    style={[
                                        styles.text,
                                        {
                                            fontSize: sizeConfig.fontSize,
                                            color: textColor,
                                        },
                                        textStyle,
                                    ]}
                                >
                                    {title}
                                </Text>
                            ) : null}

                            {rightIcon && (
                                <Ionicons
                                    name={rightIcon}
                                    size={sizeConfig.iconSize}
                                    color={textColor}
                                    style={{ opacity: isDisabled ? 0.6 : 1 }}
                                />
                            )}
                        </>
                    )}
                </>
            )}
        </Pressable>
    );
};

// Variante IconButton para botões apenas com ícone
interface IconButtonProps extends Omit<ButtonProps, 'title' | 'leftIcon' | 'rightIcon' | 'children'> {
    /** Nome do ícone (Ionicons) */
    icon: keyof typeof Ionicons.glyphMap;
    /** Cor do ícone */
    iconColor?: string;
}

export const IconButton: React.FC<IconButtonProps> = ({
    icon,
    iconColor,
    variant = 'ghost',
    size = 'md',
    rounded = 'lg',
    ...props
}) => {
    const sizeConfig = SIZE_CONFIG[size];

    // Calcula a cor do ícone
    const getIconColor = (): string => {
        if (iconColor) return iconColor;
        switch (variant) {
            case 'primary':
            case 'danger':
            case 'success':
                return COLORS.white;
            default:
                return COLORS.text;
        }
    };

    return (
        <Button
            variant={variant}
            size={size}
            rounded={rounded}
            style={{
                width: sizeConfig.height,
                paddingHorizontal: 0,
            }}
            {...props}
        >
            <Ionicons
                name={icon}
                size={sizeConfig.iconSize}
                color={getIconColor()}
            />
        </Button>
    );
};

const styles = StyleSheet.create({
    text: {
        fontWeight: '600',
        letterSpacing: 0.3,
    },
    disabled: {
        opacity: 0.5,
    },
});

export default Button;
