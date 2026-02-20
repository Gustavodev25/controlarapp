export interface CategoryMapping {
    id: string;
    originalKey: string;
    displayName: string;
    isDefault: boolean;
    group?: string;
    icon?: string;
    color?: string;
    updatedAt?: string;
    // For local logic matching existing structure
    isCustom?: boolean;
}
