const ChatRoom = require("../models/ChatRoom");
const Concern = require("../models/Concern");
const Message = require("../models/Message");
const { getIO } = require("../config/socket");

const mapFileType = (mimeType = "") => {
    if (mimeType.startsWith("image/")) return "image";
    if (mimeType.startsWith("audio/")) return "audio";
    if (mimeType === "application/pdf") return "pdf";
    if (mimeType === "text/csv") return "csv";
    return "other";
};

const userHasAccess = (room, userId) => {
    return (
        room.requester.toString() === userId.toString() ||
        room.responder.toString() === userId.toString()
    );
};

const getMyContacts = async (req, res) => {
    try {
        const rooms = await ChatRoom.find({
            $or: [{ requester: req.user._id }, { responder: req.user._id }]
        })
            .populate("requester", "name email avatar")
            .populate("responder", "name email avatar")
            .populate("concern", "title description status")
            .sort({ updatedAt: -1 });

        return res.json(rooms);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

const getChatMessages = async (req, res) => {
    try {
        const room = await ChatRoom.findById(req.params.roomId);

        if (!room) {
            return res.status(404).json({ message: "Room not found" });
        }

        if (!userHasAccess(room, req.user._id)) {
            return res.status(403).json({ message: "Access denied" });
        }

        const messages = await Message.find({ room: room._id })
            .populate("sender", "name email avatar")
            .sort({ createdAt: 1 });

        return res.json({
            room,
            messages,
            readOnly: room.status === "complete"
        });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

const sendMessage = async (req, res) => {
    try {
        const { text } = req.body;
        const room = await ChatRoom.findById(req.params.roomId);

        if (!room) {
            return res.status(404).json({ message: "Room not found" });
        }

        if (!userHasAccess(room, req.user._id)) {
            return res.status(403).json({ message: "Access denied" });
        }

        if (room.status === "complete") {
            return res.status(400).json({ message: "Chat is closed. Read-only mode." });
        }

        const attachments =
            req.files?.map((file) => ({
                fileName: file.originalname,
                fileUrl: `/uploads/${file.filename}`,
                fileType: mapFileType(file.mimetype),
                mimeType: file.mimetype,
                size: file.size
            })) || [];

        if ((!text || !text.trim()) && attachments.length === 0) {
            return res.status(400).json({ message: "Message text or file is required" });
        }

        const message = await Message.create({
            room: room._id,
            sender: req.user._id,
            text: text || "",
            attachments,
            readBy: [req.user._id]
        });

        const populatedMessage = await Message.findById(message._id).populate(
            "sender",
            "name email avatar"
        );

        room.updatedAt = new Date();
        await room.save();

        const io = getIO();
        io.to(room._id.toString()).emit("newMessage", populatedMessage);

        return res.status(201).json(populatedMessage);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

const updateChatStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const room = await ChatRoom.findById(req.params.roomId);

        if (!room) {
            return res.status(404).json({ message: "Room not found" });
        }

        if (room.responder.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: "Only responder can change status" });
        }

        if (!["pending", "complete"].includes(status)) {
            return res.status(400).json({ message: "Invalid status" });
        }

        room.status = status;
        if (status === "complete") {
            room.closedBy = req.user._id;
        } else {
            room.closedBy = null;
        }

        await room.save();

        await Concern.findByIdAndUpdate(room.concern, {
            status: status === "complete" ? "complete" : "accepted",
            completedAt: status === "complete" ? new Date() : null
        });

        const updatedRoom = await ChatRoom.findById(room._id)
            .populate("requester", "name email avatar")
            .populate("responder", "name email avatar")
            .populate("concern", "title description status");

        const io = getIO();
        io.to(room._id.toString()).emit("chatStatusUpdated", updatedRoom);

        return res.json(updatedRoom);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getMyContacts,
    getChatMessages,
    sendMessage,
    updateChatStatus
};