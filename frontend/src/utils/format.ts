export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat().format(value);
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
}

export function getStateColor(state: string): { bg: string; text: string; border: string } {
  const colors: Record<string, { bg: string; text: string; border: string }> = {
    active: { bg: 'bg-accent-900/30', text: 'text-accent-400', border: 'border-accent-800' },
    inactive: { bg: 'bg-dark-700', text: 'text-dark-400', border: 'border-dark-600' },
    failed: { bg: 'bg-danger-900/30', text: 'text-danger-400', border: 'border-danger-800' },
    activating: { bg: 'bg-blue-900/30', text: 'text-blue-400', border: 'border-blue-800' },
    deactivating: { bg: 'bg-blue-900/30', text: 'text-blue-400', border: 'border-blue-800' },
    reloading: { bg: 'bg-blue-900/30', text: 'text-blue-400', border: 'border-blue-800' },
    running: { bg: 'bg-accent-900/30', text: 'text-accent-400', border: 'border-accent-800' },
    paused: { bg: 'bg-warning-900/30', text: 'text-warning-400', border: 'border-warning-800' },
    restarting: { bg: 'bg-blue-900/30', text: 'text-blue-400', border: 'border-blue-800' },
    exited: { bg: 'bg-dark-700', text: 'text-dark-400', border: 'border-dark-600' },
    dead: { bg: 'bg-danger-900/30', text: 'text-danger-400', border: 'border-danger-800' },
    created: { bg: 'bg-dark-700', text: 'text-dark-400', border: 'border-dark-600' },
    healthy: { bg: 'bg-accent-900/30', text: 'text-accent-400', border: 'border-accent-800' },
    unhealthy: { bg: 'bg-danger-900/30', text: 'text-danger-400', border: 'border-danger-800' },
    starting: { bg: 'bg-blue-900/30', text: 'text-blue-400', border: 'border-blue-800' },
    listen: { bg: 'bg-accent-900/30', text: 'text-accent-400', border: 'border-accent-800' },
    established: { bg: 'bg-blue-900/30', text: 'text-blue-400', border: 'border-blue-800' },
    success: { bg: 'bg-accent-900/30', text: 'text-accent-400', border: 'border-accent-800' },
    denied: { bg: 'bg-warning-900/30', text: 'text-warning-400', border: 'border-warning-800' },
    partial: { bg: 'bg-blue-900/30', text: 'text-blue-400', border: 'border-blue-800' },
    live: { bg: 'bg-accent-900/30', text: 'text-accent-400', border: 'border-accent-800' },
    loading: { bg: 'bg-blue-900/30', text: 'text-blue-400', border: 'border-blue-800' },
    unloading: { bg: 'bg-warning-900/30', text: 'text-warning-400', border: 'border-warning-800' },
  };
  return colors[state] || { bg: 'bg-dark-700', text: 'text-dark-400', border: 'border-dark-600' };
}

export function getStateBadgeClass(state: string): string {
  const colors = getStateColor(state);
  return `badge ${colors.bg} ${colors.text} ${colors.border}`;
}