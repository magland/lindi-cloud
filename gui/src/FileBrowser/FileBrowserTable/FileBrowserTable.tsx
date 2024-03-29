/* eslint-disable @typescript-eslint/no-explicit-any */
import { Hyperlink } from "@fi-sci/misc"
import { faPython } from "@fortawesome/free-brands-svg-icons"
import { faCaretDown, faCaretRight, faFile, faFolder, faNoteSticky } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { FunctionComponent, useCallback, useEffect, useMemo, useReducer } from "react"
import { timeAgoString } from "./timeStrings"
import { SelectedStrings, SelectedStringsAction, expandedFoldersReducer } from "./expandedFoldersReducer"
import formatByteCount from "./formatByteCount"
import './file-browser-table.css'

export type FileItem = {
    type: 'file'
    id: string
    name: string
    selected: boolean
    size: number
    timestampLastModified: number
} | {
    type: 'folder'
    id: string
    name: string
}

export type FileBrowserTableFile = {
    fileName: string
    size: number
    timestampLastModified: number
}

export type FileBrowserTableFolder = {
    folderName: string
}

type TreeNode = {
    type: 'file' | 'folder'
    name: string
    subNodes: TreeNode[]
    file?: FileBrowserTableFile
}

type FileBrowserTableProps = {
    hideSizeColumn?: boolean
    hideModifiedColumn?: boolean
    files: FileBrowserTableFile[]
    selectedFileNames: SelectedStrings
    selectedFileNamesDispatch: (a: SelectedStringsAction) => void
    onOpenFile: (fileName: string) => void
    multiSelect: boolean
    onRetrieveFolder: (folderName: string) => void
}

const colWidth = 15

const initialExpandedFoldersJson = localStorage.getItem('lindi-cloud-expanded-folders')
let initialExpandedFolders: Set<string>
try {
    initialExpandedFolders = new Set(JSON.parse(initialExpandedFoldersJson || '[]'))
}
catch (err) {
    if (initialExpandedFoldersJson) console.error('Error parsing expanded folders from local storage:', err)
    initialExpandedFolders = new Set<string>()
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const FileBrowserTable: FunctionComponent<FileBrowserTableProps> = ({hideSizeColumn, hideModifiedColumn, files, selectedFileNames, selectedFileNamesDispatch, onOpenFile, multiSelect, onRetrieveFolder}) => {
    const [expandedFolders, expandedFoldersDispatch] = useReducer(expandedFoldersReducer, initialExpandedFolders)
    useEffect(() => {
        // don't include folders that no longer exist!
        const newExpandedFolders = new Set<string>()
        for (const f of expandedFolders) {
            if (files.some(ff => ff.fileName.startsWith(f))) {
                newExpandedFolders.add(f)
            }
        }
        localStorage.setItem('lindi-cloud-expanded-folders', JSON.stringify(Array.from(newExpandedFolders)))
    }, [expandedFolders, files])
    useEffect(() => {
        for (const f of initialExpandedFolders) {
            onRetrieveFolder(f)
        }
    }, [onRetrieveFolder])
    const itemIsVisible = useMemo(() => ((path: string) => {
        if (!path) return false
        const aa = path.split('/')
        if (aa.length === 1) return true
        for (let i = 1; i < aa.length; i++) {
            const bb = aa.slice(0, i).join('/')
            if (!expandedFolders.has(bb)) return false
        }
        return true
    }), [expandedFolders])

    const determineCheckedStateForFolder = useCallback((folderName: string) => {
        if (!files) return false
        const ff = files.filter(f => f.fileName.startsWith(folderName + '/'))
        const ff2 = ff.filter(f => selectedFileNames.has(f.fileName))
        if (ff2.length === 0)  return false
        if (ff2.length === ff.length) return true
        return null // indeterminate
    }, [files, selectedFileNames])

    const handleClickFolderCheckbox = useCallback((folderName: string) => {
        if (!files) return
        const ff = files.filter(f => f.fileName.startsWith(folderName + '/'))
        if (ff.length === 0) return
        const ff2 = ff.filter(f => selectedFileNames.has(f.fileName))
        if (ff2.length === ff.length) {
            // all selected, so unselect all
            selectedFileNamesDispatch({type: 'set-multiple', paths: ff.map(f => f.fileName), selected: false})
        }
        else {
            // some or none selected, so select all
            selectedFileNamesDispatch({type: 'set-multiple', paths: ff.map(f => f.fileName), selected: true})
        }
    }, [files, selectedFileNames, selectedFileNamesDispatch])

    const rootNode = useMemo(() => {
        const defineSubnodesForNode = (node: TreeNode) => {
            if (node.type === 'folder') {
                const subFoldersSet = new Set<string>()
                for (const ff of files || []) {
                    const aa = ff.fileName.split('/')
                    const bb = node.name ? node.name.split('/') : []
                    const cc = bb.length > 0 ? aa.slice(0, bb.length).join('/') : ''
                    if (bb.join('/') === cc) {
                        if (aa.length > bb.length + 1) {
                            if (aa[bb.length] === '') continue // important to skip this case
                            subFoldersSet.add(aa[bb.length])
                        }
                    }
                }
                const subFoldersListSorted = Array.from(subFoldersSet).sort()
                for (const subFolderName of subFoldersListSorted) {
                    const subNode: TreeNode = {
                        type: 'folder',
                        name: node.name ? node.name + '/' + subFolderName : subFolderName,
                        subNodes: [],
                        file: undefined
                    }
                    node.subNodes.push(subNode)
                    defineSubnodesForNode(subNode)
                }
                for (const ff of files || []) {
                    const aa = ff.fileName.split('/')
                    const bb = node.name ? node.name.split('/') : []
                    const cc = bb.length > 0 ? aa.slice(0, bb.length).join('/') : ''
                    if (bb.join('/') === cc) {
                        if (aa.length === bb.length + 1) {
                            node.subNodes.push({
                                type: 'file',
                                name: ff.fileName,
                                subNodes: [],
                                file: ff
                            })
                        }
                    }
                }
            }
        }
        const rootNode: TreeNode = {
            type: 'folder',
            name: '',
            subNodes: [],
            file: undefined
        }
        defineSubnodesForNode(rootNode)
        return rootNode
    }, [files])

    // IMPORTANT not to initialize the expanded state here, because then the root node will get redefined every time new files come in as props
    // useEffect(() => {
    //     // initialize expanded state
    //     const newExpandedFolders = new Set<string>()
    //     const handleNode = (node: TreeNode) => {
    //         if (node.type === 'folder') {
    //             const isTopLevelHiddenFolder = (!node.name.includes('/')) && node.name.startsWith('.')
    //             if ((node.name) && (!isTopLevelHiddenFolder) && (node.subNodes.length <= 5)) {
    //                 newExpandedFolders.add(node.name)
    //             }
    //             for (const subNode of node.subNodes) {
    //                 handleNode(subNode)
    //             }
    //         }
    //     }
    //     handleNode(rootNode)
    //     expandedFoldersDispatch({type: 'set', paths: newExpandedFolders})
    // }, [rootNode])

    const fileItems = useMemo(() => {
        const ret: FileItem[] = []
        const handleNode = (node: TreeNode) => {
            if (node.type === 'folder') {
                if (node.name !== '') {
                    ret.push({
                        type: 'folder',
                        id: node.name,
                        name: node.name
                    })
                }
                for (const subNode of node.subNodes) {
                    handleNode(subNode)
                }
            }
            else {
                if (!node.name.endsWith('___dummy___')) {
                    ret.push({
                        type: 'file',
                        id: node.name,
                        name: node.name,
                        // selected: 'file:' + node.name === currentTabName,
                        selected: false,
                        size: node.file?.size || 0,
                        timestampLastModified: node.file?.timestampLastModified || 0
                    })
                }
            }
        }
        handleNode(rootNode)
        return ret
    }, [rootNode])

    const handleClickFile = useCallback((fileName: string) => {
        onOpenFile(fileName)
    }, [onOpenFile])

    return (
        <table className="file-browser-table">
            <thead>
                <tr>
                    {multiSelect && <th style={{width: colWidth}}></th>}
                    <th style={{width: colWidth}}></th>
                    <th>File</th>
                    {!hideModifiedColumn && <th>Modified</th>}
                    {!hideSizeColumn && <th>Size</th>}
                </tr>
            </thead>
            <tbody>
                {
                    fileItems.filter(fi => (itemIsVisible(fi.name))).map(x => (
                        <tr key={x.id}>
                            {multiSelect && <td style={{width: colWidth}}>
                                {
                                    x.type === 'file' ? (
                                        <Checkbox checked={selectedFileNames.has(x.name)} onClick={() => selectedFileNamesDispatch({type: 'toggle', value: x.name})} />
                                    ) : (
                                        <Checkbox checked={determineCheckedStateForFolder(x.name)} onClick={() => handleClickFolderCheckbox(x.name)} />
                                    )
                                }
                            </td>}
                            <td style={{width: colWidth}}>
                                {
                                    x.type === 'file' ? (
                                        <FileIcon fileName={x.name} />
                                    ) : (
                                        <FolderIcon />
                                    )
                                }
                            </td>
                            <td>
                                {
                                    x.type === 'file' ? (
                                        <Hyperlink
                                            onClick={() => handleClickFile(x.name)}
                                        >{depthIndentation(x.name)}{baseName(x.name)}</Hyperlink>
                                    ) : (
                                        <span style={{cursor: 'pointer'}} onClick={() => {
                                            expandedFoldersDispatch({type: 'toggle', path: x.name})
                                            onRetrieveFolder(x.name)
                                        }}>
                                            {depthIndentation(x.name)}
                                            {
                                                expandedFolders.has(x.name) ? (
                                                    <span><FontAwesomeIcon icon={faCaretDown} style={{color: 'gray'}} /> </span>
                                                ) : (
                                                    <span><FontAwesomeIcon icon={faCaretRight} style={{color: 'gray'}} /> </span>
                                                )
                                            }
                                            {baseName(x.name)}
                                        </span>
                                    )
                                }
                            </td>
                            {!hideModifiedColumn && <td>
                                {(x.type === 'file' && x.timestampLastModified) ? (
                                    <span style={{whiteSpace: 'nowrap'}}>{timeAgoString(x.timestampLastModified)}</span>
                                ): ''}
                            </td>}
                            {!hideSizeColumn && (
                                x.type === 'file' && x.size ? <td>{formatByteCount(x.size)}</td> : <td />
                            )}
                        </tr>
                    ))
                }
            </tbody>
        </table>
    )
}

export const Checkbox: FunctionComponent<{checked: boolean | null, onClick: () => void}> = ({checked, onClick}) => {
    // null means indeterminate
    return (
        <input
            ref={input => {
                if (!input) return
                input.indeterminate = checked === null
            }}
            type="checkbox"
            checked={checked === true}
            onChange={onClick}
        />
    )
}

export const FileIcon: FunctionComponent<{fileName: string}> = ({fileName}) => {
    const ext = fileName.split('.').pop()
    if (ext === 'py') {
        return <FontAwesomeIcon icon={faPython} style={{color: 'darkblue'}} />
    }
    else if (ext === 'json') {
        return <FontAwesomeIcon icon={faFile as any} style={{color: 'black'}} />
    }
    else if (ext === 'stan') {
        // return <FontAwesomeIcon icon={faFile as any} style={{color: 'darkorange'}} />
        return <img src="/dendro-logo.png" alt="logo" height={14} style={{paddingBottom: 0, cursor: 'pointer'}} />
    }
    else if (ext === 'nwb') {
        return <FontAwesomeIcon icon={faFile as any} style={{color: 'red'}} />
    }
    else if (ext === 'ipynb') {
        return <FontAwesomeIcon icon={faNoteSticky as any} style={{color: 'darkblue'}} />
    }
    else {
        return <FontAwesomeIcon icon={faFile as any} style={{color: 'gray'}} />
    }
}

const depthIndentation = (path: string) => {
    if (!path) return <span />
    const depth = path.split('/').length - 1
    if (!depth) return <span />
    return <span style={{paddingLeft: depth * 10}} />
}

const FolderIcon = () => {
    return <FontAwesomeIcon icon={faFolder} />
}

const baseName = (path: string) => {
    if (!path) return ''
    const aa = path.split('/')
    return aa[aa.length - 1]
}

export default FileBrowserTable