import { useEffect, useState, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getProfile, getPublicProfileById } from "../../services/profileService";
import { getOrCreateConversation } from "../../services/chatService";
import {
  getMyConnections,
  getReceivedRequests,
  getSentRequests,
  acceptConnectionRequest,
  rejectConnectionRequest,
  cancelConnectionRequest,
  removeConnection,
} from "../../services/connectionService";
import { PageHeader, Tabs } from "../../components/ui/Primitives";
import ToastStack from "../../components/ui/Toast";
import { NETWORK_TABS } from "../../utils/navigation";
import NetworkTabs from "../../components/network/NetworkTabs";
import NetworkStats from "../../components/network/NetworkStats";
import ConnectionCard from "../../components/network/ConnectionCard";
import RequestCard from "../../components/network/RequestCard";
import EmptyNetworkState from "../../components/network/EmptyNetworkState";
import { NetworkCardSkeleton } from "../../components/network/NetworkCardSkeleton";

function extractErrorMessage(err, fallback) {
  return err?.response?.data?.message || fallback;
}

export default function Network() {
  const navigate = useNavigate();
  const location = useLocation();

  // a connection-request notification opens straight on the Requests tab
  const [activeTab, setActiveTab] = useState(location.state?.tab || "connections");
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const [connections, setConnections] = useState([]);
  const [received, setReceived] = useState([]);
  const [sent, setSent] = useState([]);

  const showToast = useCallback((message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const me = await getProfile();
        const myId = me?.data?.user_id;

        const [connRes, recvRes, sentRes] = await Promise.all([
          getMyConnections(),
          getReceivedRequests(),
          getSentRequests(),
        ]);

        const connRows = connRes?.data || [];
        const recvRows = recvRes?.data || [];
        const sentRows = sentRes?.data || [];

        const otherIdOf = (row) => (row.sender_id === myId ? row.receiver_id : row.sender_id);

        const uniqueIds = [...new Set([...connRows, ...recvRows, ...sentRows].map(otherIdOf))];

        const profileEntries = await Promise.all(
          uniqueIds.map(async (id) => {
            try {
              const res = await getPublicProfileById(id);
              return [id, res?.data || null];
            } catch {
              return [id, null];
            }
          })
        );
        const profileMap = new Map(profileEntries);

        const attach = (row) => ({
          connectionId: row.id,
          otherUserId: otherIdOf(row),
          profile: profileMap.get(otherIdOf(row)) || {},
        });

        if (!cancelled) {
          setConnections(connRows.map(attach));
          setReceived(recvRows.map(attach));
          setSent(sentRows.map(attach));
        }
      } catch (err) {
        if (!cancelled) {
          showToast(extractErrorMessage(err, "Unable to load your network."), "error");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [showToast]);

  const handleAccept = async (item) => {
    try {
      await acceptConnectionRequest(item.connectionId);
      setReceived((prev) => prev.filter((r) => r.connectionId !== item.connectionId));
      setConnections((prev) => [item, ...prev]);
      showToast("Connection request accepted.");
    } catch (err) {
      showToast(extractErrorMessage(err, "Unable to accept request."), "error");
    }
  };

  const handleReject = async (item) => {
    try {
      await rejectConnectionRequest(item.connectionId);
      setReceived((prev) => prev.filter((r) => r.connectionId !== item.connectionId));
      showToast("Request rejected.");
    } catch (err) {
      showToast(extractErrorMessage(err, "Unable to reject request."), "error");
    }
  };

  const handleCancel = async (item) => {
    try {
      await cancelConnectionRequest(item.connectionId);
      setSent((prev) => prev.filter((r) => r.connectionId !== item.connectionId));
      showToast("Request cancelled.");
    } catch (err) {
      showToast(extractErrorMessage(err, "Unable to cancel request."), "error");
    }
  };

  const handleRemove = async (item) => {
    try {
      await removeConnection(item.connectionId);
      setConnections((prev) => prev.filter((c) => c.connectionId !== item.connectionId));
      showToast("Connection removed.");
    } catch (err) {
      showToast(extractErrorMessage(err, "Unable to remove connection."), "error");
      throw err;
    }
  };

  const handleMessage = async (item) => {
    try {
      const res = await getOrCreateConversation(item.otherUserId);
      const conversationId = res?.data?.id || res?.data?._id || res?.data?.conversationId;
      navigate("/chat", { state: { conversationId, userId: item.otherUserId } });
    } catch (err) {
      showToast(extractErrorMessage(err, "Unable to open chat."), "error");
    }
  };

  const handleViewProfile = (item) => {
    navigate(`/profile/${item.otherUserId}`);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 py-6 sm:px-6 sm:py-8">
      <PageHeader eyebrow="Network" title="My network" subtitle="The people you are connected with, and requests waiting for an answer.">
        <Tabs tabs={NETWORK_TABS} label="Network" />
      </PageHeader>

      <NetworkStats connections={connections.length} received={received.length} sent={sent.length} />

      <NetworkTabs
        active={activeTab}
        onChange={setActiveTab}
        counts={{ connections: connections.length, received: received.length, sent: sent.length }}
      />

      <div className="space-y-3">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <NetworkCardSkeleton key={i} />)
        ) : activeTab === "connections" ? (
          connections.length === 0 ? (
            <EmptyNetworkState
              title="No connections yet"
              subtitle="Start connecting with your college community."
            />
          ) : (
            connections.map((item) => (
              <ConnectionCard
                key={item.connectionId}
                profile={item.profile}
                onMessage={() => handleMessage(item)}
                onRemove={() => handleRemove(item)}
                onViewProfile={() => handleViewProfile(item)}
              />
            ))
          )
        ) : activeTab === "received" ? (
          received.length === 0 ? (
            <EmptyNetworkState title="No pending requests" />
          ) : (
            received.map((item) => (
              <RequestCard
                key={item.connectionId}
                type="received"
                profile={item.profile}
                onAccept={() => handleAccept(item)}
                onReject={() => handleReject(item)}
                onViewProfile={() => handleViewProfile(item)}
              />
            ))
          )
        ) : sent.length === 0 ? (
          <EmptyNetworkState title="No sent requests" />
        ) : (
          sent.map((item) => (
            <RequestCard
              key={item.connectionId}
              type="sent"
              profile={item.profile}
              onCancel={() => handleCancel(item)}
              onViewProfile={() => handleViewProfile(item)}
            />
          ))
        )}
      </div>

      <ToastStack toasts={toast ? [{ id: 1, ...toast }] : []} onDismiss={() => setToast(null)} />
    </div>
  );
}