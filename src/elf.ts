import * as vscode from 'vscode';
import * as path from 'path';
import * as cp from 'child_process';
import * as fs from 'fs';
import { MemoryRegion } from './parser';

/**
 * Parses the `.map` file adjacent to the compiled Zephyr ELF natively.
 * It strictly extrapolates topological core memory bounds (e.g. HPSRAM, LPSRAM)
 * evaluating size constraints provided structurally by the linker.
 * 
 * @param elfPath The absolute path to the local `zephyr.elf` executable.
 * @returns An array of structurally mapped memory regions containing execution sizes.
 */
export function parseZephyrMap(elfPath: string): MemoryRegion[] {
  // Discover map file equivalently to ELF structural path
  const mapPath = elfPath.replace(/\.elf$/, '.map');
  if (!fs.existsSync(mapPath)) return [];
  
  const regions: MemoryRegion[] = [];
  try {
    const data = fs.readFileSync(mapPath, 'utf8');
    
    // Locate the structural Configuration boundary natively
    const configIdx = data.indexOf('Memory Configuration');
    if (configIdx === -1) return [];
    
    // Extrapolate map layout structural blocks
    const lines = data.substring(configIdx).split('\n');
    let reading = false;
    for (const line of lines) {
        // Detect the memory table header configuration explicitly
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
            
            // Bypass null/default regions appending strictly evaluated structural memory
            if (!isNaN(start) && !isNaN(size) && size > 0 && rName !== '*default*') {
                regions.push({ name: rName, start: start, end: start + size });
            }
        }
    }
  } catch(e) {
      // Silently fail allowing upstream logic to handle map absence gracefully natively
  }
  return regions;
}

/**
 * Executes the `nm` subsystem to extract detailed structural sizes matching execution offsets.
 * Parses the output natively constructing a mapped array of all function pointers and symbols.
 * 
 * @param elfPath The absolute path to the local `zephyr.elf` executable.
 * @param logData Array of parsed logs to mutate natively once bindings arrive.
 * @returns Promise evaluating a fully structural array of program functions and addresses.
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
        
        // Process each nm output line iteratively natively evaluating object locations
        for (const rawLine of lines) {
          const rawParts = rawLine.trim().split(/\t/);
          const lineData = rawParts[0];
          const fileData = rawParts.length > 1 ? rawParts[1] : undefined;
          const parts = lineData.trim().split(/\s+/);

          // Locate execution pointer directives containing filepath and local lines
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
             // Standard size-annotated symbol format
             addrStr = parts[0]; sizeStr = parts[1]; typeChar = parts[2]; nameStr = parts[3];
          } else if (parts.length === 3) {
             // Assembly / un-sized symbol format evaluating size as '0' locally 
             addrStr = parts[0]; sizeStr = "0"; typeChar = parts[1]; nameStr = parts[2];
          } else {
             // Extraneous block
             continue;
          }
          
          const tChar = typeChar.toLowerCase();
          
          // Only evaluate execution blocks (e.g. data, text, bss directives natively)
          if (['t', 'w', 'b', 'd', 'r', 'c', 'v', 'g', 'a'].includes(tChar)) {
              let sect = 'text';
              if (tChar === 'r') sect = 'rodata';
              else if (tChar === 'd' || tChar === 'v' || tChar === 'g') sect = 'data';
              else if (tChar === 'b' || tChar === 'c') sect = 'bss';
              
              // Push the successfully resolved location symbol globally
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

        // Evaluate earlier empty log data instances natively replacing pointers
        applyElfSymbols(logData, symbols);
        
        vscode.window.showInformationMessage('Successfully resolved ' + symbols.length + ' ELF format symbols natively via: ' + path.basename(elfPath));
        resolve(symbols);
      });
    });
  });
}

/**
 * Iterates across pre-loaded dynamic execution data log strings linearly 
 * converting abstract address pointers immediately into nested native symbol names via binary lookups.
 * 
 * @param logData Mutable log arrays representing dynamic UART executions natively.
 * @param symbols Pre-sorted array of internal parsed ELF structural pointer elements.
 */
export function applyElfSymbols(logData: any[], symbols: any[]) {
  // Ignore logic if ELF has not instantiated completely 
  if (!symbols || symbols.length === 0) return;
  
  for (const d of logData) {
    // If the logical node possesses an abstract PC/VADDR explicitly natively
    if (d.funcAddr !== undefined) {
      const addr = d.funcAddr;
      let low = 0, high = symbols.length - 1;
      let closestIndex = -1;
      
      // Perform Binary search recursively traversing the sorted list structurally identifying offsets
      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        if (symbols[mid].addr <= addr) {
          closestIndex = mid;
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      }
      
      // If a match falls behind the pointer bounds natively
      if (closestIndex !== -1) {
        const sym = symbols[closestIndex];
        
        // Ensure execution explicitly resides inside boundary lengths natively if length strictly supplied
        if (sym.size > 0 && addr >= sym.addr + sym.size) {
          // Address exceeded strictly bound function size limit natively - silently ignore fallback!
        } else {
          // Convert properties securely inside log pointer structures
          d.funcName = sym.name;
          if (sym.file) d.file = sym.file;
          if (sym.line) d.line = sym.line;
        }
      }
    }
  }
}
