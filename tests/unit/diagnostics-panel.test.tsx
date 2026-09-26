jest.mock('d3', () => require('./visualizations/mockVizDeps').d3Mock);
jest.mock(
  '@/components/visualizations/chartHelpers',
  () => require('./visualizations/mockVizDeps').chartHelpersMock,
);

import React, { useEffect } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ArnoldMapVisualization from '@/components/visualizations/ArnoldMapVisualization';
import DiagnosticsPanel from '@/components/ui/DiagnosticsPanel';
import {
  DiagnosticsSeriesProvider,
  useDrawnSeries,
  usePublishDrawnSeries,
} from '@/components/ui/DiagnosticsSeriesContext';

const posts: string[] = [];

class RecordingWorker {
  postMessage(msg: { measure?: string }): void {
    posts.push(msg.measure ?? '');
  }
  addEventListener(): void {}
  removeEventListener(): void {}
  terminate(): void {}
}

function Publisher({
  series,
  view,
}: {
  series: number[] | null;
  view: string;
}): null {
  const publish = usePublishDrawnSeries();
  useEffect(() => {
    publish(series, view);
  }, [publish, series, view]);
  return null;
}

function Probe(): React.ReactElement {
  const drawn = useDrawnSeries();
  const n = drawn.series == null ? 'null' : String(drawn.series.length);
  return <output data-testid="drawn-series">{`${n}|${drawn.view}`}</output>;
}

function renderPanel(series: number[] | null, view: string): void {
  render(
    <DiagnosticsSeriesProvider>
      <Publisher series={series} view={view} />
      <DiagnosticsPanel />
    </DiagnosticsSeriesProvider>,
  );
}

describe('diagnostics series store and panel', () => {
  const previousWorker = global.Worker;

  beforeEach(() => {
    posts.length = 0;
    global.Worker = RecordingWorker as unknown as typeof Worker;
  });

  afterEach(() => {
    global.Worker = previousWorker;
  });

  it('null series shows no time series and em dashes', async () => {
    renderPanel([1, 2, 3, 4], 'Trajectory');
    renderPanel(null, 'Matrix Properties');
    await waitFor(() => {
      expect(screen.getAllByTestId('diagnostics-series').at(-1)).toHaveTextContent(
        'no time series in this view',
      );
    });
    const panels = screen.getAllByTestId('diagnostics-k');
    expect(panels.at(-1)).toHaveTextContent('—');
    expect(screen.getAllByTestId('diagnostics-d2').at(-1)).toHaveTextContent('—');
    expect(screen.getAllByTestId('diagnostics-pe').at(-1)).toHaveTextContent('—');
    expect(posts).toEqual([]);
  });

  it('shows N and the published view label', async () => {
    renderPanel([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8], 'Time Series');
    await waitFor(() => {
      expect(screen.getByTestId('diagnostics-series')).toHaveTextContent('N = 8 · Time Series');
    });
  });

  it('below MIN_N shows series too short and does not ask the worker', async () => {
    renderPanel(Array.from({ length: 20 }, (_, i) => i / 20), 'Cobweb Plot');
    await waitFor(() => {
      expect(screen.getByTestId('diagnostics-k')).toHaveTextContent('series too short (N = 20)');
    });
    expect(screen.getByTestId('diagnostics-pe')).toHaveTextContent('series too short (N = 20)');
    expect(screen.getByTestId('diagnostics-d2')).toHaveTextContent('series too short (N = 20)');
    expect(posts).toEqual([]);
  });

  it('asks the worker only for measures whose MIN_N the series meets', async () => {
    renderPanel(Array.from({ length: 100 }, (_, i) => (i % 7) / 7), 'Time Series');
    await waitFor(() => {
      expect(posts).toEqual(['k']);
    });
    expect(screen.getByTestId('diagnostics-k')).toHaveTextContent('…');
    expect(screen.getByTestId('diagnostics-pe')).toHaveTextContent('series too short (N = 100)');
    expect(screen.getByTestId('diagnostics-d2')).toHaveTextContent('series too short (N = 100)');
  });
});

describe('Arnold view publish', () => {
  function selectView(value: string): void {
    const label = screen.getByText('Visualization Type');
    const select = label.parentElement?.querySelector('select');
    if (!select) throw new Error('missing view select');
    fireEvent.change(select, { target: { value } });
  }

  it('properties view publishes null instead of keeping the trajectory series', async () => {
    render(
      <DiagnosticsSeriesProvider>
        <ArnoldMapVisualization />
        <Probe />
      </DiagnosticsSeriesProvider>,
    );
    await waitFor(() => {
      expect(screen.getByTestId('drawn-series')).toHaveTextContent('50|Trajectory');
    });
    selectView('properties');
    await waitFor(() => {
      expect(screen.getByTestId('drawn-series')).toHaveTextContent('null|Matrix Properties');
    });
  });
});
