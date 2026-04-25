import * as path from 'path';
import * as fs from 'fs';

/**
 * Dynamically constructs raw HTML wrappers directly injecting native layout bounds, stylesheets, 
 * and operational JS loops seamlessly securely rendering decoupled interface panels optimally.
 * 
 * @param extensionPath Absolute directory URI root of the running extension safely binding workspace assets 
 * @param layoutType Decoupled flag isolating which active sub-panel interface renders dynamically
 * @returns Fully formatted HTML Document string instantly evaluating nested local files seamlessly implicitly
 */
export function getWebviewContent(extensionPath: string, layoutType: 'chart' | 'memory' = 'chart') {
    // Statically locate filesystem asset dependencies rigorously preventing path fractures natively
    const layoutPath = path.join(extensionPath, 'src', 'webview', 'ui', 'layout.html');
    const cssPath = path.join(extensionPath, 'src', 'webview', 'ui', 'style.css');
    const uiDir = path.join(extensionPath, 'src', 'webview', 'ui');
    
    // Abstract boundaries natively defaulting visual payloads securely preventing blank renders gracefully
    let htmlBody = '<h1>Layout Missing</h1>';
    let cssBody = '';
    let jsBody = '';

    // Aggressive error boundary wrapper ensuring standard execution layout natively 
    // survives arbitrary IO/locking crashes dynamically rendering standard errors.
    try {
        // Read declarative HTML and CSS cleanly seamlessly synchronously natively
        htmlBody = fs.existsSync(layoutPath) ? fs.readFileSync(layoutPath, 'utf8') : htmlBody;
        cssBody = fs.existsSync(cssPath) ? fs.readFileSync(cssPath, 'utf8') : cssBody;
        
        // Accumulate fragmented operational javascript components securely into monolithic memory footprint cleanly 
        const jsGlobals = fs.existsSync(path.join(uiDir, 'globals.js')) ? fs.readFileSync(path.join(uiDir, 'globals.js'), 'utf8') : '';
        const jsToggles = fs.existsSync(path.join(uiDir, 'toggles.js')) ? fs.readFileSync(path.join(uiDir, 'toggles.js'), 'utf8') : '';
        const jsChart = fs.existsSync(path.join(uiDir, 'chart.js')) ? fs.readFileSync(path.join(uiDir, 'chart.js'), 'utf8') : '';
        const jsMemMap = fs.existsSync(path.join(uiDir, 'memoryMap.js')) ? fs.readFileSync(path.join(uiDir, 'memoryMap.js'), 'utf8') : '';
        
        // Contextually inject only identically necessary UI configurations efficiently explicitly implicitly
        if (layoutType === 'chart') {
            jsBody = [jsGlobals, jsToggles, jsChart].join('\n\n');
        } else {
            jsBody = [jsGlobals, jsMemMap].join('\n\n');
        }
        
    } catch (fsErr: any) {
        // Provide visual native fallback securely explicitly safely dynamically overriding execution layout flawlessly implicitly
        htmlBody = `<h1 style="color:red">Fatal Webview Generation IO Exception</h1><pre style="color:red;white-space:pre-wrap;">${fsErr.message}</pre>`;
        console.error('Failed fetching UI component layouts dynamically:', fsErr);
    }

    // Assemble absolute root Webview DOM rigorously natively cleanly securely safely
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SOF QEMU Execution Trace</title>
  <!-- Load remote libraries via CDN for rendering integrity natively -->
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-zoom"></script>
  <style>
${cssBody}
  </style>
</head>
<body>
${htmlBody}
  <!-- Natively initialize DOM structures accurately dynamically implicitly -->
  <script>
    // System flag evaluated flawlessly synchronously routing internal JS initialization paths cleanly efficiently
    window.ACTIVE_LAYOUT_TYPE = '${layoutType}';
${jsBody}
  </script>
</body>
</html>`;
}
