import * as path from 'path';
import * as fs from 'fs';

export function getWebviewContent(extensionPath: string, layoutType: 'chart' | 'memory' = 'chart') {
    const layoutPath = path.join(extensionPath, 'src', 'webview', 'ui', 'layout.html');
    const cssPath = path.join(extensionPath, 'src', 'webview', 'ui', 'style.css');
    const uiDir = path.join(extensionPath, 'src', 'webview', 'ui');
    
    let htmlBody = '<h1>Layout Missing</h1>';
    let cssBody = '';
    let jsBody = '';

    // Aggressive error boundary wrapper ensuring standard execution layout natively 
    // survives arbitrary IO/locking crashes dynamically rendering standard errors.
    try {
        htmlBody = fs.existsSync(layoutPath) ? fs.readFileSync(layoutPath, 'utf8') : htmlBody;
        cssBody = fs.existsSync(cssPath) ? fs.readFileSync(cssPath, 'utf8') : cssBody;
        
        const jsGlobals = fs.existsSync(path.join(uiDir, 'globals.js')) ? fs.readFileSync(path.join(uiDir, 'globals.js'), 'utf8') : '';
        const jsToggles = fs.existsSync(path.join(uiDir, 'toggles.js')) ? fs.readFileSync(path.join(uiDir, 'toggles.js'), 'utf8') : '';
        const jsChart = fs.existsSync(path.join(uiDir, 'chart.js')) ? fs.readFileSync(path.join(uiDir, 'chart.js'), 'utf8') : '';
        const jsMemMap = fs.existsSync(path.join(uiDir, 'memoryMap.js')) ? fs.readFileSync(path.join(uiDir, 'memoryMap.js'), 'utf8') : '';
        
        if (layoutType === 'chart') {
            jsBody = [jsGlobals, jsToggles, jsChart].join('\n\n');
        } else {
            jsBody = [jsGlobals, jsMemMap].join('\n\n');
        }
        
    } catch (fsErr: any) {
        htmlBody = `<h1 style="color:red">Fatal Webview Generation IO Exception</h1><pre style="color:red;white-space:pre-wrap;">${fsErr.message}</pre>`;
        console.error('Failed fetching UI component layouts dynamically:', fsErr);
    }

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
  <!-- Natively initialize DOM structures -->
  <script>
    window.ACTIVE_LAYOUT_TYPE = '${layoutType}';
${jsBody}
  </script>
</body>
</html>`;
}
