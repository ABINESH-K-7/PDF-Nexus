import { useEffect, useRef, useState } from "react"
import { getData } from "@/context/userContext"
import axios from "axios"
import { API_URL } from "../config/api"
import { SendHorizontal } from "lucide-react"
import { AIChatIcon } from "./Topbar"
import { getDisplayName, getUserProfilePhoto } from "@/utils/userProfile"


const getFirstName = (user) => (user?.username || user?.name || "there").trim().split(/\s+/)[0]

function AIBrainAvatar({ thinking = false }) {
  return (
    <div className={`ai-brain-avatar shrink-0 ${thinking ? "ai-brain-thinking" : ""}`} aria-label="AI assistant">
      <AIChatIcon className="h-6 w-6" />
    </div>
  )
}

export default function AIChat({ fileId, fileName, chatData, setChatStore, onClose }) {
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [thinking, setThinking] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [showHistory, setShowHistory] = useState(false)
  const messagesRef = useRef(null)
  const sendInProgressRef = useRef(false)
  const { user } = getData()
  const displayName = getDisplayName(user)
  const profilePhoto = getUserProfilePhoto(user)
  const activeThreadId = chatData?.activeThreadId
  const messages = activeThreadId ? chatData?.threads?.[activeThreadId] || [] : []

  useEffect(() => {
    messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight, behavior: "smooth" })
  }, [messages.length, thinking, errorMessage])

  const authConfig = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem("accessToken")}` }
  })

  const updateThread = (threadId, thread, makeActive = true) => {
    setChatStore((previous) => ({
      ...previous,
      [fileId]: {
        activeThreadId: makeActive ? threadId : previous[fileId]?.activeThreadId,
        // Preserve an optimistic question until its persisted counterpart
        // arrives, so an API refresh cannot make it disappear mid-response.
        threads: {
          ...(previous[fileId]?.threads || {}),
          [threadId]: (() => {
            const persistedMessages = thread.messages || []
            const optimisticMessages = (previous[fileId]?.threads?.[threadId] || [])
              .filter((message) => message.clientMessageId)
              .filter((message) => !persistedMessages.some((saved) => saved.role === message.role && saved.text === message.text))
            return [...persistedMessages, ...optimisticMessages]
          })()
        },
        threadMeta: {
          ...(previous[fileId]?.threadMeta || {}),
          [threadId]: { title: thread.title || "New Chat", createdAt: thread.createdAt, updatedAt: thread.updatedAt }
        }
      }
    }))
  }

  const createNewChat = async () => {
    if (!fileId || loading) return
    try {
      setLoading(true)
      const { data } = await axios.post(`${API_URL}/chat/${fileId}/thread`, {}, authConfig())
      updateThread(data.thread.threadId, data.thread)
    } catch (error) {
      console.error("Failed to create chat", error.response?.data || error.message)
    } finally {
      setLoading(false)
    }
  }

  const sendMessage = async () => {
    const question = input.trim()
    if (!question || !fileId || loading || sendInProgressRef.current) return

    const threadId = activeThreadId || crypto.randomUUID()
    setInput("")
    setErrorMessage("")
    sendInProgressRef.current = true
    setLoading(true)
    setThinking(true)
    const optimisticMessage = {
      role: "user",
      text: question,
      createdAt: new Date().toISOString(),
      clientMessageId: crypto.randomUUID()
    }
    setChatStore((previous) => {
      const currentFile = previous[fileId] || { activeThreadId: null, threads: {}, threadMeta: {} }
      const currentMessages = currentFile.threads?.[threadId] || []
      return {
        ...previous,
        [fileId]: {
          ...currentFile,
          activeThreadId: threadId,
          threads: { ...currentFile.threads, [threadId]: [...currentMessages, optimisticMessage] },
          threadMeta: {
            ...currentFile.threadMeta,
            [threadId]: currentFile.threadMeta?.[threadId] || { title: "New Chat", createdAt: optimisticMessage.createdAt, updatedAt: optimisticMessage.createdAt }
          }
        }
      }
    })
    try {
      const { data } = await axios.post(
        `${API_URL}/chat/${fileId}/${threadId}/message`,
        { question },
        authConfig()
      )
      updateThread(threadId, data.thread)
    } catch (error) {
      console.error("Failed to send message", error.response?.data || error.message)
      if (error.response?.status === 429) {
        const response = error.response.data || {}
        if (response.error_type === "quota_exceeded") {
          setErrorMessage(response.error || "Gemini API quota is currently exhausted. Please try again after the quota resets or increase the API quota.")
        } else if (response.error_type === "fallback_rate_limit_exceeded") {
          setErrorMessage(response.message || response.error || "Both AI providers are temporarily unavailable. Please try again later.")
        } else {
          const retryAfter = Number(response.retry_after)
          const waitMessage = Number.isFinite(retryAfter) && retryAfter > 0
            ? ` Please try again in about ${Math.max(1, Math.ceil(retryAfter / 60))} minute${retryAfter > 60 ? "s" : ""}.`
            : " Please try again in about 1 minute."
          setErrorMessage(`AI is temporarily busy.${waitMessage}`)
        }
      } else {
        setErrorMessage(error.response?.data?.error || error.response?.data?.message || "Unable to get an AI response. Please try again.")
      }
    } finally {
      sendInProgressRef.current = false
      setThinking(false)
      setLoading(false)
    }
  }

  const selectThread = async (threadId) => {
    setChatStore((previous) => ({
      ...previous,
      [fileId]: { ...previous[fileId], activeThreadId: threadId }
    }))
    setShowHistory(false)
    try {
      await axios.post(`${API_URL}/chat/${fileId}/${threadId}/activate`, {}, authConfig())
    } catch (error) {
      console.error("Failed to save active chat", error.response?.data || error.message)
    }
  }

  const formatTime = (date) => new Date(date).toLocaleString("en-US", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: true
  })

  return (
    <div className="relative h-full min-h-0 flex bg-neutral-900 text-neutral-200">
      <div className="relative h-full min-h-0 flex-1 flex flex-col">
        <div className="shrink-0 px-4 py-3 bg-neutral-900 border-b border-neutral-700 flex items-center gap-2">
          <span className="mr-auto text-sm font-medium tracking-wide">AI Assistant</span>
          <button onClick={createNewChat} disabled={loading} className="px-2 py-1 text-sm rounded bg-blue-500/10 hover:bg-blue-500/20 disabled:opacity-50">New Chat</button>
          <button onClick={() => setShowHistory(true)} className="px-2 py-1 text-sm rounded bg-neutral-800 hover:bg-neutral-700">History</button>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-red-900" title="Close">✕</button>
        </div>

        <div ref={messagesRef} className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-neutral-900">
          {!messages.length && !loading && (
            <div className="h-full flex flex-col items-center justify-center text-center text-neutral-400 px-5">
              <p className="text-lg text-neutral-200">Hey {getFirstName(user)} 👋</p>
              <p className="mt-2">How can I help you with this PDF?</p>
              {fileName && <p className="mt-1 text-xs text-neutral-500">You&apos;re viewing {fileName}</p>}
            </div>
          )}
          {messages.map((message, index) => (
            <div key={`${message.createdAt || index}-${index}`} className={`flex w-full gap-3 ${message.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
              {message.role === "user" ? (
                profilePhoto ? (
                  <img src={profilePhoto} alt={`${displayName} profile`} referrerPolicy="no-referrer" className="h-8 w-8 shrink-0 rounded-full border border-neutral-600 object-cover" />
                ) : (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-neutral-600 bg-neutral-700 text-xs font-semibold">{displayName[0]?.toUpperCase()}</div>
                )
              ) : <AIBrainAvatar />}
              <div className={`max-w-[75%] px-4 py-2 text-sm leading-relaxed shadow-md break-words whitespace-pre-wrap ${message.role === "user" ? "bg-neutral-600 text-white border border-neutral-500 rounded-lg rounded-br-none" : "bg-neutral-800 text-neutral-300 border border-neutral-700 rounded-lg rounded-bl-none"}`}>
                <div>{message.text}</div>
                {message.createdAt && <div className="mt-1 text-[9px] opacity-60">{formatTime(message.createdAt)}</div>}
              </div>
            </div>
          ))}
          {thinking && <div className="flex gap-3"><AIBrainAvatar thinking /><div className="bg-neutral-800 border border-neutral-700 px-4 py-2 rounded-lg text-sm">Thinking<span className="thinking-dots" aria-label="Thinking"><i>.</i><i>.</i><i>.</i></span></div></div>}
          {errorMessage && <div role="alert" className="rounded border border-amber-700 bg-amber-950/50 px-3 py-2 text-sm text-amber-200">{errorMessage}</div>}
        </div>

        <div className="shrink-0 border-t border-neutral-700 p-3 flex gap-2 bg-neutral-900">
          <input value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => event.key === "Enter" && sendMessage()} disabled={loading} placeholder="Ask about this PDF…" className="flex-1 bg-neutral-800 text-sm px-3 py-2 rounded outline-none border border-neutral-700 focus:border-blue-400 disabled:opacity-50" />
          <button onClick={sendMessage} disabled={loading} aria-label="Send message" title="Send message" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"><SendHorizontal size={18} /></button>
        </div>
      </div>

      {showHistory && <div className="chat-history-panel absolute inset-0 z-50 flex flex-col">
        <div className="px-4 py-3 border-b border-neutral-700 font-medium flex justify-between items-center"><span>Chat History</span><button onClick={() => setShowHistory(false)} className="p-1.5 rounded hover:bg-red-900">✕</button></div>
        <div className="flex-1 overflow-y-auto">
          {!Object.keys(chatData?.threads || {}).length && <p className="p-4 text-sm text-neutral-500">No chats yet.</p>}
          {Object.entries(chatData?.threads || {}).map(([threadId], index) => (
            <button key={threadId} onClick={() => selectThread(threadId)} className={`w-full text-left px-4 py-3 text-sm ${activeThreadId === threadId ? "bg-blue-500/20 text-blue-300" : "hover:bg-neutral-700"}`}>
              <span className="block truncate">{chatData.threadMeta?.[threadId]?.title || `Chat ${index + 1}`}</span>
              {chatData.threadMeta?.[threadId]?.updatedAt && <span className="mt-1 block text-xs opacity-60">{formatTime(chatData.threadMeta[threadId].updatedAt)}</span>}
            </button>
          ))}
        </div>
      </div>}
    </div>
  )
}
