import * as path from 'path';
import * as fs from 'fs';

export function getWebviewContent(extensionPath: string) {
    const layoutPath = path.join(extensionPath, 'src', 'webview', 'ui', 'layout.html');
    const cssPath = path.join(extensionPath, 'src', 'webview', 'ui', 'style.css');
    const uiDir = path.join(extensionPath, 'src', 'webview', 'ui');
    
    // Natively read out separated physical components statically avoiding monolithic strings
    const htmlBody = fs.existsSync(layoutPath) ? fs.readFileSync(layoutPath, 'utf8') : '<h1>Layout Missing</h1>';
    const cssBody = fs.existsSync(cssPath) ? fs.readFileSync(cssPath, 'utf8') : '';
    
    const jsGlobals = fs.existsSync(path.join(uiDir, 'globals.js')) ? fs.readFileSync(path.join(uiDir, 'globals.js'), 'utf8') : '';
    const jsToggles = fs.existsSync(path.join(uiDir, 'toggles.js')) ? fs.readFileSync(path.join(uiDir, 'toggles.js'), 'utf8') : '';
    const jsChart = fs.existsSync(path.join(uiDir, 'chart.js')) ? fs.readFileSync(path.join(uiDir, 'chart.js'), 'utf8') : '';
    const jsSidebar = fs.existsSync(path.join(uiDir, 'sidebar.js')) ? fs.readFileSync(path.join(uiDir, 'sidebar.js'), 'utf8') : '';
    const jsMemMap = fs.existsSync(path.join(uiDir, 'memoryMap.js')) ? fs.readFileSync(path.join(uiDir, 'memoryMap.js'), 'utf8') : '';
    const jsBody = [jsGlobals, jsToggles, jsChart, jsSidebar, jsMemMap].join('\n\n');

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
${jsBody}
  </script>
</body>
</html>`;
}
