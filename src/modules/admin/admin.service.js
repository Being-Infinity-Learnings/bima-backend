const prisma =
require("../../config/prisma");

async function getPendingUsers() {

    return await prisma.user.findMany({

        where: {
            approved: false,
            blocked: false
        },

        orderBy: {
            createdAt: "asc"
        }

    });

}

module.exports = {
    getPendingUsers
};