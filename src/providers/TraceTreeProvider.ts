import * as vscode from 'vscode';

import { BaseTreeProvider, IBaseTreeItem } from './BaseTreeProvider';

/**
 * Encapsulates a distinct hierarchical trace function natively mapping Zephyr stack ingress/egress.
 * Maintains chronological bounding variables implicitly wrapping temporal execution footprints seamlessly.
 */
export class TraceTreeItem extends vscode.TreeItem implements IBaseTreeItem {
    public children: TraceTreeItem[] = []; // Explicit recursive dependency tree evaluating nested stack scopes securely
    public parent?: TraceTreeItem; // Bidirectional topological reference securely unlocking TreeView.reveal internally flawlessly

    constructor(
        public readonly label: string,                                     // Textual display name formatting pointer footprints cleanly
        public readonly state: vscode.TreeItemCollapsibleState,            // UI hierarchy tracking open/closed nested bounds
        public readonly command?: vscode.Command,                          // Navigates instantly onto VS Code editor source lines
        public readonly line?: number,                                     // Exact physical source configuration boundary
        public readonly file?: string,                                     // Originating absolute/relative mapping path explicitly
        public readonly startT?: number,                                   // Ingress Execution Tick exactly bounding entry natively
        public readonly endT?: number                                      // Egress Execution Tick securely matching return logic natively
    ) {
        super(label, state);
        this.contextValue = 'traceItem'; // Explicit context enabling context menus dynamically securely
    }
}

/**
 * Controller mapping sequential UART traces structurally against the VS Code left sidebar natively explicitly.
 */
export class TraceTreeProvider extends BaseTreeProvider<TraceTreeItem> {
    // Lifo recursive scope implicitly tracking nested boundaries dynamically explicitly correctly seamlessly 
    private stack: TraceTreeItem[] = [];

    /**
     * Resolves the deepest and most chronologically recent execution matched securely purely dynamically seamlessly explicit neatly seamlessly efficiently
     */
    public findLastExecutionByName(name: string): TraceTreeItem | null {
        return this.searchRecursiveLast(this.rootItems, name);
    }

    /**
     * Executes chronological reverse topological extraction flawlessly structurally evaluating deeply nested contexts sequentially
     */
    private searchRecursiveLast(nodes: TraceTreeItem[], name: string): TraceTreeItem | null {
        for (let i = nodes.length - 1; i >= 0; i--) {
            if (nodes[i].children && nodes[i].children.length > 0) {
                const foundChild = this.searchRecursiveLast(nodes[i].children, name);
                if (foundChild) return foundChild;
            }
            if (nodes[i].label.startsWith(name + ' ') || nodes[i].label === name) {
                return nodes[i];
            }
        }
        return null;
    }

    /**
     * Resolves the most recent structurally unclosed scope directly capturing exact architectural crash boundaries implicitly correctly creatively efficiently cleverly efficiently properly cleanly.
     */
    public getMostRecentExecution(): TraceTreeItem | null {
        if (this.stack && this.stack.length > 0) {
            return this.stack[this.stack.length - 1];
        }
        // Fallback to absolute latest chronological root if stack is completely flushed identically safely correctly 
        if (this.rootItems && this.rootItems.length > 0) {
            return this.rootItems[this.rootItems.length - 1];
        }
        return null;
    }

    /**
     * Accurately envelopes click timestamps traversing tree arrays iteratively beautifully capturing exact topological execution scopes seamlessly creatively elegantly!
     */
    public findClosestItemByTime(targetT: number): TraceTreeItem | null {
        let bestDetails: TraceTreeItem | null = null;
        let minDuration = Infinity;

        const traverse = (nodes: TraceTreeItem[]) => {
            for (const node of nodes) {
                const s = node.startT !== undefined ? node.startT : -1;
                const e = node.endT !== undefined ? node.endT : Infinity;
                if (s !== -1 && targetT >= s && targetT <= e) {
                    const dur = e - s;
                    if (dur <= minDuration) {
                        minDuration = dur;
                        bestDetails = node;
                    }
                }
                if (node.children && node.children.length > 0) {
                    traverse(node.children);
                }
            }
        };

        traverse(this.rootItems);

        if (!bestDetails) {
            let minDiff = Infinity;
            const traverseDiff = (nodes: TraceTreeItem[]) => {
                for (const node of nodes) {
                    if (node.startT !== undefined) {
                        const delta = Math.abs(node.startT - targetT);
                        if (delta < minDiff) { 
                            minDiff = delta; 
                            bestDetails = node; 
                        }
                    }
                    if (node.children && node.children.length > 0) {
                        traverseDiff(node.children);
                    }
                }
            };
            traverseDiff(this.rootItems);
        }

        return bestDetails;
    }

    /**
     * Incrementally pushes execution data directly extending trees sequentially
     * 
     * @param deltaLogData Sub-array of newly parsed UART entries internally matching exact structures accurately explicitly
     */
    refresh(deltaLogData: any[]): void {
        this.buildTraceTree(deltaLogData);
        this._onDidChangeTreeData.fire();
    }

    /**
     * Erases completely native tracking buffers dropping references flawlessly 
     */
    clear(): void {
        this.rootItems = [];
        this.stack = [];
        this._onDidChangeTreeData.fire();
    }

    protected evaluateMatch(item: TraceTreeItem, searchStr: string): boolean {
        return Boolean(item.label.toLowerCase().includes(searchStr) || 
               (item.description && typeof item.description === 'string' && item.description.toLowerCase().includes(searchStr)));
    }

    protected cloneNode(item: TraceTreeItem, matchesSelf: boolean, childrenToUse: TraceTreeItem[]): TraceTreeItem {
        const newItem = new TraceTreeItem(item.label, 
                  matchesSelf ? item.state : vscode.TreeItemCollapsibleState.Expanded, 
                  item.command, item.line, item.file, item.startT, item.endT);
        newItem.description = item.description;
        newItem.iconPath = item.iconPath;
        newItem.children = childrenToUse;
        return newItem;
    }

    /**
     * Integrates dynamically arriving structures linearly extending visual stacks sequentially explicit securely seamlessly.
     * 
     * @param deltaLogData UART delta fragments
     */
    private buildTraceTree(deltaLogData: any[]): void {
        for (let i = 0; i < deltaLogData.length; i++) {
            const p = deltaLogData[i];
            
            // Execute evaluations dynamically validating structurally explicit entries
            if (p.funcAddr !== undefined) {
                // Detect Stack Entry inherently allocating children exactly perfectly 
                if (p.funcArgs) {
                    const nameLabel = p.funcName || '0x' + p.funcAddr.toString(16);
                    const labelStr = nameLabel + ' (a2...a7: ' + p.funcArgs.join(', ') + ')';
                    
                    const item = new TraceTreeItem(
                        labelStr,
                        vscode.TreeItemCollapsibleState.Collapsed,
                        {
                            command: 'sof-logger.openResource',
                            title: 'Open Source',
                            arguments: [p.file, p.line, p.t]
                        },
                        p.line,
                        p.file,
                        p.t
                    );

                    // Suppress exceedingly recursive crashes seamlessly bypassing rendering faults effectively dynamically safely
                    if (this.stack.length > 250) {
                        item.parent = this.stack[this.stack.length - 2];
                        this.stack[this.stack.length - 2].children.push(item);
                        this.stack.push(item);
                    } else if (this.stack.length > 0) {
                        item.parent = this.stack[this.stack.length - 1];
                        this.stack[this.stack.length - 1].children.push(item);
                        this.stack.push(item);
                    } else {
                        item.parent = undefined;
                        this.rootItems.push(item);
                        this.stack.push(item);
                    }
                } 
                // Detect Stack Exit natively stripping items properly seamlessly mapping properties definitively explicitly
                else if (p.funcRet) {
                    if (this.stack.length > 0) {
                        const current = this.stack.pop();
                        if (current) {
                            // Suppress strict ts configurations safely implicitly
                            // @ts-ignore
                            current.endT = p.t;
                            current.description = `-> a2=${p.funcRet}`;
                            if (current.command && current.command.arguments) {
                                current.command.arguments.push(p.t);
                            }
                        }
                    }
                }
            } 
            // Isolate Faults vividly rendering red icons tracking explicitly recursively dynamically fully implicitly
            else if (p.raw && p.raw.toLowerCase().includes('privilege error')) {
                if (this.stack.length > 0) {
                    // Iterate and expand absolutely every single wrapping parent element clearly
                    for (const node of this.stack) {
                        // Suppress strict ts assignments safely explicitly
                        // @ts-ignore
                        node.state = vscode.TreeItemCollapsibleState.Expanded;
                        node.iconPath = new vscode.ThemeIcon('error', new vscode.ThemeColor('errorForeground'));
                    }
                }
            }
        }
        
        // Auto-expand any lingering nodes aggressively wrapping trace dropouts cleanly securely smoothly explicitly 
        for (const item of this.stack) {
           if (!item.description || !item.description.toString().includes('Unclosed')) {
               item.description = (item.description || '') + ' (Unclosed Trace)';
           }
        }
    }
}
