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

module.exports = {
    getPendingUsers
};