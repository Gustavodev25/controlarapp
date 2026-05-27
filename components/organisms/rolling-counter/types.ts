import { SharedValue, WithSpringConfig } from "react-native-reanimated";

export interface ICounter {
    value: number | SharedValue<number>;
    height?: number;
    width?: number;
    fontSize?: number;
    color?: string;
    fontFamily?: string;
    letterSpacing?: number;
    springConfig?: WithSpringConfig;
}

export interface IReusableDigit {
    place: number;
    counterValue: SharedValue<number>;
    height: number;
    width: number;
    color: string;
    fontSize: number;
    fontFamily?: string;
    letterSpacing?: number;
    springConfig: WithSpringConfig;
}
