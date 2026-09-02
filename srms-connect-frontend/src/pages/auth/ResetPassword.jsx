import { useState } from "react";
import { resetPassword } from "../../services/authService";
import { useLocation, useNavigate } from "react-router-dom";

const ResetPassword = () => {
    const [newPassword, setNewPassword] = useState("");
    const location = useLocation();
    const navigate = useNavigate();

    const resetToken = location.state?.resetToken || "";

    const handleSubmit = async (e) => {
        e.preventDefault();

        try {
            const data = await resetPassword({
                resetToken,
                newPassword,
            });

            console.log("Reset Password Success:", data);

            navigate("/login");
        } catch (error) {
            console.log(
                "Reset Password Error:",
                error.response?.data || error.message
            );
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">

                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-900">
                        Reset Password
                    </h1>

                    <p className="text-gray-500 mt-2">
                        Enter your reset token and new password.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Reset Token
                        </label>

                        <input
                            type="text"
                            value={resetToken}
                            readOnly
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg
                             bg-gray-100 text-gray-600 focus:outline-none"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            New Password
                        </label>

                        <input
                            type="password"
                            placeholder="Enter new password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    <button
                        type="submit"
                        className="w-full bg-blue-600 text-white py-3 rounded-lg
                       font-semibold hover:bg-blue-700 transition"
                    >
                        Reset Password
                    </button>

                </form>

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

export default ResetPassword;