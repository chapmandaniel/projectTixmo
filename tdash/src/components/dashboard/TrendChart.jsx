import React, { useEffect, useRef, useState } from 'react';
import { ResponsiveLine } from '@nivo/line';
import { CHART_COLORS, getChartTheme } from './chartTheme';
import { cn } from '../../lib/utils';

const ChartBox = ({ children, heightClassName = 'h-[340px]' }) => {
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

const ticketsAreaLayer = ({ series, areaGenerator }) => {
    const tickets = series.find((item) => item.id === 'Tickets sold');
    if (!tickets || !areaGenerator) return null;
    const points = tickets.data.map((point) => ({
        x: point.position.x,
        y: point.position.y,
    }));
    return (
        <path
            d={areaGenerator(points)}
            fill="url(#ticketsFill)"
            style={{ pointerEvents: 'none' }}
        />
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
            const tickets = item.id === 'Tickets sold';
            return (
                <path
                    key={item.id}
                    d={path}
                    fill="none"
                    stroke={item.color}
                    strokeWidth={tickets ? 3 : 2}
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
    formatSlice,
    heightClassName = 'h-[340px] lg:h-[360px]',
}) => (
    <ChartBox heightClassName={heightClassName}>
        <ResponsiveLine
            data={data}
            theme={getChartTheme(isDark)}
            margin={{ top: 12, right: 16, bottom: 40, left: 48 }}
            xScale={{ type: 'point' }}
            yScale={{ type: 'linear', min: 0, max: 'auto', stacked: false }}
            curve="monotoneX"
            colors={colors}
            lineWidth={2}
            pointSize={0}
            enableArea={false}
            useMesh
            enableSlices="x"
            defs={[{
                id: 'ticketsFill',
                type: 'linearGradient',
                colors: [
                    { offset: 0, color: CHART_COLORS.current, opacity: 0.34 },
                    { offset: 100, color: CHART_COLORS.current, opacity: 0.02 },
                ],
            }]}
            layers={['grid', 'markers', 'axes', ticketsAreaLayer, 'crosshair', dashedLinesLayer, 'points', 'slices', 'mesh']}
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
            sliceTooltip={formatSlice ? ({ slice }) => (
                <div
                    className={cn(
                        'max-w-xs rounded-md border px-3 py-2 text-sm font-light leading-5 shadow-dashboard-soft',
                        isDark ? 'border-dashboard-border bg-dashboard-shell text-zinc-100' : 'border-slate-200 bg-white text-slate-700'
                    )}
                >
                    {formatSlice(slice)}
                </div>
            ) : undefined}
        />
    </ChartBox>
);
