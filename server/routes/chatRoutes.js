// routes/chatRoutes.js
import express from "express"
import { isAuthenticated } from "../middleware/isAuthenticated.js"
import {
  createThread,
  deleteChatByFile,
  getChatByFile,
  setActiveThread,
  sendMessage
} from "../controllers/chatController.js"

const router = express.Router()

router.get("/:fileId", isAuthenticated, getChatByFile)
router.post("/:fileId/thread", isAuthenticated, createThread)
router.post("/:fileId/:threadId/activate", isAuthenticated, setActiveThread)
router.post("/:fileId/:threadId/message", isAuthenticated, sendMessage)
router.delete("/:fileId", isAuthenticated, deleteChatByFile)


export default router
