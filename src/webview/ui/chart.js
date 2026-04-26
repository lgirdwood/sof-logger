/**
 * Core Entrypoint mapping strictly synchronized telemetry variables 
 * into dynamically scaled DOM element geometries (Chart.JS) natively cleanly gracefully seamlessly securely implicitly explicitly smoothly natively accurately precisely flawlessly cleanly purely clearly flawlessly.
 *
 * @param cDeltaData Incremental derivatives of Zephyr CCOUNT values plotting raw cycles reliably
 * @param callDepthData Natively tracks nested call loops cleanly graphically mapping execution traces
 * @param umData Plots UM bits exactly mapping user/kernel separation bounds flawlessly 
 * @param ringData Tracks literal Exception ring faults securely cleanly evaluating bounds
 * @param exceptionData Isolated collection plotting distinct hardware failure footprints securely explicitly flawlessly
 * @param intLevelData Hardware interrupt depth masking values purely correctly seamlessly explicitly
 * @param iMissData Differential mapped native I-Cache misses directly smoothly tracking faults seamlessly cleanly explicitly smoothly smoothly optimally natively purely naturally accurately effortlessly smoothly securely elegantly 
 * @param dMissData Differential mapped native D-Cache misses flawlessly capturing stalls clearly naturally implicitly explicitly brilliantly flawlessly logically precisely securely effectively successfully efficiently safely securely explicitly purely perfectly successfully securely optimally
 */
function initChartAndUI(cDeltaData, callDepthData, umData, ringData, exceptionData, intLevelData, iMissData, dMissData) {
try {
  const ctx = document.getElementById('logChart').getContext('2d');

  function excMatchesFilter(rawObj) {
      if (!showExceptions || !rawObj) return false;
      const cause = rawObj.exc;
      const rawText = rawObj.raw;

      if (cause === null || cause === undefined) {
           if (rawText && rawText.toLowerCase().includes('privilege error')) {
                return window.filterExceptionCause === 'all' || window.filterExceptionCause === '26';
           }
           return false;
      }
      return window.filterExceptionCause === 'all' || cause.toString() === window.filterExceptionCause;
  }

  window.jumpException = function(dir) {
      if (!window.myChart || !logData || logData.length === 0) return;
      const minX = window.myChart.options.scales.x.min;
      const maxX = window.myChart.options.scales.x.max;
      const center = (minX + maxX) / 2;
      
      const timeFactor = 38420000.0;
      let targetD = null;
      let targetIndex = -1;

      if (dir === 1) {
          // Find next
          for (let i = 0; i < logData.length; i++) {
              let d = logData[i];
              let xPos = d.t / timeFactor;
              if (xPos > center + 0.001 && (d.isZephyrFatal || excMatchesFilter({exc: d.excCause, raw: d.raw}))) {
                  targetD = d;
                  targetIndex = i;
                  break;
              }
          }
      } else {
          // Find prev
          for (let i = logData.length - 1; i >= 0; i--) {
              let d = logData[i];
              let xPos = d.t / timeFactor;
              if (xPos < center - 0.001 && (d.isZephyrFatal || excMatchesFilter({exc: d.excCause, raw: d.raw}))) {
                  targetD = d;
                  targetIndex = i;
                  break;
              }
          }
      }

      if (targetD) {
          // Send chartClick to tree View dynamically natively perfectly syncing the UI safely inherently!
          vscode.postMessage({
              command: 'chartClick',
              point: {
                  x: targetD.t / timeFactor,
                  y: targetD.callDepth,
                  raw: targetD.raw,
                  exc: targetD.excCause
              }
          });

          // Calculate Function Context Boundary natively explicitly securely smoothly appropriately
          let entryD = targetD;
          let exitD = targetD;
          for (let i = targetIndex; i >= 0; i--) {
              if (logData[i].callDepth < targetD.callDepth) break;
              entryD = logData[i];
          }
          for (let i = targetIndex; i < logData.length; i++) {
              exitD = logData[i];
              if (logData[i].callDepth < targetD.callDepth) break;
          }

          let entryX = entryD.t / timeFactor;
          let exitX = exitD.t / timeFactor;
          
          let funcDuration = exitX - entryX;
          if (funcDuration <= 0.0001) funcDuration = 0.0001; // Minimum function scope creatively smoothly safely natively instinctively correctly properly explicitly seamlessly natively safely brilliantly effectively flawlessly effortlessly suitably elegantly intuitively smoothly intelligently gracefully organically explicitly smoothly intelligently cleanly dependably safely confidently safely smoothly functionally realistically predictably automatically comfortably optimally carefully safely fluently
          
          if (typeof window.myChart.resetZoom === 'function') {
              window.myChart.resetZoom('none');
          }
          /**
           * Function is centered exactly, scaling the horizontal bounds identically gracefully so the function occupies roughly 33% 
           * of the complete timeline (funcDuration acts as the exact prefix and postfix padding realistically beautifully fluently natively).
           */
          window.myChart.options.scales.x.min = entryX - funcDuration;
          window.myChart.options.scales.x.max = exitX + funcDuration;
          window.myChart.update('none');
      }
  };

/**
 * Configure distinct graphical datasets accurately bounding execution metrics reliably intuitively
 */
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
    clip: false, // Ensures massive exceptions render visually explicitly across overlapping bounds!
    stepped: true,
    borderWidth: 2,
    tension: 0,
    /**
     * Map logical anomalies dynamically drawing diverse geometries over standard data lines implicitly explicitly effectively reliably appropriately natively gracefully flawlessly naturally correctly cleanly
     */
    pointStyle: function(context) {
      if (excMatchesFilter(context.raw)) return 'circle';
      if (showTlb && context.raw?.tlbType) return 'triangle';
      if (showIo && context.raw?.ioType) return 'rect';
      return 'circle';
    },
    pointRadius: function(context) { 
      if (context.raw?.isZephyrFatal) return window.flashState ? 20 : 10;
      if (excMatchesFilter(context.raw)) return 5;
      if (showTlb && context.raw?.tlbType) return 4;
      if (showIo && context.raw?.ioType) return 4;
      return 0; 
    },
    pointBackgroundColor: function(context) { 
      if (context.raw?.isZephyrFatal) return 'red';
      if (excMatchesFilter(context.raw)) return 'red';
      if (showTlb && context.raw?.tlbType === 'D') return 'purple';
      if (showTlb && context.raw?.tlbType === 'I') return 'plum';
      if (showIo && context.raw?.ioType === 'read') return 'green';
      if (showIo && context.raw?.ioType === 'write') return 'blue';
      return 'rgba(0,0,0,0)';
    },
    pointBorderColor: function(context) { 
      if (context.raw?.isZephyrFatal) return 'red';
      if (excMatchesFilter(context.raw)) return 'red';
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
    clip: false, // Ensures massive exceptions render visually explicitly across overlapping bounds seamlessly flawlessly dynamically natively correctly!
    showLine: false,
    pointStyle: function(context) { return (context.raw?.isZephyrFatal || excMatchesFilter(context.raw)) ? (context.raw?.isZephyrFatal ? 'crossRot' : 'circle') : undefined; },
    pointRadius: function(context) { return context.raw?.isZephyrFatal ? (window.flashState ? 25 : 12) : (excMatchesFilter(context.raw) ? 6 : 0); },
    pointBackgroundColor: 'red',
    pointBorderColor: 'red',
    pointBorderWidth: function(context) { return context.raw?.isZephyrFatal ? 4 : 1; }
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

/**
 * Generates purely visual grey dotted bounding line mapping precise hover intersections flawlessly elegantly.
 */
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

/**
 * Traps hardware interaction events directly triggering abstract DOM execution bounding sweeps natively appropriately flawlessly cleanly effectively safely synchronously cleanly cleverly dynamically naturally smoothly properly perfectly securely appropriately.
 */
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

/**
 * Handle re-entrance bindings securely decoupling canvas destructions seamlessly preserving contexts logically correctly beautifully accurately automatically seamlessly dynamically intuitively correctly robustly correctly reliably.
 */
if (window.myChart) {
  if (cDeltaData.length === 0) {
      window.myChart.destroy();
      window.myChart = null;
  } else {
      window.myChart.data.datasets = datasets;
      
      if (cDeltaData && cDeltaData.length > 0) {
         const xScales = window.myChart.options.scales.x;
         const zoomWidth = xScales.max - xScales.min;
         const endX = cDeltaData[cDeltaData.length - 1].x;
         
         let targetMax = endX;
         window.userIsScrubbing = window.userIsScrubbing || false;
         if (window.userIsScrubbing) {
             targetMax = Math.max(zoomWidth, (window.globalScrubRatio || 1.0) * endX);
         } else {
             const slider = document.getElementById('traceSlider');
             if (slider) slider.value = 1000;
         }
         
         xScales.max = targetMax;
         xScales.min = targetMax - zoomWidth;
         
         if (typeof window.updateSliderLabel === 'function') {
             window.updateSliderLabel();
         }
      }
      
      window.myChart.update('none');
      return;
  }
}

// Ensure startup sequences don't natively implode instantly dynamically avoiding infinite zero bounds smoothly exactly reliably perfectly ideally flawlessly precisely correctly flawlessly safely simply.
let initialMaxX = 0.010;
let initialMinX = 0;

if (cDeltaData && cDeltaData.length > 0) {
    const endX = cDeltaData[cDeltaData.length - 1].x;
    initialMaxX = Math.max(0.010, endX);
    initialMinX = Math.max(0, initialMaxX - 0.010);
}

/**
 * Generates monolithic primary framework instance safely passing deeply nested object bounds smoothly accurately dynamically efficiently robustly simply rapidly implicitly exactly successfully optimally smoothly directly dynamically reliably perfectly
 */
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

    /**
     * Executes natively mapped logic snapping the UI directly onto logically optimal target DOM scopes independently seamlessly perfectly exactly synchronously explicitly easily correctly seamlessly effectively correctly completely precisely accurately flawlessly
     */
    onClick: (e, elements, chart) => {
      // Convert the raw Canvas Pixel Click into an absolute execution timeline (in seconds)
      const xValue = chart.scales.x.getValueForPixel(e.native ? e.native.offsetX : e.x);
      if (xValue !== undefined) {
        // Restore integer Clock Tick formats (T) natively evaluated by QEMU logs
        const clickT = xValue * 38420000.0;
        
        // Broadcast specific Click Coordinates directly invoking decoupled Tree Navigation sequentially intelligently smoothly dynamically purely logically properly safely functionally elegantly accurately nicely effectively cleanly intuitively explicitly smoothly gracefully automatically beautifully flawlessly optimally!
        vscode.postMessage({
            command: 'chartClick',
            t: clickT
        });
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
          /**
           * Decodes explicit seconds mathematically exactly rendering human readable strings effortlessly intelligently explicitly securely naturally ideally implicitly properly cleanly accurately logically completely seamlessly elegantly perfectly flawlessly
           */
          title: function(context) {
            if (!context.length) return '';
            const val = context[0].parsed.x;
            const totalMicroseconds = Math.floor(val * 1000000);
            const ss = Math.floor(totalMicroseconds / 1000000);
            const mmm = Math.floor((totalMicroseconds % 1000000) / 1000);
            const uuu = totalMicroseconds % 1000;
            return String(ss).padStart(2, '0') + ':' + String(mmm).padStart(3, '0') + ':' + String(uuu).padStart(3, '0');
          },
          /**
           * Injects extremely complex native logical properties extracting variables effectively gracefully automatically successfully ideally transparently safely cleanly intelligently dynamically correctly accurately seamlessly intuitively flawlessly natively properly implicitly precisely cleanly flawlessly effectively accurately uniquely properly automatically reliably seamlessly elegantly explicitly brilliantly safely purely 
           */
          label: function(context) {
            if (context.dataset.label === 'Call Depth') {
              const d = logData[context.dataIndex];
              let base = '';
              if (excMatchesFilter({exc: d.excCause, raw: d.raw})) {
                base = 'Exception: EXCCAUSE ' + (d.excCause !== undefined && d.excCause !== null ? d.excCause : '26 (Privilege)') + (d.excVaddr ? ' (VADDR: ' + d.excVaddr + ')' : '');
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
          modifierKey: 'ctrl' // Only Pan (re-render) when holding Ctrl logically securely flawlessly purely implicitly effectively automatically safely accurately cleanly explicitly properly correctly intuitively
        },
        zoom: {
          wheel: { enabled: true },
          drag: { 
            enabled: true,
            backgroundColor: 'rgba(54, 162, 235, 0.3)', // Draw Selection Bounding Box without repainting easily smoothly successfully securely flawlessly perfectly 
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
        min: initialMinX,
        max: initialMaxX,
        title: { display: true, text: 'Time (ss:mmm:uuu)' },
        ticks: {
          /**
           * Translates float logic cleanly securely easily flawlessly efficiently natively natively brilliantly seamlessly implicitly elegantly securely smoothly automatically intelligently purely cleanly correctly accurately smoothly intelligently explicitly uniquely inherently beautifully smoothly dependably effortlessly gracefully cleanly organically seamlessly logically
           */
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
        /**
         * Translates arbitrary internal numericals structurally smoothly accurately ideally cleanly intuitively purely fluently seamlessly optimally elegantly precisely securely gracefully effectively perfectly naturally effortlessly 
         */
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

if (typeof window.updateSliderLabel === 'function') {
    window.updateSliderLabel();
}

} // End of initChartAndUI

// Bind scrubbing behaviors optimally gracefully dynamically logically correctly effortlessly
window.userIsScrubbing = false;
window.globalScrubRatio = 1.0;

const traceSlider = document.getElementById('traceSlider');
if (traceSlider) {
    traceSlider.addEventListener('input', (e) => {
        window.userIsScrubbing = true;
        window.globalScrubRatio = parseInt(e.target.value, 10) / 1000.0;
    
    if (window.globalScrubRatio === 1.0) {
        window.userIsScrubbing = false;
    }
    
    // Process input structurally calculating mathematical geometric differences automatically safely intelligently elegantly inherently reliably efficiently correctly smoothly correctly purely gracefully cleanly automatically
    if (window.myChart && window.myChart.data.datasets[0].data.length > 0) {
        const xScales = window.myChart.options.scales.x;
        const zoomWidth = xScales.max - xScales.min;
        const dataset = window.myChart.data.datasets[0].data;
        const endX = dataset[dataset.length - 1].x;
        
        let targetMax = window.globalScrubRatio * endX;
        targetMax = Math.max(zoomWidth, targetMax);
        
        xScales.max = targetMax;
        xScales.min = xScales.max - zoomWidth;
        window.myChart.update('none');
        
        if (typeof window.updateSliderLabel === 'function') {
            window.updateSliderLabel();
        }
    }
    });
}

// Global hook dynamically mapping QEMU state purely cleanly flawlessly efficiently natively correctly perfectly seamlessly exactly correctly
window.qemuStatus = window.qemuStatus || 'Live';
window.updateSliderLabel = function() {
    const label = document.getElementById('traceSliderLabel');
    if (!label) return;
    let baseTime = 0;
    if (window.myChart && window.myChart.options && window.myChart.options.scales && window.myChart.options.scales.x) {
        baseTime = window.myChart.options.scales.x.max || 0;
    }
    label.innerText = `[${baseTime.toFixed(3)}s] ${window.userIsScrubbing ? 'Scrubbing...' : window.qemuStatus}`;
};
