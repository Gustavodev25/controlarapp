import * as Haptics from "expo-haptics";
import { Children, isValidElement } from "react";
import { Dimensions } from "react-native";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

export function parseSnapPoint(snapPoint: string | number): number {
    if (typeof snapPoint === "number") {
        return snapPoint;
    }
    const percentageStr = snapPoint.replace("%", "");
    const percentage = parseFloat(percentageStr);
    return (percentage * SCREEN_HEIGHT) / 100;
}

export function triggerHaptic() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

export function isScrollableList(element: any): boolean {
    if (!isValidElement(element)) return false;

    const elementType = (element as any)?.type;
    const name = elementType?.displayName || elementType?.name || "";
    if (
        name === "ScrollView" ||
        name === "FlatList" ||
        name === "SectionList" ||
        name === "VirtualizedList"
    ) {
        return true;
    }

    // Fallback para listas virtualizadas embrulhadas por HOCs/animated wrappers.
    const props = element.props as any;
    if (typeof props?.renderItem === "function" && props?.data !== undefined) {
        return true;
    }
    if (typeof props?.getItem === "function" && typeof props?.getItemCount === "function") {
        return true;
    }

    return false;
}

export function hasScrollableListDescendant(element: any): boolean {
    if (!isValidElement(element)) return false;
    if (isScrollableList(element)) return true;

    const children = (element.props as any)?.children;
    if (!children) return false;

    return Children.toArray(children).some(hasScrollableListDescendant);
}
