type ExpandedFoldersState = Set<string>

type ExpandedFoldersAction = {
    type: 'toggle'
    path: string
} | {
    type: 'set'
    paths: Set<string>
}

export const expandedFoldersReducer = (state: ExpandedFoldersState, action: ExpandedFoldersAction): ExpandedFoldersState => {
    if (action.type === 'toggle') {
        const ret = new Set(state)
        if (ret.has(action.path)) {
            ret.delete(action.path)
        }
        else {
            ret.add(action.path)
        }
        return ret
    }
    else if (action.type === 'set') {
        return new Set(action.paths)
    }
    else {
        return state
    }
}

export type SelectedStrings = Set<string>

export type SelectedStringsAction = {
    type: 'toggle'
    value: string
} | {
    type: 'set'
    values: Set<string>
} | {
    type: 'set-multiple'
    paths: string[]
    selected: boolean
} | {
    type: 'add'
    value: string
}

export const selectedStringsReducer = (state: SelectedStrings, action: SelectedStringsAction): SelectedStrings => {
    if (action.type === 'toggle') {
        const ret = new Set(state)
        if (ret.has(action.value)) {
            ret.delete(action.value)
        }
        else {
            ret.add(action.value)
        }
        return ret
    }
    else if (action.type === 'set') {
        return new Set(action.values)
    }
    else if (action.type === 'set-multiple') {
        const ret = new Set(state)
        for (const path of action.paths) {
            if (action.selected) {
                if (!ret.has(path)) ret.add(path)
            }
            else {
                if (ret.has(path)) ret.delete(path)
            }
        }
        return ret
    }
    else if (action.type === 'add') {
        const ret = new Set(state)
        ret.add(action.value)
        return ret
    }
    else {
        return state
    }
}