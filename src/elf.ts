import * as vscode from 'vscode';
import * as path from 'path';
import * as cp from 'child_process';
import * as fs from 'fs';
import { MemoryRegion } from './parser';

export function parseZephyrMap(elfPath: string): MemoryRegion[] {
  const mapPath = elfPath.replace(/\.elf$/, '.map');
  if (!fs.existsSync(mapPath)) return [];
  
  const regions: MemoryRegion[] = [];
  try {
    const data = fs.readFileSync(mapPath, 'utf8');
    const configIdx = data.indexOf('Memory Configuration');
    if (configIdx === -1) return [];
    
    // Extrapolate map layout structural blocks
    const lines = data.substring(configIdx).split('\n');
    let reading = false;
    for (const line of lines) {
        if (line.includes('Name') && line.includes('Origin') && line.includes('Length')) {
            reading = true;
            continue;
        }
        if (!reading) continue;
        if (line.trim() === '') break; // Ends on the very first blank line following Memory Configuration boundaries securely
        
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 3) {
            const rName = parts[0];
            const start = parseInt(parts[1], 16);
            const size = parseInt(parts[2], 16);
            if (!isNaN(start) && !isNaN(size) && size > 0 && rName !== '*default*') {
                regions.push({ name: rName, start: start, end: start + size });
            }
        }
    }
  } catch(e) {
  }
  return regions;
}
/**
 * Executes the `nm` subsystem to extract detailed structural sizes matching execution offsets.
 */
export async function resolveElfSymbols(
  elfPath: string,
  logData: any[]
): Promise<any[]> {
  // Present a native VS Code progress bar indicating long-running tasks seamlessly.
  return vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: "Loading ELF Symbols (-l formatting)...",
    cancellable: false
  }, async (progress) => {
    return new Promise<any[]>((resolve) => {
      // Execute the native `nm` binary dynamically pulling virtual section scopes 
      // with a dynamic memory buffer constraint avoiding NodeJS heap fatalities.
      const config = vscode.workspace.getConfiguration('sofLogger');
      const maxMemMB = config.get<number>('bufferSizeMB', 50);

      cp.exec(`nm -nS -l ${elfPath}`, { maxBuffer: 1024 * 1024 * maxMemMB }, (error: any, stdout: string) => {
        if (error) {
          vscode.window.showErrorMessage('Error reading elf: ' + error.message);
          console.error("Fatal exception invoking nm process.", error);
          resolve([]);
          return;
        }
        
        // Output array formatting ELF segments linearly internally
        const symbols: {addr: number, size: number, name: string, file?: string, line?: number, sect?: string}[] = [];
        const lines = stdout.split('\n');
        for (const rawLine of lines) {
          const rawParts = rawLine.trim().split(/\t/);
          const lineData = rawParts[0];
          const fileData = rawParts.length > 1 ? rawParts[1] : undefined;
          const parts = lineData.trim().split(/\s+/);

          let file, lineNum;
          if (fileData) {
             const idx = fileData.lastIndexOf(':');
             if (idx !== -1) {
                file = fileData.substring(0, idx);
                lineNum = parseInt(fileData.substring(idx + 1), 10);
             } else {
                file = fileData;
             }
          }

          let addrStr, sizeStr, typeChar, nameStr;
          if (parts.length >= 4) {
             addrStr = parts[0]; sizeStr = parts[1]; typeChar = parts[2]; nameStr = parts[3];
          } else if (parts.length === 3) {
             addrStr = parts[0]; sizeStr = "0"; typeChar = parts[1]; nameStr = parts[2];
          } else {
             continue;
          }
          
          const tChar = typeChar.toLowerCase();
          if (['t', 'w', 'b', 'd', 'r', 'c', 'v', 'g', 'a'].includes(tChar)) {
              let sect = 'text';
              if (tChar === 'r') sect = 'rodata';
              else if (tChar === 'd' || tChar === 'v' || tChar === 'g') sect = 'data';
              else if (tChar === 'b' || tChar === 'c') sect = 'bss';
              
              symbols.push({
                addr: parseInt(addrStr, 16),
                size: parseInt(sizeStr, 16),
                name: nameStr,
                file: file,
                line: lineNum,
                sect: sect
              });
          }
        }

        applyElfSymbols(logData, symbols);
        
        vscode.window.showInformationMessage('Successfully resolved ' + symbols.length + ' ELF format symbols natively via: ' + path.basename(elfPath));
        resolve(symbols);
      });
    });
  });
}

export function applyElfSymbols(logData: any[], symbols: any[]) {
  if (!symbols || symbols.length === 0) return;
  for (const d of logData) {
    if (d.funcAddr !== undefined) {
      const addr = d.funcAddr;
      let low = 0, high = symbols.length - 1;
      let closestIndex = -1;
      
      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        if (symbols[mid].addr <= addr) {
          closestIndex = mid;
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      }
      if (closestIndex !== -1) {
        const sym = symbols[closestIndex];
        if (sym.size > 0 && addr >= sym.addr + sym.size) {
          // Address exceeded strictly bound function size limit natively
        } else {
          d.funcName = sym.name;
          if (sym.file) d.file = sym.file;
          if (sym.line) d.line = sym.line;
        }
      }
    }
  }
}
