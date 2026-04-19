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
}

export interface MemoryRegion {
  name: string;
  start: number;
  end: number;
}

export interface ParseResult {
  dataPoints: LogDataPoint[];
  elfPath: string | null;
  memoryRegions?: MemoryRegion[];
}

export async function parseLogFile(filePath: string): Promise<ParseResult> {
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  const dataPoints: LogDataPoint[] = [];

  // Patterns
  // Matches [T:0x... C:0x...] OR [c:0 T:0x... C:0x...]
  const tRegex = /^\[(?:c:\d+\s+)?T:(0x[0-9a-fA-F]+)(?:\s+C:(0x[0-9a-fA-F]+))?/;
  // ps=0x0006002f or PS = 0x00060033
  const psRegex = /\b(?:ps|PS)\s*=\s*(0x[0-9a-fA-F]+)/;
  // Imiss=0 Dmiss=73728
  const missRegex = /Imiss=(\d+)\s+Dmiss=(\d+)/i;
  // FUNC ENTRY: pc=0xa10486f0 sp=0xa1042000 ps=0x0005002f a2=0x00000000 a3=0x00000000 a4=0x610485a0 a5=0xa1041fe0 a6=0x00000000 a7=0xa1040000
  const funcEntryRegex = /FUNC ENTRY:\s*pc=(0x[0-9a-fA-F]+)\s+sp=(0x[0-9a-fA-F]+)\s+ps=(0x[0-9a-fA-F]+)\s+a2=(0x[0-9a-fA-F]+)\s+a3=(0x[0-9a-fA-F]+)\s+a4=(0x[0-9a-fA-F]+)\s+a5=(0x[0-9a-fA-F]+)\s+a6=(0x[0-9a-fA-F]+)\s+a7=(0x[0-9a-fA-F]+)/;
  // FUNC RET: pc=0xa10481c6 sp=0xa1041fe0 ps=0x0006002f ret=0x00480000
  const funcRetRegex = /FUNC RET:\s*pc=(0x[0-9a-fA-F]+)\s+sp=(0x[0-9a-fA-F]+)\s+ps=(0x[0-9a-fA-F]+)\s+(?:ret|a2)=(0x[0-9a-fA-F]+)/;
  // Exceptions
  const excRegex = /EXCCAUSE\s*=\s*(\d+)/;
  // TLB Events: "TLB D lookup hit: addr=0x..."
  const tlbRegex = /\bTLB\s+([ID])\s+(.*)/i;
  const ioRegex = /\b([A-Za-z0-9_]+)\s+(read|write):\s+(.*)/i;
  // Firmware Linkage
  const firmwareRegex = /Loading\s+DSP\s+Firmware:\s+(.+)/i;
  // Memory Region Extraction
  const regionRegex = /^\s*(?:\[.*?\])?\s*([a-zA-Z0-9_-]+)\s*:\s*(0x[0-9a-fA-F]+)\s*-\s*(0x[0-9a-fA-F]+)/i;
  // Coherent Alias Extraction
  const aliasRegex = /^\s*(?:\[.*?\])?\s*([a-zA-Z0-9_-]+)\s+non-coherent:\s+\d+\s+core\s+shadows\s+@\s+(0x[0-9a-fA-F]+),\s+coherent\s+alias\s+@\s+(0x[0-9a-fA-F]+)\s+\(size\s+(0x[0-9a-fA-F]+)\)/i;

  let parsedRegions: MemoryRegion[] = [];

  let currentElfPath: string | null = null;
  let currentUM: number | null = null;
  let currentRing: number | null = null;
  let currentIntLevel: number | null = null;
  let currentIMiss: number | null = null;
  let currentDMiss: number | null = null;
  let currentCallDepth = 0;
  let currentT = 0;
  let currentC: number | null = null;

  for await (const line of rl) {
    const tMatch = line.match(tRegex);
    if (tMatch) {
      currentT = parseInt(tMatch[1], 16);
      if (tMatch[2]) {
        currentC = parseInt(tMatch[2], 16);
      }
    }

    let changed = false;
    let currentExc: number | null = null;
    let currentTlbType: 'I' | 'D' | null = null;
    let currentTlbDetails: any = null;
    let currentIoType: 'read' | 'write' | null = null;
    let currentIoDevice: string | null = null;
    let currentIoDetails: string | null = null;

    // Parse IO event
    const ioMatch = line.match(ioRegex);
    if (ioMatch) {
      currentIoDevice = ioMatch[1];
      currentIoType = ioMatch[2].toLowerCase() as 'read' | 'write';
      currentIoDetails = ioMatch[3];
      changed = true;
    }

    // Parse TLB event
    const tlbMatch = line.match(tlbRegex);
    if (tlbMatch) {
      if (!currentTlbType) currentTlbType = tlbMatch[1].toUpperCase() as 'I' | 'D';
      if (!currentTlbDetails) currentTlbDetails = tlbMatch[2];
      else currentTlbDetails += ' | ' + tlbMatch[2];
      changed = true;
    }

    // Parse Exception
    const excMatch = line.match(excRegex);
    if (excMatch) {
      currentExc = parseInt(excMatch[1], 10);
      changed = true;
    }

    let currentFuncAddr: number | null = null;
    let currentFuncArgs: string[] | null = null;
    let currentFuncRet: string | null = null;
    let currentFuncSp: string | null = null;

    // Parse FUNC ENTRY / RET
    const entryMatch = line.match(funcEntryRegex);
    if (entryMatch) {
      currentCallDepth++;
      changed = true;
      currentFuncAddr = parseInt(entryMatch[1], 16);
      currentFuncSp = entryMatch[2];
      currentFuncArgs = [entryMatch[4], entryMatch[5], entryMatch[6], entryMatch[7], entryMatch[8], entryMatch[9]];
    } else {
      const retMatch = line.match(funcRetRegex);
      if (retMatch) {
        currentCallDepth = Math.max(0, currentCallDepth - 1);
        changed = true;
        currentFuncAddr = parseInt(retMatch[1], 16);
        currentFuncSp = retMatch[2];
        currentFuncRet = retMatch[4];
      }
    }

    // Parse PS
      const firmwareMatch = line.match(firmwareRegex);
      if (firmwareMatch) {
        currentElfPath = firmwareMatch[1].trim();
      }

      const regionMatch = line.match(regionRegex);
      if (regionMatch) {
         parsedRegions.push({
            name: regionMatch[1].trim(),
            start: parseInt(regionMatch[2], 16),
            end: parseInt(regionMatch[3], 16)
         });
      }

      const aliasMatch = line.match(aliasRegex);
      if (aliasMatch) {
         const baseName = aliasMatch[1].trim();
         const nStart = parseInt(aliasMatch[2], 16);
         const cStart = parseInt(aliasMatch[3], 16);
         const size = parseInt(aliasMatch[4], 16);
         parsedRegions.push({ name: baseName + '-non-coherent', start: nStart, end: nStart + size - 1 });
         parsedRegions.push({ name: baseName + '-coherent', start: cStart, end: cStart + size - 1 });
      }

      const psMatch = line.match(psRegex);
    if (psMatch) {
      const psVal = parseInt(psMatch[1], 16);
      const intLevel = psVal & 0xF;
      const um = (psVal >> 5) & 0x1;
      const ring = (psVal >> 6) & 0x3;

      currentIntLevel = intLevel;
      currentUM = um;
      currentRing = ring;
      changed = true;
    }

    // Parse Cache Misses
    const missMatch = line.match(missRegex);
    if (missMatch) {
      const imiss = parseInt(missMatch[1], 10);
      const dmiss = parseInt(missMatch[2], 10);

      if (currentIMiss !== imiss || currentDMiss !== dmiss) {
        currentIMiss = imiss;
        currentDMiss = dmiss;
        changed = true;
      }
    }

    if (changed) {
      dataPoints.push({
        t: currentT,
        um: currentUM !== null ? currentUM : undefined,
        ring: currentRing !== null ? currentRing : undefined,
        intLevel: currentIntLevel !== null ? currentIntLevel : undefined,
        iMiss: currentIMiss !== null ? currentIMiss : undefined,
        dMiss: currentDMiss !== null ? currentDMiss : undefined,
        callDepth: currentCallDepth,
        excCause: currentExc !== null ? currentExc : undefined,
        c: currentC !== null ? currentC : undefined,
        tlbType: currentTlbType !== null ? currentTlbType : undefined,
        tlbDetails: currentTlbDetails !== null ? currentTlbDetails : undefined,
        ioType: currentIoType !== null ? currentIoType : undefined,
        ioDevice: currentIoDevice !== null ? currentIoDevice : undefined,
        ioDetails: currentIoDetails !== null ? currentIoDetails : undefined,
        funcAddr: changed && currentFuncAddr !== null ? currentFuncAddr : undefined,
        funcSp: changed && currentFuncSp !== null ? currentFuncSp : undefined,
        funcArgs: changed && currentFuncArgs !== null ? currentFuncArgs : undefined,
        funcRet: changed && currentFuncRet !== null ? currentFuncRet : undefined,
      });

      // Reset transients
      currentExc = null;
      currentTlbType = null;
      currentTlbDetails = null;
      currentIoType = null;
      currentIoDevice = null;
      currentIoDetails = null;
      currentFuncAddr = null;
      currentFuncSp = null;
      currentFuncArgs = null;
      currentFuncRet = null;
    }
  }

  return { dataPoints, elfPath: currentElfPath, memoryRegions: parsedRegions };
}
