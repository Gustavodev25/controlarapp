import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

const BACKGROUND_COLORS = ['#F7F9FC', '#EEEDFD', '#FFEBEE', '#FDEFE2', '#E7F9F3', '#EDEEFD', '#ECFAFE', '#F2FFD1', '#FFF7E0', '#FDF1F7', '#EAEFE6', '#E0E6EB', '#E4E2F3', '#E6DFEC', '#E2F4E8', '#E6EBEF', '#EBE6EF', '#E8DEF6', '#D8E8F3', '#ECE1FE'];
const SHAPE_COLORS = ['#060A23', '#5E36F5', '#E11234', '#E87917', '#3EA884', '#0618BC', '#0FBBE6', '#87B80A', '#FFC933', '#EE77AF', '#69785E', '#2D3A46', '#280F6D', '#37364F', '#363548', '#4D176E', '#AB133E', '#420790', '#222A54', '#192251'];

const SHAPES = [
    "M16 0L19.856 9.32122L29.8565 8L23.712 16L29.8565 24L19.856 22.6787L16 32L12.144 22.6787L2.14359 24L8.28799 16L2.14359 8L12.144 9.32122L16 0Z",
    "M16.017 0L18.4 8.66546L25.4214 3.05573L22.256 11.467L31.2338 11.0557L23.729 16L31.2338 20.9443L22.256 20.533L25.4214 28.9443L18.4 23.3346L16.017 32L13.6338 23.3346L6.61234 28.9443L9.77776 20.533L0.800003 20.9443L8.30492 16L0.800003 11.0557L9.77776 11.467L6.61234 3.05573L13.6338 8.66546L16.017 0Z",
    "M17.1429 0H14.8571V13.2409L5.49442 3.87816L3.87818 5.49442L13.2409 14.8571H0V17.1429H13.2409L3.87818 26.5056L5.49442 28.1218L14.8571 18.759V32H17.1429V18.759L26.5056 28.1218L28.1218 26.5056L18.759 17.1429H32V14.8571H18.759L28.1218 5.4944L26.5056 3.87816L17.1429 13.2409V0Z",
    "M16 32C24.8365 32 32 24.8365 32 16C32 7.16344 24.8365 0 16 0C7.16344 0 0 7.16344 0 16C0 24.8365 7.16344 32 16 32ZM16 23C19.8659 23 23 19.8659 23 16C23 12.134 19.8659 9 16 9C12.134 9 9 12.134 9 16C9 19.8659 12.134 23 16 23Z",
    "M8 16C12.4183 16 16 12.4183 16 8C16 12.4183 19.5818 16 24 16C19.5818 16 16 19.5818 16 24C16 19.5818 12.4183 16 8 16ZM8 16C3.58173 16 0 19.5818 0 24C0 28.4182 3.58173 32 8 32C12.4183 32 16 28.4182 16 24C16 28.4182 19.5818 32 24 32C28.4182 32 32 28.4182 32 24C32 19.5818 28.4182 16 24 16C28.4182 16 32 12.4183 32 8C32 3.58173 28.4182 0 24 0C19.5818 0 16 3.58173 16 8C16 3.58173 12.4183 0 8 0C3.58173 0 0 3.58173 0 8C0 12.4183 3.58173 16 8 16Z",
    "M16 2L21.12 17.68L32 30L16 26.64L0 30L10.88 17.68L16 2Z",
    "M16 0C16.5432 8.60154 23.3984 15.4568 32 16C23.3984 16.5432 16.5432 23.3984 16 32C15.4568 23.3984 8.60154 16.5432 0 16C8.60154 15.4568 15.4568 8.60154 16 0Z",
    "M32 16.1074L16 0L0 16.1074H15.7867L0 32H32L16.2133 16.1074H32Z"
];

function stringToNumber(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash);
}

interface AvvvatarsProps {
    value: string;
    size?: number;
    style?: 'shape' | 'character';
}

export default function Avvvatars({ value, size = 32 }: AvvvatarsProps) {
    const hash = stringToNumber(value);

    const bgColor = BACKGROUND_COLORS[hash % BACKGROUND_COLORS.length];
    const shapeColor = SHAPE_COLORS[hash % SHAPE_COLORS.length];
    const shapePath = SHAPES[hash % SHAPES.length];

    // The inner shape is sized assuming a viewBox of "0 0 32 32" in original avvvatars, 
    // but we want it to be scaled down slightly within the container like the original.
    // Original uses ~60% size, we will scale the SVG bounding.

    return (
        <View
            style={[
                styles.container,
                {
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    backgroundColor: bgColor,
                },
            ]}
        >
            <Svg
                width={size * 0.6}
                height={size * 0.6}
                viewBox="0 0 32 32"
                fill="none"
            >
                <Path d={shapePath} fill={shapeColor} />
            </Svg>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
});
