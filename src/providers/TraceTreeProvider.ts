import * as vscode from 'vscode';

export class TraceTreeItem extends vscode.TreeItem {
    public children: TraceTreeItem[] = [];

    constructor(
        public readonly label: string,
        public readonly state: vscode.TreeItemCollapsibleState,
        public readonly command?: vscode.Command,
        public readonly line?: number,
        public readonly file?: string,
        public readonly startT?: number,
        public readonly endT?: number
    ) {
        super(label, state);
        this.contextValue = 'traceItem';
    }
}

export class TraceTreeProvider implements vscode.TreeDataProvider<TraceTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<TraceTreeItem | undefined | void> = new vscode.EventEmitter<TraceTreeItem | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<TraceTreeItem | undefined | void> = this._onDidChangeTreeData.event;

    private rootNodes: TraceTreeItem[] = [];
    private searchString: string = '';

    setSearchString(val: string) {
        this.searchString = val.toLowerCase();
        this._onDidChangeTreeData.fire();
    }

    refresh(logData: any[]): void {
        this.rootNodes = this.buildTraceTree(logData);
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: TraceTreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: TraceTreeItem): Thenable<TraceTreeItem[]> {
        let items = element ? (element.children || []) : this.rootNodes;
        if (this.searchString && items.length > 0) {
            items = items.map(item => this.filterItem(item)).filter(item => item !== null) as TraceTreeItem[];
        }
        return Promise.resolve(items);
    }

    private filterItem(item: TraceTreeItem): TraceTreeItem | null {
        const matchesSelf = item.label.toLowerCase().includes(this.searchString) || 
                            (item.description && typeof item.description === 'string' && item.description.toLowerCase().includes(this.searchString));
        
        if (!item.children || item.children.length === 0) {
            return matchesSelf ? item : null;
        }

        const filteredChildren = item.children.map(child => this.filterItem(child)).filter(c => c !== null) as TraceTreeItem[];
        
        if (matchesSelf || filteredChildren.length > 0) {
            const childrenToUse = matchesSelf ? item.children : filteredChildren;
            const newItem = new TraceTreeItem(item.label, 
                      matchesSelf ? item.state : vscode.TreeItemCollapsibleState.Expanded, 
                      item.command, item.line, item.file, item.startT, item.endT);
            newItem.description = item.description;
            newItem.iconPath = item.iconPath;
            newItem.children = childrenToUse;
            return newItem;
        }
        return null;
    }

    private buildTraceTree(logData: any[]): TraceTreeItem[] {
        const rootNodes: TraceTreeItem[] = [];
        let stack: TraceTreeItem[] = [];

        for (let i = 0; i < logData.length; i++) {
            const p = logData[i];
            
            if (p.funcAddr !== undefined) {
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

                    if (stack.length > 250) {
                        stack[stack.length - 2].children.push(item);
                        stack.push(item);
                    } else if (stack.length > 0) {
                        stack[stack.length - 1].children.push(item);
                        stack.push(item);
                    } else {
                        rootNodes.push(item);
                        stack.push(item);
                    }
                } else if (p.funcRet) {
                    if (stack.length > 0) {
                        const current = stack.pop();
                        if (current) {
                            // @ts-ignore
                            current.endT = p.t;
                            current.description = `-> a2=${p.funcRet}`;
                            if (current.command && current.command.arguments) {
                                current.command.arguments.push(p.t);
                            }
                        }
                    }
                }
            } else if (p.raw && p.raw.toLowerCase().includes('privilege error')) {
                if (stack.length > 0) {
                    for (const node of stack) {
                        // @ts-ignore
                        node.state = vscode.TreeItemCollapsibleState.Expanded;
                        node.iconPath = new vscode.ThemeIcon('error', new vscode.ThemeColor('errorForeground'));
                    }
                }
            }
        }
        
        // Auto-expand any lingering nodes aggressively wrapping trace dropouts cleanly securely smoothly 
        for (const item of stack) {
           item.description = (item.description || '') + ' (Unclosed Trace)';
        }

        return rootNodes;
    }
}
