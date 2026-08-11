const authRepository = require("./auth.repository");
const AppError = require('../../utils/AppError')
const bcrypt = require('bcryptjs')

const AuthService = {

    async register(registerData) {
        const {
            enrollment,
            dob,
            password,
            confirmPassword
        } = registerData;

        const student = await authRepository.findStudentByEnrollmentAndDob(enrollment, dob)

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

        const userId = await authRepository.createUser(userData);
        return userId

    },

};

module.exports = AuthService;