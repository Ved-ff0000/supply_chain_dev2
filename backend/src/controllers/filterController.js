const savedFilterService = require("../services/savedFilterService");


// ======================================================
// LIST FILTERS
// ======================================================
//
// GET /api/filters
//
// ======================================================

const getFilters = async (req, res) => {
    try {
        const filters = await savedFilterService.listFilters(req.user.id);

        return res.status(200).json({
            success: true,
            count: filters.length,
            data: filters
        });
    } catch (error) {
        console.error("Error listing saved filters:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to load saved filters",
            error: error.message
        });
    }
};


// ======================================================
// GET ONE FILTER
// ======================================================
//
// GET /api/filters/:id
//
// ======================================================

const getFilterById = async (req, res) => {
    try {
        const filter = await savedFilterService.getFilter({
            id: req.params.id,
            userId: req.user.id
        });

        if (!filter) {
            return res.status(404).json({
                success: false,
                message: "Saved filter not found"
            });
        }

        return res.status(200).json({
            success: true,
            data: filter
        });
    } catch (error) {
        console.error("Error fetching saved filter:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to load saved filter",
            error: error.message
        });
    }
};


// ======================================================
// CREATE FILTER
// ======================================================
//
// POST /api/filters
//
// Body: { "name": "Urgent delays", "filter": { ... }, "is_default": false }
//
// ======================================================

const createFilter = async (req, res) => {
    try {
        const { name, filter, is_default } = req.body || {};

        const created = await savedFilterService.createFilter({
            userId: req.user.id,
            name,
            filter: filter || {},
            isDefault: is_default === true
        });

        return res.status(201).json({
            success: true,
            message: "Filter saved",
            data: created
        });
    } catch (error) {
        console.error("Error creating saved filter:", error);

        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || "Failed to save filter"
        });
    }
};


// ======================================================
// UPDATE FILTER
// ======================================================
//
// PATCH /api/filters/:id
//
// ======================================================

const updateFilter = async (req, res) => {
    try {
        const { name, filter, is_default } = req.body || {};

        const updated = await savedFilterService.updateFilter({
            id: req.params.id,
            userId: req.user.id,
            name,
            filter,
            isDefault: is_default
        });

        if (!updated) {
            return res.status(404).json({
                success: false,
                message: "Saved filter not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Filter updated",
            data: updated
        });
    } catch (error) {
        console.error("Error updating saved filter:", error);

        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || "Failed to update filter"
        });
    }
};


// ======================================================
// DELETE FILTER
// ======================================================
//
// DELETE /api/filters/:id
//
// ======================================================

const deleteFilter = async (req, res) => {
    try {
        const deleted = await savedFilterService.deleteFilter({
            id: req.params.id,
            userId: req.user.id
        });

        if (!deleted) {
            return res.status(404).json({
                success: false,
                message: "Saved filter not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Filter deleted",
            data: deleted
        });
    } catch (error) {
        console.error("Error deleting saved filter:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to delete filter",
            error: error.message
        });
    }
};


module.exports = {
    getFilters,
    getFilterById,
    createFilter,
    updateFilter,
    deleteFilter
};
