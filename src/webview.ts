import { LogDataPoint } from './parser';

export function getWebviewContent(data: LogDataPoint[]): string {
  const umData = data.map(d => ({ x: d.t, y: d.um }));
  const ringData = data.map(d => ({ x: d.t, y: d.ring }));
  const intLevelData = data.map(d => ({ x: d.t, y: d.intLevel }));
  const callDepthData = data.map(d => ({ x: d.t, y: d.callDepth }));

  const iMissData = data.map((d, i, arr) => {
    if (i === 0 || d.iMiss === null || arr[i - 1].iMiss === null) return { x: d.t, y: 0 };
    return { x: d.t, y: Math.max(0, d.iMiss - arr[i - 1].iMiss!) };
  });

  const dMissData = data.map((d, i, arr) => {
    if (i === 0 || d.dMiss === null || arr[i - 1].dMiss === null) return { x: d.t, y: 0 };
    return { x: d.t, y: Math.max(0, d.dMiss - arr[i - 1].dMiss!) };
  });

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>SOF Log Visualizer</title>
      <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
      <script src="https://cdn.jsdelivr.net/npm/hammerjs@2.0.8"></script>
      <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-zoom@2.0.1/dist/chartjs-plugin-zoom.min.js"></script>
      <style>
        body { padding: 10px; font-family: var(--vscode-font-family); color: var(--vscode-editor-foreground); background-color: var(--vscode-editor-background); }
        .chart-container { position: relative; height: 85vh; width: 100vw; }
        .toolbar { margin-bottom: 10px; }
        button { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 6px 12px; cursor: pointer; }
        button:hover { background: var(--vscode-button-hoverBackground); }
      </style>
    </head>
    <body>
      <div class="toolbar">
        <h2>QEMU Log Execution</h2>
        <button onclick="resetZoom()">Reset Zoom</button>
      </div>
      <div class="chart-container">
        <canvas id="logChart"></canvas>
      </div>

      <script>
        const ctx = document.getElementById('logChart').getContext('2d');
        
        const datasets = [
          {
            label: 'Call Depth',
            data: ${JSON.stringify(callDepthData)},
            borderColor: 'rgb(255, 205, 86)',
            backgroundColor: 'rgba(255, 205, 86, 0.1)',
            yAxisID: 'yCallDepth',
            stepped: true,
            borderWidth: 2,
            tension: 0
          },
          {
            label: 'UM (User Mode)',
            data: ${JSON.stringify(umData)},
            borderColor: 'rgb(75, 192, 192)',
            backgroundColor: 'rgba(75, 192, 192, 0.1)',
            yAxisID: 'yUM',
            stepped: true,
            borderWidth: 2,
            tension: 0
          },
          {
            label: 'RING',
            data: ${JSON.stringify(ringData)},
            borderColor: 'rgb(153, 102, 255)',
            backgroundColor: 'rgba(153, 102, 255, 0.1)',
            yAxisID: 'yRing',
            stepped: true,
            borderWidth: 2,
            tension: 0
          },
          {
            label: 'INTLEVEL',
            data: ${JSON.stringify(intLevelData)},
            borderColor: 'rgb(255, 159, 64)',
            backgroundColor: 'rgba(255, 159, 64, 0.1)',
            yAxisID: 'yIntLevel',
            stepped: true,
            borderWidth: 2,
            tension: 0
          },
          {
            label: 'I-Cache Miss',
            data: ${JSON.stringify(iMissData)},
            borderColor: 'rgb(255, 99, 132)',
            backgroundColor: 'rgba(255, 99, 132, 0.1)',
            yAxisID: 'yIMiss',
            borderWidth: 2,
            tension: 0.1
          },
          {
            label: 'D-Cache Miss',
            data: ${JSON.stringify(dMissData)},
            borderColor: 'rgb(54, 162, 235)',
            backgroundColor: 'rgba(54, 162, 235, 0.1)',
            yAxisID: 'yDMiss',
            borderWidth: 2,
            tension: 0.1
          }
        ];

        window.myChart = new Chart(ctx, {
          type: 'line',
          data: {
            datasets: datasets
          },
          options: {
            parsing: false,
            normalized: true,
            animation: false,
            elements: { point: { radius: 0, hitRadius: 5, hoverRadius: 0 } },
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
              mode: 'index',
              intersect: false,
            },
            plugins: {
              tooltip: {
                animation: false,
              },
              legend: { position: 'top' },
              zoom: {
                pan: {
                  enabled: true,
                  mode: 'x'
                },
                zoom: {
                  wheel: { enabled: true },
                  drag: { enabled: true },
                  pinch: { enabled: true },
                  mode: 'x'
                }
              }
            },
            scales: {
              x: {
                type: 'linear',
                title: { display: true, text: 'Time (T)' },
                ticks: {
                  callback: function(value) {
                    return '0x' + Number(value).toString(16);
                  }
                }
              },
              yCallDepth: {
                type: 'linear', display: true, position: 'left', stack: 'metrics', stackWeight: 1.5,
                title: { display: true, text: 'Call Depth' }, suggestedMin: 0,
                grid: { drawOnChartArea: true },
                ticks: { stepSize: 1 }
              },
              yDMiss: {
                type: 'linear', display: true, position: 'left', stack: 'metrics', stackWeight: 2,
                title: { display: true, text: 'D-Miss' },
                grid: { drawOnChartArea: true }
              },
              yIMiss: {
                type: 'linear', display: true, position: 'left', stack: 'metrics', stackWeight: 2,
                title: { display: true, text: 'I-Miss' },
                grid: { drawOnChartArea: true }
              },
              yIntLevel: {
                type: 'linear', display: true, position: 'left', stack: 'metrics', stackWeight: 1,
                title: { display: true, text: 'INT' }, suggestedMin: 0, suggestedMax: 16,
                grid: { drawOnChartArea: true },
                ticks: { stepSize: 1 }
              },
              yRing: {
                type: 'linear', display: true, position: 'left', stack: 'metrics', stackWeight: 1,
                title: { display: true, text: 'RING' }, suggestedMin: 0, suggestedMax: 4,
                grid: { drawOnChartArea: true },
                ticks: { stepSize: 1 }
              },
              yUM: {
                type: 'linear', display: true, position: 'left', stack: 'metrics', stackWeight: 1,
                title: { display: true, text: 'UM' }, suggestedMin: 0, suggestedMax: 1.5,
                grid: { drawOnChartArea: true },
                ticks: { 
                  stepSize: 1,
                  callback: function(value) {
                    if (value === 0) return 'Kernel (0)';
                    if (value === 1) return 'User (1)';
                    return '';
                  }
                }
              }
            }
          }
        });

        function resetZoom() {
          if (window.myChart) {
            window.myChart.resetZoom();
          }
        }
      </script>
    </body>
    </html>
  `;
}
