import { ObjectId } from "mongodb"
import { randomUUID } from "node:crypto"
import mongoose from "mongoose"
import Chat from "../models/Chat.js"

const RAG_SERVICE_URL = process.env.RAG_SERVICE_URL
const HISTORY_LIMIT = 16
// Keep a finite upper bound for genuine Python/RAG stalls. Interactive Gemini
// 429 responses return immediately and are not retried by Python or Node.
const RAG_ASK_TIMEOUT_MS = 5 * 60 * 1000

const toTitleCase = (value) => value.replace(/\b\w/g, (letter) => letter.toUpperCase())

const createTitle = (question) => {
  const cleaned = question
    .replace(/[?!.]+$/g, "")
    .replace(/^(can you|could you|please|tell me|explain|what is|what are|how does|how do)\s+/i, "")
    .trim()

  if (/\b(summarize|summary)\b/i.test(question)) {
    const chapter = question.match(/\bchapter\s+(\d+)\b/i)
    return chapter ? `Chapter ${chapter[1]} Summary` : "Document Summary Chat"
  }

  const comparison = question.match(/(?:difference between|compare)\s+(.+?)\s+(?:and|vs\.?|versus)\s+(.+)/i)
  if (comparison) return `${toTitleCase(comparison[1].trim())} vs ${toTitleCase(comparison[2].trim())}`.split(/\s+/).slice(0, 7).join(" ")
  if (/\b(this pdf|this document)\b/i.test(question)) return "PDF Overview Chat"

  const words = (cleaned || "").match(/[\p{L}\p{N}]+/gu) || []
  if (words.length >= 3) return toTitleCase(words.slice(0, 7).join(" "))
  return "New PDF Discussion"
}

const getOwnedPdf = async (fileId, userId) => {
  const objectIdIsValid = ObjectId.isValid(fileId)
  const authenticatedUserId = userId?.toString()
  console.info("Chat PDF ownership lookup", {
    requestedFileId: fileId,
    authenticatedUserId,
    objectIdIsValid
  })

  if (!objectIdIsValid) return null

  // Older GridFS uploads validly omit top-level contentType. Ownership is
  // determined only by the canonical GridFS _id and uploader metadata.
  const file = await mongoose.connection.db.collection("fs.files").findOne({
    _id: new ObjectId(fileId)
  })
  const storedUserId = file?.metadata?.userId
  const ownershipMatches = Boolean(file) && storedUserId === authenticatedUserId

  console.info("Chat PDF ownership result", {
    requestedFileId: fileId,
    fsFileFound: Boolean(file),
    storedMetadataUserId: storedUserId,
    ownershipMatches
  })

  return ownershipMatches ? file : null
}

const requireOwnedPdf = async (req, res) => {
  const file = await getOwnedPdf(req.params.fileId, req.userId)
  if (!file) {
    res.status(404).json({ success: false, message: "PDF not found" })
    return null
  }
  return file
}

export const getChatByFile = async (req, res) => {
  try {
    if (!(await requireOwnedPdf(req, res))) return
    const chat = await Chat.findOne({ userId: req.userId, fileId: req.params.fileId }).lean()
    res.json({ success: true, threads: chat?.threads || [], activeThreadId: chat?.activeThreadId || null })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

export const createThread = async (req, res) => {
  try {
    if (!(await requireOwnedPdf(req, res))) return
    const thread = {
      threadId: randomUUID(), title: "New Chat", messages: [],
      createdAt: new Date(), updatedAt: new Date()
    }
    const chat = await Chat.findOneAndUpdate(
      { userId: req.userId, fileId: req.params.fileId },
      { $push: { threads: thread }, $set: { activeThreadId: thread.threadId } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    )
    res.status(201).json({ success: true, thread, activeThreadId: chat.activeThreadId })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

export const setActiveThread = async (req, res) => {
  try {
    if (!(await requireOwnedPdf(req, res))) return
    const chat = await Chat.findOne({ userId: req.userId, fileId: req.params.fileId })
    if (!chat || !chat.threads.some((thread) => thread.threadId === req.params.threadId)) {
      return res.status(404).json({ success: false, message: "Chat thread not found" })
    }
    chat.activeThreadId = req.params.threadId
    await chat.save()
    res.json({ success: true, activeThreadId: chat.activeThreadId })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

export const sendMessage = async (req, res) => {
  try {
    if (!RAG_SERVICE_URL) return res.status(503).json({ success: false, message: "RAG service is not configured" })
    if (!(await requireOwnedPdf(req, res))) return
    const question = req.body.question?.trim()
    if (!question) return res.status(400).json({ success: false, message: "question is required" })

    const { fileId, threadId } = req.params
    const newThread = {
      threadId,
      title: "New Chat",
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date()
    }

    // Persist a first-message thread before calling the external RAG service.
    // The conditional second update makes concurrent requests for the same
    // thread id converge on one thread instead of creating duplicates.
    let chat = await Chat.findOneAndUpdate(
      { userId: req.userId, fileId },
      {
        $setOnInsert: {
          userId: req.userId,
          fileId,
          threads: [newThread],
          activeThreadId: threadId
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    )

    if (!chat.threads.some((item) => item.threadId === threadId)) {
      chat = await Chat.findOneAndUpdate(
        { userId: req.userId, fileId, "threads.threadId": { $ne: threadId } },
        { $push: { threads: newThread }, $set: { activeThreadId: threadId } },
        { new: true }
      ) || await Chat.findOne({ userId: req.userId, fileId })
    }

    const thread = chat?.threads.find((item) => item.threadId === threadId)
    if (!thread) return res.status(409).json({ success: false, message: "Unable to create chat thread" })

    const history = thread.messages.slice(-HISTORY_LIMIT).map(({ role, text }) => ({ role, text }))
    console.info("Sending RAG conversation history", {
      fileId,
      threadId,
      historyMessageCount: history.length
    })
    const ragStartedAt = Date.now()
    let ragResponse
    let ragData
    try {
      console.info("Python /ask request started", {
        fileId,
        threadId,
        timeoutMs: RAG_ASK_TIMEOUT_MS
      })
      ragResponse = await fetch(`${RAG_SERVICE_URL}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId, userId: req.userId.toString(), threadId, question, history }),
        signal: AbortSignal.timeout(RAG_ASK_TIMEOUT_MS)
      })
      ragData = await ragResponse.json().catch(() => ({}))
    } catch (error) {
      const elapsedMs = Date.now() - ragStartedAt
      if (error.name === "TimeoutError") {
        console.warn("Python /ask timeout detected", {
          fileId,
          threadId,
          timeoutMs: RAG_ASK_TIMEOUT_MS,
          elapsedMs
        })
        // Do not retry here. Python may still complete after this client-side
        // abort; persisting messages only after a received answer avoids a
        // duplicate user/AI pair if the user later retries manually.
        return res.status(504).json({
          success: false,
          error: "AI request timed out before an answer was received. Please wait before trying again.",
          message: "RAG service timed out"
        })
      }
      throw error
    }
    const ragElapsedMs = Date.now() - ragStartedAt
    console.info("[CHAT] Python response status=%d", ragResponse.status)
    console.info("[CHAT] elapsed=%d", ragElapsedMs)
    if (ragResponse.status === 429) {
      console.warn("[CHAT] Python response status=429 retry_after=%s", ragData.retry_after)
      return res.status(429).json({
        success: false,
        error: ragData.error || "AI service is temporarily rate limited. Please try again shortly.",
        error_type: ragData.error_type || "rate_limit_exceeded",
        retry_after: ragData.retry_after
      })
    }
    if (!ragResponse.ok || !ragData.success || !ragData.answer) {
      return res.status(502).json({ success: false, message: ragData.detail || ragData.message || "RAG service failed" })
    }

    // Persist the pair only after Node has received Python's successful answer.
    // This is intentional: a timed-out upstream response must not create a
    // partial or duplicate chat message that could be retried automatically.
    const now = new Date()
    thread.messages.push({ role: "user", text: question, createdAt: now })
    thread.messages.push({ role: "ai", text: ragData.answer, createdAt: now })
    if (thread.messages.filter((message) => message.role === "user").length === 1) thread.title = createTitle(question)
    thread.updatedAt = now
    chat.activeThreadId = threadId
    await chat.save()

    res.json({ success: true, answer: ragData.answer, thread, activeThreadId: threadId })
  } catch (err) {
    const message = err.name === "TimeoutError" ? "RAG service timed out" : err.message
    res.status(502).json({ success: false, message })
  }
}

export const deleteChatByFile = async (req, res) => {
  try {
    if (!(await requireOwnedPdf(req, res))) return
    await Chat.findOneAndDelete({ userId: req.userId, fileId: req.params.fileId })
    res.json({ success: true, message: "Chat deleted successfully" })
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to delete chat" })
  }
}
