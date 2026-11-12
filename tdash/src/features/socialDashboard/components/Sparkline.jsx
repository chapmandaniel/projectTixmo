import React from 'react';
import { ResponsiveLine } from '@nivo/line';
import { getChartTheme, CHART_COLORS } from '../chartTheme';

export const Sparkline = ({ values = [], isDark, color = CHART_COLORS.current }) => {
    if (!values.length) return <div className="h-10" />;
    const data = [{
        id: 'spark',
        data: values.map((y, index) => ({ x: index, y })),
    }];

    return (
        <div className="h-10 w-full">
            <ResponsiveLine
                data={data}
                theme={getChartTheme(isDark)}
                margin={{ top: 4, right: 4, bottom: 4, left: 4 }}
                xScale={{ type: 'point' }}
                yScale={{ type: 'linear', min: 'auto', max: 'auto' }}
                curve="monotoneX"
                enableArea
                areaOpacity={0.14}
                colors={[color]}
                lineWidth={1.6}
                pointSize={0}
                enableGridX={false}
                enableGridY={false}
                axisLeft={null}
                axisBottom={null}
                enableCrosshair={false}
                isInteractive={false}
                animate={false}
            />
        </div>
    );
};
