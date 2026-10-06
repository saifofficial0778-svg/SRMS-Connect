import { useState, useEffect, useCallback } from "react";
import { getUsers, updateUserStatus } from "../../services/adminService";
import useToast from "../../hooks/useToast";
import ToastStack from "../../components/ui/Toast";

const STATUS_COLORS = {
  ACTIVE: "bg-green-100 text-green-700",
  PENDING: "bg-yellow-100 text-yellow-700",
  BLOCKED: "bg-red-100 text-red-700",
  REJECTED: "bg-gray-200 text-gray-600",
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1 });
  const [filters, setFilters] = useState({ role: "", status: "", search: "" });
  const [loading, setLoading] = useState(false);

  const [rejectModal, setRejectModal] = useState(null); // user id for reject modal
  const [rejectReason, setRejectReason] = useState("");

  const { toasts, showToast, dismiss } = useToast();

  const fetchUsers = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = { page, limit: 10 };
      if (filters.role) params.role = filters.role;
      if (filters.status) params.status = filters.status;
      if (filters.search) params.search = filters.search;

      const data = await getUsers(params);
      setUsers(data.data.users);
      setPagination(data.data.pagination);
    } catch (error) {
      showToast(error.response?.data?.message || "Failed to load users", "error");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchUsers(1);
  }, [fetchUsers]);

  const handleApprove = async (id) => {
    try {
      await updateUserStatus(id, "ACTIVE");
      showToast("User approved successfully");
      fetchUsers(pagination.page);
    } catch (error) {
      showToast(error.response?.data?.message || "Failed to approve user", "error");
    }
  };

  const openRejectModal = (id) => {
    setRejectModal(id);
    setRejectReason("");
  };

  const confirmReject = async () => {
    if (!rejectReason.trim()) {
      showToast("Please enter a rejection reason", "error");
      return;
    }
    try {
      await updateUserStatus(rejectModal, "REJECTED", rejectReason.trim());
      showToast("User rejected");
      setRejectModal(null);
      fetchUsers(pagination.page);
    } catch (error) {
      showToast(error.response?.data?.message || "Failed to reject user", "error");
    }
  };

  const handleBlock = async (id) => {
    try {
      await updateUserStatus(id, "BLOCKED");
      showToast("User blocked");
      fetchUsers(pagination.page);
    } catch (error) {
      showToast(error.response?.data?.message || "Failed to block user", "error");
    }
  };

  const handleUnblock = async (id) => {
    try {
      await updateUserStatus(id, "ACTIVE");
      showToast("User unblocked");
      fetchUsers(pagination.page);
    } catch (error) {
      showToast(error.response?.data?.message || "Failed to unblock user", "error");
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-2xl font-serif font-bold text-[#1B2438] mb-6">
        User Management
      </h1>

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <select
          value={filters.status}
          onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
          className="border border-[#1B2438]/20 rounded-md px-3 py-2 text-sm"
        >
          <option value="">All Status</option>
          <option value="PENDING">Pending</option>
          <option value="ACTIVE">Active</option>
          <option value="BLOCKED">Blocked</option>
          <option value="REJECTED">Rejected</option>
        </select>

        <select
          value={filters.role}
          onChange={(e) => setFilters((f) => ({ ...f, role: e.target.value }))}
          className="border border-[#1B2438]/20 rounded-md px-3 py-2 text-sm"
        >
          <option value="">All Roles</option>
          <option value="STUDENT">Student</option>
          <option value="ALUMNI">Alumni</option>
        </select>

        <input
          type="text"
          placeholder="Search by enrollment..."
          value={filters.search}
          onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
          className="border border-[#1B2438]/20 rounded-md px-3 py-2 text-sm flex-1 min-w-[200px]"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#1B2438]/5 text-[#1B2438]/70">
            <tr>
              <th className="text-left px-4 py-3">Enrollment</th>
              <th className="text-left px-4 py-3">Email</th>
              <th className="text-left px-4 py-3">Role</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Registered</th>
              <th className="text-left px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-[#1B2438]/50">
                  Loading...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-[#1B2438]/50">
                  No users found
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id} className="border-t border-[#1B2438]/10">
                  <td className="px-4 py-3 font-medium">{u.enrollment}</td>
                  <td className="px-4 py-3 text-[#1B2438]/70">{u.email}</td>
                  <td className="px-4 py-3">{u.role}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[u.status]}`}>
                      {u.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#1B2438]/50">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      {u.status === "PENDING" && (
                        <>
                          <button
                            onClick={() => handleApprove(u.id)}
                            className="text-green-600 hover:text-green-800 text-xs font-medium"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => openRejectModal(u.id)}
                            className="text-red-600 hover:text-red-800 text-xs font-medium"
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {u.status === "ACTIVE" && (
                        <button
                          onClick={() => handleBlock(u.id)}
                          className="text-red-600 hover:text-red-800 text-xs font-medium"
                        >
                          Block
                        </button>
                      )}
                      {u.status === "BLOCKED" && (
                        <button
                          onClick={() => handleUnblock(u.id)}
                          className="text-green-600 hover:text-green-800 text-xs font-medium"
                        >
                          Unblock
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => fetchUsers(p)}
              className={`px-3 py-1 rounded-md text-sm ${
                p === pagination.page
                  ? "bg-[#C98A2B] text-white"
                  : "bg-white text-[#1B2438]/70 border border-[#1B2438]/10"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="font-serif text-lg font-bold text-[#1B2438] mb-3">
              Reject User
            </h3>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Enter rejection reason..."
              rows={3}
              className="w-full border border-[#1B2438]/20 rounded-md px-3 py-2 text-sm mb-4"
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setRejectModal(null)}
                className="px-4 py-2 text-sm text-[#1B2438]/60"
              >
                Cancel
              </button>
              <button
                onClick={confirmReject}
                className="px-4 py-2 text-sm bg-[#B3432B] text-white rounded-md"
              >
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}