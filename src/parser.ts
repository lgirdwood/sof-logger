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
}

export async function parseLogFile(filePath: string): Promise<LogDataPoint[]> {
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  const dataPoints: LogDataPoint[] = [];

  // Patterns
  // [T:0x000023c2 ...]
  const tRegex = /^\[T:(0x[0-9a-fA-F]+)\s.*\]/;
  // ps=0x0006002f or PS = 0x00060033
  const psRegex = /ps\s*=\s*(0x[0-9a-fA-F]+)/i;
  // Imiss=0 Dmiss=73728
  const missRegex = /Imiss=(\d+)\s+Dmiss=(\d+)/i;
  // FUNC ENTRY / FUNC RET
  const funcEntryRegex = /FUNC ENTRY:/;
  const funcRetRegex = /FUNC RET:/;

  let currentUM: number | null = null;
  let currentRing: number | null = null;
  let currentIntLevel: number | null = null;
  let currentIMiss: number | null = null;
  let currentDMiss: number | null = null;
  let currentCallDepth = 0;

  for await (const line of rl) {
    const tMatch = line.match(tRegex);
    if (!tMatch) continue;

    const currentT = parseInt(tMatch[1], 16);
    let changed = false;

    // Parse FUNC ENTRY / RET
    if (funcEntryRegex.test(line)) {
      currentCallDepth++;
      changed = true;
    } else if (funcRetRegex.test(line)) {
      currentCallDepth = Math.max(0, currentCallDepth - 1);
      changed = true;
    }

    // Parse PS
    const psMatch = line.match(psRegex);
    if (psMatch) {
      const psVal = parseInt(psMatch[1], 16);
      const intLevel = psVal & 0xF;
      const um = (psVal >> 5) & 0x1;
      const ring = (psVal >> 6) & 0x3;

      if (currentIntLevel !== intLevel || currentUM !== um || currentRing !== ring) {
        currentIntLevel = intLevel;
        currentUM = um;
        currentRing = ring;
        changed = true;
      }
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
        callDepth: currentCallDepth
      });
    }
  }

  // Deduplicate points with the exact same 'T' (keep latest values)
  const uniquePoints: LogDataPoint[] = [];
  for (let i = 0; i < dataPoints.length; i++) {
    if (i < dataPoints.length - 1 && dataPoints[i].t === dataPoints[i + 1].t) {
      continue;
    }
    uniquePoints.push(dataPoints[i]);
  }

  return uniquePoints;
}
