import { LogDataPoint, MemoryRegion } from './parser';

export function getWebviewContent(data: LogDataPoint[], symbols: any[] = [], regionsMeta: MemoryRegion[] = []): string {
  const timeFactor = 38420000.0;
  
  const umData = data.map(d => ({ x: d.t / timeFactor, y: d.um }));
  const ringData = data.map(d => ({ x: d.t / timeFactor, y: d.ring }));
  const intLevelData = data.map(d => ({ x: d.t / timeFactor, y: d.intLevel }));
  // Keep only essential primitives required for scatter point colors (exc, tlb, io)
  const callDepthData = data.map(d => ({ x: d.t / timeFactor, y: d.callDepth, exc: d.excCause, tlbType: d.tlbType, ioType: d.ioType }));

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
        .toolbar { margin-bottom: 10px; display: flex; flex-wrap: wrap; gap: 5px; align-items: center; }
        .toolbar h2 { margin: 0; padding-right: 15px; font-size: 16px; }
        button { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 6px 12px; cursor: pointer; }
        button:hover { background: var(--vscode-button-hoverBackground); }
        .main-layout { display: flex; width: 100vw; height: 85vh; }
        .sidebar-wrapper { width: 30%; height: 100%; display: flex; flex-direction: column; border-right: 1px solid var(--vscode-panel-border); }
        .sidebar { flex-grow: 1; overflow-y: auto; padding: 5px; box-sizing: border-box; }
        #treeSearch { width: 100%; box-sizing: border-box; margin-bottom: 5px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); padding: 6px; }
        .chart-container { width: 70%; height: 100%; position: relative; }
        details { margin-left: 12px; }
        summary { font-family: monospace; font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding: 2px; user-select: none; }
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
        <h2>Visual Memory Map</h2>
        <div id="memory-map-container"></div>
      </div>

      <script>
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

        let mapZoom = 1.0;
        function handleMapZoom(e) {
          e.preventDefault();
          let delta = e.deltaY > 0 ? -0.1 : 0.1;
          if (mapZoom > 2.0) delta = e.deltaY > 0 ? -0.5 : 0.5;
          if (mapZoom > 5.0) delta = e.deltaY > 0 ? -1.0 : 1.0;
          
          const newZoom = Math.max(1.0, Math.min(30.0, mapZoom + delta));
          if (newZoom === mapZoom) return;
          
          const allData = Array.from(document.querySelectorAll('.map-scrollable')).map(scrollable => {
             const rect = scrollable.getBoundingClientRect();
             const pX = e.clientX - rect.left;
             const oldScroll = scrollable.scrollLeft;
             const mapInner = scrollable.querySelector('.map-inner');
             const oldWidth = mapInner ? mapInner.offsetWidth : 1;
             return { scrollable, pX, oldScroll, mapInner, oldWidth };
          });

          mapZoom = newZoom;
          
          const inners = document.querySelectorAll('.map-inner');
          inners.forEach(inner => {
             // @ts-ignore
             inner.style.width = (mapZoom * 100) + '%';
          });
          
          allData.forEach(d => {
             if (!d.mapInner) return;
             const newWidth = d.mapInner.offsetWidth;
             const ratio = (d.oldScroll + d.pX) / d.oldWidth;
             d.scrollable.scrollLeft = (ratio * newWidth) - d.pX;
          });
        }

        function renderMemoryMap() {
          const container = document.getElementById('memory-map-container');
          if (!container) return;
          if (container.children.length > 0) return; // already rendered
          
          container.addEventListener('wheel', handleMapZoom, { passive: false });
          
          let isDragging = false;
          let startX = 0;
          let startY = 0;
          let scrollLeftStarts = [];
          let scrollTopStart = 0;
          const layoutContainer = document.getElementById('memoryMapLayout');

          container.addEventListener('mousedown', (e) => {
             isDragging = true;
             startX = e.pageX;
             startY = e.pageY;
             scrollLeftStarts = Array.from(document.querySelectorAll('.map-scrollable')).map(s => ({
                el: s,
                startLeft: s.scrollLeft
             }));
             if (layoutContainer) scrollTopStart = layoutContainer.scrollTop;
             container.style.cursor = 'grabbing';
          });

          window.addEventListener('mousemove', (e) => {
             if (!isDragging) return;
             e.preventDefault();
             const dx = e.pageX - startX;
             const dy = e.pageY - startY;
             scrollLeftStarts.forEach(obj => {
                obj.el.scrollLeft = obj.startLeft - dx;
             });
             if (layoutContainer) layoutContainer.scrollTop = scrollTopStart - dy;
          });

          window.addEventListener('mouseup', () => {
             if (isDragging) {
                isDragging = false;
                container.style.cursor = 'auto';
             }
          });
          
          if (!symbolsData || symbolsData.length === 0) {
            container.innerHTML = '<p><i>Please use the "Load ELF Symbols" button successfully before tracing Hardware Memory allocations!</i></p>';
            return;
          }

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
              
              const startLabel = document.createElement('span');
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
              endLabel.textContent = '0x' + (bankLimit - 1).toString(16).toUpperCase();
              endLabel.style.position = 'absolute';
              endLabel.style.right = '2px';
              endLabel.style.top = '2px';
              endLabel.style.fontSize = '10px';
              endLabel.style.color = '#fff';
              endLabel.style.background = 'rgba(0,0,0,0.6)';
              endLabel.style.padding = '0 3px';
              endLabel.style.zIndex = '5';
              
              bDiv.appendChild(startLabel);
              bDiv.appendChild(endLabel);

              const pagePct = (4096 / bankSize) * 100;
              bDiv.style.backgroundImage = 'repeating-linear-gradient(to right, transparent, transparent calc(' + pagePct + '% - 1px), var(--vscode-editorGroup-border) ' + pagePct + '%)';
              
              insideBank.forEach(sym => {
                const sb = createMemBlock(sym, bankBase, bankSize);
                bDiv.appendChild(sb);
              });
              blocksDiv.appendChild(bDiv);
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
        
        function createMemBlock(sym, baseAddr, planeSize) {
           const sb = document.createElement('div');
           sb.className = 'mem-block';
           sb.style.position = 'absolute';
           sb.style.height = '100%';

           let bg = 'var(--vscode-editor-selectionBackground)';
           let fg = '#fff';

           // Explicitly intercept and mark Heap Allocations in High Contrast Red natively 
           if (sym.name && sym.name.toLowerCase().includes('heap')) {
               bg = 'rgba(211, 47, 47, 0.9)'; // Red
               fg = '#fff';
           } else if (sym.sect === 'text') {
               bg = 'rgba(25, 118, 210, 0.85)'; // Blue
           } else if (sym.sect === 'rodata') {
               bg = 'rgba(56, 142, 60, 0.85)'; // Green
           } else if (sym.sect === 'data') { 
               bg = 'rgba(129, 199, 132, 0.85)'; // Light Green
               fg = '#000'; 
           } else if (sym.sect === 'bss') {
               bg = 'rgba(123, 31, 162, 0.85)'; // Purple
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
           
           let titleText = sym.name + ' \\nAddr: 0x' + sym.addr.toString(16) + '\\nLayout Size: ' + sym.size + ' bytes';
           if (sym.file) titleText += '\\nFile: ' + sym.file + ':' + (sym.line || 1);
           sb.title = titleText;
           
           // Natively drop internal textual overlays truncating visually dense geometries
           if (((visibleSize / planeSize) * 100) > 3) sb.textContent = sym.name; 
           
           if (sym.file) {
             sb.onclick = () => {
               vscode.postMessage({ command: 'openSource', file: sym.file, line: sym.line || 1 });
             };
           }
           return sb;
        }
      </script>
    </body>
    </html>
  `;
}
