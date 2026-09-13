import { useEffect, useRef } from "react"
import { Moon, Sun } from "lucide-react"

// The canonical AI mark used by the toolbar control and every AI chat avatar.
export function AIChatIcon({ className = "" }) {
  return (
    <svg viewBox="-4.8 -4.8 57.6 57.6" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <rect x="-4.8" y="-4.8" width="57.6" height="57.6" rx="28.8" fill="#fff" />
      <path fill="#000" d="M45.6 18.7 41 14.9V7.5a1 1 0 0 0-.6-.9L30.5 2.1h-.4l-.6.2L24 5.9l-5.5-3.7-.6-.2h-.4L7.6 6.6a1 1 0 0 0-.6.9v7.4l-4.6 3.8a.8.8 0 0 0-.4.8v9H2a.8.8 0 0 0 .4.8L7 33.1v7.4a1 1 0 0 0 .6.9l9.9 4.5h.4l.6-.2 5.5-3.6 5.5 3.6.6.2h.4l9.9-4.5a1 1 0 0 0 .6-.9v-7.4l4.6-3.8a.8.8 0 0 0 .4-.7v-9.2a.8.8 0 0 0-.4-.7ZM21 25.5h1.5v12.8l-.7.5-4.2 2.8L11 38.5v-5.4l.7-.3a1.5 1.5 0 0 0 .6-2 1.4 1.4 0 0 0-2-.7l-.4.2-.4-.3L6 27.1v-1.6h1.5a1.5 1.5 0 0 0 0-3H6v-1.6l3.5-2.8.4-.3.4.2.7.2a1.4 1.4 0 0 0 1.3-.9 1.5 1.5 0 0 0-.6-2L11 15V9.5l6.6-3.1 4.2 2.8.7.5v12.8H21a1.5 1.5 0 0 0 0 3Zm21-3H40.5a1.5 1.5 0 0 0 0 3H42v1.6L38.5 30l-.4.3-.4-.2a1.4 1.4 0 0 0-2 .7 1.5 1.5 0 0 0 .6 2l.7.3v5.4l-6.6 3.1-4.2-2.8-.7-.5V25.5H27a1.5 1.5 0 0 0 0-3h-1.5V9.7l.7-.5 4.2-2.8L37 9.5V15l-.7.3a1.5 1.5 0 0 0-.6 2 1.4 1.4 0 0 0 1.3.9l.7-.2.4-.2.4.3 3.5 2.8v1.6Z" />
      <path fill="#000" d="M13.9 9.9a1.8 1.8 0 0 0 0 2.2l2.6 2.5v2.8l-4 4v5.2l4 4v2.8l-2.6 2.5a1.8 1.8 0 0 0 0 2.2 1.5 1.5 0 0 0 1.1.4 1.5 1.5 0 0 0 1.1-.4l3.4-3.5v-5.2l-4-4v-2.8l4-4v-5.2l-3.4-3.5a1.8 1.8 0 0 0-2.2 0ZM31.5 14.6l2.6-2.5a1.8 1.8 0 0 0 0-2.2 1.8 1.8 0 0 0-2.2 0l-3.4 3.5v5.2l4 4v2.8l-4 4v5.2l3.4 3.5a1.7 1.7 0 0 0 2.2 0 1.8 1.8 0 0 0 0-2.2l-2.6-2.5v-2.8l4-4v-5.2l-4-4Z" />
    </svg>
  )
}

export default function Topbar({ activeFile, openFiles, setActiveFile, onCloseFile, onToggleAI, showAI, theme, onToggleTheme }) {
  const tabsRef = useRef(null)
  const onWheelTabs = (event) => {
    const element = tabsRef.current
    if (element?.scrollWidth > element?.clientWidth) element.scrollLeft += event.deltaY
  }

  useEffect(() => {
    if (!tabsRef.current || !activeFile) return
    tabsRef.current.querySelector(`[data-id="${activeFile.id}"]`)?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" })
  }, [activeFile])

  return <div className="h-12 bg-neutral-800 flex items-center border-b border-neutral-700 w-full overflow-hidden">
    <div ref={tabsRef} onWheel={onWheelTabs} className="flex flex-1 h-full items-center overflow-x-auto overflow-y-hidden whitespace-nowrap scrollbar-none">
      {openFiles.length === 0 && <div className="text-sm text-gray-400 px-3">No file</div>}
      {openFiles.map((file) => {
        const isActive = activeFile?.id === file.id
        return <div key={file.id} data-id={file.id} onClick={() => setActiveFile(file)} className={`group flex items-center h-full px-2 py-1 cursor-pointer transition-colors border-r border-neutral-700 ${isActive ? "bg-blue-200/30 text-white border-t-2 border-blue-500" : "text-gray-400 hover:bg-neutral-700"}`}>
          <span className="truncate max-w-[140px]">{file.name}</span>
          <button onClick={(event) => { event.stopPropagation(); onCloseFile(file.id) }} className="ml-1 p-1 rounded text-white hover:bg-white/10 opacity-0 group-hover:opacity-100 transition" title="Close">✕</button>
        </div>
      })}
    </div>
    <div className="flex items-center gap-1 px-2 shrink-0">
      <button onClick={onToggleTheme} className="w-9 h-9 flex items-center justify-center rounded hover:bg-neutral-700" title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}>{theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}</button>
      <button onClick={onToggleAI} className="w-10 h-10 flex items-center justify-center rounded-full bg-black hover:ring-2 hover:ring-blue-400/60" aria-label="Toggle AI assistant">
        <div className="relative w-6 h-6 flex items-center justify-center">
          <div className={`absolute inset-0 rounded-full bg-blue-500/20 blur-sm ${showAI ? "animate-none" : "animate-[aiBreath_1.8s_ease-in-out_infinite]"}`} />
          <div className={`w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center shadow-md ${showAI ? "animate-none" : "animate-[aiBreath_1.8s_ease-in-out_infinite]"}`}><AIChatIcon className="h-6 w-6" /></div>
        </div>
      </button>
    </div>
  </div>
}
