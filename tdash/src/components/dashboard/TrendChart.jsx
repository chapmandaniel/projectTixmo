import React, { useEffect, useRef, useState } from 'react';
import { ResponsiveLine } from '@nivo/line';
import { CHART_COLORS, getChartTheme } from './chartTheme';

const ChartBox = ({ children, heightClassName = 'h-[280px]' }) => {
    const ref = useRef(null);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        const node = ref.current;
        if (!node) return undefined;
        const update = () => setReady(node.clientWidth > 8 && node.clientHeight > 8);
        update();
        const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(update) : null;
        observer?.observe(node);
        return () => observer?.disconnect();
    }, []);

    return (
        <div ref={ref} className={`w-full ${heightClassName}`}>
            {ready ? children : null}
        </div>
    );
};

const dashedLinesLayer = ({ series, lineGenerator, xScale, yScale }) => (
    <g>
        {series.map((item) => {
            const path = lineGenerator(item.data.map((point) => ({
                x: xScale(point.data.x),
                y: yScale(point.data.y),
            })));
            const dashed = item.id === 'Forecast';
            return (
                <path
                    key={item.id}
                    d={path}
                    fill="none"
                    stroke={item.color}
                    strokeWidth={2}
                    strokeDasharray={dashed ? '6 4' : undefined}
                />
            );
        })}
    </g>
);

export const TrendChart = ({
    isDark,
    data,
    colors = [CHART_COLORS.current, CHART_COLORS.secondary, CHART_COLORS.forecast],
    formatY,
    formatX,
}) => (
    <ChartBox>
        <ResponsiveLine
            data={data}
            theme={getChartTheme(isDark)}
            margin={{ top: 16, right: 24, bottom: 48, left: 56 }}
            xScale={{ type: 'point' }}
            yScale={{ type: 'linear', min: 0, max: 'auto', stacked: false }}
            curve="monotoneX"
            colors={colors}
            lineWidth={2}
            pointSize={0}
            enableArea={false}
            useMesh
            enableSlices="x"
            layers={['grid', 'markers', 'axes', 'areas', 'crosshair', dashedLinesLayer, 'points', 'slices', 'mesh', 'legends']}
            axisBottom={{
                tickSize: 0,
                tickPadding: 10,
                tickRotation: -45,
                format: formatX || ((value) => String(value).slice(5)),
            }}
            axisLeft={{
                tickSize: 0,
                tickPadding: 8,
                format: formatY,
            }}
            legends={[{
                anchor: 'top-right',
                direction: 'row',
                translateY: -8,
                itemWidth: 130,
                itemHeight: 16,
                symbolSize: 8,
            }]}
        />
    </ChartBox>
);
