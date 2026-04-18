import * as fs from 'fs';
import * as readline from 'readline';

export interface LogDataPoint {
  t: number;
  um: number | null;
  ring: number | null;
  intLevel: number | null;
  iMiss: number | null;
  dMiss: number | null;
  callDepth: number | null;
  excCause: number | null;
  c: number | null;
  tlbType: 'I' | 'D' | null;
  tlbDetails: string | null;
  ioType: 'read' | 'write' | null;
  ioDevice: string | null;
  ioDetails: string | null;
  funcAddr?: number;
  funcArgs?: string[];
  funcRet?: string;
  funcName?: string;
}

export async function parseLogFile(filePath: string): Promise<LogDataPoint[]> {
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
  // FUNC RET: pc=0xa10481c6 sp=0xa1041fe0 ps=0x0006002f a2=0x00000000
  const funcRetRegex = /FUNC RET:\s*pc=(0x[0-9a-fA-F]+)\s+sp=(0x[0-9a-fA-F]+)\s+ps=(0x[0-9a-fA-F]+)\s+a2=(0x[0-9a-fA-F]+)/;
  // Exceptions
  const excRegex = /EXCCAUSE\s*=\s*(\d+)/;
  // TLB Events: "TLB D lookup hit: addr=0x..."
  const tlbRegex = /\bTLB\s+([ID])\s+(.*)/i;
  // IO Events: "DSPCS read: addr=0x50 size=4 val=0x0"
  const ioRegex = /\b([A-Za-z0-9_]+)\s+(read|write):\s+(.*)/i;

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
    
    if (!currentT) continue;

    let changed = false;
    let currentExc: number | null = null;
    let currentTlbType: 'I' | 'D' | null = null;
    let currentTlbDetails: string | null = null;
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
      currentTlbType = tlbMatch[1].toUpperCase() as 'I' | 'D';
      currentTlbDetails = tlbMatch[2];
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

    // Parse FUNC ENTRY / RET
    const entryMatch = line.match(funcEntryRegex);
    if (entryMatch) {
      currentCallDepth++;
      changed = true;
      currentFuncAddr = parseInt(entryMatch[1], 16);
      currentFuncArgs = [entryMatch[4], entryMatch[5], entryMatch[6], entryMatch[7], entryMatch[8], entryMatch[9]];
    } else {
      const retMatch = line.match(funcRetRegex);
      if (retMatch) {
        currentCallDepth = Math.max(0, currentCallDepth - 1);
        changed = true;
        currentFuncAddr = parseInt(retMatch[1], 16);
        currentFuncRet = retMatch[4];
      }
    }

    // Parse PS
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
        um: currentUM,
        ring: currentRing,
        intLevel: currentIntLevel,
        iMiss: currentIMiss,
        dMiss: currentDMiss,
        callDepth: currentCallDepth,
        excCause: currentExc,
        c: currentC,
        tlbType: currentTlbType,
        tlbDetails: currentTlbDetails,
        ioType: currentIoType,
        ioDevice: currentIoDevice,
        ioDetails: currentIoDetails,
        funcAddr: currentFuncAddr !== null ? currentFuncAddr : undefined,
        funcArgs: currentFuncArgs !== null ? currentFuncArgs : undefined,
        funcRet: currentFuncRet !== null ? currentFuncRet : undefined
      });
    }
  }

  return dataPoints;
}
