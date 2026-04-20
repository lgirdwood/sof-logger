import { LogDataPoint, MemoryRegion } from './parser';

export function getWebviewContent(data: LogDataPoint[], symbols: any[] = [], regionsMeta: MemoryRegion[] = []): string {
  const timeFactor = 38420000.0;
  
  const umData = data.map(d => ({ x: d.t / timeFactor, y: d.um }));
  const ringData = data.map(d => ({ x: d.t / timeFactor, y: d.ring }));
  const intLevelData = data.map(d => ({ x: d.t / timeFactor, y: d.intLevel }));
  // Keep only essential primitives required for scatter point colors (exc, tlb, io)
  const callDepthData = data.map(d => ({ x: d.t / timeFactor, y: d.callDepth, exc: d.excCause, tlbType: d.tlbType, ioType: d.ioType }));

  const iMissData = data.map((d, i, arr) => {
    if (i === 0 || d.iMiss == null || arr[i - 1].iMiss == null) return { x: d.t / timeFactor, y: 0 };
    return { x: d.t / timeFactor, y: Math.max(0, (d.iMiss || 0) - (arr[i - 1].iMiss || 0)) };
  });

  const dMissData = data.map((d, i, arr) => {
    if (i === 0 || d.dMiss == null || arr[i - 1].dMiss == null) return { x: d.t / timeFactor, y: 0 };
    return { x: d.t / timeFactor, y: Math.max(0, (d.dMiss || 0) - (arr[i - 1].dMiss || 0)) };
  });

  const cDeltaData = data.map((d, i, arr) => {
    if (i === 0 || d.c == null || arr[i - 1].c == null) return { x: d.t / timeFactor, y: 0 };
    return { x: d.t / timeFactor, y: Math.max(0, (d.c || 0) - (arr[i - 1].c || 0)) };
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
        .toolbar { margin-bottom: 10px; display: flex; flex-wrap: wrap; gap: 5px; align-items: center; }
        .toolbar h2 { margin: 0; padding-right: 15px; font-size: 16px; }
        button { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 6px 12px; cursor: pointer; }
        button:hover { background: var(--vscode-button-hoverBackground); }
        .main-layout { display: flex; width: 100vw; height: 85vh; }
        .sidebar-wrapper { width: 30%; height: 100%; display: flex; flex-direction: column; border-right: 1px solid var(--vscode-panel-border); }
        .sidebar { flex-grow: 1; overflow-y: auto; overflow-x: auto; padding: 5px; box-sizing: border-box; }
        #treeSearch { width: 100%; box-sizing: border-box; margin-bottom: 5px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); padding: 6px; }
        .chart-container { width: 70%; height: 100%; position: relative; }
        details { margin-left: 12px; }
        summary { font-family: monospace; font-size: 11px; white-space: nowrap; padding: 2px; user-select: none; }
        summary:hover { background: var(--vscode-list-hoverBackground); }
        summary.selected { background-color: var(--vscode-list-activeSelectionBackground); color: var(--vscode-list-activeSelectionForeground); }
        .memory-map-layout { display: none; padding: 10px; overflow-y: auto; height: 85vh; }
        .memory-region { margin-bottom: 20px; }
        .memory-region h3 { border-bottom: 1px solid var(--vscode-panel-border); padding-bottom: 4px; }
        .map-scrollable { width: 100%; overflow-x: auto; overflow-y: hidden; background: var(--vscode-editor-background); padding: 5px; box-sizing: border-box; }
        .map-inner { width: calc(var(--map-zoom, 1) * 100%); transform-origin: left top; min-width: 100%; position: relative; }
        .memory-bank { border: 1px solid var(--vscode-editorGroup-border); margin-bottom: 8px; position: relative; background: var(--vscode-editor-background); height: 35px; box-sizing: border-box; overflow: hidden; background-image: repeating-linear-gradient(to right, transparent, transparent calc(6.25% - 1px), var(--vscode-editorGroup-border) 6.25%); }
        .mem-block { position: absolute; height: 100%; background: var(--vscode-editor-selectionBackground); border-right: 1px solid var(--vscode-editor-selectionForeground); overflow: hidden; font-size: 10px; display: flex; align-items: center; justify-content: center; color: var(--vscode-editor-foreground); cursor: pointer; box-sizing: border-box; }
        .mem-block:hover { background: var(--vscode-list-hoverBackground); }
        @keyframes mapFlash {
           0% { background: #ffff00 !important; color: #000 !important; box-shadow: 0 0 15px #ffff00, inset 0 0 10px #000; z-index: 100; }
           25% { background: #ff0000 !important; color: #fff !important; box-shadow: 0 0 25px #ff0000, inset 0 0 15px #fff; z-index: 100; transform: scaleY(1.3); }
           50% { background: #ffff00 !important; color: #000 !important; box-shadow: 0 0 15px #ffff00, inset 0 0 10px #000; z-index: 100; transform: scaleY(1.3); }
           75% { background: #ff0000 !important; color: #fff !important; box-shadow: 0 0 25px #ff0000, inset 0 0 15px #fff; z-index: 100; transform: scaleY(1.3); }
           100% { z-index: 100; transform: scaleY(1); }
        }
        .flash-target { animation: mapFlash 2s cubic-bezier(0.25, 0.1, 0.25, 1) !important; z-index: 100 !important; }
        .memory-map-layout::-webkit-scrollbar { display: none; }
        .map-scrollable::-webkit-scrollbar { display: none; }
        .memory-map-layout { -ms-overflow-style: none; scrollbar-width: none; }
        .map-scrollable { -ms-overflow-style: none; scrollbar-width: none; }
      </style>
    </head>
    <body>
      <div class="toolbar">
        <h2>QEMU Log Execution</h2>
        <button onclick="resetZoom()">Reset Zoom</button>
        <button id="toggleExceptionsBtn" onclick="toggleExceptions()">Toggle Exceptions (On)</button>
        <button id="toggleTlbBtn" onclick="toggleTlb()">Toggle TLB Events (On)</button>
        <button id="toggleIoBtn" onclick="toggleIo()">Toggle ACE IO (On)</button>
        <button onclick="toggleMemoryMap()">Toggle Memory Map</button>
        <div id="memory-map-legend" style="display: none; align-items: center; gap: 15px; margin-left: 20px; flex-wrap: wrap;">
          <div style="display: flex; align-items: center; gap: 5px;"><div style="width: 14px; height: 14px; background-color: rgba(211, 47, 47, 0.9); border: 1px solid rgba(255,255,255,0.4); border-radius: 3px;"></div><span style="font-size: 12px;">Heap Allocations</span></div>
          <div style="display: flex; align-items: center; gap: 5px;"><div style="width: 14px; height: 14px; background-color: rgba(25, 118, 210, 0.85); border: 1px solid rgba(255,255,255,0.4); border-radius: 3px;"></div><span style="font-size: 12px;">.text (Executable)</span></div>
          <div style="display: flex; align-items: center; gap: 5px;"><div style="width: 14px; height: 14px; background-color: rgba(56, 142, 60, 0.85); border: 1px solid rgba(255,255,255,0.4); border-radius: 3px;"></div><span style="font-size: 12px;">.rodata</span></div>
          <div style="display: flex; align-items: center; gap: 5px;"><div style="width: 14px; height: 14px; background-color: rgba(129, 199, 132, 0.85); border: 1px solid rgba(255,255,255,0.4); border-radius: 3px;"></div><span style="font-size: 12px;">.data</span></div>
          <div style="display: flex; align-items: center; gap: 5px;"><div style="width: 14px; height: 14px; background-color: rgba(123, 31, 162, 0.85); border: 1px solid rgba(255,255,255,0.4); border-radius: 3px;"></div><span style="font-size: 12px;">.bss</span></div>
        </div>
      </div>
      <div class="main-layout" id="mainLayout">
        <div class="sidebar-wrapper">
          <input type="text" id="treeSearch" placeholder="Search function traces..." onkeydown="if(event.key === 'Enter') searchTree(this.value)" />
          <div class="sidebar" id="tree-sidebar"></div>
        </div>
        <div class="chart-container">
          <canvas id="logChart"></canvas>
        </div>
      </div>
      <div class="memory-map-layout" id="memoryMapLayout">
        <div style="display: flex; gap: 20px; align-items: baseline; margin-bottom: 10px;">
          <h2>Visual Memory Map</h2>
          <input type="text" id="allocSearch" placeholder="Search allocations..." onkeydown="if(event.key === 'Enter') searchAllocs(this.value)" style="width: 300px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); padding: 5px;" />
        </div>
        <div style="display: flex; height: calc(100% - 40px); gap: 10px;">
          <div class="sidebar-wrapper" style="width: 25%; flex-shrink: 0; display: flex; flex-direction: column; border-right: 1px solid var(--vscode-panel-border); padding-right: 10px;">
             <h3 style="margin-top: 0; font-size: 14px;">Dynamic Allocations</h3>
             <div class="sidebar" id="alloc-sidebar" style="flex-grow: 1; overflow-y: auto; overflow-x: auto;"></div>
          </div>
          <div id="memory-map-container" style="flex-grow: 1; overflow-y: auto;"></div>
        </div>
      </div>

      <script>
        try {
        const logData = ${JSON.stringify(data)};
        const symbolsData = ${JSON.stringify(symbols)};
        const regionsMeta = ${JSON.stringify(regionsMeta)};
        const vscode = acquireVsCodeApi();

        let showExceptions = true;
        let showTlb = true;
        let showIo = true;

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

        document.getElementById('logChart').ondblclick = (e) => {
          if (!window.myChart) return;
          const xValue = window.myChart.scales.x.getValueForPixel(e.native ? e.native.offsetX : e.offsetX);
          if (xValue !== undefined) {
            const clickT = xValue * 38420000.0;
            const allDetails = document.querySelectorAll('#tree-sidebar details');
            let bestDetails = null;
            let minDuration = Infinity;

            for (let i = 0; i < allDetails.length; i++) {
              const el = allDetails[i];
              const startT = parseInt(el.dataset.startT, 10);
              const endT = el.dataset.endT ? parseInt(el.dataset.endT, 10) : Infinity;

              if (clickT >= startT && clickT <= endT) {
                const duration = endT - startT;
                if (duration <= minDuration) {
                  minDuration = duration;
                  bestDetails = el;
                }
              }
            }

            if (bestDetails) {
              const summary = bestDetails.querySelector('summary');
              if (summary && summary.dataset.file) {
                vscode.postMessage({ command: 'openSource', file: summary.dataset.file, line: parseInt(summary.dataset.line, 10) });
              }
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

            onClick: (e, elements, chart) => {
              // Convert the raw Canvas Pixel Click into an absolute execution timeline (in seconds)
              const xValue = chart.scales.x.getValueForPixel(e.native ? e.native.offsetX : e.x);
              if (xValue !== undefined) {
                // Restore integer Clock Tick formats (T) natively evaluated by QEMU logs
                const clickT = xValue * 38420000.0;
                
                const allDetails = document.querySelectorAll('#tree-sidebar details');
                let bestDetails = null;
                let minDuration = Infinity;

                for (let i = 0; i < allDetails.length; i++) {
                  const el = allDetails[i];
                  const startT = parseInt(el.dataset.startT, 10);
                  const endT = el.dataset.endT ? parseInt(el.dataset.endT, 10) : Infinity;

                  // Safely envelope functions wrapping the exact Millisecond Click Coordinate
                  if (clickT >= startT && clickT <= endT) {
                    const duration = endT - startT;
                    if (duration <= minDuration) {
                      minDuration = duration;
                      bestDetails = el;
                    }
                  }
                }

                if (bestDetails) {
                  const summary = bestDetails.querySelector('summary');
                  if (summary) {
                    const prev = document.querySelector('summary.selected');
                    if (prev) prev.classList.remove('selected');
                    summary.classList.add('selected');

                    let parent = bestDetails.parentElement;
                    while(parent && parent.id !== 'tree-sidebar') {
                      if (parent.tagName === 'DETAILS') parent.open = true;
                      parent = parent.parentElement;
                    }

                    summary.scrollIntoView({ block: 'center', behavior: 'smooth' });
                  }
                }
              }
            },
            plugins: {
              decimation: {
                enabled: true,
                algorithm: 'min-max'
              },
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
                      const d = logData[context.dataIndex];
                      let base = '';
                      if (showExceptions && d.excCause !== null && d.excCause !== undefined) {
                        base = 'Exception: EXCCAUSE ' + d.excCause;
                      } else if (showTlb && d.tlbType) {
                        base = 'TLB ' + d.tlbType + ' ' + (d.tlbDetails || '');
                      } else if (showIo && d.ioType) {
                        base = 'ACE IO: ' + (d.ioDevice || '') + ' ' + d.ioType.toUpperCase() + ' // ' + (d.ioDetails || '');
                      }

                      let funcDesc = '';
                      if (d.funcAddr !== undefined) {
                        const nameLabel = d.funcName ? d.funcName : '0x' + d.funcAddr.toString(16);
                        if (d.funcArgs) {
                          funcDesc = 'Entry: ' + nameLabel + '(a2=' + d.funcArgs[0] + ', a3=' + d.funcArgs[1] + ', a4=' + d.funcArgs[2] + ', a5=' + d.funcArgs[3] + ', a6=' + d.funcArgs[4] + ', a7=' + d.funcArgs[5] + ')';
                        } else if (d.funcRet) {
                          funcDesc = 'Return: ' + nameLabel + ' -> a2=' + d.funcRet;
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
                  mode: 'x',
                  modifierKey: 'ctrl' // Only Pan (re-render) when holding Ctrl
                },
                zoom: {
                  wheel: { enabled: true },
                  drag: { 
                    enabled: true,
                    backgroundColor: 'rgba(54, 162, 235, 0.3)', // Draw Selection Bounding Box without repainting
                    borderColor: 'rgb(54, 162, 235)',
                    borderWidth: 1
                  },
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
                grid: { drawOnChartArea: true }, grace: '20%'
              },
              yCallDepth: {
                type: 'linear', display: true, position: 'left', stack: 'metrics', stackWeight: 1.5,
                title: { display: true, text: 'Call Depth' }, suggestedMin: 0, grace: '20%',
                grid: { drawOnChartArea: true },
                ticks: { stepSize: 1 }
              },
              yDMiss: {
                type: 'linear', display: true, position: 'left', stack: 'metrics', stackWeight: 2,
                title: { display: true, text: 'D-Miss' },
                grid: { drawOnChartArea: true }, grace: '20%'
              },
              yIMiss: {
                type: 'linear', display: true, position: 'left', stack: 'metrics', stackWeight: 2,
                title: { display: true, text: 'I-Miss' },
                grid: { drawOnChartArea: true }, grace: '20%'
              },
              yRing: {
                type: 'linear', display: true, position: 'left', stack: 'metrics', stackWeight: 1,
                title: { display: true, text: 'RING' }, min: 0, max: 4,
                grid: { drawOnChartArea: true },
                ticks: { stepSize: 1 }
              },
              yIntLevel: {
                type: 'linear', display: true, position: 'left', stack: 'metrics', stackWeight: 1.5,
                title: { display: true, text: 'INTLEVEL' }, suggestedMin: 0, grace: '20%',
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
                
                if (p.file) {
                  summary.dataset.file = p.file;
                  if (p.line !== undefined) summary.dataset.line = p.line.toString();
                }

                summary.ondblclick = (e) => {
                  if (summary.dataset.file) {
                    vscode.postMessage({ command: 'openSource', file: summary.dataset.file, line: parseInt(summary.dataset.line, 10) });
                  }
                };

                summary.onclick = (e) => {
                  const prev = document.querySelector('summary.selected');
                  if (prev) prev.classList.remove('selected');
                  summary.classList.add('selected');

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

        function searchTree(query) {
          query = query.toLowerCase();
          const tree = document.getElementById('tree-sidebar');
          if (!tree) return;
          
          function traverse(node) {
            if (node.tagName === 'SUMMARY') return false;
            if (node.tagName === 'DETAILS') {
              const summary = node.querySelector('summary');
              const text = summary ? summary.textContent.toLowerCase() : '';
              let matches = text.includes(query);
              
              const children = node.children;
              for (let i = 0; i < children.length; i++) {
                if (children[i].tagName === 'DETAILS') {
                  const childMatches = traverse(children[i]);
                  if (childMatches) matches = true;
                }
              }
              
              node.style.display = matches ? '' : 'none';
              if (query && matches) node.open = true;
              return matches;
            }
            
            let anyMatch = false;
            const children = node.children;
            for (let i = 0; i < children.length; i++) {
              if (children[i].tagName === 'DETAILS') {
                if (traverse(children[i])) anyMatch = true;
              }
            }
            return anyMatch;
          }
          
          if (tree.firstChild) traverse(tree.firstChild);

          if (!query) {
            const selected = document.querySelector('summary.selected');
            if (selected) {
              selected.scrollIntoView({ block: 'center', behavior: 'smooth' });
            }
          }
        }

        function searchAllocs(query) {
           query = query.toLowerCase();
           const sidebar = document.getElementById('alloc-sidebar');
           if (!sidebar) return;
           const children = sidebar.children;
           for (let i = 0; i < children.length; i++) {
              const text = children[i].textContent.toLowerCase();
              if (text.includes(query)) children[i].style.display = 'block';
              else children[i].style.display = 'none';
           }
        }

        function resetZoom() {
          if (window.myChart) {
            window.myChart.options.scales.x.min = undefined;
            window.myChart.options.scales.x.max = undefined;
            window.myChart.resetZoom();
          }
        }

        function toggleMemoryMap() {
          const mainLayout = document.getElementById('mainLayout');
          const memLayout = document.getElementById('memoryMapLayout');
          const legend = document.getElementById('memory-map-legend');
          
          if (mainLayout.style.display === 'none') {
            mainLayout.style.display = 'flex';
            memLayout.style.display = 'none';
            if (legend) legend.style.display = 'none';
          } else {
            mainLayout.style.display = 'none';
            memLayout.style.display = 'block';
            if (legend) legend.style.display = 'flex';
            renderMemoryMap();
          }
        }

        function updateEdgeLabels() {
            document.querySelectorAll('.map-scrollable').forEach(scrollable => {
                const inner = scrollable.querySelector('.map-inner');
                if (!inner) return;
                
                // Use scroll measurements directly resolving bounding offsets relative to zoomed capacities
                const ratioLeft = scrollable.scrollLeft / inner.scrollWidth;
                const ratioRight = (scrollable.scrollLeft + scrollable.clientWidth) / inner.scrollWidth;
                
                scrollable.querySelectorAll('.bank-row').forEach(bDiv => {
                    // @ts-ignore
                    const bankBase = parseInt(bDiv.dataset.base, 10);
                    // @ts-ignore
                    const bankSize = parseInt(bDiv.dataset.size, 10);
                    
                    const leftAddr = bankBase + (ratioLeft * bankSize);
                    const rightAddr = bankBase + (ratioRight * bankSize);
                    
                    // Match precisely structural 4K page bounds rounding explicitly evaluating absolute chunks!
                    const pageLeft = Math.floor(leftAddr / 4096) * 4096;
                    // Cap right bound conservatively at bankLimit - 1 equivalent
                    const pageRight = Math.min((Math.ceil(rightAddr / 4096) * 4096) - 1, bankBase + bankSize - 1);
                    
                    const startL = bDiv.querySelector('.start-label');
                    const endL = bDiv.querySelector('.end-label');
                    if (startL) {
                        startL.textContent = '0x' + Math.max(bankBase, pageLeft).toString(16).toUpperCase();
                        startL.style.left = (scrollable.scrollLeft + 2) + 'px';
                    }
                    if (endL) {
                        endL.textContent = '0x' + pageRight.toString(16).toUpperCase();
                        endL.style.left = (scrollable.scrollLeft + scrollable.clientWidth - endL.offsetWidth - 2) + 'px';
                    }
                });
            });
        }

        let mapZoom = 1.0;
        let redrawTimeout = null;
        let baseZoom = 1.0;
        let visualPanX = 0;
        let visualPanY = 0;

        function renderMemoryMap() {
          const container = document.getElementById('memory-map-container');
          if (!container) return;
          if (container.children.length > 0) return; // already rendered

          let isDragging = false;
          let startX = 0;
          let startY = 0;
          let dxGlobal = 0;
          let scrollLeftStarts = [];
          let scrollTopStart = 0;
          let pendingZoomAnchor = null;
          const layoutContainer = document.getElementById('memoryMapLayout');

          function commitRedraw() {
              baseZoom = mapZoom;
              visualPanX = 0;
              visualPanY = 0;
              
              document.querySelectorAll('.map-scrollable').forEach(scrollable => {
                 const inner = scrollable.querySelector('.map-inner');
                 if (inner) {
                     inner.style.transform = '';
                     // @ts-ignore
                     inner.style.width = (mapZoom * 100) + '%';
                 }
              });
              
              document.querySelectorAll('.addr-marker').forEach(marker => {
                 // @ts-ignore
                 marker.style.display = (mapZoom >= parseFloat(marker.dataset.z)) ? 'block' : 'none';
              });
              
              if (pendingZoomAnchor) {
                  const scrolls = container.querySelectorAll('.map-scrollable');
                  if (scrolls.length > 0) {
                      const newWidth = scrolls[0].scrollWidth;
                      const newLeft = (newWidth * pendingZoomAnchor.ratio) - pendingZoomAnchor.pX;
                      scrolls.forEach(s => { s.scrollLeft = newLeft; });
                  }
                  pendingZoomAnchor = null;
              } else if (scrollLeftStarts.length > 0) {
                 const newLeft = scrollLeftStarts[0].startLeft - dxGlobal;
                 scrollLeftStarts.forEach(obj => { obj.el.scrollLeft = newLeft; });
              }
              
              updateEdgeLabels();
          }

          container.addEventListener('wheel', (e) => {
              e.preventDefault();
              let delta = e.deltaY > 0 ? -0.1 : 0.1;
              if (mapZoom >= 2.0) delta = e.deltaY > 0 ? -0.5 : 0.5;
              if (mapZoom >= 5.0) delta = e.deltaY > 0 ? -1.0 : 1.0;
              if (mapZoom >= 15.0) delta = e.deltaY > 0 ? -5.0 : 5.0;
              if (mapZoom >= 50.0) delta = e.deltaY > 0 ? -10.0 : 10.0;
              if (mapZoom >= 100.0) delta = e.deltaY > 0 ? -25.0 : 25.0;
              if (mapZoom >= 300.0) delta = e.deltaY > 0 ? -50.0 : 50.0;
              
              mapZoom = Math.max(0.1, Math.min(2000.0, mapZoom + delta));
              
              const scale = mapZoom / baseZoom;
              
              if (!pendingZoomAnchor) {
                  const scrolls = container.querySelectorAll('.map-scrollable');
                  if (scrolls.length > 0) {
                      const rect = scrolls[0].getBoundingClientRect();
                      const pX = e.clientX - rect.left;
                      const absX = scrolls[0].scrollLeft + pX;
                      pendingZoomAnchor = { ratio: absX / scrolls[0].scrollWidth, pX: pX, absX: absX };
                  }
              }

              if (pendingZoomAnchor) {
                  document.querySelectorAll('.map-inner').forEach(inner => {
                      // @ts-ignore
                      inner.style.transformOrigin = pendingZoomAnchor.absX + 'px center';
                      // @ts-ignore
                      inner.style.transform = 'scaleX(' + scale + ')';
                  });
              }
              
              clearTimeout(redrawTimeout);
              redrawTimeout = setTimeout(() => { commitRedraw(); }, 200);
          }, { passive: false });
          
          container.addEventListener('mousedown', (e) => {
             isDragging = true;
             startX = e.pageX;
             startY = e.pageY;
             dxGlobal = 0;
             scrollLeftStarts = Array.from(document.querySelectorAll('.map-scrollable')).map(s => ({
                el: s,
                startLeft: s.scrollLeft
             }));
             if (layoutContainer) scrollTopStart = layoutContainer.scrollTop;
             container.style.cursor = 'grabbing';
             clearTimeout(redrawTimeout);
          });

          window.addEventListener('mousemove', (e) => {
             if (!isDragging) return;
             e.preventDefault();
             dxGlobal = e.pageX - startX;
             const dy = e.pageY - startY;
             document.querySelectorAll('.map-inner').forEach(inner => {
                 // scaleX applies visual modifications without recomputing layouts!
                 // @ts-ignore
                 inner.style.transform = 'translateX(' + dxGlobal + 'px)';
             });
             
             if (layoutContainer) layoutContainer.scrollTop = scrollTopStart - dy;
          });

          window.addEventListener('mouseup', () => {
             if (isDragging) {
                isDragging = false;
                container.style.cursor = 'auto';
                clearTimeout(redrawTimeout);
                commitRedraw();
             }
          });
          
          let scrollDebounce = null;
          container.addEventListener('scroll', () => { 
             clearTimeout(scrollDebounce);
             scrollDebounce = setTimeout(() => { updateEdgeLabels(); }, 100);
          }, true);
          
          if (!symbolsData || symbolsData.length === 0) {
            container.innerHTML = '<p><i>Please use the "Load ELF Symbols" button successfully before tracing Hardware Memory allocations!</i></p>';
            return;
          }

          // --- EXTRACT DYNAMIC ALLOCATIONS FROM LOG DATA ---
          const coreStacks = {};
          const heapAllocs = [];

          function guessAllocSize(name, args) {
             if (!args) return 0;
             const n = name.toLowerCase();
             const a = args.map(x => parseInt(x, 16) || 0);

             // Evaluate exact argument indices based cleanly on alloc.c prototypes
             if (n.includes('virtual_heap_alloc')) return a[2]; // (heap, flags, bytes, align)
             if (n.includes('sof_heap_alloc')) return a[2]; // (heap, flags, bytes, align)
             if (n.includes('l3_heap_alloc')) return a[2]; // (heap, align, bytes)
             if (n.includes('heap_alloc_aligned')) return a[2]; // (heap, align, bytes)
             
             if (n.includes('rmalloc_align')) return a[1]; // (flags, bytes, alignment)
             if (n.includes('rmalloc')) return a[1]; // (flags, bytes)
             if (n.includes('rballoc_align')) return a[1]; // (flags, bytes, align)
             if (n.includes('rballoc')) return a[1]; // (flags, caps, bytes) occasionally
             
             if (n.includes('rzalloc')) return a[1]; // (flags, bytes)
             if (n.includes('rbrealloc') || n.includes('realloc')) return a[2]; // (ptr, flags, bytes, ...)
             if (n.includes('vmh_alloc')) return a[1]; // (heap, alloc_size)
             if (n.includes('vmh_alloc')) return a[1]; // (heap, alloc_size)
             
             if (n.includes('sys_heap_aligned_alloc')) return a[2]; // (heap, align, bytes)
             if (n.includes('sys_heap_alloc') || n.includes('z_malloc_heap')) return a[1]; // (heap, bytes)
             
             // Fallback iteration
             return a[2] || a[1] || a[0];
          }

           function guessAllocFlags(name, args) {
              if (!args) return '0x0';
              const n = name.toLowerCase();
              if (n.includes('virtual_heap_alloc')) return args[1];
              if (n.includes('sof_heap_alloc')) return args[1];
              if (n.includes('rbrealloc') || n.includes('realloc')) return args[1];
              if (n.includes('sys_heap_') || n.includes('z_malloc_')) return 'N/A';
              if (n.includes('l3_heap_alloc') || n.includes('heap_alloc_aligned')) return 'N/A';
              if (n.includes('vmh_alloc')) return 'N/A';
              return args[0]; // For rmalloc, rzalloc, rballoc
           }
          const pageAttributes = {};
          const tlbRanges = [];
          let lastTlbAttrObj = null;
          let lastTlbPaddr = null;
          logData.forEach((d) => {
             if (d.tlbDetails) {
                 const mtch = d.tlbDetails.match(/paddr=(0x[0-9a-f]+)\\s+asid=(0x[0-9a-f]+)\\s+attr=(0x[0-9a-f]+)(?:\\s+ring=(\\d))?/i);
                 if (mtch) {
                     lastTlbPaddr = parseInt(mtch[1], 16);
                     lastTlbAttrObj = { asid: mtch[2], attr: mtch[3], ring: mtch[4] };
                     const base4k = lastTlbPaddr - (lastTlbPaddr % 4096);
                     pageAttributes[base4k] = lastTlbAttrObj;
                 }
                 
                 const pgSizeMtch = d.tlbDetails.match(/page_size=(0x[0-9a-f]+)/i);
                 if (pgSizeMtch && lastTlbAttrObj && lastTlbPaddr !== null) {
                     const pageSize = parseInt(pgSizeMtch[1], 16);
                     const baseBase = lastTlbPaddr - (lastTlbPaddr % 4096);
                     
                     tlbRanges.push({ start: baseBase, end: baseBase + pageSize, attr: lastTlbAttrObj });
                     lastTlbAttrObj = null;
                     lastTlbPaddr = null;
                 }
             }
             
             const core = d.core !== undefined ? d.core : 0;
             if (!coreStacks[core]) coreStacks[core] = [];
             
             if (d.funcArgs) {
                // Entry Trace
                const deepStack = coreStacks[core].map(s => s.name);
                coreStacks[core].push({ 
                    name: d.funcName, 
                    args: d.funcArgs, 
                    isEntry: isAllocCall(d.funcName),
                    stackChain: deepStack,
                    sp: d.funcSp
                });
             } else if (d.funcRet && d.funcSp) {
                // Exit Trace
                // Function RET PCs don't natively match symbols (they are retw instructions).
                // Safely grab the corresponding stack frame structurally resolving SP alignments instead!
                if (coreStacks[core].length > 0) {
                   let matchIdx = -1;
                   for (let i = coreStacks[core].length - 1; i >= 0; i--) {
                       if (coreStacks[core][i].sp === d.funcSp) {
                           matchIdx = i;
                           break;
                       }
                   }
                   
                   if (matchIdx !== -1) {
                       const entryNode = coreStacks[core][matchIdx];
                       // Structurally pop this frame and everything above it implicitly aligning dropping corrupted bounds
                       coreStacks[core] = coreStacks[core].slice(0, matchIdx);
                       
                       const name = entryNode.name;
                       // Track dynamic allocations exactly closing execution boundaries structurally resolving parameters!
                       if (entryNode.isEntry && isAllocCall(name)) {
                           const size = guessAllocSize(name, entryNode.args);
                           const flags = guessAllocFlags(name, entryNode.args);
                            const ptr = parseInt(d.funcRet, 16);
                           if (size > 0 && ptr > 0) {
                              const callerName = entryNode.stackChain && entryNode.stackChain.length > 0 ? entryNode.stackChain[entryNode.stackChain.length - 1] : name;
                              heapAllocs.push({
                                  name: name,
                                  stackChain: entryNode.stackChain,
                                  addr: ptr,
                                  size: size,
                                  flags: flags,
                                  args: entryNode.args,
                                  sect: 'heap_dyn',
                                  file: symbolsData.find(s => s.name === callerName)?.file || symbolsData.find(s => s.name === name)?.file || '',
                                  line: symbolsData.find(s => s.name === callerName)?.line || symbolsData.find(s => s.name === name)?.line || 0
                              });
                           }
                       }
                   }
                }
             }
          });

          // We evaluate allocation components sequentially to correctly fold wrapper pointers (like rzalloc) possessing shifted address offsets safely into their exact originating vmh_alloc footprint seamlessly!
          const finalHeapAllocs = [];
          heapAllocs.forEach(alloc => {
              // Ignore any child beneath the fundamental physical boundary
              if (alloc.stackChain.includes('vmh_alloc') && alloc.name !== 'vmh_alloc') return;
              
              if (!alloc.visualName) {
                  alloc.visualName = alloc.name;
                  alloc.visualStack = alloc.stackChain || [];
              }
              
              // Scan backwards to find if this is just a wrapper finishing over its explicit internal payload.
              let replaced = false;
              for (let i = finalHeapAllocs.length - 1; i >= Math.max(0, finalHeapAllocs.length - 15); i--) {
                  const prev = finalHeapAllocs[i];
                  if (prev.stackChain && prev.stackChain.includes(alloc.name)) {
                      // It belongs to the same execution trace! The child (prev) contains the parent (alloc) natively.
                      // We overwrite the child's visual representation globally with the parent's parameters natively, 
                      // stripping the inner API from the TreeView dynamically!
                      prev.visualName = alloc.name;
                      prev.visualStack = alloc.stackChain || [alloc.name];
                      prev.args = alloc.args; // Update explicit arg strings explicitly for Sidebar
                      prev.file = alloc.file;
                      prev.line = alloc.line;
                      replaced = true;
                      break;
                  }
              }
              
              if (!replaced) {
                  finalHeapAllocs.push(alloc);
              }
          });

          // Append uniquely compiled dynamic structures targeting ELF Map arrays seamlessly
          finalHeapAllocs.forEach(alloc => {
             symbolsData.push(alloc);
          });
          
          // Populate allocation sidebar natively mimicking structural elements securely!
          const allocSidebar = document.getElementById('alloc-sidebar');
          if (allocSidebar) {
             allocSidebar.innerHTML = '';
             finalHeapAllocs.forEach(alloc => {
                 const rootNode = document.createElement('div');
                 rootNode.className = 'alloc-item';
                 rootNode.id = 'alloc-node-' + alloc.addr.toString(16);
                 rootNode.style.padding = '4px 6px';
                 rootNode.style.borderBottom = '1px solid var(--vscode-panel-border)';
                 
                 let currentContainer = rootNode;
                 const chain = alloc.visualStack || alloc.stackChain || [];
                 
                 chain.forEach((funcName, idx) => {
                    const details = document.createElement('details');
                    details.open = (idx === 0); 
                    const summary = document.createElement('summary');
                    summary.style.cursor = 'pointer';
                    summary.style.fontSize = '12px';
                    summary.style.padding = '2px 0';
                    summary.textContent = funcName;
                    
                    summary.ondblclick = (e) => {
                        e.stopPropagation();
                        const sym = symbolsData.find(s => s.name === funcName);
                        if (sym && sym.file) {
                            vscode.postMessage({ command: 'openSource', file: sym.file, line: sym.line || 1 });
                        }
                    };
                    
                    details.appendChild(summary);
                    
                    const innerContainer = document.createElement('div');
                    innerContainer.style.paddingLeft = '15px';
                    innerContainer.style.borderLeft = '1px dashed var(--vscode-editorGroup-border)';
                    innerContainer.style.marginLeft = '5px';
                    
                    details.appendChild(innerContainer);
                    currentContainer.appendChild(details);
                    
                    currentContainer = innerContainer;
                 });
                 
                 const allocDetails = document.createElement('details');
                 allocDetails.open = true;
                 const allocSummary = document.createElement('summary');
                 allocSummary.style.cursor = 'pointer';
                 allocSummary.style.fontSize = '12px';
                 allocSummary.style.color = '#e53935'; 
                 allocSummary.style.fontWeight = 'bold';
                 allocSummary.textContent = alloc.visualName || alloc.name;
                 
                 allocSummary.ondblclick = (e) => {
                     e.stopPropagation();
                     const sym = symbolsData.find(s => s.name === (alloc.visualName || alloc.name));
                     if (sym && sym.file) {
                         vscode.postMessage({ command: 'openSource', file: sym.file, line: sym.line || 1 });
                     }
                 };
                 
                 allocDetails.appendChild(allocSummary);
                 
                 const resContainer = document.createElement('div');
                 resContainer.style.paddingLeft = '15px';
                 resContainer.style.borderLeft = '1px dashed var(--vscode-editorGroup-border)';
                 resContainer.style.marginLeft = '5px';
                 resContainer.style.fontSize = '12px';
                 resContainer.style.color = '#e2863b';
                 resContainer.style.lineHeight = '1.4';
                 
                 let htmlText = '<b>Size:</b> ' + alloc.size + ' B<br/>';
                 if (alloc.flags !== 'N/A') htmlText += '<b>Flags:</b> ' + alloc.flags + '<br/>';
                 htmlText += '<b>Ret Addr:</b> 0x' + alloc.addr.toString(16).toUpperCase() + '<br/>';
                 htmlText += '<span style="font-size:10px; color:var(--vscode-descriptionForeground)">(' + alloc.args.join(', ') + ')</span>';
                 
                 resContainer.innerHTML = htmlText;
                 
                 allocDetails.appendChild(resContainer);
                 currentContainer.appendChild(allocDetails);
                 // Remove generic rootNode.ondblclick handler isolating execution targets inherently
                 
                 rootNode.onclick = (e) => {
                    const blockTarget = document.getElementById('mem-block-' + alloc.addr.toString(16));
                    if (blockTarget) {
                        mapZoom = 50.0;
                        document.querySelectorAll('.map-inner').forEach(inner => {
                           // @ts-ignore
                           inner.style.width = (mapZoom * 100) + '%';
                        });
                        setTimeout(() => {
                           blockTarget.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
                           blockTarget.classList.remove('flash-target');
                           void blockTarget.offsetWidth; // Trigger DOM reflow seamlessly
                           blockTarget.classList.add('flash-target');
                        }, 50);
                    }
                 };
                 
                 allocSidebar.appendChild(rootNode);
              });
          }
          // ----------------------------------------------------

          let regions = {};
          if (regionsMeta && regionsMeta.length > 0) {
             regionsMeta.forEach(r => { regions[r.name] = []; });
          } else {
             regions = { 'IMR': [], 'LPSRAM': [], 'HPSRAM': [] };
          }
          
          symbolsData.forEach(sym => {
            if (sym.size > 0) {
              let rName = '';
              if (regionsMeta && regionsMeta.length > 0) {
                 const matched = regionsMeta.find(r => sym.addr >= r.start && sym.addr < r.end);
                 if (matched) rName = matched.name;
                 else {
                   const prefix = sym.addr >>> 20;
                   if (prefix === 0xA00) rName = 'hp-sram (deferred)';
                   else if (prefix === 0xA01 || prefix === 0xA10) rName = 'lp-sram (overflow)';
                 }
              } else {
                 const prefix = sym.addr >>> 20; 
                 if (prefix === 0xA00) rName = 'HPSRAM';
                 else if (prefix === 0xA01 || prefix === 0xA10) {
                   if (sym.addr >= 0xA1040000 && sym.addr < 0xA1060000) rName = 'IMR';
                   else rName = 'LPSRAM';
                 }
              }
              if (rName) {
                 if (!regions[rName]) regions[rName] = [];
                 regions[rName].push(sym);
              }
            }
          });

          const activeRegions = Object.keys(regions)
            .map(rName => {
               const sortedSyms = regions[rName].sort((a,b) => a.addr - b.addr);
               let base = sortedSyms[0] ? sortedSyms[0].addr : 0;
               if (regionsMeta && regionsMeta.length > 0) {
                  const rm = regionsMeta.find(r => r.name === rName);
                  if (rm) base = rm.start;
               }
               return { name: rName, base: base, syms: sortedSyms };
            })
            .sort((a,b) => a.base - b.base);

          activeRegions.forEach(regionData => {
            const rName = regionData.name;
            const sorted = regionData.syms;
            let sumSize = 0;
            sorted.forEach(s => sumSize += s.size);

            const rDiv = document.createElement('div');
            rDiv.className = 'memory-region';
            const rTitle = document.createElement('h3');
            rTitle.textContent = rName + ' (Total Explicit Load: ' + sumSize + ' bytes, Objects: ' + regions[rName].length + ')';
            rDiv.appendChild(rTitle);

            const blocksDiv = document.createElement('div');
            blocksDiv.className = 'memory-blocks';
            blocksDiv.style.display = 'block'; // Override flex, we will use individual bank rows natively
            
            // Resolve boundary arrays
            let minAddr = sorted[0] ? sorted[0].addr : 0;
            let maxAddr = sorted.length ? sorted[sorted.length - 1].addr + sorted[sorted.length - 1].size : 0;

            if (regionsMeta && regionsMeta.length > 0) {
               const rm = regionsMeta.find(r => r.name === rName);
               if (rm) {
                  minAddr = rm.start;
                  maxAddr = rm.end + 1;
               }
            }

            const bankSize = 262144; // 256KB Explicit Hardware Bank Array Constraints
            minAddr = Math.floor(minAddr / bankSize) * bankSize; // Protect against JS 32-bit signed bitwise limits safely
            const bankCount = Math.ceil((maxAddr - minAddr) / bankSize) || 1;
            
            for (let idx = 0; idx < bankCount; idx++) {
              const bankBase = minAddr + (idx * bankSize);
              const bankLimit = bankBase + bankSize;
              
              const insideBank = sorted.filter(s => s.addr < bankLimit && (s.addr + s.size) > bankBase);
              
              const bDiv = document.createElement('div');
              bDiv.className = 'memory-bank';
              bDiv.style.position = 'relative';
              bDiv.style.height = '35px';
              bDiv.style.marginBottom = '6px';
              bDiv.style.backgroundColor = 'rgba(0,0,0,0.1)';
              bDiv.style.border = '1px solid var(--vscode-editorGroup-border)';
              bDiv.title = rName + ' Row ' + idx + ' (0x' + bankBase.toString(16).toUpperCase() + ')';
              bDiv.className = 'bank-row';
              bDiv.dataset.base = bankBase.toString();
              bDiv.dataset.size = bankSize.toString();
              
              const startLabel = document.createElement('span');
              startLabel.className = 'start-label';
              startLabel.textContent = '0x' + bankBase.toString(16).toUpperCase();
              startLabel.style.position = 'absolute';
              startLabel.style.left = '2px';
              startLabel.style.top = '2px';
              startLabel.style.fontSize = '10px';
              startLabel.style.color = '#fff';
              startLabel.style.background = 'rgba(0,0,0,0.6)';
              startLabel.style.padding = '0 3px';
              startLabel.style.zIndex = '5';
              
              const endLabel = document.createElement('span');
              endLabel.className = 'end-label';
              endLabel.textContent = '0x' + (bankLimit - 1).toString(16).toUpperCase();
              endLabel.style.position = 'absolute';
              endLabel.style.left = '100px'; // Set dynamically by Javascript updateEdgeLabels
              endLabel.style.top = '2px';
              endLabel.style.fontSize = '10px';
              endLabel.style.color = '#fff';
              endLabel.style.background = 'rgba(0,0,0,0.6)';
              endLabel.style.padding = '0 3px';
              endLabel.style.zIndex = '5';
              
              bDiv.appendChild(startLabel);
              bDiv.appendChild(endLabel);
              
              for (let offset = 4096; offset < bankSize; offset += 4096) {
                   const label = document.createElement('span');
                   label.textContent = '0x' + (bankBase + offset).toString(16).toUpperCase();
                   label.style.position = 'absolute';
                   label.style.left = ((offset / bankSize) * 100) + '%';
                   label.style.top = '2px';
                   label.style.fontSize = '9px';
                   label.style.color = 'rgba(255,255,255,0.7)';
                   label.style.background = 'rgba(0,0,0,0.5)';
                   label.style.padding = '0 2px';
                   label.style.zIndex = '4';
                   label.style.transform = 'translate(-50%, 0)';
                   label.style.pointerEvents = 'none';
                   label.className = 'addr-marker';
                   
                   if (offset % 65536 === 0) label.dataset.z = '2.0';
                   else if (offset % 32768 === 0) label.dataset.z = '5.0';
                   else if (offset % 16384 === 0) label.dataset.z = '12.0';
                   else if (offset % 8192 === 0) label.dataset.z = '25.0';
                   else label.dataset.z = '50.0';
                   
                   label.style.display = (mapZoom >= parseFloat(label.dataset.z)) ? 'block' : 'none';
                   bDiv.appendChild(label);
              }

              const pagePct = (4096 / bankSize) * 100;
              bDiv.style.backgroundImage = 'linear-gradient(to right, transparent calc(100% - 1px), var(--vscode-editorGroup-border) 100%)';
              bDiv.style.backgroundSize = pagePct + '% 100%';
              
              insideBank.forEach(sym => {
                const sb = createMemBlock(sym, bankBase, bankSize);
                bDiv.appendChild(sb);
              });
              blocksDiv.appendChild(bDiv);
              
              const ringRow = document.createElement('div');
              const asidRow = document.createElement('div');
              const attrRow = document.createElement('div');
              
              const rowStyle = 'display: flex; width: 100%; height: 12px; margin-bottom: 1px;';
              ringRow.style.cssText = rowStyle;
              asidRow.style.cssText = rowStyle;
              attrRow.style.cssText = rowStyle + 'margin-bottom: 6px;';
              
              for (let offset = 0; offset < bankSize; offset += 4096) {
                  const pg = bankBase + offset;
                  
                  let extRing = null;
                  let extAsid = null;
                  let extAttr = null;
                  
                  for (let i = tlbRanges.length - 1; i >= 0; i--) {
                      if (pg >= tlbRanges[i].start && pg < tlbRanges[i].end) {
                          if (extRing === null && tlbRanges[i].attr.ring !== undefined) extRing = tlbRanges[i].attr.ring;
                          if (extAsid === null && tlbRanges[i].attr.asid !== undefined) extAsid = tlbRanges[i].attr.asid;
                          if (extAttr === null && tlbRanges[i].attr.attr !== undefined) extAttr = tlbRanges[i].attr.attr;
                          if (extRing !== null && extAsid !== null && extAttr !== null) break;
                      }
                  }
                  
                  const rootPg = pageAttributes[pg] || { ring: '0', asid: '0x0', attr: '0x0' };
                  if (extRing === null) extRing = rootPg.ring !== undefined ? rootPg.ring : '0';
                  if (extAsid === null) extAsid = rootPg.asid !== undefined ? rootPg.asid : '0x0';
                  if (extAttr === null) extAttr = rootPg.attr !== undefined ? rootPg.attr : '0x0';
                  
                  const pgAttr = { ring: extRing, asid: extAsid, attr: extAttr };
                  
                  const rDiv = document.createElement('div');
                  const aDiv = document.createElement('div');
                  const atDiv = document.createElement('div');
                  
                  const cellStyle = 'flex: 1; border: 1px solid var(--vscode-editorGroup-border); box-sizing: border-box; font-size: 8px; text-align: center; overflow: hidden; display: flex; align-items: center; justify-content: center;';
                  
                  rDiv.style.cssText = cellStyle;
                  aDiv.style.cssText = cellStyle;
                  atDiv.style.cssText = cellStyle;
                  
                  const r = pgAttr.ring || '?';
                  const asidNode = pgAttr.asid === '0xff' ? 'FF' : pgAttr.asid.replace('0x', '');
                  const attrHex = pgAttr.attr.replace('0x', '').toUpperCase();
                  
                  const attrAbbrev = {
                      '0': 'Ill',
                      '1': 'WT KRW',
                      '2': 'WT KRWX',
                      '3': 'Bypass',
                      '4': 'WB KRW',
                      '5': 'WB KRWX',
                      '6': 'WB URW',
                      '7': 'WB URWX',
                      '8': 'WT URW',
                      '9': 'WT URWX',
                      'A': 'UG KRW',
                      'B': 'UG KRWX',
                      'C': 'UG URW',
                      'D': 'UG URWX',
                      'E': 'Isolated',
                      'F': 'UC KRWX'
                  };
                  const attrTitles = {
                      '0': 'Illegal / Unmapped (Triggers exception)',
                      '1': 'Write-Through, Kernel (R/W)',
                      '2': 'Write-Through, Kernel (R/W/X)',
                      '3': 'Cache Bypass, Full R/W/X for ALL Rings (Power-On)',
                      '4': 'Write-Back, Kernel (R/W)',
                      '5': 'Write-Back, Kernel (R/W/X)',
                      '6': 'Write-Back, Userspace (R/W)',
                      '7': 'Write-Back, Userspace (R/W/X)',
                      '8': 'Write-Through, Userspace (R/W)',
                      '9': 'Write-Through, Userspace (R/W/X)',
                      'A': 'Cache Bypass, Kernel (R/W)',
                      'B': 'Cache Bypass, Kernel (R/W/X)',
                      'C': 'Cache Bypass, Userspace (R/W)',
                      'D': 'Cache Bypass, Userspace (R/W/X)',
                      'E': 'Platform Specific / Isolated RAM',
                      'F': 'Cache Bypass, Kernel R/W/X (MMIO / Dev Regs)'
                  };
                  
                  rDiv.textContent = 'R:' + r;
                  aDiv.textContent = 'A:' + asidNode;
                  atDiv.textContent = attrAbbrev[attrHex] || attrHex;
                  
                  const attrDesc = attrTitles[attrHex] ? ' (' + attrTitles[attrHex] + ')' : '';
                  const titleStr = 'Page: 0x' + pg.toString(16).toUpperCase() + '\\nASID: ' + pgAttr.asid + '\\nAttr: ' + pgAttr.attr + attrDesc + (r !== '?' ? '\\nRing: ' + r : '');
                  rDiv.title = titleStr;
                  aDiv.title = titleStr;
                  atDiv.title = titleStr;
                  
                  const defBg = 'rgba(56, 142, 60, 0.3)';
                  const diffBg = 'rgba(211, 47, 47, 0.4)';
                  
                  rDiv.style.backgroundColor = (r === '0') ? defBg : diffBg;
                  aDiv.style.backgroundColor = (asidNode === '0') ? defBg : diffBg;
                  atDiv.style.backgroundColor = (attrHex === '0') ? defBg : diffBg;
                  
                  rDiv.style.color = '#fff';
                  aDiv.style.color = '#fff';
                  atDiv.style.color = '#fff';
                  
                  ringRow.appendChild(rDiv);
                  asidRow.appendChild(aDiv);
                  attrRow.appendChild(atDiv);
              }
              blocksDiv.appendChild(ringRow);
              blocksDiv.appendChild(asidRow);
              blocksDiv.appendChild(attrRow);
            }
            
            const mapScroll = document.createElement('div');
            mapScroll.className = 'map-scrollable';
            const mapInner = document.createElement('div');
            mapInner.className = 'map-inner';
            mapInner.appendChild(blocksDiv);
            mapScroll.appendChild(mapInner);
            
            rDiv.appendChild(mapScroll);
            container.appendChild(rDiv);
          });
        }
        
        // Truncate evaluation logic below 'vmh_alloc' because internal parameters duplicate pointer shifts corrupting boundaries.
        function isAllocCall(name, stackChain = []) {
           if (!name) return false;
           if (stackChain.includes('vmh_alloc')) return false;
           const n = name.toLowerCase();
           if (n.includes('free') || n.includes('chunk')) return false;
           return n.includes('alloc') || n.includes('rzalloc') || n.includes('vmh_alloc') || n.includes('heap_alloc');
        }

        function createMemBlock(sym, baseAddr, planeSize) {
           const sb = document.createElement('div');
           sb.className = 'mem-block';
           sb.id = 'mem-block-' + sym.addr.toString(16);
           sb.style.position = 'absolute';
           sb.style.height = '100%';

           let bg = 'var(--vscode-editor-selectionBackground)';
           let fg = '#fff';

           // Explicitly intercept and mark Heap Allocations in High Contrast Red natively 
           if (sym.sect === 'heap_dyn' || (sym.name && sym.name.toLowerCase().includes('heap'))) {
               bg = 'rgba(211, 47, 47, 0.4)'; // Red
               fg = '#fff';
           } else if (sym.sect === 'text') {
               bg = 'rgba(25, 118, 210, 0.4)'; // Blue
           } else if (sym.sect === 'rodata') {
               bg = 'rgba(56, 142, 60, 0.4)'; // Green
           } else if (sym.sect === 'data') { 
               bg = 'rgba(129, 199, 132, 0.4)'; // Light Green
               fg = '#000'; 
           } else if (sym.sect === 'bss') {
               bg = 'rgba(123, 31, 162, 0.4)'; // Purple
           }

           sb.style.backgroundColor = bg;
           sb.style.borderRight = '1px solid rgba(255,255,255,0.3)';
           sb.style.overflow = 'hidden';
           sb.style.display = 'flex';
           sb.style.alignItems = 'center';
           sb.style.justifyContent = 'center';
           sb.style.fontSize = '10px';
           sb.style.color = fg;
           sb.style.cursor = 'pointer';
           
           const offset = Math.max(0, sym.addr - baseAddr);
           // Calculate mapped proportional explicit geometries strictly capping over structural frames
           const visibleSize = Math.min(sym.size, planeSize - offset); 
           
           sb.style.left = ((offset / planeSize) * 100) + '%';
           sb.style.width = ((visibleSize / planeSize) * 100) + '%';
           
           let displayName = sym.name;
           if (sym.stackChain && sym.stackChain.length > 0) {
               displayName = sym.stackChain[sym.stackChain.length - 1]; 
               for (let i = sym.stackChain.length - 1; i >= 0; i--) {
                   if (!isAllocCall(sym.stackChain[i])) {
                       displayName = sym.stackChain[i];
                       break;
                   }
               }
           }

           let titleText = displayName + ' \\nAddr: 0x' + sym.addr.toString(16) + '\\nLayout Size: ' + sym.size + ' bytes';
           if (sym.file) titleText += '\\nFile: ' + sym.file + ':' + (sym.line || 1);
           sb.title = titleText;
           
           // Natively drop internal textual overlays truncating visually dense geometries
           if (((visibleSize / planeSize) * 100) > 3) sb.textContent = displayName; 
           
           sb.ondblclick = (e) => {
               e.stopPropagation();
               if (sym.sect === 'heap_dyn' && sym.caller) {
                   const callerSym = symbolsData.find(s => s.name === sym.caller);
                   if (callerSym && callerSym.file) {
                       vscode.postMessage({ command: 'openSource', file: callerSym.file, line: callerSym.line || 1 });
                   } else if (sym.file) {
                       vscode.postMessage({ command: 'openSource', file: sym.file, line: sym.line || 1 });
                   }
               } else if (sym.file) {
                   vscode.postMessage({ command: 'openSource', file: sym.file, line: sym.line || 1 });
               }
           };
           
           sb.onclick = (e) => {
               e.stopPropagation();
               const allocNode = document.getElementById('alloc-node-' + sym.addr.toString(16));
               if (allocNode) {
                    const blockTarget = document.getElementById('mem-block-' + sym.addr.toString(16));
                    if (blockTarget) {
                        blockTarget.classList.remove('flash-target');
                        void blockTarget.offsetWidth;
                        blockTarget.classList.add('flash-target');
                    }
                    
                    const summaries = allocNode.querySelectorAll('summary');
                    if (summaries && summaries.length > 0) {
                        const prev = document.querySelector('.alloc-item summary.selected');
                        if (prev) prev.classList.remove('selected');
                        summaries[0].classList.add('selected');
                    }
                    
                    allocNode.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    // Open the top-level details recursively evaluating structural hierarchies seamlessly!
                    const detailsNode = allocNode.querySelector('details');
                    if (detailsNode) detailsNode.open = true;
               }
           };

           return sb;
        }
        } catch (e) {
            document.body.innerHTML = '<h1 style="color:red;">Exception Caught</h1><pre style="color:red;white-space:pre-wrap;">' + e.message + '\\n' + e.stack + '</pre>';
            console.error(e);
        }
      </script>
    </body>
    </html>
  `;
}
