import { LogDataPoint } from './parser';

export function getWebviewContent(data: LogDataPoint[]): string {
  const timeFactor = 38420000.0;
  
  const umData = data.map(d => ({ x: d.t / timeFactor, y: d.um }));
  const ringData = data.map(d => ({ x: d.t / timeFactor, y: d.ring }));
  const intLevelData = data.map(d => ({ x: d.t / timeFactor, y: d.intLevel }));
  const callDepthData = data.map(d => ({ x: d.t / timeFactor, y: d.callDepth, exc: d.excCause, tlbType: d.tlbType, tlbDetails: d.tlbDetails, ioType: d.ioType, ioDevice: d.ioDevice, ioDetails: d.ioDetails, funcAddr: d.funcAddr, funcArgs: d.funcArgs, funcRet: d.funcRet, funcName: d.funcName }));

  const iMissData = data.map((d, i, arr) => {
    if (i === 0 || d.iMiss === null || arr[i - 1].iMiss === null) return { x: d.t / timeFactor, y: 0 };
    return { x: d.t / timeFactor, y: Math.max(0, d.iMiss - arr[i - 1].iMiss!) };
  });

  const dMissData = data.map((d, i, arr) => {
    if (i === 0 || d.dMiss === null || arr[i - 1].dMiss === null) return { x: d.t / timeFactor, y: 0 };
    return { x: d.t / timeFactor, y: Math.max(0, d.dMiss - arr[i - 1].dMiss!) };
  });

  const cDeltaData = data.map((d, i, arr) => {
    if (i === 0 || d.c === null || arr[i - 1].c === null) return { x: d.t / timeFactor, y: 0 };
    return { x: d.t / timeFactor, y: Math.max(0, d.c - arr[i - 1].c!) };
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
        body { padding: 10px; font-family: var(--vscode-font-family); color: var(--vscode-editor-foreground); background-color: var(--vscode-editor-background); overflow: hidden; }
        .toolbar { margin-bottom: 10px; }
        button { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 6px 12px; cursor: pointer; }
        button:hover { background: var(--vscode-button-hoverBackground); }
        .main-layout { display: flex; width: 100vw; height: 85vh; }
        .sidebar { width: 30%; height: 100%; overflow-y: auto; border-right: 1px solid var(--vscode-panel-border); padding: 5px; box-sizing: border-box; }
        .chart-container { width: 70%; height: 100%; position: relative; }
        details { margin-left: 12px; }
        summary { font-family: monospace; font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding: 2px; user-select: none; }
        summary:hover { background: var(--vscode-list-hoverBackground); }
      </style>
    </head>
    <body>
      <div class="toolbar">
        <h2>QEMU Log Execution</h2>
        <button onclick="loadSymbols()">Load ELF Symbols</button>
        <button onclick="resetZoom()">Reset Zoom</button>
        <button id="toggleExceptionsBtn" onclick="toggleExceptions()">Toggle Exceptions (On)</button>
        <button id="toggleTlbBtn" onclick="toggleTlb()">Toggle TLB Events (On)</button>
        <button id="toggleIoBtn" onclick="toggleIo()">Toggle ACE IO (On)</button>
      </div>
      <div class="main-layout">
        <div class="sidebar" id="tree-sidebar"></div>
        <div class="chart-container">
          <canvas id="logChart"></canvas>
        </div>
      </div>

      <script>
        const logData = ${JSON.stringify(data)};
        const vscode = acquireVsCodeApi();

        let showExceptions = true;
        let showTlb = true;
        let showIo = true;

        function loadSymbols() {
          vscode.postMessage({ command: 'loadElf' });
        }

        function toggleExceptions() {
          showExceptions = !showExceptions;
          document.getElementById('toggleExceptionsBtn').innerText = 'Toggle Exceptions (' + (showExceptions ? 'On' : 'Off') + ')';
          window.myChart.update();
        }

        function toggleTlb() {
          showTlb = !showTlb;
          document.getElementById('toggleTlbBtn').innerText = 'Toggle TLB Events (' + (showTlb ? 'On' : 'Off') + ')';
          window.myChart.update();
        }

        function toggleIo() {
          showIo = !showIo;
          document.getElementById('toggleIoBtn').innerText = 'Toggle ACE IO (' + (showIo ? 'On' : 'Off') + ')';
          window.myChart.update();
        }

        const ctx = document.getElementById('logChart').getContext('2d');
        
        const datasets = [
          {
            label: 'CCOUNT Delta',
            data: ${JSON.stringify(cDeltaData)},
            borderColor: 'rgb(201, 203, 207)',
            backgroundColor: 'rgba(201, 203, 207, 0.1)',
            yAxisID: 'yCDelta',
            stepped: true,
            borderWidth: 2,
            tension: 0
          },
          {
            label: 'Call Depth',
            data: ${JSON.stringify(callDepthData)},
            borderColor: 'rgb(255, 205, 86)',
            backgroundColor: 'rgba(255, 205, 86, 0.1)',
            yAxisID: 'yCallDepth',
            stepped: true,
            borderWidth: 2,
            tension: 0,
            pointStyle: function(context) {
              if (showExceptions && context.raw?.exc !== null && context.raw?.exc !== undefined) return 'circle';
              if (showTlb && context.raw?.tlbType) return 'triangle';
              if (showIo && context.raw?.ioType) return 'rect';
              return 'circle';
            },
            pointRadius: function(context) { 
              if (showExceptions && context.raw?.exc !== null && context.raw?.exc !== undefined) return 5;
              if (showTlb && context.raw?.tlbType) return 4;
              if (showIo && context.raw?.ioType) return 4;
              return 0; 
            },
            pointBackgroundColor: function(context) { 
              if (showExceptions && context.raw?.exc !== null && context.raw?.exc !== undefined) return 'red';
              if (showTlb && context.raw?.tlbType === 'D') return 'purple';
              if (showTlb && context.raw?.tlbType === 'I') return 'plum';
              if (showIo && context.raw?.ioType === 'read') return 'green';
              if (showIo && context.raw?.ioType === 'write') return 'blue';
              return 'rgba(0,0,0,0)';
            },
            pointBorderColor: function(context) { 
              if (showExceptions && context.raw?.exc !== null && context.raw?.exc !== undefined) return 'red';
              if (showTlb && context.raw?.tlbType === 'D') return 'purple';
              if (showTlb && context.raw?.tlbType === 'I') return 'plum';
              if (showIo && context.raw?.ioType === 'read') return 'green';
              if (showIo && context.raw?.ioType === 'write') return 'blue';
              return 'rgba(0,0,0,0)';
            }
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
            stepped: true,
            borderWidth: 2,
            tension: 0
          },
          {
            label: 'D-Cache Miss',
            data: ${JSON.stringify(dMissData)},
            borderColor: 'rgb(54, 162, 235)',
            backgroundColor: 'rgba(54, 162, 235, 0.1)',
            yAxisID: 'yDMiss',
            stepped: true,
            borderWidth: 2,
            tension: 0
          }
        ];

        const verticalLinePlugin = {
          id: 'verticalLine',
          afterDraw: chart => {
            if (chart.tooltip?._active && chart.tooltip._active.length) {
              const activePoint = chart.tooltip._active[0];
              const ctx = chart.ctx;
              const x = activePoint.element.x;
              const topY = chart.chartArea.top;
              const bottomY = chart.chartArea.bottom;

              ctx.save();
              ctx.beginPath();
              ctx.moveTo(x, topY);
              ctx.lineTo(x, bottomY);
              ctx.lineWidth = 1;
              ctx.strokeStyle = 'rgba(128, 128, 128, 0.8)';
              ctx.setLineDash([3, 3]);
              ctx.stroke();
              ctx.restore();
            }
          }
        };

        window.myChart = new Chart(ctx, {
          type: 'line',
          plugins: [verticalLinePlugin],
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
                callbacks: {
                  title: function(context) {
                    if (!context.length) return '';
                    const val = context[0].parsed.x;
                    const totalMicroseconds = Math.floor(val * 1000000);
                    const ss = Math.floor(totalMicroseconds / 1000000);
                    const mmm = Math.floor((totalMicroseconds % 1000000) / 1000);
                    const uuu = totalMicroseconds % 1000;
                    return String(ss).padStart(2, '0') + ':' + String(mmm).padStart(3, '0') + ':' + String(uuu).padStart(3, '0');
                  },
                  label: function(context) {
                    if (context.dataset.label === 'Call Depth') {
                      let base = '';
                      if (showExceptions && context.raw.exc !== null && context.raw.exc !== undefined) {
                        base = 'Exception: EXCCAUSE ' + context.raw.exc;
                      } else if (showTlb && context.raw.tlbType) {
                        base = 'TLB ' + context.raw.tlbType + ' ' + (context.raw.tlbDetails || '');
                      } else if (showIo && context.raw.ioType) {
                        base = 'ACE IO: ' + (context.raw.ioDevice || '') + ' ' + context.raw.ioType.toUpperCase() + ' // ' + (context.raw.ioDetails || '');
                      }

                      let funcDesc = '';
                      if (context.raw.funcAddr !== undefined) {
                        const nameLabel = context.raw.funcName ? context.raw.funcName : '0x' + context.raw.funcAddr.toString(16);
                        if (context.raw.funcArgs) {
                          funcDesc = 'Entry: ' + nameLabel + '(a2=' + context.raw.funcArgs[0] + ', a3=' + context.raw.funcArgs[1] + ', a4=' + context.raw.funcArgs[2] + ', a5=' + context.raw.funcArgs[3] + ', a6=' + context.raw.funcArgs[4] + ', a7=' + context.raw.funcArgs[5] + ')';
                        } else if (context.raw.funcRet) {
                          funcDesc = 'Return: ' + nameLabel + ' -> a2=' + context.raw.funcRet;
                        }
                      }

                      if (base && funcDesc) return [base, funcDesc];
                      if (funcDesc) return funcDesc;
                      return base ? base : null;
                    }
                    let label = context.dataset.label || '';
                    if (label) label += ': ';
                    if (context.parsed.y !== null) label += context.parsed.y;
                    return label;
                  }
                }
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
                title: { display: true, text: 'Time (ss:mmm:uuu)' },
                ticks: {
                  callback: function(value) {
                    const totalMicroseconds = Math.floor(value * 1000000);
                    const ss = Math.floor(totalMicroseconds / 1000000);
                    const mmm = Math.floor((totalMicroseconds % 1000000) / 1000);
                    const uuu = totalMicroseconds % 1000;
                    return String(ss).padStart(2, '0') + ':' + String(mmm).padStart(3, '0') + ':' + String(uuu).padStart(3, '0');
                  }
                }
              },
              yCDelta: {
                type: 'linear', display: true, position: 'left', stack: 'metrics', stackWeight: 2,
                title: { display: true, text: 'C-Delta' },
                grid: { drawOnChartArea: true }
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
                title: { display: true, text: 'INT' }, min: 0, max: 16,
                grid: { drawOnChartArea: true },
                ticks: { stepSize: 1 }
              },
              yRing: {
                type: 'linear', display: true, position: 'left', stack: 'metrics', stackWeight: 1,
                title: { display: true, text: 'RING' }, min: 0, max: 4,
                grid: { drawOnChartArea: true },
                ticks: { stepSize: 1 }
              },
              yUM: {
                type: 'linear', display: true, position: 'left', stack: 'metrics', stackWeight: 1,
                title: { display: true, text: 'UM' }, min: 0, max: 1.5,
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


        function renderSidebar() {
          const sidebar = document.getElementById('tree-sidebar');
          if (!sidebar) return;
          const root = document.createElement('div');
          
          let stack = [root];
          
          for (let i = 0; i < logData.length; i++) {
            const p = logData[i];
            if (p.funcAddr !== undefined) {
              if (p.funcArgs) {
                const nameLabel = p.funcName ? p.funcName : '0x' + p.funcAddr.toString(16);
                const details = document.createElement('details');
                const summary = document.createElement('summary');
                
                summary.textContent = nameLabel + ' (a2...a7: ' + p.funcArgs.join(', ') + ')';
                summary.onclick = (e) => {
                  if (window.myChart) {
                    const start = p.t / 38420000.0;
                    let end = start + (1000 / 38420000.0);
                    if (details.dataset.endT) {
                      end = parseFloat(details.dataset.endT) / 38420000.0;
                    }
                    const buffer = (end - start) * 0.1 || 0.000001;
                    window.myChart.options.scales.x.min = start - buffer;
                    window.myChart.options.scales.x.max = end + buffer;
                    window.myChart.update();
                  }
                };

                details.appendChild(summary);
                details.dataset.startT = p.t;
                
                stack[stack.length - 1].appendChild(details);
                stack.push(details);
              } else if (p.funcRet) {
                if (stack.length > 1) {
                  const currentDetails = stack.pop();
                  currentDetails.dataset.endT = p.t;
                  const sum = currentDetails.querySelector('summary');
                  if (sum) {
                    sum.textContent += ' -> a2=' + p.funcRet;
                  }
                }
              }
            }
          }
          sidebar.appendChild(root);
        }

        // Initialize Call-Stack sidebar automatically
        renderSidebar();

        function resetZoom() {
          if (window.myChart) {
            window.myChart.options.scales.x.min = undefined;
            window.myChart.options.scales.x.max = undefined;
            window.myChart.resetZoom();
          }
        }
      </script>
    </body>
    </html>
  `;
}
