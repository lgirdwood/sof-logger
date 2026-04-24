import * as fs from 'fs';
import * as readline from 'readline';

export interface LogDataPoint {
  t: number;
  c?: number;
  core?: number;
  um?: number;
  ring?: number;
  intLevel?: number;
  excCause?: number;
  tlbType?: 'I' | 'D';
  tlbDetails?: string;
  ioType?: 'read' | 'write';
  ioDevice?: string;
  ioDetails?: string;
  iMiss?: number | null;
  dMiss?: number | null;
  callDepth?: number;
  funcAddr?: number;
  funcSp?: string;
  funcName?: string;
  funcArgs?: string[];
  funcRet?: string;
  file?: string;
  line?: number;
  caller?: string;
  raw?: string;
}

export interface MemoryRegion {
  name: string;
  start: number;
  end: number;
}

export interface SramTopology {
  name: string;
  banks: number;
  bankSize: number;
}

export interface ParseResult {
  dataPoints: LogDataPoint[];
  elfPath: string | null;
  memoryRegions?: MemoryRegion[];
  sramTopologies?: SramTopology[];
}

export class IncrementalLogParser {
  private fd: number = -1;
  private offset: number = 0;
  private remainder: string = '';

  private currentElfPath: string | null = null;
  private currentUM: number | null = null;
  private currentRing: number | null = null;
  private currentIntLevel: number | null = null;
  private currentIMiss: number | null = null;
  private currentDMiss: number | null = null;
  private currentCallDepth = 0;
  private currentT = 0;
  private currentC: number | null = null;

  private parsedRegions: MemoryRegion[] = [];
  private parsedSramTopologies: SramTopology[] = [];

  // Central mapping RegExp sequences
  private tRegex = /^\[(?:c:\d+\s+)?T:(0x[0-9a-fA-F]+)(?:\s+C:(0x[0-9a-fA-F]+))?/;
  private psRegex = /\b(?:ps|PS)\s*=\s*(0x[0-9a-fA-F]+)/;
  private missRegex = /Imiss=(\d+)\s+Dmiss=(\d+)/i;
  private funcEntryRegex = /FUNC ENTRY:\s*pc=(0x[0-9a-fA-F]+)\s+sp=(0x[0-9a-fA-F]+)\s+ps=(0x[0-9a-fA-F]+)\s+a2=(0x[0-9a-fA-F]+)\s+a3=(0x[0-9a-fA-F]+)\s+a4=(0x[0-9a-fA-F]+)\s+a5=(0x[0-9a-fA-F]+)\s+a6=(0x[0-9a-fA-F]+)\s+a7=(0x[0-9a-fA-F]+)/;
  private funcRetRegex = /FUNC RET:\s*pc=(0x[0-9a-fA-F]+)\s+sp=(0x[0-9a-fA-F]+)\s+ps=(0x[0-9a-fA-F]+)\s+(?:ret|a2)=(0x[0-9a-fA-F]+)/;
  private excRegex = /EXCCAUSE\s*=\s*(\d+)/;
  private tlbRegex = /\bTLB\s+([ID])\s+(.*)/i;
  private ioRegex = /\b([A-Za-z0-9_]+)\s+(read|write):\s+(.*)/i;
  private firmwareRegex = /Loading\s+DSP\s+Firmware:\s+(.+)/i;
  private regionRegex = /^\s*(?:\[.*?\])?\s*([a-zA-Z0-9_-]+)\s*:\s*(0x[0-9a-fA-F]+)\s*-\s*(0x[0-9a-fA-F]+)/i;
  private sramTopologyRegex = /^\s*(?:\[.*?\])?\s*([a-zA-Z0-9_-]+)\s*:\s*(\d+)\s+banks of (0x[0-9a-fA-F]+)\s+bytes/i;
  private aliasRegex = /^\s*(?:\[.*?\])?\s*([a-zA-Z0-9_-]+)\s+non-coherent:\s+\d+\s+core\s+shadows\s+@\s+(0x[0-9a-fA-F]+),\s+coherent\s+alias\s+@\s+(0x[0-9a-fA-F]+)\s+\(size\s+(0x[0-9a-fA-F]+)\)/i;

  constructor(private filePath: string) {}

  public parseNext(): ParseResult {
    const dataPoints: LogDataPoint[] = [];

    if (this.fd === -1) {
      if (!fs.existsSync(this.filePath)) {
        return { dataPoints: [], elfPath: this.currentElfPath, memoryRegions: this.parsedRegions, sramTopologies: this.parsedSramTopologies };
      }
      try {
        this.fd = fs.openSync(this.filePath, 'r');
      } catch (e) {
        return { dataPoints: [], elfPath: this.currentElfPath, memoryRegions: this.parsedRegions, sramTopologies: this.parsedSramTopologies };
      }
    }

    try {
      const stat = fs.fstatSync(this.fd);
      if (stat.size <= this.offset) {
        // Handle file truncation safely seamlessly gracefully
        if (stat.size < this.offset) {
           this.offset = 0;
           this.remainder = '';
        } else {
           return { dataPoints: [], elfPath: this.currentElfPath, memoryRegions: this.parsedRegions, sramTopologies: this.parsedSramTopologies };
        }
      }

      const lengthToRead = stat.size - this.offset;
      const buf = Buffer.alloc(lengthToRead);
      fs.readSync(this.fd, buf, 0, lengthToRead, this.offset);
      this.offset += lengthToRead;

      let chunk = this.remainder + buf.toString('utf8');
      
      // If we don't end in a newline, reserve the last part back into remainder
      const endsWithNewline = chunk.endsWith('\n') || chunk.endsWith('\r');
      const lines = chunk.split(/\r?\n/);

      if (!endsWithNewline) {
        this.remainder = lines.pop() || '';
      } else {
        this.remainder = '';
        if (lines[lines.length - 1] === '') lines.pop(); // Remove naturally empty slice dynamically correctly
      }

      for (const line of lines) {
        if (!line.trim()) continue;

        const tMatch = line.match(this.tRegex);
        if (tMatch) {
          this.currentT = parseInt(tMatch[1], 16);
          if (tMatch[2]) {
            this.currentC = parseInt(tMatch[2], 16);
          }
        }

        let changed = false;
        let currentExc: number | null = null;
        let currentTlbType: 'I' | 'D' | null = null;
        let currentTlbDetails: any = null;
        let currentIoType: 'read' | 'write' | null = null;
        let currentIoDevice: string | null = null;
        let currentIoDetails: string | null = null;

        const ioMatch = line.match(this.ioRegex);
        if (ioMatch) {
          currentIoDevice = ioMatch[1];
          currentIoType = ioMatch[2].toLowerCase() as 'read' | 'write';
          currentIoDetails = ioMatch[3];
          changed = true;
        }

        const tlbMatch = line.match(this.tlbRegex);
        if (tlbMatch) {
          if (!currentTlbType) currentTlbType = tlbMatch[1].toUpperCase() as 'I' | 'D';
          if (!currentTlbDetails) currentTlbDetails = tlbMatch[2];
          else currentTlbDetails += ' | ' + tlbMatch[2];
          changed = true;
        } else {
          const resetMmuMatch = line.match(/way=\d+\s+entry=\d+\s+(vaddr=.*)/i);
          if (resetMmuMatch) {
            if (!currentTlbType) currentTlbType = 'I';
            currentTlbDetails = resetMmuMatch[1] + " page_size=0x20000000";
            changed = true;
          }
        }

        const excMatch = line.match(this.excRegex);
        if (excMatch) {
          currentExc = parseInt(excMatch[1], 10);
          changed = true;
        } else if (line.toLowerCase().includes('privilege error')) {
          changed = true;
        }

        let currentFuncAddr: number | null = null;
        let currentFuncArgs: string[] | null = null;
        let currentFuncRet: string | null = null;
        let currentFuncSp: string | null = null;

        const entryMatch = line.match(this.funcEntryRegex);
        if (entryMatch) {
          this.currentCallDepth++;
          changed = true;
          currentFuncAddr = parseInt(entryMatch[1], 16);
          currentFuncSp = entryMatch[2];
          currentFuncArgs = [entryMatch[4], entryMatch[5], entryMatch[6], entryMatch[7], entryMatch[8], entryMatch[9]];
        } else {
          const retMatch = line.match(this.funcRetRegex);
          if (retMatch) {
            this.currentCallDepth = Math.max(0, this.currentCallDepth - 1);
            changed = true;
            currentFuncAddr = parseInt(retMatch[1], 16);
            currentFuncSp = retMatch[2];
            currentFuncRet = retMatch[4];
          }
        }

        const firmwareMatch = line.match(this.firmwareRegex);
        if (firmwareMatch) {
          this.currentElfPath = firmwareMatch[1].trim();
        }

        const regionMatch = line.match(this.regionRegex);
        if (regionMatch) {
          this.parsedRegions.push({
            name: regionMatch[1].trim(),
            start: parseInt(regionMatch[2], 16),
            end: parseInt(regionMatch[3], 16)
          });
        }
        
        const sramMatch = line.match(this.sramTopologyRegex);
        if (sramMatch) {
          this.parsedSramTopologies.push({
            name: sramMatch[1].trim(),
            banks: parseInt(sramMatch[2], 10),
            bankSize: parseInt(sramMatch[3], 16)
          });
        }

        const aliasMatch = line.match(this.aliasRegex);
        if (aliasMatch) {
          const baseName = aliasMatch[1].trim();
          const nStart = parseInt(aliasMatch[2], 16);
          const cStart = parseInt(aliasMatch[3], 16);
          const size = parseInt(aliasMatch[4], 16);
          this.parsedRegions.push({ name: baseName + '-non-coherent', start: nStart, end: nStart + size - 1 });
          this.parsedRegions.push({ name: baseName + '-coherent', start: cStart, end: cStart + size - 1 });
        }

        const psMatch = line.match(this.psRegex);
        if (psMatch) {
          const psVal = parseInt(psMatch[1], 16);
          const intLevel = psVal & 0xF;
          const um = (psVal >> 5) & 0x1;
          const ring = (psVal >> 6) & 0x3;

          this.currentIntLevel = intLevel;
          this.currentUM = um;
          this.currentRing = ring;
          changed = true;
        }

        const missMatch = line.match(this.missRegex);
        if (missMatch) {
          const imiss = parseInt(missMatch[1], 10);
          const dmiss = parseInt(missMatch[2], 10);

          if (this.currentIMiss !== imiss || this.currentDMiss !== dmiss) {
            this.currentIMiss = imiss;
            this.currentDMiss = dmiss;
            changed = true;
          }
        }

        if (changed) {
          dataPoints.push({
            t: this.currentT,
            um: this.currentUM !== null ? this.currentUM : undefined,
            ring: this.currentRing !== null ? this.currentRing : undefined,
            intLevel: this.currentIntLevel !== null ? this.currentIntLevel : undefined,
            iMiss: this.currentIMiss !== null ? this.currentIMiss : undefined,
            dMiss: this.currentDMiss !== null ? this.currentDMiss : undefined,
            callDepth: this.currentCallDepth,
            excCause: currentExc !== null ? currentExc : undefined,
            c: this.currentC !== null ? this.currentC : undefined,
            tlbType: currentTlbType !== null ? currentTlbType : undefined,
            tlbDetails: currentTlbDetails !== null ? currentTlbDetails : undefined,
            ioType: currentIoType !== null ? currentIoType : undefined,
            ioDevice: currentIoDevice !== null ? currentIoDevice : undefined,
            ioDetails: currentIoDetails !== null ? currentIoDetails : undefined,
            funcAddr: changed && currentFuncAddr !== null ? currentFuncAddr : undefined,
            funcSp: changed && currentFuncSp !== null ? currentFuncSp : undefined,
            funcArgs: changed && currentFuncArgs !== null ? currentFuncArgs : undefined,
            funcRet: changed && currentFuncRet !== null ? currentFuncRet : undefined,
            raw: line
          });
        }
      }
    } catch (ioErr) {
      console.error("Non-fatal delta read threshold interrupted: ", ioErr);
    }

    return { 
      dataPoints, 
      elfPath: this.currentElfPath, 
      memoryRegions: this.parsedRegions, 
      sramTopologies: this.parsedSramTopologies 
    };
  }

  public close() {
    if (this.fd !== -1) {
      try {
        fs.closeSync(this.fd);
      } catch (e) {}
      this.fd = -1;
    }
  }
}
