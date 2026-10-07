import { Tabs } from "../ui/Primitives";

const TABS = [
  { value: "connections", label: "Connections" },
  { value: "received", label: "Requests" },
  { value: "sent", label: "Sent" },
];

// what you are looking at inside "My network"; requests waiting for you carry a count
export default function NetworkTabs({ active, onChange, counts }) {
  return <Tabs label="My network" value={active} onChange={onChange} tabs={TABS.map((t) => ({ ...t, count: t.value === "connections" ? 0 : counts?.[t.value] || 0 }))} />;
}
