import { Users } from "lucide-react";
import { EmptyState } from "../ui/Primitives";
import Button from "../ui/Button";

export default function EmptyNetworkState({ title, subtitle }) {
  return (
    <EmptyState icon={Users} title={title} action={<Button variant="secondary" size="sm" to="/alumni">Browse the directory</Button>}>
      {subtitle}
    </EmptyState>
  );
}
