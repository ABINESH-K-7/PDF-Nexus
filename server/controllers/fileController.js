import { FileTree } from "../models/fileTreeModel.js";

/**
 * GET user's file tree
 */
export const getFileTree = async (req, res) => {
  try {
    const userId = req.userId;

    let data = await FileTree.findOne({ userId });

    // First login → create empty tree
    if (!data) {
      data = await FileTree.create({
        userId,
        tree: [
          {
            id: "root",
            type: "folder",
            name: "root",
            expanded: true,
            children: []
          }
        ]
      });
    }

    res.json({
      success: true,
      tree: data.tree
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * SAVE user's file tree
 */
export const saveFileTree = async (req, res) => {
  try {
    console.log("SAVE FILE TREE HIT");
    console.log("USER ID:", req.userId);
    console.log("TREE RECEIVED:", JSON.stringify(req.body.tree, null, 2));

    const userId = req.userId;
    const { tree } = req.body;

    if (!tree) {
      return res.status(400).json({
        success: false,
        message: "Tree missing in request body"
      });
    }

    await FileTree.findOneAndUpdate(
      { userId },
      { tree },
      { upsert: true, new: true }
    );

    res.json({ success: true });
  } catch (err) {
    console.error("SAVE TREE ERROR:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

