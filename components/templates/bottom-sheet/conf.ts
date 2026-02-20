import { WithSpringConfig, WithTimingConfig } from "react-native-reanimated";

export const DEFAULT_SPRING_CONFIG: WithSpringConfig = {
    damping: 50,
    stiffness: 500,
    mass: 1,
    overshootClamping: true,
};

export const DEFAULT_TIMING_CONFIG: WithTimingConfig = {
    duration: 250,
};

export const HANDLE_HEIGHT = 28;
export const SCROLL_TOP_THRESHOLD = 5;
