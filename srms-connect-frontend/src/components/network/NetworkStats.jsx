import { Inbox, Send, Users } from "lucide-react";
import { StatCard } from "../ui/Primitives";

export default function NetworkStats({ connections, received, sent }) {
  return (
    <div className="grid grid-cols-3 gap-3 sm:gap-4">
      <StatCard value={connections} label="Connections" icon={Users} />
      <StatCard value={received} label="Requests" icon={Inbox} />
      <StatCard value={sent} label="Sent" icon={Send} />
    </div>
  );
}
