import { FunctionComponent, useCallback, useEffect, useMemo, useReducer } from "react";
import FileBrowserTable, { FileBrowserTableFile } from "./FileBrowserTable/FileBrowserTable";
import { selectedStringsReducer } from "./FileBrowserTable/expandedFoldersReducer";

type FileBrowserProps = {
    //
}

type FileItem = {
    type: 'folder' | 'file'
    path: string
    size: number
    timestampLastModified: number
}

type FileBrowserState = {
    expandedFolderPaths: string[]
    fileItems: FileItem[]
}

type FileBrowserAction = {
    type: 'toggleFolderExpansion'
    folderPath: string
} | {
    type: 'addItems'
    items: FileItem[]
}

const fileBrowserReducer = (state: FileBrowserState, action: FileBrowserAction): FileBrowserState => {
    switch (action.type) {
        case 'toggleFolderExpansion': {
            const folderPath = action.folderPath
            const expandedFolderPaths = state.expandedFolderPaths.includes(folderPath) ? state.expandedFolderPaths.filter(p => (p !== folderPath)) : [...state.expandedFolderPaths, folderPath]
            return {
                ...state,
                expandedFolderPaths
            }
        }
        case 'addItems': {
            return {
                ...state,
                fileItems: [
                    ...state.fileItems,
                    ...action.items
                ]
            }
        }
        default: {
            throw Error('Unexpected action type in fileBrowserReducer')
        }
    }
}

const doFetchDirectory = async (folderPath: string): Promise<{
    files: {
        name: string,
        size: number,
        lastModified: number
    }[],
    dirNames: string[]
}> => {
    // we need to hardcode the production API URL here because I can't get local dev to work (problem with imports and .js extension)
    const apiUrl = `https://lindi-cloud.vercel.app/api/listDir`
    const resp = await fetch(apiUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            type: 'listDir',
            url: join(`https://lindi.neurosift.org/zones`, folderPath)
        })
    })
    if (!resp.ok) {
        throw Error(`Error fetching directory: ${resp.statusText}`)
    }
    const {files, dirNames} = await resp.json()
    return {files, dirNames}
}

const join = (a: string, b: string) => {
    if (!b) return a
    if (!a) return b
    return a + '/' + b
}

class DirectoryLister {
    #fetchedDirectories: string[] = []
    constructor(private dispatch: React.Dispatch<FileBrowserAction>) {
    }
    async fetchDirectory(folderPath: string) {
        if (this.#fetchedDirectories.includes(folderPath)) return
        this.#fetchedDirectories.push(folderPath)
        const {files, dirNames} = await doFetchDirectory(folderPath)
        const fileString: 'file' | 'folder' = 'file'
        const folderString: 'file' | 'folder' = 'folder'
        this.dispatch({
            type: 'addItems',
            items: [
                ...files.map(ff => ({
                    type: fileString,
                    path: join(folderPath, ff.name),
                    size: ff.size,
                    timestampLastModified: ff.lastModified
                })),
                ...dirNames.map(name => ({
                    type: folderString,
                    path: join(folderPath, name),
                    size: 0,
                    timestampLastModified: 0
                }))
            ]
        })
    }
}

const rootName = 'zones'

const FileBrowser: FunctionComponent<FileBrowserProps> = () => {
    const [state, dispatch] = useReducer(fileBrowserReducer, {
        expandedFolderPaths: [],
        fileItems: [{
            type: 'folder',
            path: '',
            size: 0,
            timestampLastModified: 0
        }]
    })
    const {fileItems, expandedFolderPaths} = state
    const lister = useMemo(() => new DirectoryLister(dispatch), [])
    useEffect(() => {
        for (const folderPath of expandedFolderPaths) {
            lister.fetchDirectory(folderPath)
        }
    }, [expandedFolderPaths, lister])

    const [selectedFileNames, selectedFileNamesDispatch] = useReducer(selectedStringsReducer, new Set<string>())

    const handleRetrieveFolder = useCallback((folderPath: string) => {
        lister.fetchDirectory(folderPath.slice(`${rootName}/`.length))
    }, [lister])

    const fileBrowserTableFiles: FileBrowserTableFile[] = useMemo(() => {
        return fileItems.map(item => {
            if (item.type === 'file') {
                return {
                    fileName: `${rootName}/${item.path}`,
                    size: item.size,
                    timestampLastModified: item.timestampLastModified
                }
            }
            else {
                // if it's a folder, we need to add a dummy file so that it shows up in the table even if there are no files yet fetched in it
                return {
                    fileName: item.path ? `${rootName}/${item.path}/___dummy___` : `${rootName}/___dummy___`,
                    size: 0,
                    timestampLastModified: 0
                }
            }
        })
    }, [fileItems])

    const handleOpenFile = useCallback((fileName: string) => {
        const fname = fileName.slice(`${rootName}/`.length)
        const url0 = `https://lindi.neurosift.org/zones/${fname}`
        const url = `https://neurosift.app?p=/nwb&url=${url0}&st=lindi`
        window.open(url, '_blank')
    }, [])

    return (
        <div style={{maxWidth: 1000}}>
            <FileBrowserTable
                hideSizeColumn={false}
                hideModifiedColumn={false}
                files={fileBrowserTableFiles}
                selectedFileNames={selectedFileNames}
                selectedFileNamesDispatch={selectedFileNamesDispatch}
                onOpenFile={handleOpenFile}
                multiSelect={true}
                onRetrieveFolder={handleRetrieveFolder}
            />
        </div>
    )
}

export default FileBrowser;
