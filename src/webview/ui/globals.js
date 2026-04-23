const vscode = acquireVsCodeApi();
        let logData = [];
        let symbolsData = [];
        let regionsMeta = [];
        let sramTopologies = [];
        let rawZephyrLog = '';
        
        let showExceptions = true;
        let showTlb = true;
        let showIo = true;

        window.addEventListener('message', event => {
            const message = event.data;
            if (message.command === 'loadData') {
                try {
                const ov = document.getElementById('loadingOverlay');
                if (ov) ov.style.display = 'none';
                
                logData = message.logData || [];
                symbolsData = message.symbols || [];
                regionsMeta = message.regionsMeta || [];
                sramTopologies = message.sramTopologies || [];
                rawZephyrLog = message.zephyrLog || '';

                const timeFactor = 38420000.0;
                
                const umData = logData.map(d => ({ x: d.t / timeFactor, y: d.um }));
                const ringData = logData.map(d => ({ x: d.t / timeFactor, y: d.ring, raw: d.raw }));
                const intLevelData = logData.map(d => ({ x: d.t / timeFactor, y: d.intLevel }));
                const callDepthData = logData.map(d => ({ x: d.t / timeFactor, y: d.callDepth, exc: d.excCause, tlbType: d.tlbType, ioType: d.ioType, raw: d.raw }));
                const exceptionData = logData.filter(d => d.raw && d.raw.toLowerCase().includes('privilege error')).map(d => ({ x: d.t / timeFactor, y: d.ring, raw: d.raw }));

                const iMissData = logData.map((d, i, arr) => {
                  if (i === 0 || d.iMiss == null || arr[i - 1].iMiss == null) return { x: d.t / timeFactor, y: 0 };
                  return { x: d.t / timeFactor, y: Math.max(0, (d.iMiss || 0) - (arr[i - 1].iMiss || 0)) };
                });

                const dMissData = logData.map((d, i, arr) => {
                  if (i === 0 || d.iMiss == null || arr[i - 1].dMiss == null) return { x: d.t / timeFactor, y: 0 };
                  return { x: d.t / timeFactor, y: Math.max(0, (d.dMiss || 0) - (arr[i - 1].dMiss || 0)) };
                });

                const cDeltaData = logData.map((d, i, arr) => {
                  if (i === 0 || d.c == null || arr[i - 1].c == null) return { x: d.t / timeFactor, y: 0 };
                  return { x: d.t / timeFactor, y: Math.max(0, (d.c || 0) - (arr[i - 1].c || 0)) };
                });

                initChartAndUI(cDeltaData, callDepthData, umData, ringData, exceptionData, intLevelData, iMissData, dMissData);
                switchView('chart');
                } catch (e) {
                   document.body.innerHTML = '<h1 style="color:red;">Exception Caught During Load</h1><pre style="color:red;white-space:pre-wrap;">' + e.message + '\n' + e.stack + '</pre>';
                }
            } else if (message.command === 'updateSymbols') {
                try {
                    logData = message.logData || logData;
                    symbolsData = message.symbols || [];
                    
                    const sidebar = document.getElementById('tree-sidebar');
                    if (sidebar) {
                        sidebar.innerHTML = '';
                        renderSidebar();
                    }

                    // @ts-ignore
                    if (window.memoryMapRendered) {
                        // @ts-ignore
                        window.memoryMapRendered = false;
                        const c = document.getElementById('memory-map-container');
                        if (c) c.innerHTML = '';
                        const ml = document.getElementById('memoryMapLayout');
                        if (ml && (ml.style.display === 'flex' || ml.style.display === 'block')) {
                            switchView('memory');
                        }
                    }
                } catch (e) {
                    document.body.innerHTML = '<h1 style="color:red;">Exception in updateSymbols</h1><pre style="color:red;white-space:pre-wrap;">' + e.message + '\n' + e.stack + '</pre>';
                    console.error('updateSymbols error:', e);
                }
            }
        });

        try {

        function switchView(viewName) {
          const main = document.getElementById('mainLayout');
          const memMap = document.getElementById('memoryMapLayout');
          const terminal = document.getElementById('terminalLayout');

          const btnChart = document.getElementById('btnViewChart');
          const btnMem = document.getElementById('btnViewMemory');
          const btnTerm = document.getElementById('btnViewTerminal');

          // Reset backgrounds
          btnChart.style.backgroundColor = '';
          btnMem.style.backgroundColor = '';
          btnTerm.style.backgroundColor = '';

          // Hide all layouts
          main.style.display = 'none';
          if (memMap) memMap.style.display = 'none';
          terminal.style.display = 'none';

          if (viewName === 'chart') {
            main.style.display = 'flex';
            btnChart.style.backgroundColor = 'var(--vscode-button-hoverBackground)';
          } else if (viewName === 'memory') {
            if (memMap) memMap.style.display = 'flex';
            btnMem.style.backgroundColor = 'var(--vscode-button-hoverBackground)';
            // @ts-ignore
            if (!window.memoryMapRendered) {
                const container = document.getElementById('memory-map-container');
                if (container) {
                    container.innerHTML = '<div style="display:flex; justify-content:center; align-items:center; height:100%;"><div class="flash-target" style="padding: 20px; background: #333; color: white; border-radius: 8px; font-size: 16px;">Computing Topological Memory Intersections...</div></div>';
                    setTimeout(() => {
                        container.innerHTML = '';
                        // @ts-ignore
                        if (typeof renderMemoryMap !== 'undefined') renderMemoryMap();
                        // @ts-ignore
                        window.memoryMapRendered = true;
                    }, 50);
                }
            }
          } else if (viewName === 'terminal') {
            terminal.style.display = 'block';
            btnTerm.style.backgroundColor = 'var(--vscode-button-hoverBackground)';

            // @ts-ignore
            if (!window._terminalFormatted) {
                let htmlLog = rawZephyrLog
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;');
                
                htmlLog = htmlLog.replace(/\b(0x)?[0-9a-fA-F]{6,16}\b/gi, (match) => {
                    const hexVal = match.replace(/^0x/i, '');
                    const addr = parseInt(hexVal, 16);
                    if (isNaN(addr)) return match;

                    let low = 0, high = symbolsData.length - 1;
                    let closestIndex = -1;
                    while (low <= high) {
                      const mid = Math.floor((low + high) / 2);
                      if (symbolsData[mid].addr <= addr) {
                        closestIndex = mid;
                        low = mid + 1;
                      } else {
                        high = mid - 1;
                      }
                    }
                    if (closestIndex !== -1) {
                      const sym = symbolsData[closestIndex];
                      if (sym.size > 0 && addr >= sym.addr + sym.size) {
                        return match;
                      }
                      
                      let titleStr = sym.name + ' (.' + sym.sect + ')';
                      if (sym.file) titleStr += ' \n' + sym.file;
                      if (sym.line) titleStr += ':' + sym.line;
                      
                      const safeFile = (sym.file || '').replace(/'/g, "\\'");
                      return `<span style="color: #64B5F6; text-decoration: underline; cursor: help;" title="${titleStr}" ondblclick="vscode.postMessage({ command: 'openSource', file: '${safeFile}', line: ${sym.line || 1} })">${match}</span>`;
                    }
                    return match;
                });
                // @ts-ignore
                window._terminalFormattedLog = htmlLog;
                // @ts-ignore
                window._terminalFormatted = true;
            }
            // @ts-ignore
            document.getElementById('terminalLogContent').innerHTML = window._terminalFormattedLog;
          }
        }
