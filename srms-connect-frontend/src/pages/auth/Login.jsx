import React from "react";
import { useState } from "react";
import { loginUser } from "../../services/authService"; // Adjust the import path as needed

const Login = () => {
  const [enrollment, setEnrollment] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();

    try {
      const data = await loginUser({
        enrollment,
        password,
      });

      console.log("Login Success:", data);
    } catch (error) {
      console.log("Login Error:", error.response?.data || error.message);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            SRMS Connect
          </h1>

          <p className="text-gray-500 mt-2">
            Connect with your college community
          </p>
        </div>

        {/* Login Form */}
        <form className="space-y-5" onSubmit={handleLogin}>

          {/* Enrollment */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Enrollment Number
            </label>

            <input
              type="text"
              placeholder="Enter your enrollment number"
              value={enrollment}
              onChange={(e) => setEnrollment(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg 
                         focus:outline-none focus:ring-2 focus:ring-blue-500 
                         focus:border-transparent"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>

            <input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg 
                         focus:outline-none focus:ring-2 focus:ring-blue-500 
                         focus:border-transparent"
            />
          </div>

          {/* Login Button */}
          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-3 rounded-lg 
                       font-semibold hover:bg-blue-700 transition"
          >
            Login
          </button>
        </form>

        {/* Links */}
        <div className="flex justify-between mt-6 text-sm">
          <a
            href="/forgot-password"
            className="text-blue-600 hover:underline"
          >
            Forgot Password?
          </a>

          <a
            href="/register"
            className="text-blue-600 hover:underline"
          >
            Create Account
          </a>
        </div>

      </div>
    </div>
  );
};

export default Login;