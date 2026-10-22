import { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  RefreshCw,
  Play,
  Square,
  RotateCcw,
  Pause,
  Trash2,
  Info,
  Terminal,
  ExternalLink,
  Box,
} from 'lucide-react';
import { Card, CardHeader, Badge, Button, Input, Select, Modal, ConfirmDialog, Table, LoadingSpinner, EmptyState } from '@/components/common';
import { useApi } from '@/hooks';
import { dockerApi } from '@/services/api';
import { Container, ContainerAction, ContainerActionResponse, ContainerState, RestartPolicy } from '@/types';
import { formatBytes, formatUptime, getStateBadgeClass } from '@/utils/format';
import { clsx } from 'clsx';

const stateOptions = [
  { value: '', label: 'All States' },
  { value: 'running', label: 'Running' },
  { value: 'exited', label: 'Exited' },
  { value: 'paused', label: 'Paused' },
  { value: 'restarting', label: 'Restarting' },
  { value: 'created', label: 'Created' },
  { value: 'dead', label: 'Dead' },
];

const restartPolicyOptions: { value: RestartPolicy; label: string }[] = [
  { value: 'no', label: 'No' },
  { value: 'on-failure', label: 'On Failure' },
  { value: 'always', label: 'Always' },
  { value: 'unless-stopped', label: 'Unless Stopped' },
];

export function Docker() {
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [selectedContainer, setSelectedContainer] = useState<Container | null>(null);
  const [showLogs, setShowLogs] = useState(false);
  const [logs, setLogs] = useState<string>('');
  const [logsLoading, setLogsLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ container: Container; action: ContainerAction } | null>(null);
  const [showInspect, setShowInspect] = useState(false);

  const { data: containers, loading, refreshing, error, refetch } = useApi<Container[]>(
    () => dockerApi.listContainers(true),
    [],
    { refreshInterval: 15000, cacheKey: 'docker:containers' }
  );

  const handleAction = async (container: Container, action: ContainerAction['action']) => {
    const confirmRequired = ['start', 'stop', 'restart', 'pause', 'unpause', 'kill', 'remove'].includes(action);
    if (confirmRequired) {
      setConfirmAction({ container, action: { action, confirm: true, timeout: 10 } });
    } else {
      await executeAction(container, action);
    }
  };

  const executeAction = async (container: Container, action: ContainerAction['action']) => {
    try {
      const response = await dockerApi.containerAction(container.id, { action, confirm: true, timeout: 10 });
      if (response.success) {
        refetch();
      }
    } catch (err: any) {
      console.error('Action failed:', err);
    }
  };

  const handleConfirmAction = async () => {
    if (confirmAction) {
      await executeAction(confirmAction.container, confirmAction.action.action);
      setConfirmAction(null);
    }
  };

  const handleViewLogs = async (container: Container) => {
    setSelectedContainer(container);
    setShowLogs(true);
    setLogsLoading(true);
    try {
      const response = await dockerApi.getContainerLogs(container.id, 200);
      setLogs(response);
    } catch (err) {
      setLogs('Failed to load logs');
    } finally {
      setLogsLoading(false);
    }
  };

  const handleInspect = (container: Container) => {
    setSelectedContainer(container);
    setShowInspect(true);
  };

  const filteredContainers = containers?.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.image.toLowerCase().includes(search.toLowerCase()) ||
    c.id.toLowerCase().includes(search.toLowerCase())
  ) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-dark-100">Docker Containers</h1>
          <p className="text-dark-400">Manage Docker containers</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={refetch} loading={loading || refreshing}>
            <RefreshCw className={clsx('w-4 h-4', (loading || refreshing) && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      <Card>
        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-500" />
            <Input
              placeholder="Search containers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
            className="w-full sm:w-48"
          >
            {stateOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </Select>
        </div>

        {loading && !containers ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner size="lg" />
          </div>
        ) : error && !containers ? (
          <div className="text-center py-8 text-danger-400">Failed to load containers: {error}</div>
        ) : filteredContainers.length === 0 ? (
          <EmptyState
            icon={<Box className="w-12 h-12" />}
            title="No containers found"
            message="Try adjusting your search or filter criteria"
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <th className="w-48">Container</th>
                <th className="w-32">Image</th>
                <th className="w-28">Status</th>
                <th>Ports</th>
                <th className="w-24">CPU</th>
                <th className="w-28">Memory</th>
                <th className="w-24">Restart Policy</th>
                <th className="w-48">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredContainers.map((container) => (
                <tr key={container.id}>
                  <td>
                    <div>
                      <p className="font-mono text-sm text-dark-100">{container.name}</p>
                      <p className="text-xs text-dark-500 truncate max-w-xs">{container.id.slice(0, 12)}</p>
                    </div>
                  </td>
                  <td className="font-mono text-sm truncate max-w-xs">{container.image}</td>
                  <td>
                    <Badge className={getStateBadgeClass(container.state)}>
                      {container.status}
                    </Badge>
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {container.ports.map((p, i) => (
                        <Badge key={i} variant="info" className="text-xs">
                          {p.host_port ? `${p.host_port}:${p.container_port}` : `${p.container_port}`}
                          {p.protocol}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="font-mono text-sm">{container.cpu_percent ? `${container.cpu_percent.toFixed(1)}%` : '—'}</td>
                  <td className="font-mono text-sm">
                    {container.memory_usage && container.memory_limit
                      ? `${formatBytes(container.memory_usage)} / ${formatBytes(container.memory_limit)}`
                      : container.memory_usage
                      ? formatBytes(container.memory_usage)
                      : '—'}
                  </td>
                  <td>
                    <Badge variant="neutral">{container.restart_policy}</Badge>
                  </td>
                  <td>
                    <div className="flex items-center gap-1">
                      {container.state !== 'running' && (
                        <Button size="sm" variant="primary" onClick={() => handleAction(container, 'start')}>
                          <Play className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      {container.state === 'running' && (
                        <>
                          <Button size="sm" variant="secondary" onClick={() => handleAction(container, 'stop')}>
                            <Square className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => handleAction(container, 'restart')}>
                            <RotateCcw className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleAction(container, 'pause')}>
                            <Pause className="w-3.5 h-3.5" />
                          </Button>
                        </>
                      )}
                      {container.state === 'paused' && (
                        <Button size="sm" variant="primary" onClick={() => handleAction(container, 'unpause')}>
                          <Play className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => handleViewLogs(container)}>
                        <Terminal className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleInspect(container)}>
                        <Info className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => handleAction(container, 'remove')}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <ConfirmDialog
        isOpen={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={handleConfirmAction}
        title={confirmAction ? `Confirm ${confirmAction.action.action}` : ''}
        message={confirmAction
          ? `Are you sure you want to ${confirmAction.action.action} ${confirmAction.container.name}?`
          : ''}
        confirmText={confirmAction?.action.action || 'Confirm'}
        variant={confirmAction?.action.action === 'remove' ? 'danger' : 'warning'}
      />

      <Modal
        isOpen={showLogs}
        onClose={() => { setShowLogs(false); setSelectedContainer(null); }}
        title={selectedContainer ? `Logs: ${selectedContainer.name}` : 'Logs'}
        size="lg"
      >
        <div className="h-[60vh] overflow-y-auto bg-dark-950 rounded-lg p-4 font-mono text-sm text-dark-300 whitespace-pre-wrap">
          {logsLoading ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner />
            </div>
          ) : (
            logs.split('\n').map((line, i) => (
              <div key={i} className="border-b border-dark-800 py-1 last:border-0">
                {line}
              </div>
            ))
          )}
        </div>
        <div className="modal-footer">
          <Button onClick={() => { setShowLogs(false); setSelectedContainer(null); }}>
            Close
          </Button>
        </div>
      </Modal>

      <Modal
        isOpen={showInspect}
        onClose={() => { setShowInspect(false); setSelectedContainer(null); }}
        title={selectedContainer ? `Inspect: ${selectedContainer.name}` : 'Inspect'}
        size="xl"
      >
        <div className="h-[70vh] overflow-y-auto bg-dark-950 rounded-lg p-4 font-mono text-sm text-dark-300 whitespace-pre-wrap">
          {selectedContainer ? JSON.stringify(selectedContainer, null, 2) : 'Loading...'}
        </div>
        <div className="modal-footer">
          <Button onClick={() => { setShowInspect(false); setSelectedContainer(null); }}>
            Close
          </Button>
        </div>
      </Modal>
    </div>
  );
}

