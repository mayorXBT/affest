import { AgentCredentials } from '@/components/agent-panel';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

export default function AgentsPage() {
  return (
    <>
      <Card className="mt-7 flex items-start justify-between p-[22px_23px]">
        <div>
          <p className="eyebrow">Remote MCP</p>
          <h2 className="m-0 text-[21px] font-semibold">Scoped access for copilots</h2>
          <p className="mt-2 mb-0 max-w-[560px] text-[12px] leading-relaxed text-[#899596]">
            Affest exposes portfolio reads, planning, proof inspection and guarded actions through one model-independent MCP server.
          </p>
        </div>
        <Badge variant="agent">MCP</Badge>
      </Card>
      <AgentCredentials />
    </>
  );
}
