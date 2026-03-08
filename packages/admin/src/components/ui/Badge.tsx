import type { ProjectStatus } from '@gallery/shared';

const statusColors: Record<ProjectStatus, string> = {
  created: 'bg-zinc-800 text-zinc-300',
  'in-progress': 'bg-blue-900/40 text-blue-300',
  'post-shooting': 'bg-orange-900/40 text-orange-300',
  delivered: 'bg-green-900/40 text-green-300',
  archived: 'bg-zinc-900 text-zinc-500',
};

interface BadgeProps {
  status: ProjectStatus;
  label: string;
}

export const StatusBadge = ({ status, label }: BadgeProps) => (
  <span className={`inline-block px-2.5 py-0.5 text-xs font-semibold tracking-wider uppercase ${statusColors[status]}`}>
    {label}
  </span>
);
