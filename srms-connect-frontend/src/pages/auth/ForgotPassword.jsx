import { useState } from "react";
import { forgotPassword } from "../../services/authService";
import { useNavigate } from "react-router-dom";

const ForgotPassword = () => {
    const [enrollment, setEnrollment] = useState("");
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();

        try {
            const data = await forgotPassword({
                enrollment,
            });
            navigate("/reset-password", {
                state: {
                    resetToken: data.data,
                },
            });

            console.log("Forgot Password Success:", data);
        } catch (error) {
            console.log(
                "Forgot Password Error:",
                error.response?.data || error.message
            );
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">

                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-900">
                        Forgot Password?
                    </h1>

                    <p className="text-gray-500 mt-2">
                        Enter your enrollment number to reset your password.
                    </p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-5">

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Enrollment Number
                        </label>

                        <input
                            type="text"
                            placeholder="Enter enrollment number"
                            value={enrollment}
                            onChange={(e) => setEnrollment(e.target.value)}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    <button
                        type="submit"
                        className="w-full bg-blue-600 text-white py-3 rounded-lg
                       font-semibold hover:bg-blue-700 transition"
                    >
                        Send Reset Link
                    </button>

                </form>

                {/* Back to Login */}
                <p className="text-center text-sm text-gray-500 mt-6">
                    Remember your password?{" "}
                    <a
                        href="/login"
                        className="text-blue-600 hover:underline font-medium"
                    >
                        Back to Login
                    </a>
                </p>

            </div>
        </div>
    );
};

export default ForgotPassword;