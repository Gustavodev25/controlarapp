import * as Haptics from "expo-haptics";
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
    if (!element) return false;
    const name = element?.type?.name || element?.type?.displayName;
    return name === "ScrollView" || name === "FlatList" || name === "SectionList";
}
