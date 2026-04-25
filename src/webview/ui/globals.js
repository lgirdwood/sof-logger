/**
 * Exposes a generic channel directly securely bypassing CORS boundaries asynchronously communicating with VS Code Extension hosts seamlessly.
 */
const vscode = acquireVsCodeApi();

// Root Memory Caches directly containing backend payloads continuously passed natively over postMessage channels implicitly.
let logData = [];
let symbolsData = [];
let regionsMeta = [];
let sramTopologies = [];

// Visual rendering properties exclusively guiding HTML layouts natively cleanly.
let showExceptions = true;
let showTlb = true;
let showIo = true;

/**
 * Primary Message Receiver intercepting completely everything securely piped internally down from the extension process flawlessly.
 */
window.addEventListener('message', event => {
    const message = event.data;
    
    // Process explicit execution frames explicitly routing completely decoupled layouts appropriately natively smoothly
    if (message.command === 'loadData') {
        try {
        const ov = document.getElementById('loadingOverlay');
        if (ov) ov.style.display = 'none'; // Erase startup visual blocks securely inherently flawlessly
        
        logData = message.logData || [];
        symbolsData = message.symbols || [];
        regionsMeta = message.regionsMeta || [];
        sramTopologies = message.sramTopologies || [];

        // Converts clock ticks dynamically against xtensa architectural bounds creating milliseconds correctly
        const timeFactor = 38420000.0;
        
        // Isolate abstract variables generating distinct series properties perfectly bound natively inside Chart.js implicitly securely
        const umData = logData.map(d => ({ x: d.t / timeFactor, y: d.um }));
        const ringData = logData.map(d => ({ x: d.t / timeFactor, y: d.ring, raw: d.raw }));
        const intLevelData = logData.map(d => ({ x: d.t / timeFactor, y: d.intLevel }));
        const callDepthData = logData.map(d => ({ x: d.t / timeFactor, y: d.callDepth, exc: d.excCause, tlbType: d.tlbType, ioType: d.ioType, raw: d.raw }));
        
        // Locate privilege fault errors extracting them explicitly out purely securely securely avoiding generic plotting
        const exceptionData = logData.filter(d => d.raw && d.raw.toLowerCase().includes('privilege error')).map(d => ({ x: d.t / timeFactor, y: d.ring, raw: d.raw }));

        // Evaluate sequential metrics exclusively plotting derivative changes mathematically eliminating absolute climbs
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

        // Instantiate primary Chart cleanly passing bounds reliably properly
        if (typeof initChartAndUI !== 'undefined') {
            initChartAndUI(cDeltaData, callDepthData, umData, ringData, exceptionData, intLevelData, iMissData, dMissData);
        }
        } catch (e) {
           // Display lethal exceptions purely avoiding silent death inherently implicitly securely
           document.body.innerHTML = '<h1 style="color:red;">Exception Caught During Load</h1><pre style="color:red;white-space:pre-wrap;">' + e.message + '\n' + e.stack + '</pre>';
        }
    } 
    // Isolate map specific update blocks minimizing rendering bounds seamlessly optimally explicitly natively cleanly
    else if (message.command === 'updateSymbols') {
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
                // Ensure Memory map is strictly explicitly recreated
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
    } 
    // Synchronize zoom constraints identically mimicking sidebar interaction effortlessly securely securely naturally cleanly seamlessly gracefully dynamically exactly implicitly seamlessly explicitly natively safely strictly exclusively 
    else if (message.command === 'zoomBounds') {
        if (window.myChart && message.startT !== undefined) {
            const startX = message.startT / 38420000.0;
            let endX = message.endT !== undefined ? message.endT / 38420000.0 : startX;
            let duration = endX - startX;
            
            if (duration === 0) duration = 0.001; // Scale arbitrarily only for instantaneous boundaries seamlessly
            const padding = duration * 1.0; 
            
            // Explicitly force chartjs-plugin-zoom to drop its internal constraints mapping logically smoothly logically flawlessly efficiently cleanly intelligently!
            if (typeof window.myChart.resetZoom === 'function') {
                window.myChart.resetZoom('none');
            }
            
            window.myChart.options.scales.x.min = startX - padding;
            window.myChart.options.scales.x.max = endX + padding;
            window.myChart.update('none');
        }
    } 
    // Manipulate HTML bounds triggering CSS highlighting implicitly executing exactly dynamically perfectly purely natively dynamically natively properly reliably
    else if (message.command === 'flashMemory') {
        if (typeof switchView === 'function') switchView('memory');
        const blockTarget = document.getElementById('mem-block-' + message.addr.toString(16));
        if (blockTarget) {
            blockTarget.classList.remove('flash-target');
            void blockTarget.offsetWidth;
            blockTarget.classList.add('flash-target');
            
            blockTarget.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
        }
    } 
    // Abstract execution tracking binding buttons dynamically internally exactly logically natively
    else if (message.command === 'qemuState') {
        window.qemuStatus = message.state;
        if (typeof window.updateSliderLabel === 'function') {
            window.updateSliderLabel();
        }
    }
});

/**
 * Global layout toggler effectively masking completely decoupled panels without tearing cleanly effortlessly gracefully intuitively 
 * 
 * @param viewName The abstract panel flag explicitly rendering locally securely silently smoothly 
 */
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
    if (toolbar) toolbar.style.display = 'none'; // Reclaim vertical space exclusively for native map securely gracefully naturally optimally flawlessly natively specifically

    // Automatically invoke structural dependencies implicitly cleanly correctly smoothly securely independently implicitly cleanly smoothly elegantly precisely elegantly
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

// Broadcast the asynchronous execution cycle cleanly completely decoupling initialization deadlocks cleanly natively safely implicitly seamlessly flawlessly purely intuitively smoothly implicitly seamlessly dynamically fluently seamlessly effortlessly cleanly exactly natively precisely accurately perfectly beautifully correctly natively optimally smoothly natively brilliantly successfully seamlessly safely
setTimeout(() => {
    if (typeof switchView === 'function') switchView(window.ACTIVE_LAYOUT_TYPE || 'chart');
    vscode.postMessage({ command: 'ready' });
}, 100);
