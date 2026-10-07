import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FileText, HelpCircle, MessageSquare, Share2, UserCheck, UserPlus, UserX } from "lucide-react";
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
import ProfileHero from "../../components/profile/ProfileHero";
import Button from "../../components/ui/Button";
import ToastStack from "../../components/ui/Toast";
import { Badge, EmptyState, SkeletonCard } from "../../components/ui/Primitives";
import OpenToChips from "../../components/ui/OpenToChips";
import { academicLine, headline, isVerifiedAlumni } from "../../utils/personFormat";
import ProfileSuggestions from "../../components/profile/ProfileSuggestions";

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
      <div className="mx-auto max-w-5xl space-y-5 px-4 py-6 sm:px-6 sm:py-8" aria-busy="true">
        <SkeletonCard avatar lines={3} />
        <SkeletonCard lines={4} />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12">
        <EmptyState icon={UserX} title={error || "Profile not found"} action={<Button variant="secondary" size="sm" onClick={() => navigate(-1)}>Go back</Button>}>
          This member may have left SRMS Connect, or the link is wrong.
        </EmptyState>
      </div>
    );
  }

  const { full_name, profile_photo, location, bio } = profile;

  return (
    <div className="min-h-screen bg-canvas">
      <div className="mx-auto max-w-5xl space-y-5 px-4 py-6 sm:px-6 sm:py-8">
        <ProfileHero
          name={full_name || "SRMS Member"}
          role={profile.role}
          verified={isVerifiedAlumni(profile)}
          work={headline(profile)}
          academic={academicLine(profile)}
          location={location}
          bio={bio}
          avatar={<Avatar photoUrl={profile_photo} fullName={full_name} size={112} />}
          actions={
            <>
              {status === "none" && <Button icon={UserPlus} onClick={handleConnect} loading={actionLoading}>Connect</Button>}
              {status === "sent" && (
                <>
                  <Badge label="Request sent" tone="pending" />
                  <Button variant="secondary" onClick={handleCancel} loading={actionLoading}>Withdraw</Button>
                </>
              )}
              {status === "received" && (
                <>
                  <Button variant="secondary" onClick={handleReject} disabled={actionLoading}>Ignore</Button>
                  <Button icon={UserCheck} onClick={handleAccept} loading={actionLoading}>Accept request</Button>
                </>
              )}
              {status === "connected" && (
                <>
                  <Button variant="ghost" onClick={handleRemove} disabled={actionLoading}>Remove</Button>
                  <Button icon={MessageSquare} onClick={handleMessage} disabled={actionLoading}>Message</Button>
                </>
              )}
            </>
          }
        >
          <OpenToChips intents={profile.open_to} className="mt-3" />
          {/* students only; the server decides whether each request is allowed */}
          {profile.role === "ALUMNI" && localStorage.getItem("role") === "STUDENT" && (
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="accent" size="sm" icon={HelpCircle} to={`/career/new?type=QUESTION&alumni=${profile.user_id}`}>Ask a question</Button>
              <Button variant="accent" size="sm" icon={FileText} to={`/career/new?type=RESUME_REVIEW&alumni=${profile.user_id}`}>Request a resume review</Button>
              {/* a warm introduction only makes sense while you are not connected yet */}
              {status !== "connected" && (
                <Button variant="accent" size="sm" icon={Share2} to={`/mentorship/intros/new?target=${profile.user_id}`}>Ask for an introduction</Button>
              )}
            </div>
          )}
        </ProfileHero>

        <div className="grid md:grid-cols-[1.1fr_1fr] gap-5 items-start">
          <div className="space-y-5">
            <BasicInfoCard profile={profile} />
          </div>
          <div className="space-y-5">
            <SocialLinks profile={profile} />
          </div>
        </div>

        <ProfileSuggestions userId={profile.user_id} ownerName={profile.full_name} showToast={showToast} />
      </div>

      <ToastStack toasts={toast ? [{ id: 1, ...toast }] : []} onDismiss={() => setToast(null)} />
    </div>
  );
}