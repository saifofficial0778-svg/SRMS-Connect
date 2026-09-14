import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getProfile, getPublicProfileById } from "../../services/profileService";
import { getOrCreateConversation } from "../../services/chatService";
import {
  getMyConnections,
  getReceivedRequests,
  getSentRequests,
  sendConnectionRequest,
  acceptConnectionRequest,
  rejectConnectionRequest,
  cancelConnectionRequest,
  removeConnection,
} from "../../services/connectionService";
import Avatar from "../../components/profile/Avatar";
import BasicInfoCard from "../../components/profile/BasicInfoCard";
import SocialLinks from "../../components/profile/SocialLinks";
import { BuildingIcon, LocationIcon } from "../../components/profile/icons";

export default function PublicProfile() {
  const { userId } = useParams();
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // relationship state: "none" | "sent" | "received" | "connected"
  const [status, setStatus] = useState("none");
  const [connectionId, setConnectionId] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError("");
      try {
        const [meRes, profileRes, connRes, recvRes, sentRes] = await Promise.all([
          getProfile(),
          getPublicProfileById(userId),
          getMyConnections(),
          getReceivedRequests(),
          getSentRequests(),
        ]);

        if (cancelled) return;

        const myId = meRes?.data?.user_id;
        const targetId = Number(userId);

        setProfile(profileRes?.data || null);

        const otherIdOf = (row) => (row.sender_id === myId ? row.receiver_id : row.sender_id);

        const connectedRow = (connRes?.data || []).find((r) => otherIdOf(r) === targetId);
        const receivedRow = (recvRes?.data || []).find((r) => r.sender_id === targetId);
        const sentRow = (sentRes?.data || []).find((r) => r.receiver_id === targetId);

        if (connectedRow) {
          setStatus("connected");
          setConnectionId(connectedRow.id);
        } else if (receivedRow) {
          setStatus("received");
          setConnectionId(receivedRow.id);
        } else if (sentRow) {
          setStatus("sent");
          setConnectionId(sentRow.id);
        } else {
          setStatus("none");
          setConnectionId(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.response?.data?.message || "Couldn't load this profile.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const handleConnect = async () => {
    setActionLoading(true);
    try {
      const res = await sendConnectionRequest(userId);
      setStatus("sent");
      setConnectionId(res?.data);
      showToast("Connection request sent.");
    } catch (err) {
      showToast(err?.response?.data?.message || "Couldn't send request.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    setActionLoading(true);
    try {
      await cancelConnectionRequest(connectionId);
      setStatus("none");
      setConnectionId(null);
      showToast("Request cancelled.");
    } catch (err) {
      showToast(err?.response?.data?.message || "Couldn't cancel request.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleAccept = async () => {
    setActionLoading(true);
    try {
      await acceptConnectionRequest(connectionId);
      setStatus("connected");
      showToast("Connection accepted.");
    } catch (err) {
      showToast(err?.response?.data?.message || "Couldn't accept request.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    setActionLoading(true);
    try {
      await rejectConnectionRequest(connectionId);
      setStatus("none");
      setConnectionId(null);
      showToast("Request rejected.");
    } catch (err) {
      showToast(err?.response?.data?.message || "Couldn't reject request.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemove = async () => {
    setActionLoading(true);
    try {
      await removeConnection(connectionId);
      setStatus("none");
      setConnectionId(null);
      showToast("Connection removed.");
    } catch (err) {
      showToast(err?.response?.data?.message || "Couldn't remove connection.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleMessage = async () => {
    setActionLoading(true);
    try {
      const res = await getOrCreateConversation(userId);
      const conversationId = res?.data?.id || res?.data?._id || res?.data?.conversationId;
      navigate("/chat", { state: { conversationId, userId: Number(userId) } });
    } catch (err) {
      showToast(err?.response?.data?.message || "Couldn't open chat.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="rounded-2xl border border-[#1B2438]/10 bg-white overflow-hidden animate-pulse">
          <div className="h-24 sm:h-28 bg-[#1B2438]/10" />
          <div className="px-8 pb-8 -mt-12">
            <div className="h-28 w-28 rounded-full bg-[#1B2438]/15 ring-4 ring-white" />
            <div className="mt-4 space-y-2 max-w-sm">
              <div className="h-6 w-40 rounded bg-[#1B2438]/10" />
              <div className="h-4 w-56 rounded bg-[#1B2438]/8" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="max-w-md mx-auto mt-16 text-center px-4">
        <p className="text-[#1B2438] font-medium">{error || "Profile not found."}</p>
        <button
          onClick={() => navigate(-1)}
          className="mt-4 px-4 py-2 rounded-lg bg-[#1B2438] text-white text-sm hover:bg-[#141B2C]"
        >
          Go back
        </button>
      </div>
    );
  }

  const { full_name, profile_photo, designation, company, location, bio } = profile;

  return (
    <div className="min-h-screen bg-[#F5F6F8]">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-5">
        <section className="relative overflow-hidden rounded-2xl border border-[#1B2438]/10 bg-white">
          <div className="h-24 sm:h-28 bg-[#1B2438] relative overflow-hidden">
            <svg
              className="absolute -right-8 -top-10 sm:-top-16 h-44 w-44 sm:h-56 sm:w-56 opacity-[0.14] pointer-events-none"
              viewBox="0 0 200 200"
              aria-hidden="true"
            >
              {Array.from({ length: 9 }).map((_, i) => (
                <circle key={i} cx="100" cy="100" r={18 + i * 10} stroke="#C98A2B" strokeWidth="1" fill="none" />
              ))}
            </svg>
            <div className="absolute inset-x-5 sm:inset-x-8 top-4 h-px bg-[#C98A2B]/25" />
            <div
              className="absolute inset-x-0 bottom-0 h-3 bg-white"
              style={{
                WebkitMaskImage: "radial-gradient(circle at 8px 0, transparent 7px, black 7.5px)",
                maskImage: "radial-gradient(circle at 8px 0, transparent 7px, black 7.5px)",
                WebkitMaskSize: "16px 16px",
                maskSize: "16px 16px",
                WebkitMaskRepeat: "repeat-x",
                maskRepeat: "repeat-x",
              }}
            />
          </div>

          <div className="px-5 sm:px-8 pb-6 sm:pb-8 pt-0">
            <div className="flex flex-col sm:flex-row sm:items-end gap-4">
              <div className="-mt-12 sm:-mt-14 shrink-0">
                <Avatar photoUrl={profile_photo} fullName={full_name} size={112} />
              </div>

              <div className="flex-1 min-w-0 pt-2 sm:pt-0 sm:pb-1">
                <h1
                  className="text-2xl sm:text-3xl text-[#1B2438] truncate"
                  style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}
                >
                  {full_name || "SRMS Member"}
                </h1>
                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[#1B2438]/70">
                  {(designation || company) && (
                    <span className="flex items-center gap-1.5">
                      <BuildingIcon />
                      {[designation, company].filter(Boolean).join(" at ")}
                    </span>
                  )}
                  {location && (
                    <span className="flex items-center gap-1.5">
                      <LocationIcon />
                      {location}
                    </span>
                  )}
                </div>
              </div>

              {/* dynamic relationship action — right side, replaces Edit profile */}
              <div className="w-full sm:w-auto shrink-0 flex items-center gap-2">
                {status === "none" && (
                  <button
                    onClick={handleConnect}
                    disabled={actionLoading}
                    className="w-full sm:w-auto rounded-lg bg-[#C98A2B] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#B37A22] active:bg-[#9F6C1E] disabled:opacity-60 transition-colors"
                  >
                    {actionLoading ? "Sending..." : "Connect"}
                  </button>
                )}

                {status === "sent" && (
                  <>
                    <span className="text-xs font-medium text-[#1B2438]/50 bg-[#1B2438]/5 px-2.5 py-1.5 rounded-full">
                      Pending
                    </span>
                    <button
                      onClick={handleCancel}
                      disabled={actionLoading}
                      className="rounded-lg border border-[#1B2438]/15 px-4 py-2.5 text-sm font-medium text-[#1B2438]/70 hover:bg-[#1B2438]/5 disabled:opacity-60 transition-colors"
                    >
                      {actionLoading ? "Cancelling..." : "Cancel"}
                    </button>
                  </>
                )}

                {status === "received" && (
                  <>
                    <button
                      onClick={handleReject}
                      disabled={actionLoading}
                      className="rounded-lg border border-[#1B2438]/15 px-4 py-2.5 text-sm font-medium text-[#1B2438]/70 hover:bg-[#1B2438]/5 disabled:opacity-60 transition-colors"
                    >
                      {actionLoading ? "..." : "Reject"}
                    </button>
                    <button
                      onClick={handleAccept}
                      disabled={actionLoading}
                      className="rounded-lg bg-[#C98A2B] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#B37A22] disabled:opacity-60 transition-colors"
                    >
                      {actionLoading ? "Accepting..." : "Accept"}
                    </button>
                  </>
                )}

                {status === "connected" && (
                  <>
                    <button
                      onClick={handleMessage}
                      disabled={actionLoading}
                      className="rounded-lg bg-[#C98A2B] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#B37A22] disabled:opacity-60 transition-colors"
                    >
                      Message
                    </button>
                    <button
                      onClick={handleRemove}
                      disabled={actionLoading}
                      className="rounded-lg border border-[#1B2438]/15 px-4 py-2.5 text-sm font-medium text-[#1B2438]/70 hover:bg-red-50 hover:text-red-600 hover:border-red-200 disabled:opacity-60 transition-colors"
                    >
                      {actionLoading ? "Removing..." : "Remove"}
                    </button>
                  </>
                )}
              </div>
            </div>

            {bio && (
              <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-[#1B2438]/80 border-l-2 border-[#C98A2B]/40 pl-4">
                {bio}
              </p>
            )}
          </div>
        </section>

        <div className="grid md:grid-cols-[1.1fr_1fr] gap-5 items-start">
          <div className="space-y-5">
            <BasicInfoCard profile={profile} />
          </div>
          <div className="space-y-5">
            <SocialLinks profile={profile} />
          </div>
        </div>
      </div>

      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-lg text-sm font-medium shadow-lg text-white ${
            toast.type === "error" ? "bg-red-600" : "bg-[#1B2438]"
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}