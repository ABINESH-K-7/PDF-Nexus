import { useEffect, useRef, useState } from "react"
import axios from "axios"
import { API_URL } from "./config/api"
import Sidebar from "./components/Sidebar"
import Editor from "./components/Editor"
import Topbar from "./components/Topbar"
import { createId, findAndUpdate, removeNode } from "./utils/treeUtils"
import { extractPdfText, exportTextToPdf } from "./utils/pdfUtils"
import AIChat from "./components/AIChat"
import ActivityBar from "./components/ActivityBar"
import Loader from "./components/Loader"
import { Routes, Route } from "react-router-dom"
import Signup from "./components/pages/auth/Signup"
import Login from "./components/pages/auth/Login"
import Verify from "./components/pages/auth/Verify"
import AuthSuccess from "./components/pages/auth/AuthSuccess"
import UserProfile from "./components/pages/auth/UserProfile"
import ProtectedRoute from "./components/ProtectedRoute"
import { getData } from "@/context/userContext"
import ForgotPassword from "./components/pages/auth/ForgotPassword"
import ChangePassword from "./components/pages/auth/ChangePassword"
import VerifyEmail from "./components/pages/auth/VerifyEmail"
import VerifyOTP from "./components/pages/auth/VerifyOTP"
import CreatePassword from "./components/pages/auth/CreatePassword"
import NotFound from "./components/pages/auth/NotFound"
import EmailVerified from "./components/pages/auth/EmailVerified"
import { getDisplayName } from "./utils/userProfile"
import Pricing from "./components/pages/Pricing"




export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "dark")

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem("theme", theme)
  }, [theme])

  // -------- FILE TREE STATE --------
  const { user } = getData()
  const [activeFile, setActiveFile] = useState(null)
const [chatStore, setChatStore] = useState(() => {
  const saved = localStorage.getItem("chatStore")
  return saved ? JSON.parse(saved) : {}
})



const normalizeChat = (dbChat) => {
  const threadsObject = {}
  const threadMeta = {}

  dbChat?.threads?.forEach(t => {
    threadsObject[t.threadId] = t.messages || []
    threadMeta[t.threadId] = {
      title: t.title || "New Chat",
      createdAt: t.createdAt,
      updatedAt: t.updatedAt
    }
  })

  return {
    activeThreadId: dbChat?.activeThreadId || null,
    threads: threadsObject,
    threadMeta
  }
}

const keepOptimisticMessages = (storedChat, loadedChat) => {
  const mergedThreads = { ...loadedChat.threads }
  Object.entries(storedChat?.threads || {}).forEach(([threadId, localMessages]) => {
    const persistedMessages = mergedThreads[threadId] || []
    const pendingMessages = localMessages
      .filter((message) => message.clientMessageId)
      .filter((message) => !persistedMessages.some((saved) => saved.role === message.role && saved.text === message.text))
    if (pendingMessages.length) mergedThreads[threadId] = [...persistedMessages, ...pendingMessages]
  })
  return { ...loadedChat, threads: mergedThreads }
}

const getGridFsId = (file) => file?.gridFsId || file?.url?.match(/^\/files\/([^/]+)\/view$/)?.[1]



useEffect(() => {
  localStorage.setItem("chatStore", JSON.stringify(chatStore))
}, [chatStore])


    

    const [tree, setTree] = useState([
  {
    id: "root",
    name: "Workspace",
    type: "folder",
    expanded: true,
    children: []
  }
])




        const saveTree = async (treeData) => {
      try {
        const token = localStorage.getItem("accessToken")
    
        await axios.post(
          `${API_URL}/files`,
          { tree: treeData },
          {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        )
    
        console.log("TREE SAVED")
      } catch (err) {
        console.error("SAVE TREE FAILED", err.response?.data || err.message)
      }
    }

   useEffect(() => {
    if (!user) return

    const timeout = setTimeout(() => {
      saveTree(tree)}, 500)

    return () => clearTimeout(timeout)
}, [tree, user])

    
    useEffect(() => {
  if (!user) return;

  const loadFiles = async () => {
    try{
      
    
    const token = localStorage.getItem("accessToken");

    const res = await axios.get(`${API_URL}/files`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

  if (res.data.success) {
  const loadedTree = res.data.tree

  if (
    !Array.isArray(loadedTree) ||
    loadedTree.length === 0 ||
    loadedTree[0].id !== "root"
  ) {
    // 🔒 always ensure root
    setTree([
      {
        id: "root",
        name: getDisplayName(user),
        type: "folder",
        expanded: true,
        children: loadedTree || []
      }
    ])
  } else {
    setTree(loadedTree)
  }
}

  } catch (err) {
    console.error("LOAD FILES FAILED", err);
  }
  };

   if(user) loadFiles();
}, [user]);

useEffect(() => {
  if (!user || !tree.length) return

  setTree(prev =>
    prev.map(node =>
      node.id === "root"
        ? { ...node, name: getDisplayName(user) }
        : node
    )
  )
}, [user?.username, tree.length])



useEffect(() => {
  const chatFileId = getGridFsId(activeFile)
  if (!chatFileId) return

  const token = localStorage.getItem("accessToken")
  if (!token) return

  const loadChat = async () => {
    try {
      const res = await axios.get(
        `${API_URL}/chat/${chatFileId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      )

  if (res.data?.success) {
  const normalized = normalizeChat(res.data)

  setChatStore(prev => ({
    ...prev,
    [chatFileId]: keepOptimisticMessages(prev[chatFileId], normalized)
  }))
}

    } catch (err) {
      console.error("LOAD CHAT FAILED", err)
    }
  }

  loadChat()
}, [activeFile])




  const [openFiles, setOpenFiles] = useState([])

  const [showAI, setShowAI] = useState(false)
const [aiWidth, setAiWidth] = useState(380)
const [isResizing, setIsResizing] = useState(false); // Add this state

const isResizingRef = useRef(false)
const startXRef = useRef(0)
const startWidthRef = useRef(0)
const rafRef = useRef(null)


const [showSidebar, setShowSidebar] = useState(() => window.innerWidth >= 768)

 const [loading, setLoading] = useState(true)

const canShowAI = showAI && activeFile?.fileType === "pdf"



  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false)
    }, 1200) // adjust timing if needed

    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
  if (showAI && !activeFile) {
    setShowAI(false)
  }
}, [showAI, activeFile])

  const openFile = (file) => {
    setOpenFiles(prev => {
      const exists = prev.find(f => f.id === file.id)
      if (exists) return prev
      return [...prev, file]
    })
    setActiveFile(file)
    if (window.innerWidth < 768) setShowSidebar(false)
//     setOpenFiles(prev => {
//   const exists = prev.find(f => f.id === file.id)
//   return exists ? prev : [...prev, file]
// })

  }

  // ✅ CLOSE FILE (tab close)
  const closeFile = (id) => {
    setOpenFiles(prev => {
      const index = prev.findIndex(f => f.id === id)
      const newFiles = prev.filter(f => f.id !== id)

      if (activeFile?.id === id) {
        const next = newFiles[index] || newFiles[index - 1]
        setActiveFile(next || null)
      }

      return newFiles
    })
  }
useEffect(() => {
  const onMouseMove = (e) => {
    if (!isResizingRef.current) return

    // Smooth animation frame
    if (rafRef.current) cancelAnimationFrame(rafRef.current)

    rafRef.current = requestAnimationFrame(() => {
      const dx = startXRef.current - e.clientX
      const newWidth = startWidthRef.current + dx

      setAiWidth(Math.min(600, Math.max(280, newWidth)))
    })
  }

  const onMouseUp = () => {
    isResizingRef.current = false
     setIsResizing(false)
    document.body.style.cursor = "default"
    document.body.style.userSelect = "auto"
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
  }

  window.addEventListener("mousemove", onMouseMove)
  window.addEventListener("mouseup", onMouseUp)

  return () => {
    window.removeEventListener("mousemove", onMouseMove)
    window.removeEventListener("mouseup", onMouseUp)
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
  }
}, [])


 



  // -------- TREE ACTIONS --------

  const toggleFolder = (id) => {
    setTree(prev =>
      findAndUpdate(prev, id, node => ({
        ...node,
        expanded: !node.expanded
      }))
    )
  }

const uploadFile = async (e) => {
  const file = e.target.files[0]
  if (!file) return

  try {
    const token = localStorage.getItem("accessToken")

    const formData = new FormData()
    formData.append("file", file)

    const res = await axios.post(
      `${API_URL}/files/upload`,
      formData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data"
        }
      }
    )

    // ✅ URL returned from backend
    const fileUrl = res.data.url

    // ✅ STORE IN FILE TREE (NOT blob URL)
    const newFile = {
      id: res.data.id,
      type: "file",
      name: file.name,
      fileType: file.type === "application/pdf" ? "pdf" : "text",
      gridFsId: res.data.gridFsId,
      url: fileUrl
    }

    setTree(prev =>
      findAndUpdate(prev, "root", n => ({
        ...n,
        children: [...n.children, newFile]
      }))
    )

    setActiveFile(newFile)
    setOpenFiles(prev => {
  const exists = prev.some(f => f.id === newFile.id)
  return exists ? prev : [...prev, newFile]
})


  } catch (err) {
    console.error("UPLOAD FAILED", err)
    alert("File upload failed")
  }
}
const uploadFolder = async (e) => {
  const files = Array.from(e.target.files)
  if (!files.length) return

  const uploadedTree = await buildTreeFromFiles(files)

  setTree(prevTree => {
    const root = prevTree.find(n => n.id === "root")

    return [
      {
        ...root,
        children: [...root.children, ...uploadedTree]
      }
    ]
  })

  e.target.value = null
}

function getFileType(file) {
  if (file.type === "application/pdf") return "pdf"
  if (file.name.endsWith(".md")) return "markdown"
  return "text"
}



async function buildTreeFromFiles(files) {
  const root = []

  for (const file of files) {
    const parts = file.webkitRelativePath.split("/")
    let current = root

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      const isFile = i === parts.length - 1

      let existing = current.find(n => n.name === part)

      if (!existing) {
        existing = {
          id: crypto.randomUUID(),
          name: part,
          type: isFile ? "file" : "folder",
          expanded: true,
          children: []
        }

        // ✅ READ FILE CONTENT HERE
        if (isFile) {
          existing.fileType = getFileType(file)
          existing.content = await file.text()
        }

        current.push(existing)
      }

      current = existing.children
    }
  }

  return root
}




const deleteNode = async (node) => {
    if (node.id === "root") return
  if (!confirm(`Delete "${node.name}" ?`)) return

  // 🔐 delete chat from DB (if file)
  if (node.type === "file") {
    try {
      const token = localStorage.getItem("accessToken")

      await axios.delete(
        `${API_URL}/chat/${getGridFsId(node) || node.id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      )
    } catch (err) {
      console.error("DELETE CHAT FAILED", err)
    }
  }

  // 🧹 remove from tree
  setTree(prev => removeNode(prev, node.id))

  
  // 🧹 remove from topbar tabs
  setOpenFiles(prev => prev.filter(f => f.id !== node.id))

  // 🧹 UI cleanup
  if (node.id === activeFile?.id) {
    setActiveFile(null)
    setShowAI(false)
  }

  // 🧹 local chat store cleanup
  setChatStore(prev => {
    const copy = { ...prev }
    delete copy[getGridFsId(node) || node.id]
    return copy
  })
}



  const renameNode = (node) => {
    const name = prompt("New name", node.name)
    if (!name) return

    setTree(prev =>
      findAndUpdate(prev, node.id, n => ({
        ...n,
        name
      }))
    )
  }

  // -------- PDF ACTIONS --------

  const editPdf = async (file) => {
    const text = await extractPdfText(file)

    setActiveFile({
      id: createId(),
      type: "file",
      name: file.name + " (editable)",
      fileType: "text",
      content: text,
      sourcePdf: file
    })
  }

  const exportPdf = async () => {
    const blob = await exportTextToPdf(activeFile.content)

    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = "edited.pdf"
    a.click()
  }

  const updateContent = (value) => {
    setActiveFile(prev => ({ ...prev, content: value }))
  }

  // -------- UI --------


const startResize = (e) => {
  e.preventDefault()

  isResizingRef.current = true
   setIsResizing(true);
  startXRef.current = e.clientX
  startWidthRef.current = aiWidth

  document.body.style.cursor = "ew-resize"
  document.body.style.userSelect = "none"
}




  if (loading) return <Loader />

 return (
    <Routes>
    <Route
      path="/"
      element={
        <ProtectedRoute>
 <div className="w-screen min-h-[100dvh] h-[100dvh] flex flex-col md:flex-row overflow-hidden bg-neutral-900 text-neutral-200">
    {/* ACTIVITY BAR */}
   <ActivityBar onToggleSidebar={() => setShowSidebar(v => !v)} />


    {/* SIDEBAR */}
  {showSidebar && (
  <>
  <div
    className="fixed inset-0 z-30 bg-black/50 md:hidden"
    onClick={() => setShowSidebar(false)}
    aria-hidden="true"
  />
  <Sidebar
    tree={tree}
    activeFile={activeFile}
    // setActiveFile={setActiveFile}
    openFile={openFile}
    uploadFile={uploadFile}
    uploadFolder={uploadFolder}
    deleteNode={deleteNode}
    renameNode={renameNode}
    toggleFolder={toggleFolder}
  />
  </>
)}


  {/* MAIN BODY (EDITOR + AI SIDE BY SIDE) */}
<div className="flex flex-1 flex-col overflow-hidden min-h-0 min-w-0">

        <Topbar
         openFiles={openFiles}
          activeFile={activeFile}
          onEditPdf={editPdf}
          setActiveFile={setActiveFile}
          onCloseFile={closeFile}
          onExportPdf={exportPdf}
          onToggleAI={() => {
    if (activeFile?.fileType !== "pdf") return

    // Opening the panel must not create a client-only thread. Threads are
    // created by the authenticated Node API on first message or New Chat.
    setShowAI(v => !v)
    return
    /* Legacy client-only thread creation intentionally disabled.

    setChatStore(prev => {
      // ✅ If chat already exists, do nothing
      if (prev[activeFile.id]?.activeThreadId) return prev

      const threadId = crypto.randomUUID()

      return {
        ...prev,
        [activeFile.id]: {
          activeThreadId: threadId,
          threads: {
            [threadId]: [
              {
                role: "ai",
                text: "Hi! I’m your assistant.",
                createdAt: new Date().toISOString()
              }
            ]
          }
        }
      }
    })

    setShowAI(v => !v)
    */
          }}
          showAI={showAI}
          theme={theme}
          onToggleTheme={() => setTheme(current => current === "dark" ? "light" : "dark")}
        />
      <div className="flex flex-1 flex-col md:flex-row overflow-hidden min-h-0 min-w-0">

        {/* EDITOR */}    
   <div
  className="flex-1 min-w-0 min-h-0 overflow-hidden"
  style={{ pointerEvents: isResizing ? "none" : "auto" }}
>
<Editor
  activeFile={activeFile}
  updateContent={updateContent}
  uploadFile={uploadFile}
/>

</div>


      {/* AI PANEL (RESIZABLE) */}
{canShowAI &&  (
  <>
    {/* RESIZE HANDLE */}
    <div
      onMouseDown={startResize}
      className="hidden md:block w-1.5 flex-shrink-0 cursor-ew-resize bg-neutral-700 hover:bg-blue-200"
      title="Resize"
    />

    {/* AI PANEL */}
    <div
      style={{ "--ai-width": `${aiWidth}px` }}
      className="w-full h-[48%] md:w-[var(--ai-width)] md:h-auto bg-neutral-900 border-t md:border-t-0 md:border-l border-neutral-700 flex-none min-w-0 flex flex-col overflow-hidden"
    >
     <AIChat
        fileId={getGridFsId(activeFile)}
        fileName={activeFile.name}
        chatData={
          chatStore[getGridFsId(activeFile)] ?? {
            activeThreadId: null,
            threads: {},
            threadMeta: {}
          }
        }
        setChatStore={setChatStore}
        onClose={() => setShowAI(false)}
      />
    </div>
  </>
)}


</div>
</div>
  </div>
  </ProtectedRoute>
}
 />  










  {/* AUTH ROUTES */}
    <Route path="/signup" element={<Signup/>} />
    <Route path="/login" element={<Login />} />
    <Route path="/verify/:token" element={<VerifyEmail />} />
    <Route path="/verify" element={<VerifyEmail />} />
    <Route path="/auth-success" element={<AuthSuccess />} />
    <Route path="/profile" element={<ProtectedRoute><UserProfile /></ProtectedRoute>} />
    <Route path="/pricing" element={<ProtectedRoute><Pricing theme={theme} onToggleTheme={() => setTheme(current => current === "dark" ? "light" : "dark")} /></ProtectedRoute>} />
    <Route path="/change-password/:token" element={<ChangePassword />} />
    <Route path="/forgot-password" element={<ForgotPassword />} />
    <Route path="/verify-otp/:email" element={<VerifyOTP />} />
    <Route path="/create-password" element={<CreatePassword />} />
    <Route path="/email-verified" element={<EmailVerified/>} />



    <Route path="*" element={<NotFound />} />
  </Routes>
  )
}
