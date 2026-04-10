const Post = require("../models/Post");
const Comment = require("../models/Comment");

// Create a new post
exports.createPost = async (req, res) => {
    try {
        const { title, content, type, subject } = req.body;

        if (!title || !title.trim()) {
            return res.status(400).json({ success: false, message: "Title is required" });
        }

        const postData = {
            title: title.trim(),
            content: content ? content.trim() : "",
            type: type || "question",
            subject: subject ? subject.trim() : "",
            user: req.user._id,
        };

        if (req.file) {
            postData.fileURL = `/uploads/${req.file.filename}`;
        }

        const post = await Post.create(postData);
        const populated = await Post.findById(post._id)
            .populate("user", "fullName profilePicture");

        res.status(201).json({ success: true, post: populated });
    } catch (error) {
        console.error("Error creating post:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get all posts
exports.getAllPosts = async (req, res) => {
    try {
        const { search, type, subject } = req.query;
        const filter = {};

        if (search) {
            filter.$or = [
                { title: { $regex: search, $options: "i" } },
                { content: { $regex: search, $options: "i" } },
                { subject: { $regex: search, $options: "i" } },
            ];
        }

        if (type && type !== "all") {
            filter.type = type.toLowerCase();
        }

        if (subject) {
            filter.subject = { $regex: subject, $options: "i" };
        }

        const posts = await Post.find(filter)
            .populate("user", "fullName profilePicture")
            .sort({ createdAt: -1 })
            .lean();

        // Mark own posts
        if (req.user) {
            posts.forEach((p) => {
                p.isOwn = p.user._id.toString() === req.user._id.toString();
            });
        }

        res.status(200).json({ success: true, posts });
    } catch (error) {
        console.error("Error fetching posts:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get single post
exports.getPostById = async (req, res) => {
    try {
        const post = await Post.findById(req.params.id)
            .populate("user", "fullName profilePicture")
            .lean();

        if (!post) {
            return res.status(404).json({ success: false, message: "Post not found" });
        }

        if (req.user) {
            post.isOwn = post.user._id.toString() === req.user._id.toString();
        }

        res.status(200).json({ success: true, post });
    } catch (error) {
        console.error("Error fetching post:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Update post
exports.updatePost = async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);

        if (!post) {
            return res.status(404).json({ success: false, message: "Post not found" });
        }

        if (post.user.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: "Not authorized" });
        }

        const { title, content, subject } = req.body;

        if (title) post.title = title.trim();
        if (content !== undefined) post.content = content.trim();
        if (subject !== undefined) post.subject = subject.trim();

        if (req.file) {
            post.fileURL = `/uploads/${req.file.filename}`;
        }

        await post.save();

        const populated = await Post.findById(post._id)
            .populate("user", "fullName profilePicture");

        res.status(200).json({ success: true, post: populated });
    } catch (error) {
        console.error("Error updating post:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Delete post
exports.deletePost = async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);

        if (!post) {
            return res.status(404).json({ success: false, message: "Post not found" });
        }

        if (post.user.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: "Not authorized" });
        }

        await Comment.deleteMany({ postId: post._id });
        await Post.findByIdAndDelete(post._id);

        res.status(200).json({ success: true, message: "Post deleted" });
    } catch (error) {
        console.error("Error deleting post:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Add comment
exports.addComment = async (req, res) => {
    try {
        const { content, parentComment } = req.body;

        if (!content || !content.trim()) {
            return res.status(400).json({ success: false, message: "Comment content is required" });
        }

        const post = await Post.findById(req.params.id);
        if (!post) {
            return res.status(404).json({ success: false, message: "Post not found" });
        }

        const commentData = {
            postId: post._id,
            userId: req.user._id,
            content: content.trim(),
        };

        if (parentComment) {
            commentData.parentComment = parentComment;
        }

        if (req.file) {
            commentData.fileURL = `/uploads/${req.file.filename}`;
        }

        const comment = await Comment.create(commentData);

        post.commentCount = (post.commentCount || 0) + 1;
        await post.save();

        const populated = await Comment.findById(comment._id)
            .populate("userId", "fullName profilePicture");

        res.status(201).json({ success: true, comment: populated });
    } catch (error) {
        console.error("Error adding comment:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get comments
exports.getComments = async (req, res) => {
    try {
        const comments = await Comment.find({ postId: req.params.id })
            .populate("userId", "fullName profilePicture")
            .sort({ createdAt: -1 })
            .lean();

        if (req.user) {
            comments.forEach((c) => {
                c.isOwn = c.userId._id.toString() === req.user._id.toString();
            });
        }

        res.status(200).json({ success: true, comments });
    } catch (error) {
        console.error("Error fetching comments:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Delete comment
exports.deleteComment = async (req, res) => {
    try {
        const comment = await Comment.findById(req.params.commentId);

        if (!comment) {
            return res.status(404).json({ success: false, message: "Comment not found" });
        }

        if (comment.userId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: "Not authorized" });
        }

        await Comment.findByIdAndDelete(comment._id);

        await Post.findByIdAndUpdate(comment.postId, {
            $inc: { commentCount: -1 },
        });

        res.status(200).json({ success: true, message: "Comment deleted" });
    } catch (error) {
        console.error("Error deleting comment:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};