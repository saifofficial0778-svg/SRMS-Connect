const authRepository = require("./auth.repository");
const AppError = require('../../utils/AppError')
const bcrypt = require('bcryptjs')
const pool = require('../../config/db')
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const AuthService = {

    async register(registerData) {
        const {
            enrollment,
            dob,
            password,
            confirmPassword
        } = registerData;

        const student = await authRepository.findStudentByEnrollmentAndDob(enrollment, dob)
        let role;
        let alumni;
        if (student) {
            role = "STUDENT";
        } else {
            alumni = await authRepository.findAlumniByEnrollmentAndDob(enrollment, dob);

            if (alumni) {
                role = "ALUMNI";
            }
        }
        if (!student && !alumni) {
            throw new AppError("Invalid enrollment or date of birth", 400);
        }

        const fullName = student?.full_name || alumni?.full_name;

        const user = await authRepository.findUserByEnrollment(enrollment)
        if (user) {
            throw new AppError("User already registered", 409)
        }

        const passwordHash = await bcrypt.hash(password, 10)

        const userData = {
            enrollment,
            passwordHash,
            role,
            status: "ACTIVE"
        };
        

        const connection=await pool.getConnection()
        let userId
        let profile
        try{
            await connection.beginTransaction();
             userId=await authRepository.createUser(connection,userData)


             profile=await authRepository.createProfile(connection,{userId,fullName})

            await connection.commit()
        }catch(error){
            await connection.rollback()
            throw error
        }finally{
            connection.release()
        }
        return{
            userId,
            profile
        }

    },
    async login(enrollment, password, sessionInfo) {
        const userForLogin = await authRepository.findUserForLogin(enrollment)
        if (!userForLogin) {
            throw new AppError("Invalid credentials", 401)
        }

        if (userForLogin.status !== "ACTIVE") {
            throw new AppError("User is Inactive", 400)
        }

        const isPasswordValid = await bcrypt.compare(
            password,
            userForLogin.password_hash
        );

        if (!isPasswordValid) {
            throw new AppError("Invalid credentials", 401);
        }

        const token = jwt.sign(
            { userId: userForLogin.id ,
                role: userForLogin.role
            },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN }
        )
        const tokenHash = crypto
            .createHash("sha256")
            .update(token)
            .digest("hex");

        const { deviceInfo, ipAddress } = sessionInfo;

        const expiresAt = new Date(
            Date.now() + 15 * 60 * 1000
        );

        const sessionData = {
            userId: userForLogin.id,
            tokenHash,
            deviceInfo,
            ipAddress,
            expiresAt
        };

        const connection = await pool.getConnection()
        try {
            await connection.beginTransaction()
            await authRepository.createSession(connection, sessionData)
            await authRepository.updateLastLogin(connection, userForLogin.id)

            await connection.commit()
        } catch (error) {
            await connection.rollback()
            throw error
        } finally {
            connection.release()
        }
        return {
            userId: userForLogin.id,
            token
        };
    },
    async logout(userId, token) {
        const tokenHash = crypto
            .createHash("sha256")
            .update(token)
            .digest("hex");

        const result = await authRepository.revokeSession(
            userId,
            tokenHash
        );

        if (!result) {
            throw new AppError("Session already logged out", 400);
        }

        return true;
    },

    async forgotPassword(enrollment) {
        const userForLogin = await authRepository.findUserForLogin(enrollment)
        if (!userForLogin) {
            return
        }

        if (userForLogin.status !== "ACTIVE") {
            throw new AppError("User is Inactive", 400)
        }

        const resetToken = crypto.randomBytes(32).toString("hex");

        const tokenHash = crypto
            .createHash("sha256")
            .update(resetToken)
            .digest("hex");

        const expiresAt = new Date(
            Date.now() + 15 * 60 * 1000
        );

        await authRepository.createPasswordReset(
            userForLogin.id,
            tokenHash,
            expiresAt
        );

        return resetToken
    },

    async resetPassword(resetToken, newPassword) {

        const tokenHash = crypto
            .createHash("sha256")
            .update(resetToken)
            .digest("hex")

        const isToken = await authRepository.findResetToken(tokenHash)
        if (!isToken) {
            throw new AppError("Invalid reset token", 400);
        }
        if (isToken.used_at) {
            throw new AppError("Reset token already used", 400);
        }
        if (isToken.expires_at < new Date()) {
            throw new AppError("Token is expired", 400);
        }

        const passwordHash = await bcrypt.hash(newPassword, 10)

        const connection = await pool.getConnection()
        try {
            await connection.beginTransaction()

            await authRepository.updateUserPassword(connection, isToken.user_id, passwordHash)

            await authRepository.markResetTokenUsed(connection, isToken.id)

            await connection.commit()
        } catch (error) {
            await connection.rollback()
            throw error
        } finally {
            connection.release()
        }
        return true;

    },
};

module.exports = AuthService;