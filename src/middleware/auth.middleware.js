const admin = require("../config/firebase");

async function authenticate(req, res, next) {
    try {

        const authHeader = req.headers.authorization;

        if (!authHeader) {
            return res.status(401).json({
                success: false,
                message: "Authorization header missing"
            });
        }

        const token = authHeader.split(" ")[1];

        const decoded =
            await admin.auth().verifyIdToken(token);

        req.user = decoded;

        next();

    } catch (error) {

        return res.status(401).json({
            success: false,
            message: "Invalid token"
        });

    }
}

module.exports = authenticate;