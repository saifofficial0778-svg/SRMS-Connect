import { useState } from "react";
import Button from "../ui/Button";
import { Badge } from "../ui/Primitives";
import PersonRow from "./PersonRow";

export default function RequestCard({ type, profile, onAccept, onReject, onCancel, onViewProfile }) {
  const [loadingAction, setLoadingAction] = useState(null);

  const run = async (action, fn) => {
    setLoadingAction(action);
    try {
      await fn();
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="card flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
      <PersonRow profile={profile} onClick={onViewProfile} />

      {type === "received" ? (
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => run("reject", onReject)} loading={loadingAction === "reject"} disabled={!!loadingAction}>Ignore</Button>
          <Button size="sm" onClick={() => run("accept", onAccept)} loading={loadingAction === "accept"} disabled={!!loadingAction}>Accept</Button>
        </div>
      ) : (
        <div className="flex shrink-0 items-center gap-3">
          <Badge label="Pending" tone="pending" />
          <Button variant="secondary" size="sm" onClick={() => run("cancel", onCancel)} loading={loadingAction === "cancel"}>Withdraw</Button>
        </div>
      )}
    </div>
  );
}
