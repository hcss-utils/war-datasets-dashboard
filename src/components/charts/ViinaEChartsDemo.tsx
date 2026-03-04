import React, { useRef, useCallback } from 'react';
import ReactECharts from 'echarts-for-react';
import type { ViinaDaily } from '../../types';

interface Props {
  data: ViinaDaily[];
}

export default function ViinaEChartsDemo({ data }: Props) {
  const chartRef = useRef<ReactECharts>(null);

  // Handle brush selection - zoom to selected range
  const onBrushSelected = useCallback((params: any) => {
    if (!chartRef.current) return;
    const chart = chartRef.current.getEchartsInstance();

    if (params.batch && params.batch[0] && params.batch[0].areas && params.batch[0].areas[0]) {
      const area = params.batch[0].areas[0];
      const coordRange = area.coordRange;

      if (coordRange && coordRange.length === 2) {
        // Zoom to the selected range
        chart.dispatchAction({
          type: 'dataZoom',
          startValue: data[Math.floor(coordRange[0])]?.date,
          endValue: data[Math.floor(coordRange[1])]?.date,
        });

        // Clear the brush selection
        chart.dispatchAction({
          type: 'brush',
          areas: [],
        });
      }
    }
  }, [data]);

  const option = {
    backgroundColor: 'transparent',
    title: {
      text: 'Daily Events (ECharts) - Drag to Select Time Range',
      left: 'center',
      textStyle: {
        color: '#fff',
        fontSize: 14,
      },
    },
    brush: {
      toolbox: ['lineX', 'clear'],
      xAxisIndex: 0,
      brushStyle: {
        borderWidth: 1,
        color: 'rgba(34, 197, 94, 0.2)',
        borderColor: '#22c55e',
      },
      outOfBrush: {
        colorAlpha: 0.3,
      },
      brushMode: 'single',
    },
    toolbox: {
      show: true,
      right: 20,
      feature: {
        restore: {
          title: 'Reset Zoom',
        },
      },
      iconStyle: {
        borderColor: '#888',
      },
      emphasis: {
        iconStyle: {
          borderColor: '#fff',
        },
      },
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#1a1a2e',
      borderColor: '#333',
      textStyle: {
        color: '#fff',
      },
      formatter: (params: any) => {
        if (!params[0]) return '';
        const date = new Date(params[0].axisValue).toLocaleDateString();
        const value = params[0].value?.toLocaleString() || '0';
        return `${date}<br/>Events: <strong>${value}</strong>`;
      },
    },
    xAxis: {
      type: 'category',
      data: data.map(d => d.date),
      axisLabel: {
        color: '#888',
        fontSize: 10,
        rotate: 45,
        formatter: (value: string) => {
          const date = new Date(value);
          return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
        },
      },
      axisLine: {
        lineStyle: { color: '#333' },
      },
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        color: '#888',
        fontSize: 10,
        formatter: (value: number) => value.toLocaleString(),
      },
      axisLine: {
        lineStyle: { color: '#333' },
      },
      splitLine: {
        lineStyle: { color: '#333', type: 'dashed' },
      },
    },
    dataZoom: [
      {
        type: 'inside',
        start: 0,
        end: 100,
        zoomOnMouseWheel: true,
      },
      {
        type: 'slider',
        start: 0,
        end: 100,
        height: 30,
        bottom: 10,
        borderColor: '#333',
        backgroundColor: '#1a1a2e',
        fillerColor: 'rgba(34, 197, 94, 0.2)',
        handleStyle: {
          color: '#22c55e',
        },
        textStyle: {
          color: '#888',
        },
        dataBackground: {
          lineStyle: { color: '#22c55e', opacity: 0.5 },
          areaStyle: { color: '#22c55e', opacity: 0.1 },
        },
      },
    ],
    series: [
      {
        name: 'Events',
        type: 'line',
        data: data.map(d => d.events),
        lineStyle: {
          color: '#22c55e',
          width: 1.5,
        },
        itemStyle: {
          color: '#22c55e',
        },
        showSymbol: false,
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(34, 197, 94, 0.3)' },
              { offset: 1, color: 'rgba(34, 197, 94, 0)' },
            ],
          },
        },
      },
    ],
    grid: {
      left: 60,
      right: 60,
      top: 50,
      bottom: 80,
    },
  };

  return (
    <div className="chart-card">
      <p className="chart-note">
        <strong>Drag horizontally</strong> on the chart to select a time range and zoom.
        Use scroll wheel to zoom. Click reset icon (top-right) or double-click slider to reset.
      </p>
      <ReactECharts
        ref={chartRef}
        option={option}
        style={{ height: '400px', width: '100%' }}
        notMerge={true}
        opts={{ renderer: 'canvas' }}
        onEvents={{
          brushSelected: onBrushSelected,
        }}
      />
    </div>
  );
}
