const {
 registerProfileSchema
}
=
require("./auth.validation");

const authService =
require("./auth.service");

async function registerProfile(req, res) {

    try {

        const validated =
            registerProfileSchema.parse(req.body);

        const firebaseUser =
            req.user;

        const user =
            await authService.createUserProfile({

                firebaseUid:
                    firebaseUser.uid,

                email:
                    firebaseUser.email,

                phone:
                    firebaseUser.phone_number,

                fullName:
                    validated.fullName,

                gender:
                    validated.gender,

                collegeName:
                    validated.collegeName,

                rollNumber:
                    validated.rollNumber

            });

        return res.status(201).json({
            success: true,
            data: user
        });

    } catch (error) {

        return res.status(400).json({
            success: false,
            error: error.message
        });

    }

}

async function me(req, res) {

    try {

        const firebaseUid =
            req.user.uid;

        const user =
            await authService.getUserByFirebaseUid(
                firebaseUid
            );

        if (!user) {

            return res.status(404).json({
                success: false,
                message: "Profile not found"
            });

        }

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
    registerProfile,
    me
};