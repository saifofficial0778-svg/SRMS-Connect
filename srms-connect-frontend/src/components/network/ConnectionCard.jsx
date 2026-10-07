import { useState } from "react";
import { MessageSquare } from "lucide-react";
import Button from "../ui/Button";
import ConfirmDialog from "../ui/ConfirmDialog";
import PersonRow from "./PersonRow";

export default function ConnectionCard({ profile, onMessage, onRemove, onViewProfile }) {
  const [confirming, setConfirming] = useState(false);
  const [removing, setRemoving] = useState(false);

  const handleConfirmRemove = async () => {
    setRemoving(true);
    try {
      await onRemove();
    } catch {
      setRemoving(false);
      setConfirming(false);
    }
  };

  return (
    <div className="card flex flex-col gap-4 p-4 transition-shadow hover:shadow-raised sm:flex-row sm:items-center">
      <PersonRow profile={profile} onClick={onViewProfile} />

      <div className="flex shrink-0 items-center gap-2">
        <Button variant="secondary" size="sm" icon={MessageSquare} onClick={onMessage}>Message</Button>
        <Button variant="ghost" size="sm" onClick={() => setConfirming(true)}>Remove</Button>
      </div>

      <ConfirmDialog
        open={confirming}
        title={`Remove ${profile.full_name || "this connection"}?`}
        description="You will no longer be connected and won't be able to message each other. They are not notified."
        confirmLabel="Remove connection"
        busy={removing}
        onConfirm={handleConfirmRemove}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}
