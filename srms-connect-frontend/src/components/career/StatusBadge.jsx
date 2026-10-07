import { Badge } from "../ui/Primitives";
import { statusMeta } from "../../utils/careerFormat";

export default function StatusBadge({ status }) {
  const { label, tone } = statusMeta(status);
  return <Badge label={label} tone={tone} />;
}
