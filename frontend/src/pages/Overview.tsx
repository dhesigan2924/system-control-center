import { useEffect, useState } from 'react';
import {
  Server,
  Activity,
  HardDrive,
  Box,
  Wifi,
  AlertTriangle,
  Cpu,
  MemoryStick,
  HardDrive as DiskIcon,
  Clock,
  TrendingUp,
  RefreshCw,
} from 'lucide-react';
import { Card, CardHeader, Badge, LoadingSpinner } from '@/components/common';
import { useApi } from '@/hooks';
import { metricsApi } from '@/services/api';
import { SystemOverview } from '@/types';
import { formatBytes, formatUptime, getStateBadgeClass } from '@/utils/format';
import { clsx } from 'clsx';

const statCards = [
  { name: 'Total Services', key: 'total_services', icon: Server, color: 'text-blue-400', bg: 'bg-blue-900/30' },
  { name: 'Running', key: 'running_services', icon: Activity, color: 'text-accent-400', bg: 'bg-accent-900/30' },
  { name: 'Stopped', key: 'stopped_services', icon: Server, color: 'text-dark-400', bg: 'bg-dark-700' },
  { name: 'Failed', key: 'failed_services', icon: AlertTriangle, color: 'text-danger-400', bg: 'bg-danger-900/30' },
  { name: 'Active Ports', key: 'active_ports', icon: Wifi, color: 'text-purple-400', bg: 'bg-purple-900/30' },
  { name: 'Containers', key: 'running_containers', icon: Box, color: 'text-cyan-400', bg: 'bg-cyan-900/30' },
  { name: 'Kernel Modules', key: 'loaded_modules', icon: HardDrive, color: 'text-orange-400', bg: 'bg-orange-900/30' },
  { name: 'Recent Failures', key: 'recent_failures', icon: AlertTriangle, color: 'text-warning-400', bg: 'bg-warning-900/30' },
];

const metricCards = [
  { name: 'CPU Usage', key: 'cpu_percent', icon: Cpu, unit: '%', color: 'text-blue-400', bg: 'bg-blue-900/30' },
  { name: 'Memory Usage', key: 'memory_percent', icon: MemoryStick, unit: '%', color: 'text-accent-400', bg: 'bg-accent-900/30' },
  { name: 'Disk Usage', key: 'disk_percent', icon: DiskIcon, unit: '%', color: 'text-purple-400', bg: 'bg-purple-900/30' },
  { name: 'Uptime', key: 'uptime', icon: Clock, unit: '', color: 'text-orange-400', bg: 'bg-orange-900/30' },
];

export function Overview() {
  const { data: overview, loading, refreshing, error, updatedAt, refetch } = useApi<SystemOverview>(
    () => metricsApi.getOverview(),
    [],
    { refreshInterval: 10000, cacheKey: 'metrics:overview' }
  );

  if (loading && !overview) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <Card key={card.key}>
            <LoadingSpinner size="md" />
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="w-12 h-12 text-danger-500 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-dark-100 mb-2">Failed to load overview</h3>
        <p className="text-dark-400 mb-4">{error}</p>
        <button onClick={refetch} className="btn-primary">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-dark-100">Overview</h1>
        <div className="flex items-center gap-2 text-sm text-dark-400">
          {updatedAt && (
            <>
              <span>Last updated: {updatedAt.toLocaleTimeString()}</span>
              <RefreshCw className={clsx('w-4 h-4', refreshing && 'animate-spin text-accent-500')} />
            </>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <Card key={card.key}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-dark-400">{card.name}</p>
                <p className="text-3xl font-bold text-dark-100 mt-1">
                  {overview ? (overview[card.key as keyof SystemOverview] as number | string) : '—'}
                </p>
              </div>
              <div className={clsx('p-3 rounded-xl', card.bg)}>
                <card.icon className={clsx('w-6 h-6', card.color)} />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {metricCards.map((card) => (
          <Card key={card.key}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-dark-400">{card.name}</p>
                <p className="text-3xl font-bold text-dark-100 mt-1">
                  {overview ? (
                    card.key === 'uptime'
                      ? (overview[card.key as keyof SystemOverview] as string)
                      : `${(overview[card.key as keyof SystemOverview] as number).toFixed(1)}${card.unit}`
                  ) : '—'}
                </p>
              </div>
              <div className={clsx('p-3 rounded-xl', card.bg)}>
                <card.icon className={clsx('w-6 h-6', card.color)} />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-dark-100">System Information</h2>
          </CardHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-sm text-dark-400">Platform</p>
              <p className="text-dark-100 font-mono text-sm">{navigator.platform}</p>
            </div>
            <div>
              <p className="text-sm text-dark-400">User Agent</p>
              <p className="text-dark-100 font-mono text-sm truncate">{navigator.userAgent}</p>
            </div>
            <div>
              <p className="text-sm text-dark-400">Language</p>
              <p className="text-dark-100">{navigator.language}</p>
            </div>
            <div>
              <p className="text-sm text-dark-400">Online</p>
              <p className="text-dark-100">{navigator.onLine ? 'Yes' : 'No'}</p>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-dark-100">Quick Actions</h2>
          </CardHeader>
          <div className="grid gap-2 sm:grid-cols-2">
            <a href="/services" className="btn-secondary w-full justify-start">
              <Server className="w-5 h-5" />
              Manage Services
            </a>
            <a href="/docker" className="btn-secondary w-full justify-start">
              <Box className="w-5 h-5" />
              Manage Containers
            </a>
            <a href="/processes" className="btn-secondary w-full justify-start">
              <Activity className="w-5 h-5" />
              View Processes
            </a>
            <a href="/network" className="btn-secondary w-full justify-start">
              <Wifi className="w-5 h-5" />
              Network Ports
            </a>
          </div>
        </Card>
      </div>
    </div>
  );
}

export default Overview;