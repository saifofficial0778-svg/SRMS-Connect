const authRepository = require("./auth.repository");
const AppError = require('../../utils/AppError')
const bcrypt = require('bcryptjs')
const pool = require('../../config/db')
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { generateOtp, hashOtp, compareOtp } = require('../../utils/otp.util');
const { sendOtpEmail } = require('../../utils/email.service');

const MAX_OTP_ATTEMPTS = 5;
const OTP_EXPIRY_MINUTES = 5;
const MAX_FAILED_LOGINS = Number(process.env.LOGIN_MAX_ATTEMPTS) || 5;
const LOGIN_LOCK_MINUTES = Number(process.env.LOGIN_LOCK_MINUTES) || 15;
const FALLBACK_SESSION_MINUTES = 15;

const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

// The session row must expire exactly when the JWT does, otherwise the DB check and the
// JWT_EXPIRES_IN setting would disagree about how long a login lasts.
function sessionExpiryFromToken(token) {
    const decoded = jwt.decode(token);
    return decoded?.exp
        ? new Date(decoded.exp * 1000)
        : new Date(Date.now() + FALLBACK_SESSION_MINUTES * 60 * 1000);
}

const AuthService = {

    // Single source of truth for "is this bearer token still valid right now?".
    // Used by the HTTP auth middleware and the Socket.IO handshake.
    async authenticateToken(token) {
        const invalid = () => new AppError("Session expired or invalid. Please log in again.", 401);

        let payload;
        try {
            payload = jwt.verify(token, process.env.JWT_SECRET);
        } catch (err) {
            throw invalid();
        }

        const session = await authRepository.findActiveSession(payload.userId, hashToken(token));
        if (!session) {
            throw invalid();
        }
        if (session.status !== "ACTIVE") {
            // 401 (not 403): the session is no longer usable, so clients should drop it and sign in again
            throw new AppError("Your account is not active. Contact admin", 401);
        }

        // role comes from the DB, not the token, so role changes apply immediately
        return { userId: session.user_id, role: session.role };
    },

    async register(registerData) {
        const { enrollment, dob, password, confirmPassword } = registerData;

        const student = await authRepository.findStudentByEnrollmentAndDob(enrollment, dob);
        let role, alumni;

        if (student) {
            role = "STUDENT";
        } else {
            alumni = await authRepository.findAlumniByEnrollmentAndDob(enrollment, dob);
            if (alumni) role = "ALUMNI";
        }

        if (!student && !alumni) {
            throw new AppError("Invalid enrollment or date of birth", 400);
        }

        const fullName = student?.full_name || alumni?.full_name;
        const collegeEmail = student?.college_email || alumni?.college_email;

        const existingUser = await authRepository.findUserByEnrollment(enrollment);
        if (existingUser) {
            throw new AppError("User already registered", 409);
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const userData = {
            enrollment,
            email: collegeEmail,
            passwordHash,
            role,
            status: "PENDING"
        };

        const connection = await pool.getConnection();
        let userId, profile;
        try {
            await connection.beginTransaction();
            userId = await authRepository.createUser(connection, userData);
            // branch + batch come from the institution's master record (admission year for
            // students, passout year for alumni) so directory filters work from day one
            const master = student || alumni;
            profile = await authRepository.createProfile(connection, {
                userId,
                fullName,
                branch: master.branch ?? null,
                batchYear: (student ? master.admission_year : master.passout_year) ?? null
            });
            await connection.commit();
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }

        // Ab OTP generate aur bhejo
        const otp = generateOtp();
        const otpHash = await hashOtp(otp);
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

        const otpConnection = await pool.getConnection();
        try {
            await otpConnection.beginTransaction();
            await authRepository.invalidatePreviousOtps(otpConnection, userId, "REGISTER");
            await authRepository.createOtp(otpConnection, {
                userId,
                otpHash,
                purpose: "REGISTER",
                expiresAt
            });
            await otpConnection.commit();
        } catch (error) {
            await otpConnection.rollback();
            throw error;
        } finally {
            otpConnection.release();
        }

        await sendOtpEmail(collegeEmail, otp);

        const maskedEmail = collegeEmail.replace(/(.{2}).+(@.+)/, "$1***$2");

        return { userId, email: maskedEmail, message: "OTP sent to your registered email" };
    },

    async verifyRegisterOtp(enrollment, otp) {
        const user = await authRepository.findUserByEnrollment(enrollment);
        if (!user) {
            throw new AppError("User not found", 404);
        }

        if (user.email_verified) {
            throw new AppError("Email already verified", 400);
        }

        const otpRecord = await authRepository.findLatestValidOtp(user.id, "REGISTER");
        if (!otpRecord) {
            throw new AppError("OTP expired or not found. Please request a new one", 400);
        }
        if (otpRecord.attempts >= 5) {
            throw new AppError("Too many attempts. Please request a new OTP", 429);
        }

        const isValid = await compareOtp(otp, otpRecord.otp_hash);
        if (!isValid) {
            await authRepository.incrementOtpAttempts(otpRecord.id);
            throw new AppError("Invalid OTP", 401);
        }

        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            await authRepository.markOtpUsed(connection, otpRecord.id);
            await authRepository.markEmailVerified(connection, user.id);
            await connection.commit();
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }

        return {
            message: "Email verified successfully. Your account is pending admin approval."
        };
    },

    async resendRegisterOtp(enrollment) {
        const user = await authRepository.findUserByEnrollment(enrollment);
        if (!user) {
            throw new AppError("User not found", 404);
        }
        if (user.email_verified) {
            throw new AppError("Email already verified", 400);
        }

        const otp = generateOtp();
        const otpHash = await hashOtp(otp);
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            await authRepository.invalidatePreviousOtps(connection, user.id, "REGISTER");
            await authRepository.createOtp(connection, {
                userId: user.id,
                otpHash,
                purpose: "REGISTER",
                expiresAt
            });
            await connection.commit();
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }

        await sendOtpEmail(user.email, otp);
        return { message: "OTP resent to your registered email" };
    },
    async login(enrollment, password, sessionInfo) {
        const userForLogin = await authRepository.findUserForLogin(enrollment)
        if (!userForLogin) {
            throw new AppError("Invalid credentials", 401)
        }

        if (userForLogin.status === "PENDING") {
            throw new AppError("Your account is pending admin verification", 403)
        }
        if (userForLogin.status === "REJECTED") {
            throw new AppError(
                `Your registration was rejected: ${userForLogin.rejection_reason || "Contact admin for details"}`,
                403
            )
        }
        if (userForLogin.status === "BLOCKED") {
            throw new AppError("Your account has been blocked. Contact admin", 403)
        }
        if (userForLogin.status !== "ACTIVE") {
            throw new AppError("User is Inactive", 400)
        }

        if (userForLogin.is_locked) {
            throw new AppError(
                `Too many failed login attempts. Try again in ${userForLogin.lock_minutes} minute(s) or reset your password.`,
                429
            );
        }

        const isPasswordValid = await bcrypt.compare(
            password,
            userForLogin.password_hash
        );

        if (!isPasswordValid) {
            await authRepository.registerFailedLogin(userForLogin.id, MAX_FAILED_LOGINS, LOGIN_LOCK_MINUTES);
            throw new AppError("Invalid credentials", 401);
        }

        const token = jwt.sign(
            {
                userId: userForLogin.id,
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

        const expiresAt = sessionExpiryFromToken(token);

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
            role: userForLogin.role, 
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
        const user = await authRepository.findUserByEnrollmentForOtp(enrollment);
        if (!user) {
            // same response as success so enrollments can't be enumerated
            return { message: "OTP sent to registered email" };
        }

        if (user.status !== "ACTIVE") {
            throw new AppError("User is Inactive", 400)
        }

        const otp = generateOtp();
        const otpHash = await hashOtp(otp);
        const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            await authRepository.invalidatePreviousOtps(connection, user.id, "RESET_PASSWORD");
            await authRepository.createOtp(connection, {
                userId: user.id,
                otpHash,
                purpose: "RESET_PASSWORD",
                expiresAt
            });
            await connection.commit();
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }

        await sendOtpEmail(user.email, otp, "password reset");

        return { message: "OTP sent to registered email" };
    },

    // OTP verify hone par hi reset token milta hai; reset-password API wahi purani rahegi
    async verifyForgotPasswordOtp(enrollment, otp) {
        const user = await authRepository.findUserByEnrollmentForOtp(enrollment);
        if (!user || user.status !== "ACTIVE") {
            throw new AppError("Invalid OTP", 401);
        }

        const otpRecord = await authRepository.findLatestValidOtp(user.id, "RESET_PASSWORD");
        if (!otpRecord) {
            throw new AppError("OTP expired or not found. Please request a new one", 400);
        }
        if (otpRecord.attempts >= MAX_OTP_ATTEMPTS) {
            throw new AppError("Too many attempts. Please request a new OTP", 429);
        }

        const isValid = await compareOtp(otp, otpRecord.otp_hash);
        if (!isValid) {
            await authRepository.incrementOtpAttempts(otpRecord.id);
            throw new AppError("Invalid OTP", 401);
        }

        const resetToken = crypto.randomBytes(32).toString("hex");
        const tokenHash = crypto.createHash("sha256").update(resetToken).digest("hex");
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            await authRepository.markOtpUsed(connection, otpRecord.id);
            await connection.commit();
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }

        await authRepository.createPasswordReset(user.id, tokenHash, expiresAt);

        return { resetToken };
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

            // a password reset must log out every existing session
            await authRepository.revokeAllSessions(connection, isToken.user_id)

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

    async requestOtp(enrollment) {
        const user = await authRepository.findUserByEnrollmentForOtp(enrollment);

        if (!user) {
            throw new AppError("Invalid enrollment", 404);
        }

        if (user.status === "PENDING") {
            throw new AppError("Your account is pending admin verification", 403);
        }
        if (user.status === "REJECTED") {
            throw new AppError("Your registration was rejected", 403);
        }
        if (user.status === "BLOCKED") {
            throw new AppError("Your account has been blocked", 403);
        }
        if (user.status !== "ACTIVE") {
            throw new AppError("User is inactive", 400);
        }

        const otp = generateOtp();
        const otpHash = await hashOtp(otp);
        const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            await authRepository.invalidatePreviousOtps(connection, user.id, "LOGIN");
            await authRepository.createOtp(connection, {
                userId: user.id,
                otpHash,
                purpose: "LOGIN",
                expiresAt
            });
            await connection.commit();
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }

        await sendOtpEmail(user.email, otp);

        return { message: "OTP sent to registered email" };
    },

    async verifyOtp(enrollment, otp, sessionInfo) {
        const user = await authRepository.findUserByEnrollmentForOtp(enrollment);

        if (!user) {
            throw new AppError("Invalid enrollment", 404);
        }

        const otpRecord = await authRepository.findLatestValidOtp(user.id, "LOGIN");

        if (!otpRecord) {
            throw new AppError("OTP expired or not found. Please request a new one", 400);
        }

        if (otpRecord.attempts >= MAX_OTP_ATTEMPTS) {
            throw new AppError("Too many attempts. Please request a new OTP", 429);
        }

        const isValid = await compareOtp(otp, otpRecord.otp_hash);

        if (!isValid) {
            await authRepository.incrementOtpAttempts(otpRecord.id);
            throw new AppError("Invalid OTP", 401);
        }

        // OTP valid -> mark used, create session (login jaisa hi)
        const token = jwt.sign(
            { userId: user.id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN }
        );
        const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

        const { deviceInfo, ipAddress } = sessionInfo;
        const expiresAt = sessionExpiryFromToken(token);

        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            await authRepository.markOtpUsed(connection, otpRecord.id);
            await authRepository.createSession(connection, {
                userId: user.id,
                tokenHash,
                deviceInfo,
                ipAddress,
                expiresAt
            });
            await authRepository.updateLastLogin(connection, user.id);
            await connection.commit();
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }

        return { userId: user.id, role: user.role,token };
    }
};

module.exports = AuthService;