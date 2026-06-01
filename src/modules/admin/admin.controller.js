const adminService =
require("./admin.service");

async function getPendingUsers(
    req,
    res
) {

    try {

        const users =
            await adminService.getPendingUsers();

        return res.status(200).json({
            success: true,
            data: users
        });

    }
    catch(error) {

        return res.status(500).json({
            success: false,
            message: error.message
        });

    }

}

async function getAllUsers(req, res) {

    try {

        const users =
            await adminService.getAllUsers();

        return res.status(200).json({
            success: true,
            data: users
        });

    }
    catch(error) {

        return res.status(500).json({
            success: false,
            message: error.message
        });

    }

}

async function approveUser(req, res) {

    try {

        const user =
            await adminService.approveUser(
                req.params.id
            );

        return res.status(200).json({
            success: true,
            data: user
        });

    }
    catch(error) {

        return res.status(500).json({
            success: false,
            message: error.message
        });

    }

}

async function blockUser(req, res) {

    try {

        const user =
            await adminService.blockUser(
                req.params.id
            );

        return res.status(200).json({
            success: true,
            data: user
        });

    }
    catch(error) {

        return res.status(500).json({
            success: false,
            message: error.message
        });

    }

}

async function unblockUser(req, res) {

    try {

        const user =
            await adminService.unblockUser(
                req.params.id
            );

        return res.status(200).json({
            success: true,
            data: user
        });

    }
    catch(error) {

        return res.status(500).json({
            success: false,
            message: error.message
        });

    }

}

module.exports = {
    getPendingUsers,
    getAllUsers,
    approveUser,
    blockUser,
    unblockUser
};