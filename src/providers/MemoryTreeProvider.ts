import * as vscode from 'vscode';

export class MemoryItem extends vscode.TreeItem {
    public addr?: number;
    public size?: number;
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly details?: string,
        public readonly children?: MemoryItem[],
        public readonly id?: string,
        public readonly command?: vscode.Command
    ) {
        super(label, collapsibleState);
        this.tooltip = this.label;
        if (this.details) {
            this.description = this.details;
        }
        if (this.id) {
            this.id = id;
        } else {
            this.id = label; // simple fallback
        }
    }
}

function isAllocCall(name: string, stackChain: string[] = []): boolean {
    if (!name) return false;
    if (stackChain.includes('vmh_alloc')) return false;
    const n = name.toLowerCase();
    if (n.includes('free') || n.includes('chunk')) return false;
    return n.includes('alloc') || n.includes('rzalloc') || n.includes('vmh_alloc') || n.includes('heap_alloc');
}

function guessAllocSize(name: string, args: string[]): number {
    if (!args) return 0;
    const n = name.toLowerCase();
    const a = args.map(x => parseInt(x, 16) || 0);

    if (n.includes('virtual_heap_alloc')) return a[2];
    if (n.includes('sof_heap_alloc')) return a[2];
    if (n.includes('l3_heap_alloc')) return a[2];
    if (n.includes('heap_alloc_aligned')) return a[2];
    if (n.includes('rmalloc_align')) return a[1];
    if (n.includes('rmalloc')) return a[1];
    if (n.includes('rballoc_align')) return a[1];
    if (n.includes('rballoc')) return a[1];
    if (n.includes('rzalloc')) return a[1];
    if (n.includes('rbrealloc') || n.includes('realloc')) return a[2];
    if (n.includes('vmh_alloc')) return a[1];
    if (n.includes('sys_heap_aligned_alloc')) return a[2];
    if (n.includes('sys_heap_alloc') || n.includes('z_malloc_heap')) return a[1];
    
    return a[2] || a[1] || a[0];
}

function guessAllocFlags(name: string, args: string[]): string {
    if (!args) return '0x0';
    const n = name.toLowerCase();
    if (n.includes('virtual_heap_alloc')) return args[1];
    if (n.includes('sof_heap_alloc')) return args[1];
    if (n.includes('rbrealloc') || n.includes('realloc')) return args[1];
    if (n.includes('sys_heap_') || n.includes('z_malloc_')) return 'N/A';
    if (n.includes('l3_heap_alloc') || n.includes('heap_alloc_aligned')) return 'N/A';
    if (n.includes('vmh_alloc')) return 'N/A';
    return args[0];
}

export class MemoryTreeProvider implements vscode.TreeDataProvider<MemoryItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<MemoryItem | undefined | void> = new vscode.EventEmitter<MemoryItem | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<MemoryItem | undefined | void> = this._onDidChangeTreeData.event;

    private coreStacks: { [key: number]: any[] } = {};
    private heapAllocs: any[] = [];
    private finalHeapAllocs: any[] = [];
    private rootItems: MemoryItem[] = [];
    private cachedStaticItems: MemoryItem[] | null = null;
    private searchString: string = '';

    setSearchString(val: string) {
        this.searchString = val.toLowerCase();
        this._onDidChangeTreeData.fire();
    }

    softClear(): void {
        this.coreStacks = {};
        this.heapAllocs = [];
        this.finalHeapAllocs = [];
        this.rootItems = this.cachedStaticItems ? [...this.cachedStaticItems] : [];
        this._onDidChangeTreeData.fire();
    }

    clear(): void {
        this.coreStacks = {};
        this.heapAllocs = [];
        this.finalHeapAllocs = [];
        this.cachedStaticItems = null;
        this.rootItems = [];
        this._onDidChangeTreeData.fire();
    }

    refresh(deltaLogData: any[], symbols: any[], regionsMeta: any[], sramTopologies: any[]): void {
        this.rootItems = [];

        // 1. Dynamic Allocations
        deltaLogData.forEach((d) => {
             const core = d.core !== undefined ? d.core : 0;
             if (!this.coreStacks[core]) this.coreStacks[core] = [];
             
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
                if (this.coreStacks[core].length > 0) {
                   let matchIdx = -1;
                   for (let i = this.coreStacks[core].length - 1; i >= 0; i--) {
                       if (this.coreStacks[core][i].sp === d.funcSp) {
                           matchIdx = i;
                           break;
                       }
                   }
                   
                   if (matchIdx !== -1) {
                       const entryNode = this.coreStacks[core][matchIdx];
                       this.coreStacks[core] = this.coreStacks[core].slice(0, matchIdx);
                       
                       const name = entryNode.name;
                       if (entryNode.isEntry && isAllocCall(name)) {
                           const size = guessAllocSize(name, entryNode.args);
                           const flags = guessAllocFlags(name, entryNode.args);
                           const ptr = parseInt(d.funcRet, 16);
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

        this.finalHeapAllocs = [];
        this.heapAllocs.forEach(alloc => {
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

        if (this.finalHeapAllocs.length > 0) {
            const dynChildren = this.finalHeapAllocs.map((alloc: any) => {
                const chainStr = (alloc.visualStack || alloc.stackChain || []).join(' > ');
                let details = `Size: ${alloc.size} B`;
                if (alloc.flags && alloc.flags !== 'N/A') details += ` | Flags: ${alloc.flags}`;
                
                const chainItems = (alloc.visualStack || alloc.stackChain || []).map((funcName: string, idx: number) => {
                    return new MemoryItem(funcName, vscode.TreeItemCollapsibleState.None, undefined, undefined, `${alloc.addr}_${alloc.name}_${idx}`);
                });
                
                const displayLabel = `[0x${alloc.addr.toString(16).toUpperCase()}] ${alloc.visualName || alloc.name}`;
                const item = new MemoryItem(displayLabel, vscode.TreeItemCollapsibleState.Collapsed, details, chainItems, `alloc_${alloc.addr}_${alloc.name}`, {
                    command: 'sof-logger.openResource',
                    title: 'Open Source',
                    arguments: [alloc.file, alloc.line, undefined, undefined, alloc.addr]
                });
                item.addr = alloc.addr;
                item.size = alloc.size;
                return item;
            });
            
            this.rootItems.push(new MemoryItem('Heap (Dynamic)', vscode.TreeItemCollapsibleState.Expanded, `${this.finalHeapAllocs.length} Objects`, dynChildren, 'root_heap_dyn'));
        }

        // 2. Static Segment Allocations
        if (!this.cachedStaticItems && symbols && symbols.length > 0) {
            this.cachedStaticItems = [];
            const seenStatic = new Set();
            
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
               if ((!sym.sect || !sym.sect.startsWith('heap')) && sym.size > 0 && !seenStatic.has(sym.name)) {
                   let rName = '';
                   if (regionsMeta && regionsMeta.length > 0) {
                       const matched = regionsMeta.find((r: any) => sym.addr >= r.start && sym.addr < r.end);
                       if (matched) rName = matched.name;
                   } 
                   
                   if (!rName) {
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

        if (this.cachedStaticItems && this.cachedStaticItems.length > 0) {
            this.rootItems.push(...this.cachedStaticItems);
        }

        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: MemoryItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: MemoryItem): Thenable<MemoryItem[]> {
        let items = element ? (element.children || []) : this.rootItems;
        if (this.searchString && items.length > 0) {
            items = items.map(item => this.filterItem(item)).filter(item => item !== null) as MemoryItem[];
        }
        return Promise.resolve(items);
    }

    private filterItem(item: MemoryItem): MemoryItem | null {
        let matchesAddressRange = false;
        if (this.searchString.startsWith('0x')) {
            const searchAddr = parseInt(this.searchString, 16);
            if (!isNaN(searchAddr) && item.addr !== undefined && item.size !== undefined) {
                matchesAddressRange = (searchAddr >= item.addr && searchAddr < (item.addr + item.size));
            }
        }

        const matchesSelf = item.label.toLowerCase().includes(this.searchString) || 
                            (item.details && item.details.toLowerCase().includes(this.searchString)) ||
                            matchesAddressRange;
        
        if (!item.children || item.children.length === 0) {
            return matchesSelf ? item : null;
        }

        const filteredChildren = item.children.map(child => this.filterItem(child)).filter(c => c !== null) as MemoryItem[];
        
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
