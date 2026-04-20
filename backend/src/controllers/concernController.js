const Concern = require("../models/Concern");
const ChatRoom = require("../models/ChatRoom");

const createConcern = async (req, res) => {
    try {
        const { title, description, category } = req.body;

        const concern = await Concern.create({
            requester: req.user._id,
            title,
            description,
            category
        });

        return res.status(201).json(concern);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

const getDashboardConcerns = async (req, res) => {
    try {
        const concerns = await Concern.find()
            .populate("requester", "name email avatar")
            .populate("acceptedBy", "name email avatar")
            .sort({ createdAt: -1 });

        return res.json(concerns);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

const acceptConcern = async (req, res) => {
    try {
        const concern = await Concern.findById(req.params.id);

        if (!concern) {
            return res.status(404).json({ message: "Concern not found" });
        }

        if (concern.status !== "open") {
            return res.status(400).json({ message: "Concern already accepted or completed" });
        }

        concern.acceptedBy = req.user._id;
        concern.status = "accepted";
        concern.acceptedAt = new Date();
        await concern.save();

        const room = await ChatRoom.create({
            concern: concern._id,
            requester: concern.requester,
            responder: req.user._id,
            status: "pending"
        });

        const populatedConcern = await Concern.findById(concern._id)
            .populate("requester", "name email avatar")
            .populate("acceptedBy", "name email avatar");

        return res.json({
            message: "Concern accepted successfully",
            concern: populatedConcern,
            room
        });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

module.exports = {
    createConcern,
    getDashboardConcerns,
    acceptConcern
};