import { getConnectorLogoUrl, normalizeHexColor, normalizeImageUrl } from '@/utils/connectorLogo';
import { Landmark } from 'lucide-react-native';
import React, { memo, useEffect, useMemo, useState } from 'react';
import { Image, StyleSheet, View, type ImageStyle, type StyleProp, type ViewStyle } from 'react-native';
import { SvgCssUri } from 'react-native-svg/css';
import { SvgUri } from 'react-native-svg';

type ConnectorLike = {
    imageUrl?: string | null;
    logoUrl?: string | null;
    iconUrl?: string | null;
    image?: string | null;
    logo?: string | null;
    icon?: string | null;
    primaryColor?: string | null;
};

interface BankConnectorLogoProps {
    connector?: ConnectorLike | null;
    uri?: string | null;
    size?: number;
    borderRadius?: number;
    iconSize?: number;
    fallbackColor?: string;
    borderColor?: string;
    backgroundColor?: string;
    showBorder?: boolean;
    containerStyle?: StyleProp<ViewStyle>;
    imageStyle?: StyleProp<ImageStyle>;
}

const isSvgLogo = (url: string): boolean => {
    const lower = url.toLowerCase();
    return (
        lower.startsWith('data:image/svg+xml') ||
        lower.includes('.svg?') ||
        lower.endsWith('.svg')
    );
};

export const BankConnectorLogo = memo(({
    connector,
    uri,
    size = 36,
    borderRadius = 10,
    iconSize,
    fallbackColor,
    borderColor,
    backgroundColor = 'white',
    showBorder = true,
    containerStyle,
    imageStyle
}: BankConnectorLogoProps) => {
    const resolvedUri = useMemo(() => {
        const url = uri ?? getConnectorLogoUrl(connector);
        return normalizeImageUrl(url);
    }, [uri, connector]);

    const [hasError, setHasError] = useState(false);
    const [svgStrategy, setSvgStrategy] = useState<'css' | 'basic'>('css');

    useEffect(() => {
        setHasError(false);
        setSvgStrategy('css');
    }, [resolvedUri]);

    const primaryColor = normalizeHexColor(connector?.primaryColor, '#D97757');
    const iconColor = fallbackColor || primaryColor;
    const computedBorderColor = borderColor || `${iconColor}33`;
    const renderedIconSize = iconSize || Math.max(14, Math.round(size * 0.45));
    const shouldRenderSvg = resolvedUri ? isSvgLogo(resolvedUri) : false;

    return (
        <View
            style={[
                styles.container,
                {
                    width: size,
                    height: size,
                    borderRadius,
                    backgroundColor,
                    borderWidth: showBorder ? 1 : 0,
                    borderColor: computedBorderColor,
                },
                containerStyle
            ]}
        >
            {resolvedUri && !hasError ? (
                shouldRenderSvg ? (
                    svgStrategy === 'css' ? (
                        <SvgCssUri
                            uri={resolvedUri}
                            width="100%"
                            height="100%"
                            onError={() => setSvgStrategy('basic')}
                        />
                    ) : (
                        <SvgUri
                            uri={resolvedUri}
                            width="100%"
                            height="100%"
                            onError={() => setHasError(true)}
                        />
                    )
                ) : (
                    <Image
                        source={{ uri: resolvedUri }}
                        style={[
                            styles.image,
                            { borderRadius: Math.max(0, borderRadius - 2) },
                            imageStyle
                        ]}
                        resizeMode="contain"
                        onError={() => setHasError(true)}
                    />
                )
            ) : (
                <Landmark size={renderedIconSize} color={iconColor} />
            )}
        </View>
    );
});

BankConnectorLogo.displayName = 'BankConnectorLogo';

const styles = StyleSheet.create({
    container: {
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    image: {
        width: '100%',
        height: '100%',
    }
});
