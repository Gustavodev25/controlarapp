import { ReactNode } from "react";
import { StyleProp, ViewStyle } from "react-native";
import { WithSpringConfig } from "react-native-reanimated";

export interface BottomSheetMethods {
    snapToIndex: (index: number) => void;
    snapToPosition: (position: number) => void;
    expand: () => void;
    collapse: () => void;
    close: () => void;
    getCurrentIndex: () => number;
}

export interface BottomSheetProps {
    children?: ReactNode;
    snapPoints: (string | number)[];
    enableBackdrop?: boolean;
    backdropOpacity?: number;
    dismissOnBackdropPress?: boolean;
    dismissOnSwipeDown?: boolean;
    onSnapPointChange?: (index: number) => void;
    onClose?: () => void;
    springConfig?: WithSpringConfig;
    sheetStyle?: StyleProp<ViewStyle>;
    backdropStyle?: StyleProp<ViewStyle>;
    handleStyle?: StyleProp<ViewStyle>;
    showHandle?: boolean;
    enableOverDrag?: boolean;
    enableHapticFeedback?: boolean;
    snapVelocityThreshold?: number;
    backgroundColor?: string;
    borderRadius?: number;
    contentContainerStyle?: StyleProp<ViewStyle>;
    enableDynamicSizing?: boolean;
}
