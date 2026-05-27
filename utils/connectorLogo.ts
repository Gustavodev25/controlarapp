type ConnectorLike = {
    imageUrl?: string | null;
    logoUrl?: string | null;
    iconUrl?: string | null;
    image?: string | null;
    logo?: string | null;
    icon?: string | null;
};

const isLikelyDomain = (value: string) => /^[a-z0-9.-]+\.[a-z]{2,}($|\/)/i.test(value);

export const normalizeImageUrl = (value?: string | null): string | null => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed) return null;

    if (trimmed.startsWith('//')) {
        return `https:${trimmed}`;
    }

    const lower = trimmed.toLowerCase();
    if (
        lower.startsWith('https://') ||
        lower.startsWith('http://') ||
        lower.startsWith('data:image/')
    ) {
        return trimmed;
    }

    if (lower.startsWith('www.') || isLikelyDomain(trimmed)) {
        return `https://${trimmed}`;
    }

    return null;
};

export const getConnectorLogoUrl = (connector?: ConnectorLike | null): string | null => {
    if (!connector) return null;

    const rawUrl =
        connector.imageUrl ??
        connector.logoUrl ??
        connector.iconUrl ??
        connector.image ??
        connector.logo ??
        connector.icon ??
        null;

    return normalizeImageUrl(rawUrl);
};

export const normalizeHexColor = (value?: string | null, fallback = '#30302E'): string => {
    if (typeof value !== 'string') return fallback;
    const trimmed = value.trim();
    if (!trimmed) return fallback;

    if (trimmed.startsWith('#')) {
        return trimmed;
    }

    if (/^[0-9a-f]{3}$/i.test(trimmed) || /^[0-9a-f]{6}$/i.test(trimmed) || /^[0-9a-f]{8}$/i.test(trimmed)) {
        return `#${trimmed}`;
    }

    return fallback;
};
