        // Core Entrypoint mapping strictly synchronized telemetry variables 
        // into dynamically scaled DOM element geometries (Chart.JS) natively.
        function initChartAndUI(cDeltaData, callDepthData, umData, ringData, exceptionData, intLevelData, iMissData, dMissData) {
        try {
          const ctx = document.getElementById('logChart').getContext('2d');
        
        const datasets = [
          {
            label: 'CCOUNT Delta',
            data: cDeltaData,
            borderColor: 'rgb(201, 203, 207)',
            backgroundColor: 'rgba(201, 203, 207, 0.1)',
            yAxisID: 'yCDelta',
            stepped: true,
            borderWidth: 2,
            tension: 0
          },
          {
            label: 'Call Depth',
            data: callDepthData,
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
            data: umData,
            borderColor: 'rgb(75, 192, 192)',
            backgroundColor: 'rgba(75, 192, 192, 0.1)',
            yAxisID: 'yUM',
            stepped: true,
            borderWidth: 2,
            tension: 0
          },
          {
            label: 'RING',
            data: ringData,
            borderColor: 'rgb(153, 102, 255)',
            backgroundColor: 'rgba(153, 102, 255, 0.1)',
            yAxisID: 'yRing',
            stepped: true,
            borderWidth: 2,
            tension: 0,
            pointStyle: function(context) { return 'circle'; },
            pointRadius: 0,
            pointBackgroundColor: 'rgba(0,0,0,0)',
            pointBorderColor: 'rgba(0,0,0,0)'
          },
          {
            label: 'Exceptions',
            data: exceptionData,
            borderColor: 'rgba(0,0,0,0)',
            backgroundColor: 'rgba(0,0,0,0)',
            yAxisID: 'yRing',
            showLine: false,
            pointStyle: 'circle',
            pointRadius: 6,
            pointBackgroundColor: 'red',
            pointBorderColor: 'red'
          },
          {
            label: 'INTLEVEL',
            data: intLevelData,
            borderColor: 'rgb(255, 159, 64)',
            backgroundColor: 'rgba(255, 159, 64, 0.1)',
            yAxisID: 'yIntLevel',
            stepped: true,
            borderWidth: 2,
            tension: 0
          },
          {
            label: 'I-Cache Miss',
            data: iMissData,
            borderColor: 'rgb(255, 99, 132)',
            backgroundColor: 'rgba(255, 99, 132, 0.1)',
            yAxisID: 'yIMiss',
            stepped: true,
            borderWidth: 2,
            tension: 0
          },
          {
            label: 'D-Cache Miss',
            data: dMissData,
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

        if (window.myChart) {
          window.myChart.destroy();
        }

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

                // If anomaly triggered entirely outside C execution scope, snap natively strictly directly to the nearest topological temporal branch cleanly intelligently!
                if (!bestDetails) {
                    let minDiff = Infinity;
                    for (let i = 0; i < allDetails.length; i++) {
                        const startT = parseInt(allDetails[i].dataset.startT, 10);
                        const delta = Math.abs(startT - clickT);
                        if (delta < minDiff) { minDiff = delta; bestDetails = allDetails[i]; }
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
                grid: { drawOnChartArea: true }, grace: '20%', min: 0
              },
              yCallDepth: {
                type: 'linear', display: true, position: 'left', stack: 'metrics', stackWeight: 1.5,
                title: { display: true, text: 'Call Depth' }, grace: '20%', min: 0,
                grid: { drawOnChartArea: true },
                ticks: { stepSize: 1 }
              },
              yDMiss: {
                type: 'linear', display: true, position: 'left', stack: 'metrics', stackWeight: 2,
                title: { display: true, text: 'D-Miss' },
                grid: { drawOnChartArea: true }, grace: '20%', min: 0,
                ticks: { stepSize: 1 }
              },
              yIMiss: {
                type: 'linear', display: true, position: 'left', stack: 'metrics', stackWeight: 2,
                title: { display: true, text: 'I-Miss' },
                grid: { drawOnChartArea: true }, grace: '20%', min: 0,
                ticks: { stepSize: 1 }
              },
              yRing: {
                type: 'linear', display: true, position: 'left', stack: 'metrics', stackWeight: 1,
                title: { display: true, text: 'RING' }, min: 0, max: 3,
                grid: { drawOnChartArea: true },
                ticks: { stepSize: 1 }
              },
              yIntLevel: {
                type: 'linear', display: true, position: 'left', stack: 'metrics', stackWeight: 1.5,
                title: { display: true, text: 'INTLEVEL' }, min: 0, max: 15,
                grid: { drawOnChartArea: true },
                ticks: { stepSize: 1 }
              },
              yUM: {
                type: 'linear', display: true, position: 'left', stack: 'metrics', stackWeight: 1,
                title: { display: true, text: 'UM' }, min: 0, max: 1,
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

        } catch (chartErr) {
          console.error("Fatal failure initializing executing graph bounds explicitly:", chartErr);
        }
        } // End of initChartAndUI
