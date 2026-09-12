import { ActivityList } from '@/components/activity-list';
import { AgentTeaser } from '@/components/agent-panel';
import { StrategyList } from '@/components/strategy-list';
import { StrategyTemplates } from '@/components/strategy-templates';
import { ValueCard } from '@/components/value-card';

export default function OverviewPage() {
  return (
    <>
      <ValueCard />
      <StrategyList />
      <section className="mt-3.5 grid gap-3.5 lg:grid-cols-2">
        <StrategyTemplates />
        <ActivityList compact />
      </section>
      <section className="mt-3.5">
        <AgentTeaser />
      </section>
    </>
  );
}
