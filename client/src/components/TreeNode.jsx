import { useEffect, useRef } from "react"

const ReactIcon = () => (
  <svg
    viewBox="0 0 24 24"
    className="w-4 h-4 text-sky-400"
    fill="currentColor"
  >
    <path d="M12 2.2c-.6 0-1.2.6-1.7 1.7-.2.5-.4 1.1-.6 1.8-.6-.1-1.2-.2-1.8-.2-2.1 0-3.4.6-3.4 1.5 0 .9 1.3 1.5 3.4 1.5.6 0 1.2-.1 1.8-.2.2.7.4 1.3.6 1.8.5 1.1 1.1 1.7 1.7 1.7s1.2-.6 1.7-1.7c.2-.5.4-1.1.6-1.8.6.1 1.2.2 1.8.2 2.1 0 3.4-.6 3.4-1.5 0-.9-1.3-1.5-3.4-1.5-.6 0-1.2.1-1.8.2-.2-.7-.4-1.3-.6-1.8-.5-1.1-1.1-1.7-1.7-1.7z" />
  </svg>
)


const DeleteIcon = () => (
  <svg
    viewBox="0 0 24 24"
    className="w-4 h-4 stroke-current"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M7.69231 8.70833H5V8.16667H9.84615
         M7.69231 8.70833V19H16.3077V8.70833
         M7.69231 8.70833H16.3077
         M16.3077 8.70833H19V8.16667H14.1538
         M9.84615 8.16667V6H14.1538V8.16667
         M9.84615 8.16667H14.1538"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M10 11V17" strokeLinecap="round" />
    <path d="M12 11V17" strokeLinecap="round" />
    <path d="M14 11V17" strokeLinecap="round" />
  </svg>
)


function PDF() {
  return (
    <svg
      className="w-4 h-4 mr-1 text-white-200 inline-block"
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M19.2,6.67,12.34,0H2.74A2.77,2.77,0,0,0,.81.78,2.62,2.62,0,0,0,0,2.67V21.33a2.62,2.62,0,0,0,.81,1.89A2.77,2.77,0,0,0,2.74,24H16.46a2.77,2.77,0,0,0,1.93-.78,2.62,2.62,0,0,0,.81-1.89V20H24V9.33H19.2ZM11.66,2.16,17,7.33H11.66Zm11,8.51v8H6.17v-8Z" />
      <path d="M11.76,13.69a1.71,1.71,0,0,1-.12.71,1.58,1.58,0,0,1-.43.59,2.41,2.41,0,0,1-1.56.46h-.5v1.89H8V12H9.76a2.22,2.22,0,0,1,1.5.42,1.67,1.67,0,0,1,.38.58A1.6,1.6,0,0,1,11.76,13.69Z" />
      <path d="M17.33,14.65a2.7,2.7,0,0,1-.16,1.09,2.64,2.64,0,0,1-.61.93,3.13,3.13,0,0,1-2.22.7H12.77V12H14.5a3,3,0,0,1,2.09.7,2.47,2.47,0,0,1,.74,1.92Z" />
      <path d="M19.6,17.37H18.45V12h3.16V13h-2v1.38h1.87v.94H19.6Z" />
    </svg>
  )
}




/* ---------- FILE ICON COMPONENT ---------- */
function FILE() {
  return (
    <svg
      className="w-4 h-4 mr-1 text-neutral-400 inline-block"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-6Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M14 2v6h6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  )
}


/* ---------- TREE NODE COMPONENT ---------- */
export default function TreeNode({
  node,
  activeFile, 
  // setActiveFile,
  openFile,
  deleteNode,
  renameNode,
  toggleFolder,
  level = 0
}) {
  const padding = { paddingLeft: level * 12 }

   const nodeRef = useRef(null)
  const isActive = activeFile?.id === node.id

  useEffect(() => {
    if (isActive && nodeRef.current) {
      nodeRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest"
      })
    }
  }, [isActive])

  /* ---------- FOLDER ---------- */
  if (node.type === "folder") {
    return (
      <div>
      <div
  style={padding}
  onClick={() => toggleFolder(node.id)}
 onContextMenu={(e) => {
  e.preventDefault()
  if (confirm(`Delete "${node.name}" ?`)) {
    deleteNode(node)
  }
}}
  className="
    group cursor-pointer hover:bg-neutral-700
    px-2 py-1 select-none
    flex items-center justify-between
  "
>
  {/* LEFT: ICON + NAME */}
  <div className="flex items-center gap-1 overflow-hidden">
    <span>{node.expanded ? "📂" : "📁"}</span>
    <span className="truncate">{node.name}</span>
  </div>

  {/* RIGHT: DELETE BUTTON */}
  {node.id !== "root" && (
    <button
      onClick={(e) => {
        e.stopPropagation()   // 🔥 prevents folder toggle
        deleteNode(node)
      }}
      className="
      p-1 rounded
       text-white 
        hover:bg-red-600/80
        transition-all
      "
      title="Delete Folder"
    >
      <DeleteIcon />
    </button>
  )}
</div>


        {node.expanded &&
          node.children?.map((c) => (
            <TreeNode
              key={c.id}
              node={c}
              activeFile={activeFile}   
              // setActiveFile={setActiveFile}
               openFile={openFile} 
              deleteNode={deleteNode}
              renameNode={renameNode}
              toggleFolder={toggleFolder}
              level={level + 1}
            />
          ))}
      </div>
    )
  }
// const isActive = activeFile?.id === node.id
const isPDF = node.name.toLowerCase().endsWith(".pdf")

return (
  <div
    ref={nodeRef}
    style={padding}
   onClick={() => {
  if (node.type !== "file") return
  if (typeof openFile !== "function") return
  openFile(node)
}}

    className={`group cursor-pointer px-2 py-1 flex items-center justify-between
      hover:bg-neutral-700 transition-colors
      ${isActive
        ? "bg-blue-600/30 text-white border-l-2 border-blue-500 pl-1"
        : "border-l-2 border-transparent pl-1"
      }`}
  >
    {/* LEFT: ICON + NAME */}
    <div className="flex items-center gap-1 overflow-hidden">
      {isPDF ? <PDF /> : <FILE />}
      <span className="truncate">{node.name}</span>
    </div>

    {/* RIGHT: DELETE ICON */}
    <button
      onClick={(e) => {
        e.stopPropagation()   // 🔥 prevents file open
        deleteNode(node)
      }}
      className="
        p-1 rounded
        text-white
        hover:bg-red-600/80
        transition-all
      "
      title="Delete"
    >
      <svg
        viewBox="0 0 24 24"
        className="w-4 h-4 stroke-current"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M7.69231 8.70833H5V8.16667H9.84615
             M7.69231 8.70833V19H16.3077V8.70833
             M7.69231 8.70833H16.3077
             M16.3077 8.70833H19V8.16667H14.1538
             M9.84615 8.16667V6H14.1538V8.16667
             M9.84615 8.16667H14.1538"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M10 11V17" strokeLinecap="round" />
        <path d="M12 11V17" strokeLinecap="round" />
        <path d="M14 11V17" strokeLinecap="round" />
      </svg>
    </button>
  </div>
)
}