import * as fs from 'fs';
import * as readline from 'readline';

/**
 * Interface structurally representing a single execution tick or CPU state change
 * processed sequentially from the UART / Zephyr debugging terminals.
 */
export interface LogDataPoint {
  t: number;                  // Core tick constraint / timing measurement
  c?: number;                 // Sub-cycle clock constraint
  core?: number;              // Target DSP Core Identifier explicitly (e.g. Core 0)
  um?: number;                // User Mode execution isolation flags (0/1)
  ring?: number;              // Privilege Ring Execution level
  intLevel?: number;          // Native interrupt hardware masking levels
  excCause?: number;          // Xtensa EXCCAUSE execution termination signals
  excVaddr?: string;          // Extracted Exception Faulting Address natively dynamically logically
  isZephyrFatal?: boolean;    // Explicitly flags hardware termination logs logically
  tlbType?: 'I' | 'D';        // TLB type: Instruction or Data
  tlbDetails?: string;        // Explicit string detailing TLB metadata
  ioType?: 'read' | 'write';  // Hardware IO execution bounds natively
  ioDevice?: string;          // Extrapolated Device Name connected to IO
  ioDetails?: string;         // Detailed payload tracing bytes/sizes
  iMiss?: number | null;      // Instruction Cache miss counts cumulatively
  dMiss?: number | null;      // Data Cache miss counts cumulatively
  callDepth?: number;         // Dynamic execution stack depths actively managed
  funcAddr?: number;          // Pure Execution Program Counter Virtual Address
  funcSp?: string;            // Exact Stack Pointer bounds
  funcName?: string;          // Symbolically resolved string identifying ASM/C routine
  funcArgs?: string[];        // Array extrapolating execution arguments natively
  funcRet?: string;           // Optional function return literal pointer/address
  file?: string;              // Host file directory containing the resolved symbol natively
  line?: number;              // Source execution line natively binding logical statements
  caller?: string;            // Identifying parent frames abstractly
  raw?: string;               // Exact unparsed string footprint linearly evaluated
}

/**
 * Bounds defining spatial location memory assignments securely
 */
export interface MemoryRegion {
  name: string;               // Symbolic structural binding identity (e.g. HPSRAM)
  start: number;              // Originating boundary
  end: number;                // Ending capacity constraint boundary natively
}

/**
 * Extrapolation of structural memory constraints specifically tracking 
 * block counts internally from device hardware definitions.
 */
export interface SramTopology {
  name: string;               // Top level block identity (e.g. L2 SRAM)
  banks: number;              // Total distinct memory blocks bound inside SRAM
  bankSize: number;           // Uniform memory footprint across identical blocks
}

/**
 * Packaging natively representing a cohesive parsed data block explicitly.
 */
export interface ParseResult {
  dataPoints: LogDataPoint[];              // Dynamic state log execution streams array
  elfPath: string | null;                  // Dynamically located zephyr executable from log headers
  memoryRegions?: MemoryRegion[];          // Spatial configurations detected dynamically natively
  sramTopologies?: SramTopology[];         // Exact bank geometries internally captured dynamically
}

/**
 * The standard stateful parser ingesting incremental tail buffers across local executions
 * logically preserving memory frames between asynchronous evaluation ticks.
 */
export class IncrementalLogParser {
  private fd: number = -1;                          // File descriptor natively hooked to the UART target
  private offset: number = 0;                       // Offset bytes read allowing incremental sequential execution seamlessly
  private remainder: string = '';                   // Fragment preserved ensuring multi-line strings merge cleanly

  // Persistent logical tracking variables persisting across asynchronous iterations securely
  private currentElfPath: string | null = null;
  private currentUM: number | null = null;
  private currentRing: number | null = null;
  private currentIntLevel: number | null = null;
  private currentIMiss: number | null = null;
  private currentDMiss: number | null = null;
  private currentCallDepth = 0;
  private currentT = 0;
  private currentC: number | null = null;
  private lastExceptionPoint: LogDataPoint | null = null;

  // Statically tracked topologies collected throughout early execution frames
  private parsedRegions: MemoryRegion[] = [];
  private parsedSramTopologies: SramTopology[] = [];

  private isUnwindingFatalStack: boolean = false;

  // Central mapping RegExp sequences optimizing extraction stringently
  private zephyrFatalRegex = /ZEPHYR FATAL ERROR/i;
  private regDumpRegex = /pc=(0x[0-9a-fA-F]+)\s+a0=(0x[0-9a-fA-F]+)/i;
  private stackDumpRegex = /^\s*(0x[0-9a-fA-F]{8})(?:\s+(0x[0-9a-fA-F]{8}))?/i;

  private tRegex = /^\[(?:c:\d+\s+)?T:(0x[0-9a-fA-F]+)(?:\s+C:(0x[0-9a-fA-F]+))?/;
  private psRegex = /\b(?:ps|PS)\s*=\s*(0x[0-9a-fA-F]+)/;
  private missRegex = /Imiss=(\d+)\s+Dmiss=(\d+)/i;
  // Execution constraints evaluating nested arguments rigorously
  private funcEntryRegex = /FUNC ENTRY:\s*pc=(0x[0-9a-fA-F]+)\s+sp=(0x[0-9a-fA-F]+)\s+ps=(0x[0-9a-fA-F]+)\s+a2=(0x[0-9a-fA-F]+)\s+a3=(0x[0-9a-fA-F]+)\s+a4=(0x[0-9a-fA-F]+)\s+a5=(0x[0-9a-fA-F]+)\s+a6=(0x[0-9a-fA-F]+)\s+a7=(0x[0-9a-fA-F]+)/;
  private funcRetRegex = /FUNC RET:\s*pc=(0x[0-9a-fA-F]+)\s+sp=(0x[0-9a-fA-F]+)\s+ps=(0x[0-9a-fA-F]+)\s+(?:ret|a2)=(0x[0-9a-fA-F]+)/;
  private excRegex = /EXCCAUSE\s*=?\s*(\d+)/i;
  private vaddrRegex = /\bVADDR\s*=?\s*(0x[0-9a-fA-F]+)/i;
  private tlbRegex = /\bTLB\s+([ID])\s+(.*)/i;
  private ioRegex = /\b([A-Za-z0-9_]+)\s+(read|write):\s+(.*)/i;
  private firmwareRegex = /Loading\s+DSP\s+Firmware:\s+(.+)/i;
  private regionRegex = /^\s*(?:\[.*?\])?\s*([a-zA-Z0-9_-]+)\s*:\s*(0x[0-9a-fA-F]+)\s*-\s*(0x[0-9a-fA-F]+)/i;
  private sramTopologyRegex = /^\s*(?:\[.*?\])?\s*([a-zA-Z0-9_-]+)\s*:\s*(\d+)\s+banks of (0x[0-9a-fA-F]+)\s+bytes/i;
  private aliasRegex = /^\s*(?:\[.*?\])?\s*([a-zA-Z0-9_-]+)\s+non-coherent:\s+\d+\s+core\s+shadows\s+@\s+(0x[0-9a-fA-F]+),\s+coherent\s+alias\s+@\s+(0x[0-9a-fA-F]+)\s+\(size\s+(0x[0-9a-fA-F]+)\)/i;

  constructor(private filePath: string) {}

  /**
   * Evaluates trailing chunks progressively updating dynamic memory tracking parameters.
   * Invoked via periodic polling seamlessly evaluating new file lengths directly natively.
   * 
   * @returns ParseResult Object array containing distinct structural datapoints logically assigned securely
   */
  public parseNext(): ParseResult {
    const dataPoints: LogDataPoint[] = [];

    // Initialize raw file descriptor binding immediately gracefully surviving uncreated files 
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
      // Evaluate static boundaries securely computing raw bytes delta natively
      const stat = fs.fstatSync(this.fd);
      if (stat.size <= this.offset) {
        // Handle file truncation safely seamlessly gracefully (e.g. QEMU log rotated / reset)
        if (stat.size < this.offset) {
           this.offset = 0;
           this.remainder = '';
        } else {
           return { dataPoints: [], elfPath: this.currentElfPath, memoryRegions: this.parsedRegions, sramTopologies: this.parsedSramTopologies };
        }
      }

      // Pre-allocate buffer matching delta exactly eliminating overhead
      const lengthToRead = stat.size - this.offset;
      const buf = Buffer.alloc(lengthToRead);
      fs.readSync(this.fd, buf, 0, lengthToRead, this.offset);
      this.offset += lengthToRead;

      // Concatenate fractional leftovers with complete utf8 payload
      let chunk = this.remainder + buf.toString('utf8');
      
      // If we don't end in a newline, reserve the last part back into remainder exactly escaping bad regex breaks 
      const endsWithNewline = chunk.endsWith('\n') || chunk.endsWith('\r');
      const lines = chunk.split(/\r?\n/);

      if (!endsWithNewline) {
        this.remainder = lines.pop() || '';
      } else {
        this.remainder = '';
        if (lines[lines.length - 1] === '') lines.pop(); // Remove naturally empty slice dynamically correctly
      }

      // Linear iterative processing block
      for (const line of lines) {
        if (!line.trim()) continue;

        // Extract timing properties natively globally assigned avoiding redundancy
        const tMatch = line.match(this.tRegex);
        if (tMatch) {
          this.currentT = parseInt(tMatch[1], 16);
          if (tMatch[2]) {
            this.currentC = parseInt(tMatch[2], 16);
          }
        }

        let changed = false;
        let currentExc: number | null = null;
        let isCurrentFatal: boolean = false;
        let currentTlbType: 'I' | 'D' | null = null;
        let currentTlbDetails: any = null;
        let currentIoType: 'read' | 'write' | null = null;
        let currentIoDevice: string | null = null;
        let currentIoDetails: string | null = null;

        // Process Device Hardware Interactions
        const ioMatch = line.match(this.ioRegex);
        if (ioMatch) {
          currentIoDevice = ioMatch[1];
          currentIoType = ioMatch[2].toLowerCase() as 'read' | 'write';
          currentIoDetails = ioMatch[3];
          changed = true;
        }

        // Process Cache/Memory Controller Metadata Log Traces
        const tlbMatch = line.match(this.tlbRegex);
        if (tlbMatch) {
          if (!currentTlbType) currentTlbType = tlbMatch[1].toUpperCase() as 'I' | 'D';
          if (!currentTlbDetails) currentTlbDetails = tlbMatch[2];
          else currentTlbDetails += ' | ' + tlbMatch[2];
          changed = true;
        } else {
          // Native structural reset logs explicitly denoting mapping boundaries
          const resetMmuMatch = line.match(/way=\d+\s+entry=\d+\s+(vaddr=.*)/i);
          if (resetMmuMatch) {
            if (!currentTlbType) currentTlbType = 'I';
            currentTlbDetails = resetMmuMatch[1] + " page_size=0x20000000";
            changed = true;
          }
        }

        // Interrupt / Exception Cause mapping natively capturing Privilege Faults explicitly
        const zephyrFatalMatch = line.match(this.zephyrFatalRegex);
        if (zephyrFatalMatch) {
            currentExc = 63; // Map directly implicitly bypassing undefined capture structurally safely seamlessly
            isCurrentFatal = true;
            this.isUnwindingFatalStack = true;
            changed = true;
        } else {
            const excMatch = line.match(this.excRegex);
            if (excMatch) {
              currentExc = parseInt(excMatch[1], 10);
              changed = true;
            } else if (line.toLowerCase().includes('privilege error')) {
              changed = true;
            }
        }

        const vaddrMatch = line.match(this.vaddrRegex);
        if (vaddrMatch && this.lastExceptionPoint) {
            this.lastExceptionPoint.excVaddr = vaddrMatch[1];
        }

        let currentFuncAddr: number | null = null;
        let currentFuncArgs: string[] | null = null;
        let currentFuncRet: string | null = null;
        let currentFuncSp: string | null = null;

        // Recursive Stack Evaluator assigning depths systematically
        const entryMatch = line.match(this.funcEntryRegex);
        const retMatch = line.match(this.funcRetRegex);
        
        if (entryMatch) {
          this.currentCallDepth++; // Increment context linearly natively
          changed = true;
          this.isUnwindingFatalStack = false; // Reset exclusively returning to healthy tracking dynamically appropriately securely natively!
          currentFuncAddr = parseInt(entryMatch[1], 16);
          currentFuncSp = entryMatch[2];
          currentFuncArgs = [entryMatch[4], entryMatch[5], entryMatch[6], entryMatch[7], entryMatch[8], entryMatch[9]];
        } else if (retMatch) {
          this.currentCallDepth = Math.max(0, this.currentCallDepth - 1); // Decrement carefully bypassing negative dips seamlessly natively correctly organically cleverly explicitly
          changed = true;
          this.isUnwindingFatalStack = false; // Normal execution explicitly resumes securely dynamically automatically efficiently optimally 
          currentFuncAddr = parseInt(retMatch[1], 16);
          currentFuncSp = retMatch[2];
          currentFuncRet = retMatch[4];
        } else if (this.isUnwindingFatalStack) {
          const regDumpMatch = line.match(this.regDumpRegex);
          if (regDumpMatch) {
            this.currentCallDepth = Math.max(0, this.currentCallDepth - 1);
            changed = true;
            currentFuncAddr = parseInt(regDumpMatch[2], 16);
            currentFuncRet = regDumpMatch[1];
          } else {
            const stackDumpMatch = line.match(this.stackDumpRegex);
            if (stackDumpMatch && this.currentCallDepth > 0) {
              this.currentCallDepth = Math.max(0, this.currentCallDepth - 1);
              changed = true;
              currentFuncRet = stackDumpMatch[1];
            }
          }
        }

        // Extract native executable pointers mapping strictly matching active sessions exclusively
        const firmwareMatch = line.match(this.firmwareRegex);
        if (firmwareMatch) {
          this.currentElfPath = firmwareMatch[1].trim();
        }

        // Topology Evaluators recursively capturing system allocations implicitly printed via Zephyr natively
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

        // Processor state evaluations deriving Privilege execution natively
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

        // Cache miss evaluator aggregating seamlessly
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

        // Compile distinct structured point matching exclusively modified nodes avoiding redundant empty loops
        if (changed) {
          const pt: LogDataPoint = {
            t: this.currentT,
            um: this.currentUM !== null ? this.currentUM : undefined,
            ring: this.currentRing !== null ? this.currentRing : undefined,
            intLevel: this.currentIntLevel !== null ? this.currentIntLevel : undefined,
            iMiss: this.currentIMiss !== null ? this.currentIMiss : undefined,
            dMiss: this.currentDMiss !== null ? this.currentDMiss : undefined,
            callDepth: this.currentCallDepth,
            excCause: currentExc !== null ? currentExc : undefined,
            isZephyrFatal: isCurrentFatal ? true : undefined,
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
          };
          if (currentExc !== null || line.toLowerCase().includes('privilege error')) {
              this.lastExceptionPoint = pt;
          }
          dataPoints.push(pt);
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

  /**
   * Graceful destruction terminating active handles completely cleanly securely.
   */
  public close() {
    if (this.fd !== -1) {
      try {
        fs.closeSync(this.fd);
      } catch (e) {}
      this.fd = -1;
    }
  }
}
