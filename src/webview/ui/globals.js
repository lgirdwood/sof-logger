const vscode = acquireVsCodeApi();
        let logData = [];
        let symbolsData = [];
        let regionsMeta = [];
        let sramTopologies = [];
        
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

                if (typeof initChartAndUI !== 'undefined') {
                    initChartAndUI(cDeltaData, callDepthData, umData, ringData, exceptionData, intLevelData, iMissData, dMissData);
                }
                } catch (e) {
                   document.body.innerHTML = '<h1 style="color:red;">Exception Caught During Load</h1><pre style="color:red;white-space:pre-wrap;">' + e.message + '\n' + e.stack + '</pre>';
                }
            } else if (message.command === 'updateSymbols') {
                try {
                    logData = message.logData || logData;
                    symbolsData = message.symbols || [];
                    if (message.regionsMeta) regionsMeta = message.regionsMeta;
                    if (message.sramTopologies) sramTopologies = message.sramTopologies;
                    
                    const ovMem = document.getElementById('loadingOverlay');
                    if (ovMem) ovMem.style.display = 'none';
                    
                    // Legacy trace maps cleanly dumped! VS Code Activity Bar handles this natively identically elegantly!
                    // @ts-ignore
                    if (window.memoryMapRendered) {
                        window.memoryMapRendered = false;
                        const ml = document.getElementById('memoryMapLayout');
                        if (ml && (ml.style.display === 'flex' || ml.style.display === 'block')) {
                            switchView('memory');
                        } else {
                            if (typeof renderMemoryMap !== 'undefined') renderMemoryMap();
                            window.memoryMapRendered = true;
                        }
                    }
                } catch (e) {
                    document.body.innerHTML = '<h1 style="color:red;">Exception in updateSymbols</h1><pre style="color:red;white-space:pre-wrap;">' + e.message + '\n' + e.stack + '</pre>';
                    console.error('updateSymbols error:', e);
                }
            } else if (message.command === 'zoomBounds') {
                if (window.myChart && message.startT !== undefined) {
                    const startX = message.startT / 38420000.0;
                    let endX = message.endT !== undefined ? message.endT / 38420000.0 : startX;
                    let duration = endX - startX;
                    
                    if (duration === 0) duration = 0.001; // Scale arbitrarily only for instantaneous boundaries seamlessly
                    const padding = duration * 0.5; 
                    
                    window.myChart.options.scales.x.min = startX - padding;
                    window.myChart.options.scales.x.max = endX + padding;
                    window.myChart.update();
                }
            } else if (message.command === 'qemuState') {
                window.qemuStatus = message.state;
                if (typeof window.updateSliderLabel === 'function') {
                    window.updateSliderLabel();
                }
            }
        });
        function switchView(viewName) {
          const main = document.getElementById('mainLayout');
          const memMap = document.getElementById('memoryMapLayout');

          // Hide all layouts seamlessly
          if (main) main.style.display = 'none';
          if (memMap) memMap.style.display = 'none';
          
          const toolbar = document.querySelector('.toolbar');

          if (viewName === 'chart') {
            if (main) main.style.display = 'flex';
          } else if (viewName === 'memory') {
            if (memMap) memMap.style.display = 'flex';
            if (toolbar) toolbar.style.display = 'none'; // Reclaim vertical space exclusively for native map

            // @ts-ignore
            if (!window.memoryMapRendered) {
                const existing = document.getElementById('memory-map-container');
                const isInitial = !existing || existing.children.length === 0;
                
                if (isInitial && existing) {
                    existing.innerHTML = '<div style="display:flex; justify-content:center; align-items:center; height:100%;"><div class="flash-target" style="padding: 20px; background: #333; color: white; border-radius: 8px; font-size: 16px;">Computing Topological Memory Intersections...</div></div>';
                }
                
                setTimeout(() => {
                    try {
                        // @ts-ignore
                        if (typeof renderMemoryMap !== 'undefined') renderMemoryMap();
                        // @ts-ignore
                        window.memoryMapRendered = true;
                    } catch (e) {
                        if (existing) existing.innerHTML = '<h1 style="color:red;z-index:9999;position:absolute;">MemoryMap Crash: ' + e.message + '</h1><pre style="color:red;z-index:9999;position:absolute;top:50px;">' + e.stack + '</pre>';
                        console.error('renderMemoryMap Exception:', e);
                    }
                }, isInitial ? 50 : 1);
            }
          }
        }
        
        // Broadcast the asynchronous execution cycle cleanly completely decoupling initialization deadlocks cleanly natively
        setTimeout(() => {
            if (typeof switchView === 'function') switchView(window.ACTIVE_LAYOUT_TYPE || 'chart');
            vscode.postMessage({ command: 'ready' });
        }, 100);
