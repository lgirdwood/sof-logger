import * as vscode from 'vscode';

/**
 * Encapsulates a distinct Memory allocation or static topological segment inside the VS Code Treeview globally.
 * Implements bounds tracking evaluating exact nested boundaries for PC offsets seamlessly natively.
 */
export class MemoryItem extends vscode.TreeItem {
    public addr?: number;       // Exact numeric representation of natively allocated boundary origin
    public size?: number;       // Exact memory footprint consumed inside the execution subsystem dynamically
    
    constructor(
        public readonly label: string,                                     // Structural string representation appearing in UI 
        public readonly collapsibleState: vscode.TreeItemCollapsibleState, // Recursive state matching nested chain elements
        public readonly details?: string,                                  // Supplemental string details presented natively
        public readonly children?: MemoryItem[],                           // Internal associative arrays wrapping nested hierarchy 
        public readonly id?: string,                                       // Explicit identifier bypassing generic label deduplication
        public readonly command?: vscode.Command                           // Execution routing triggered instantly on clicks
    ) {
        super(label, collapsibleState);
        this.tooltip = this.label;
        if (this.details) {
            this.description = this.details;
        }
        if (this.id) {
            this.id = id;
        } else {
            this.id = label; // simple fallback enforcing baseline logical binding natively
        }
    }
}

/**
 * Detects if a native Zephyr execution pointer corresponds to a generative heap footprint explicitly.
 * Deflects de-allocator pointers (free, chunk evaluation) cleanly.
 * 
 * @param name Structural pointer trace function identifier
 * @param stackChain Nested call sequence isolating wrapper interfaces directly
 * @returns boolean true if node implements an allocation footprint dynamically
 */
function isAllocCall(name: string, stackChain: string[] = []): boolean {
    if (!name) return false;
    
    // Explicit override decoupling vmh internals from native pointers
    if (stackChain.includes('vmh_alloc')) return false;
    
    const n = name.toLowerCase();
    
    // Ignore garbage collection invocations
    if (n.includes('free') || n.includes('chunk')) return false;
    
    // Detect typical memory mapping pointers seamlessly
    return n.includes('alloc') || n.includes('rzalloc') || n.includes('vmh_alloc') || n.includes('heap_alloc');
}

/**
 * Extrapolates exact byte sizes from unformatted stack traces matching typical Zephyr internal architectures dynamically.
 * Standardizes sizes against arguments extracted from specific allocator hooks explicitly.
 * 
 * @param name Logged Pointer Function 
 * @param args Traced Register arguments A2 - A7 specifically parsed
 * @returns size footprint as a strict integer evaluated natively
 */
function guessAllocSize(name: string, args: string[]): number {
    if (!args) return 0;
    const n = name.toLowerCase();
    
    // Extrapolate numeric sizes safely against hex input strings
    const a = args.map(x => parseInt(x, 16) || 0);

    // Common L3 / Application size mappings securely
    if (n.includes('virtual_heap_alloc')) return a[2];
    if (n.includes('sof_heap_alloc')) return a[2];
    if (n.includes('l3_heap_alloc')) return a[2];
    if (n.includes('heap_alloc_aligned')) return a[2];
    
    // Advanced Core Ring assignments globally
    if (n.includes('rmalloc_align')) return a[1];
    if (n.includes('rmalloc')) return a[1];
    if (n.includes('rballoc_align')) return a[1];
    if (n.includes('rballoc')) return a[1];
    if (n.includes('rzalloc')) return a[1];
    if (n.includes('rbrealloc') || n.includes('realloc')) return a[2];
    if (n.includes('vmh_alloc')) return a[1];
    if (n.includes('sys_heap_aligned_alloc')) return a[2];
    if (n.includes('sys_heap_alloc') || n.includes('z_malloc_heap')) return a[1];
    
    // Fallback iteratively attempting conventional arguments dynamically
    return a[2] || a[1] || a[0];
}

/**
 * Safely extracts operational logic flags specifically injected by the Zephyr kernel mapping framework.
 * 
 * @param name Structural pointer trace function identifier
 * @param args Traced configuration arguments arrays natively 
 * @returns Strict hexadecimal string natively describing binding configurations optimally
 */
function guessAllocFlags(name: string, args: string[]): string {
    if (!args) return '0x0';
    const n = name.toLowerCase();
    if (n.includes('virtual_heap_alloc')) return args[1];
    if (n.includes('sof_heap_alloc')) return args[1];
    if (n.includes('rbrealloc') || n.includes('realloc')) return args[1];
    
    // Default ignore constraints matching isolated environments explicitly
    if (n.includes('sys_heap_') || n.includes('z_malloc_')) return 'N/A';
    if (n.includes('l3_heap_alloc') || n.includes('heap_alloc_aligned')) return 'N/A';
    if (n.includes('vmh_alloc')) return 'N/A';
    
    // Generic direct mapped pointer internally
    return args[0];
}

/**
 * Controller orchestrating interactive hierarchical expansions visually inside the VS Code editor constraints dynamically.
 */
export class MemoryTreeProvider implements vscode.TreeDataProvider<MemoryItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<MemoryItem | undefined | void> = new vscode.EventEmitter<MemoryItem | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<MemoryItem | undefined | void> = this._onDidChangeTreeData.event;

    // Ephemeral dynamic arrays capturing ongoing internal execution states linearly matching logic constraints
    private coreStacks: { [key: number]: any[] } = {};
    private heapAllocs: any[] = [];
    private finalHeapAllocs: any[] = [];
    
    // Processed rendering models directly driving the graphical UI dynamically
    private rootItems: MemoryItem[] = [];
    
    // Persistent structural layout preventing ELF wiping operations seamlessly across log resets
    private cachedStaticItems: MemoryItem[] | null = null;
    
    // Iterative searching parameter exclusively limiting memory item footprints seamlessly
    private searchString: string = '';

    /**
     * Integrates string parameters natively refreshing graphical interfaces selectively rendering isolated blocks seamlessly
     * 
     * @param val Evaluated search parameter natively matching textual descriptors or structural addresses dynamically
     */
    setSearchString(val: string) {
        this.searchString = val.toLowerCase();
        this._onDidChangeTreeData.fire();
    }

    /**
     * Executes internal resets avoiding destructive wipes strictly maintaining static cached allocations securely.
     */
    softClear(): void {
        this.coreStacks = {};
        this.heapAllocs = [];
        this.finalHeapAllocs = [];
        // Preserve immutable mappings across reboots exclusively dropping unlinked dynamic trees naturally
        this.rootItems = this.cachedStaticItems ? [...this.cachedStaticItems] : [];
        this._onDidChangeTreeData.fire();
    }

    /**
     * Deeply resets configurations erasing absolutely every traced mapping footprint explicitly ensuring strict native wipes
     */
    clear(): void {
        this.coreStacks = {};
        this.heapAllocs = [];
        this.finalHeapAllocs = [];
        this.cachedStaticItems = null; // Purge persistent traces completely gracefully
        this.rootItems = [];
        this._onDidChangeTreeData.fire();
    }

    /**
     * Iteratively regenerates logical state arrays mapping Zephyr constraints natively executing dynamic visual assignments explicitly
     * 
     * @param deltaLogData Raw incremental log pointers evaluated internally simulating allocations explicitly
     * @param symbols Comprehensive precompiled binary object lengths mapped automatically across execution pointers
     * @param regionsMeta Dynamically structural topological arrays identifying core boundary frames seamlessly
     * @param sramTopologies Isolated hardware blocks containing recursive bounds securely evaluated
     */
    refresh(deltaLogData: any[], symbols: any[], regionsMeta: any[], sramTopologies: any[]): void {
        this.rootItems = [];

        // 1. Evaluate Dynamic Allocations linearly matching recursive function depths exactly
        deltaLogData.forEach((d) => {
             const core = d.core !== undefined ? d.core : 0;
             if (!this.coreStacks[core]) this.coreStacks[core] = [];
             
             // Detect Stack Ingress explicitly associating internal arguments correctly gracefully
             if (d.funcArgs) {
                const deepStack = this.coreStacks[core].map(s => s.name);
                this.coreStacks[core].push({ 
                    name: d.funcName, 
                    args: d.funcArgs, 
                    isEntry: isAllocCall(d.funcName),
                    stackChain: deepStack,
                    sp: d.funcSp,
                    file: d.file,
                    line: d.line
                });
             } else if (d.funcRet && d.funcSp) {
                // Detect Stack Exit and bind returned allocation explicitly securely
                if (this.coreStacks[core].length > 0) {
                   let matchIdx = -1;
                   for (let i = this.coreStacks[core].length - 1; i >= 0; i--) {
                       if (this.coreStacks[core][i].sp === d.funcSp) {
                           matchIdx = i;
                           break;
                       }
                   }
                   
                   // Collapse Stack arrays logically securely avoiding arbitrary nesting overlaps seamlessly
                   if (matchIdx !== -1) {
                       const entryNode = this.coreStacks[core][matchIdx];
                       this.coreStacks[core] = this.coreStacks[core].slice(0, matchIdx);
                       
                       const name = entryNode.name;
                       if (entryNode.isEntry && isAllocCall(name)) {
                           const size = guessAllocSize(name, entryNode.args);
                           const flags = guessAllocFlags(name, entryNode.args);
                           const ptr = parseInt(d.funcRet, 16);
                           
                           // If valid size identified, register block inside temporary heap footprint array logically
                           if (size > 0 && ptr > 0) {
                              this.heapAllocs.push({
                                  name: name,
                                  stackChain: entryNode.stackChain,
                                  addr: ptr,
                                  size: size,
                                  flags: flags,
                                  args: entryNode.args,
                                  sect: 'heap_dyn',
                                  file: entryNode.file,
                                  line: entryNode.line
                              });
                           }
                       }
                   }
                }
             }
        });

        // Filter ephemeral reallocations isolating structural traces cleanly gracefully
        this.finalHeapAllocs = [];
        this.heapAllocs.forEach(alloc => {
            // Mask redundant wrapping arrays cleanly mitigating chaotic pointer sequences dynamically
            if (alloc.stackChain.includes('vmh_alloc') && alloc.name !== 'vmh_alloc') return;
            
            let replaced = false;
            for (let i = this.finalHeapAllocs.length - 1; i >= Math.max(0, this.finalHeapAllocs.length - 15); i--) {
                const prev = this.finalHeapAllocs[i];
                if (prev.stackChain && prev.stackChain.includes(alloc.name)) {
                    if (alloc.stackChain && alloc.stackChain.length > 0) {
                        prev.visualName = alloc.stackChain[alloc.stackChain.length - 1];
                    } else {
                        prev.visualName = alloc.name;
                    }
                    prev.visualStack = alloc.stackChain || [alloc.name];
                    prev.args = alloc.args; 
                    replaced = true;
                    break;
                }
            }
            
            // Append explicitly valid traces
            if (!replaced) {
                if (!alloc.visualName) {
                    if (alloc.stackChain && alloc.stackChain.length > 0) {
                        alloc.visualName = alloc.stackChain[alloc.stackChain.length - 1];
                    } else {
                        alloc.visualName = alloc.name;
                    }
                    alloc.visualStack = alloc.stackChain || [];
                }
                this.finalHeapAllocs.push(alloc);
            }
        });

        // Evaluate Dynamic Heap Tree logic exclusively isolating arrays iteratively natively
        if (this.finalHeapAllocs.length > 0) {
            const dynChildren = this.finalHeapAllocs.map((alloc: any) => {
                const chainStr = (alloc.visualStack || alloc.stackChain || []).join(' > ');
                let details = `Size: ${alloc.size} B`;
                if (alloc.flags && alloc.flags !== 'N/A') details += ` | Flags: ${alloc.flags}`;
                
                // Establish visual nesting dependencies natively evaluated identically implicitly inside TreeView
                const chainItems = (alloc.visualStack || alloc.stackChain || []).map((funcName: string, idx: number) => {
                    return new MemoryItem(funcName, vscode.TreeItemCollapsibleState.None, undefined, undefined, `${alloc.addr}_${alloc.name}_${idx}`);
                });
                
                const displayLabel = `[0x${alloc.addr.toString(16).toUpperCase()}] ${alloc.visualName || alloc.name}`;
                const item = new MemoryItem(displayLabel, vscode.TreeItemCollapsibleState.Collapsed, details, chainItems, `alloc_${alloc.addr}_${alloc.name}`, {
                    command: 'sof-logger.openResource',
                    title: 'Open Source',
                    // Pass explicitly derived locations securely bypassing empty lookups cleanly
                    arguments: [alloc.file, alloc.line, undefined, undefined, alloc.addr]
                });
                item.addr = alloc.addr;
                item.size = alloc.size;
                return item;
            });
            
            this.rootItems.push(new MemoryItem('Heap (Dynamic)', vscode.TreeItemCollapsibleState.Expanded, `${this.finalHeapAllocs.length} Objects`, dynChildren, 'root_heap_dyn'));
        }

        // 2. Static Segment Allocations
        // Prevents overwriting cached map segments explicitly caching valid lookups cleanly natively once
        if (!this.cachedStaticItems && symbols && symbols.length > 0) {
            this.cachedStaticItems = [];
            const seenStatic = new Set();
            
            // Generate nested hierarchies specifically wrapping topological layouts logically
            const regionGroups: { [key: string]: any[] } = {};
            if (sramTopologies && sramTopologies.length > 0) {
               sramTopologies.forEach((t: any) => regionGroups[t.name] = []);
            } else if (regionsMeta && regionsMeta.length > 0) {
               regionsMeta.forEach((r: any) => regionGroups[r.name] = []);
            } else {
                 regionGroups['HPSRAM'] = [];
                 regionGroups['LPSRAM'] = [];
                 regionGroups['IMR'] = [];
            }

            symbols.forEach((sym: any) => {
               // Ignore dynamic elements isolating only precompiled footprints cleanly natively
               if ((!sym.sect || !sym.sect.startsWith('heap')) && sym.size > 0 && !seenStatic.has(sym.name)) {
                   let rName = '';
                   if (regionsMeta && regionsMeta.length > 0) {
                       const matched = regionsMeta.find((r: any) => sym.addr >= r.start && sym.addr < r.end);
                       if (matched) rName = matched.name;
                   } 
                   
                   if (!rName) {
                       // Heuristic logical boundary matching mitigating older topological absence efficiently gracefully
                       const prefix = sym.addr >>> 20; 
                       if (prefix === 0xA00) rName = 'HPSRAM';
                       else if (prefix === 0xA01 || prefix === 0xA10) rName = 'LPSRAM';
                       else rName = 'IMR';
                       
                       if (!regionGroups[rName]) regionGroups[rName] = [];
                   }
                   
                   if (rName && regionGroups[rName]) {
                      seenStatic.add(sym.name);
                      regionGroups[rName].push(sym);
                   }
               }
            });
            
            // Transform explicitly mapped lists perfectly linking execution properties natively
            Object.keys(regionGroups).forEach(gName => {
               if (regionGroups[gName].length === 0) return;
               const children = regionGroups[gName].sort((a: any, b: any) => a.addr - b.addr).map((sym: any) => {
                   const details = `Size: ${sym.size} B`;
                   const displayLabel = `[0x${sym.addr.toString(16).toUpperCase()}] ${sym.name}`;
                   const item = new MemoryItem(displayLabel, vscode.TreeItemCollapsibleState.None, details, undefined, `seg_${sym.addr}_${sym.name}`, {
                        command: 'sof-logger.openResource',
                        title: 'Open Source',
                        arguments: [sym.file, sym.line, undefined, undefined, sym.addr]
                   });
                   item.addr = sym.addr;
                   item.size = sym.size;
                   return item;
               });
               
               this.cachedStaticItems!.push(new MemoryItem(`${gName} Segment (${regionGroups[gName].length})`, vscode.TreeItemCollapsibleState.Collapsed, undefined, children, `root_seg_${gName}`));
            });
        }

        // Apply precompiled structural layout dynamically natively bypassing redundant operations seamlessly
        if (this.cachedStaticItems && this.cachedStaticItems.length > 0) {
            this.rootItems.push(...this.cachedStaticItems);
        }

        this._onDidChangeTreeData.fire();
    }

    /**
     * Interface execution returning logically isolated nodes natively mapping Visual code parameters flawlessly.
     */
    getTreeItem(element: MemoryItem): vscode.TreeItem {
        return element;
    }

    /**
     * Returns explicitly bounded execution trees gracefully masking extraneous variables dynamically natively.
     */
    getChildren(element?: MemoryItem): Thenable<MemoryItem[]> {
        let items = element ? (element.children || []) : this.rootItems;
        // Apply recursive filter explicitly isolating valid structures seamlessly hiding irrelevant noise accurately natively
        if (this.searchString && items.length > 0) {
            items = items.map(item => this.filterItem(item)).filter(item => item !== null) as MemoryItem[];
        }
        return Promise.resolve(items);
    }

    /**
     * Filters dynamically parsing natively evaluating bounds mathematically seamlessly securely.
     */
    private filterItem(item: MemoryItem): MemoryItem | null {
        let matchesAddressRange = false;
        // Intercept spatial boundaries explicitly executing binary math accurately mapping textual queries cleanly natively
        if (this.searchString.startsWith('0x')) {
            const searchAddr = parseInt(this.searchString, 16);
            if (!isNaN(searchAddr) && item.addr !== undefined && item.size !== undefined) {
                matchesAddressRange = (searchAddr >= item.addr && searchAddr < (item.addr + item.size));
            }
        }

        // Expand matching logic intuitively integrating sizes natively
        const matchesSelf = item.label.toLowerCase().includes(this.searchString) || 
                            (item.details && item.details.toLowerCase().includes(this.searchString)) ||
                            matchesAddressRange;
        
        // Leaf nodes cleanly terminate effectively bounding spatial constraints natively
        if (!item.children || item.children.length === 0) {
            return matchesSelf ? item : null;
        }

        const filteredChildren = item.children.map(child => this.filterItem(child)).filter(c => c !== null) as MemoryItem[];
        
        // Maintain visually nested arrays exactly passing constraints perfectly down gracefully natively
        if (matchesSelf || filteredChildren.length > 0) {
            const childrenToUse = matchesSelf ? item.children : filteredChildren;
            return new MemoryItem(item.label, 
                      matchesSelf ? item.collapsibleState : vscode.TreeItemCollapsibleState.Expanded, 
                      item.details, 
                      childrenToUse);
        }
        return null;
    }
}
