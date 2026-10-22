import { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  RefreshCw,
  Play,
  Square,
  RotateCcw,
  Power,
  Check,
  X,
  ExternalLink,
  Server,
} from 'lucide-react';
import { Card, CardHeader, Badge, Button, Input, Select, Modal, ConfirmDialog, Table, LoadingSpinner, EmptyState } from '@/components/common';
import { useApi, usePolling } from '@/hooks';
import { systemApi } from '@/services/api';
import { Service, ServiceAction, ServiceActionResponse, ServiceState } from '@/types';
import { formatBytes, formatUptime, getStateBadgeClass } from '@/utils/format';
import { clsx } from 'clsx';

const stateOptions = [
  { value: '', label: 'All States' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'failed', label: 'Failed' },
  { value: 'activating', label: 'Activating' },
  { value: 'deactivating', label: 'Deactivating' },
  { value: 'reloading', label: 'Reloading' },
];

export function SystemServices() {
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [showLogs, setShowLogs] = useState(false);
  const [logs, setLogs] = useState<string>('');
  const [logsLoading, setLogsLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ service: Service; action: ServiceAction } | null>(null);

  const { data: services, loading, refreshing, error, refetch } = useApi<Service[]>(
    () => systemApi.listServices(true, stateFilter || undefined),
    [stateFilter],
    { refreshInterval: 15000, cacheKey: `services:${stateFilter}` }
  );

  const handleAction = async (service: Service, action: ServiceAction['action']) => {
    const confirmRequired = ['start', 'stop', 'restart', 'reload', 'enable', 'disable'].includes(action);
    if (confirmRequired) {
      setConfirmAction({ service, action: { action, confirm: true } });
    } else {
      await executeAction(service, action);
    }
  };

  const executeAction = async (service: Service, action: ServiceAction['action']) => {
    try {
      const response = await systemApi.serviceAction(service.name, { action, confirm: true });
      if (response.success) {
        refetch();
      }
    } catch (err: any) {
      console.error('Action failed:', err);
    }
  };

  const handleConfirmAction = async () => {
    if (confirmAction) {
      await executeAction(confirmAction.service, confirmAction.action.action);
      setConfirmAction(null);
    }
  };

  const handleViewLogs = async (service: Service) => {
    setSelectedService(service);
    setShowLogs(true);
    setLogsLoading(true);
    try {
      const response = await systemApi.getServiceLogs(service.name, 200);
      setLogs(response.logs);
    } catch (err) {
      setLogs('Failed to load logs');
    } finally {
      setLogsLoading(false);
    }
  };

  const filteredServices = services?.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.display_name?.toLowerCase().includes(search.toLowerCase()) ||
    s.description?.toLowerCase().includes(search.toLowerCase())
  ) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-dark-100">System Services</h1>
          <p className="text-dark-400">Manage systemd services</p>
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
              placeholder="Search services..."
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

        {loading && !services ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner size="lg" />
          </div>
        ) : error && !services ? (
          <div className="text-center py-8 text-danger-400">Failed to load services: {error}</div>
        ) : filteredServices.length === 0 ? (
          <EmptyState
            icon={<Server className="w-12 h-12" />}
            title="No services found"
            message="Try adjusting your search or filter criteria"
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <th className="w-48">Service</th>
                <th className="w-32">Status</th>
                <th className="w-24">Enabled</th>
                <th>PID</th>
                <th className="w-24">CPU</th>
                <th className="w-28">Memory</th>
                <th className="w-28">Uptime</th>
                <th className="w-48">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredServices.map((service) => (
                <tr key={service.name}>
                  <td>
                    <div>
                      <p className="font-mono text-sm text-dark-100">{service.display_name || service.name}</p>
                      <p className="text-xs text-dark-500 truncate max-w-xs">{service.name}</p>
                    </div>
                  </td>
                  <td>
                    <Badge className={getStateBadgeClass(service.state)}>
                      {service.state}
                    </Badge>
                  </td>
                  <td>
                    <Badge variant={service.enabled ? 'success' : 'neutral'}>
                      {service.enabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </td>
                  <td className="font-mono text-sm">{service.pid || '—'}</td>
                  <td className="font-mono text-sm">{service.cpu_percent ? `${service.cpu_percent.toFixed(1)}%` : '—'}</td>
                  <td className="font-mono text-sm">{service.memory_kb ? formatBytes(service.memory_kb * 1024) : '—'}</td>
                  <td className="font-mono text-sm">{service.uptime_seconds ? formatUptime(service.uptime_seconds) : '—'}</td>
                  <td>
                    <div className="flex items-center gap-1">
                      {service.state !== 'active' && (
                        <Button size="sm" variant="primary" onClick={() => handleAction(service, 'start')}>
                          <Play className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      {service.state === 'active' && (
                        <>
                          <Button size="sm" variant="secondary" onClick={() => handleAction(service, 'stop')}>
                            <Square className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => handleAction(service, 'restart')}>
                            <RotateCcw className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleAction(service, 'reload')}>
                            <RotateCcw className="w-3.5 h-3.5" />
                          </Button>
                        </>
                      )}
                      {service.enabled !== undefined && (
                        <Button
                          size="sm"
                          variant={service.enabled ? 'ghost' : 'secondary'}
                          onClick={() => handleAction(service, service.enabled ? 'disable' : 'enable')}
                        >
                          {service.enabled ? <X className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => handleViewLogs(service)}>
                        <ExternalLink className="w-3.5 h-3.5" />
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
          ? `Are you sure you want to ${confirmAction.action.action} ${confirmAction.service.display_name || confirmAction.service.name}?`
          : ''}
        confirmText={confirmAction?.action.action || 'Confirm'}
        loading={false}
      />

      <Modal
        isOpen={showLogs}
        onClose={() => { setShowLogs(false); setSelectedService(null); }}
        title={selectedService ? `Logs: ${selectedService.display_name || selectedService.name}` : 'Logs'}
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
          <Button onClick={() => { setShowLogs(false); setSelectedService(null); }}>
            Close
          </Button>
        </div>
      </Modal>
    </div>
  );
}

export default SystemServices;