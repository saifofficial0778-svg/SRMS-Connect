import { useNavigate } from "react-router-dom";



const Home = () => {
  const userId = localStorage.getItem("userId");
  const navigate = useNavigate();

  const handleLogout = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("userId");

  navigate("/login");
};

  return (
    <div className="min-h-screen bg-gray-100">

      {/* Navbar */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">

          <h1 className="text-2xl font-bold text-blue-600">
            SRMS Connect
          </h1>

          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              Welcome 👋
            </span>

            <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold">
              {userId}
            </div>
            <button
              onClick={handleLogout }
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
            >
              Logout
            </button>
          </div>

        </div>
      </nav>


      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 py-10">

        {/* Welcome Section */}
        <div className="bg-white rounded-2xl shadow-sm p-8 mb-8">
          <h2 className="text-3xl font-bold text-gray-900">
            Welcome to SRMS Connect 🎉
          </h2>

          <p className="text-gray-500 mt-2">
            Your college community, all in one place.
          </p>

          <p className="text-sm text-gray-400 mt-4">
            User ID: {userId}
          </p>
        </div>


        {/* Quick Actions */}
        <div>
          <h3 className="text-xl font-semibold text-gray-800 mb-4">
            Quick Access
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">

            <div className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition">
              <div className="text-3xl mb-3">👤</div>

              <h4 className="font-semibold text-gray-800">
                My Profile
              </h4>

              <p className="text-sm text-gray-500 mt-1">
                View and manage your profile.
              </p>
            </div>


            <div className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition">
              <div className="text-3xl mb-3">📝</div>

              <h4 className="font-semibold text-gray-800">
                Posts
              </h4>

              <p className="text-sm text-gray-500 mt-1">
                See what's happening in your college.
              </p>
            </div>


            <div className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition">
              <div className="text-3xl mb-3">👥</div>

              <h4 className="font-semibold text-gray-800">
                Students
              </h4>

              <p className="text-sm text-gray-500 mt-1">
                Discover people from your college.
              </p>
            </div>

          </div>
        </div>

      </main>

    </div>
  );
};

export default Home;