import * as vscode from 'vscode';

export interface IBaseTreeItem extends vscode.TreeItem {
    children?: any[];
    parent?: any;
}

export abstract class BaseTreeProvider<T extends IBaseTreeItem> implements vscode.TreeDataProvider<T> {
    protected _onDidChangeTreeData: vscode.EventEmitter<T | undefined | void> = new vscode.EventEmitter<T | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<T | undefined | void> = this._onDidChangeTreeData.event;

    protected searchString: string = '';
    protected rootItems: T[] = [];

    /**
     * Integrates string parameters natively refreshing graphical interfaces selectively rendering isolated blocks seamlessly
     * 
     * @param val Evaluated search parameter natively matching textual descriptors dynamically
     */
    setSearchString(val: string) {
        this.searchString = val.toLowerCase();
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: T): vscode.TreeItem {
        return element;
    }

    getParent(element: T): vscode.ProviderResult<T> {
        return element.parent;
    }

    getChildren(element?: T): Thenable<T[]> {
        let items = element ? (element.children || []) : this.rootItems;
        if (this.searchString && items.length > 0) {
            items = items.map(item => this.filterItem(item)).filter(item => item !== null) as T[];
        }
        return Promise.resolve(items);
    }

    /**
     * Internal string evaluator matching nested trace structures flawlessly bypassing dead paths dynamically seamlessly.
     */
    protected filterItem(item: T): T | null {
        const matchesSelf = this.evaluateMatch(item, this.searchString);

        if (!item.children || item.children.length === 0) {
            return matchesSelf ? item : null;
        }

        const filteredChildren = item.children.map(child => this.filterItem(child)).filter(c => c !== null) as T[];

        if (matchesSelf || filteredChildren.length > 0) {
            const childrenToUse = matchesSelf ? item.children : filteredChildren;
            return this.cloneNode(item, matchesSelf, childrenToUse);
        }
        return null;
    }

    /**
     * Required subclass implementation checking whether the current node matches the query explicitly explicitly.
     */
    protected abstract evaluateMatch(item: T, searchString: string): boolean;

    /**
     * Required subclass implementation reconstructing matching clones passing derived constraints sequentially explicitly.
     */
    protected abstract cloneNode(item: T, matchesSelf: boolean, childrenToUse: T[]): T;
}
