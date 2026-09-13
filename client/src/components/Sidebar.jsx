import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import axios from "axios"
import { API_URL } from "../config/api"
import { LogOut, X } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import TreeNode from "./TreeNode"
import { getData } from "@/context/userContext"
import { getDisplayName, getUserProfilePhoto } from "@/utils/userProfile"
import { logoutUser } from "@/utils/logout"

function ProfileModal({ user, displayName, profilePhoto, subscription, onClose, onLogout, onUpgrade }) {
  useEffect(() => {
    const onKeyDown = (event) => event.key === "Escape" && onClose()
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [onClose])

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4" role="presentation" onMouseDown={onClose}>
      <section role="dialog" aria-modal="true" aria-label="User profile" onMouseDown={(event) => event.stopPropagation()} className="profile-modal-surface relative z-[101] w-full max-w-sm rounded-2xl border border-neutral-700 p-6 text-center shadow-2xl">
        <button type="button" onClick={onClose} aria-label="Close profile" className="absolute right-3 top-3 rounded-lg p-2 text-neutral-400 transition hover:bg-neutral-700 hover:text-neutral-100"><X size={18} /></button>
        {profilePhoto ? <img src={profilePhoto} alt={`${displayName} profile`} referrerPolicy="no-referrer" className="mx-auto h-20 w-20 rounded-full border border-neutral-600 object-cover" /> : <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-neutral-600 bg-neutral-700 text-2xl font-semibold text-neutral-200">{displayName[0]?.toUpperCase()}</span>}
        <h2 className="mt-4 truncate text-lg font-semibold text-neutral-100">{displayName}</h2>
        {user.email && <p className="mt-1 truncate text-sm text-neutral-400">{user.email}</p>}
        <div className="mt-5 rounded-lg border border-neutral-700 bg-neutral-900 p-3 text-left"><p className="text-xs uppercase tracking-wide text-neutral-500">Current Plan</p><p className="mt-1 text-sm font-semibold text-neutral-100">{subscription?.plan && subscription?.plan !== "free" && subscription?.status === "active" ? `PDF Nexus ${subscription.plan[0].toUpperCase()}${subscription.plan.slice(1)}` : "Free"}</p><button type="button" onClick={onUpgrade} className="mt-2 text-sm font-medium text-blue-400 hover:text-blue-300">Upgrade Plan</button></div>
        <div className="my-6 border-t border-neutral-700" />
        <button type="button" onClick={onLogout} className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-500"><LogOut size={17} />Logout</button>
      </section>
    </div>,
    document.body
  )
}

export default function Sidebar({ tree = [], activeFile, openFile, uploadFile, uploadFolder, deleteNode, renameNode, toggleFolder }) {
  const { user, setUser } = getData()
  const displayName = getDisplayName(user)
  const profilePhoto = getUserProfilePhoto(user)
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)
  const [subscription, setSubscription] = useState(user?.subscription)
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 })
  const fileInputRef = useRef(null)
  const folderInputRef = useRef(null)
  const buttonRef = useRef(null)

  useEffect(() => {
    if (!open || !buttonRef.current) return
    const rect = buttonRef.current.getBoundingClientRect()
    setMenuPos({ top: rect.bottom + 6, left: rect.left })
  }, [open])

  useEffect(() => {
    if (!user) return
    axios.get(`${API_URL}/payment/status`, { headers: { Authorization: `Bearer ${localStorage.getItem("accessToken")}` } })
      .then(({ data }) => setSubscription(data.subscription))
      .catch(() => setSubscription(user?.subscription))
  }, [user, user?.subscription])

  const currentPlanName = subscription?.plan && subscription?.status === "active"
    ? `${subscription.plan[0].toUpperCase()}${subscription.plan.slice(1)}`
    : "Free"

  const handleLogout = async () => {
    try {
      await logoutUser()
      toast.success("Logged out successfully")
    } catch (error) {
      console.error("Logout request failed", error)
      toast.error("Logout request failed, but you have been signed out locally")
    } finally {
      setIsProfileModalOpen(false)
      setUser(null)
      navigate("/login", { replace: true })
    }
  }

  return <div className="fixed inset-y-0 left-0 z-40 flex w-[85vw] max-w-72 flex-col border-r border-neutral-800 bg-neutral-900 shadow-2xl md:static md:z-auto md:w-64 md:max-w-none md:shadow-none">
    <div className="border-b border-neutral-800 px-3 py-2"><button ref={buttonRef} onClick={() => setOpen(true)} className="rounded bg-neutral-800 px-3 py-1.5 text-sm text-neutral-200 hover:bg-neutral-700">File</button></div>
    {open && <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} />}
    {open && <div style={{ top: menuPos.top, left: menuPos.left }} className="fixed z-50 w-56 rounded-md border border-neutral-700 bg-neutral-900 py-1 shadow-2xl"><MenuItem onClick={() => { fileInputRef.current.click(); setOpen(false) }}>Upload File</MenuItem><MenuItem onClick={() => { folderInputRef.current.click(); setOpen(false) }}>Upload Folder</MenuItem></div>}
    <input ref={fileInputRef} type="file" hidden onChange={uploadFile} />
    <input ref={folderInputRef} type="file" hidden webkitdirectory="true" multiple onChange={uploadFolder} />
    <div className="flex-1 overflow-auto p-2 text-sm">{tree.length === 0 ? <div className="px-2 text-neutral-500">No files</div> : tree.map((node) => <TreeNode key={node.id} node={node} activeFile={activeFile} openFile={openFile} deleteNode={deleteNode} renameNode={renameNode} toggleFolder={toggleFolder} />)}</div>
    {user && <div className="mt-auto shrink-0 border-t border-neutral-800 p-3"><button type="button" onClick={() => setIsProfileModalOpen(true)} className="flex w-full items-center gap-3 rounded-xl border border-neutral-700 bg-neutral-800 px-3 py-2 text-left transition-colors hover:bg-neutral-700" title={`${displayName} — ${currentPlanName}`} aria-label={`Open profile for ${displayName}`}>{profilePhoto ? <img src={profilePhoto} alt={`${displayName} profile`} referrerPolicy="no-referrer" className="h-9 w-9 shrink-0 rounded-full border border-neutral-600 object-cover" /> : <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-neutral-600 bg-neutral-700 text-sm font-semibold text-neutral-200">{displayName[0]?.toUpperCase()}</span>}<span className="min-w-0"><span className="block truncate text-sm font-semibold text-neutral-200">{displayName}</span><span className="mt-0.5 block truncate text-xs text-neutral-400">{currentPlanName}</span></span></button></div>}
    {isProfileModalOpen && <ProfileModal user={user} displayName={displayName} profilePhoto={profilePhoto} subscription={subscription} onClose={() => setIsProfileModalOpen(false)} onLogout={handleLogout} onUpgrade={() => { setIsProfileModalOpen(false); navigate("/pricing") }} />}
  </div>
}

function MenuItem({ children, onClick }) {
  return <div onClick={onClick} className="cursor-pointer select-none px-4 py-2 text-sm text-neutral-200 hover:bg-neutral-700">{children}</div>
}
