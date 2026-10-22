import { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  RefreshCw,
  Info,
  AlertTriangle,
  Check,
  X,
  HardDrive,
  Cpu,
  MemoryStick,
  Wifi,
  Volume2,
  Monitor,
  Usb,
  Database,
  Shield,
  Zap,
  Thermometer,
} from 'lucide-react';
import { Card, CardHeader, Badge, Button, Input, Select, Modal, Table, LoadingSpinner, EmptyState, ConfirmDialog } from '@/components/common';
import { useApi } from '@/hooks';
import { driversApi } from '@/services/api';
import { KernelModule, ModuleAction } from '@/types';
import { formatBytes, formatUptime, getStateBadgeClass } from '@/utils/format';
import { clsx } from 'clsx';

const categoryIcons: Record<string, any> = {
  network: Wifi,
  storage: Database,
  usb: Usb,
  audio: Volume2,
  graphics: Monitor,
  input: Cpu,
  bluetooth: Wifi,
  wireless: Wifi,
  filesystem: Database,
  crypto: Shield,
  virtualization: Cpu,
  power: Zap,
  sensors: Thermometer,
  other: HardDrive,
};

const stateOptions = [
  { value: '', label: 'All States' },
  { value: 'live', label: 'Live' },
  { value: 'loading', label: 'Loading' },
  { value: 'unloading', label: 'Unloading' },
];

export function Drivers() {
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [selectedModule, setSelectedModule] = useState<KernelModule | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [moduleInfo, setModuleInfo] = useState<any>(null);
  const [confirmAction, setConfirmAction] = useState<{ module: KernelModule; action: ModuleAction } | null>(null);

  const { data: modules, loading, refreshing, error, refetch } = useApi<KernelModule[]>(
    () => driversApi.listModules(),
    [],
    { refreshInterval: 30000, cacheKey: 'drivers:modules' }
  );

  const handleAction = async (module: KernelModule, action: ModuleAction['action']) => {
    if (action === 'info') {
      setSelectedModule(module);
      setShowInfo(true);
      try {
        const info = await driversApi.getModuleInfo(module.name);
        setModuleInfo(info);
      } catch (err) {
        setModuleInfo(null);
      }
    } else {
      const confirmRequired = ['load', 'unload'].includes(action);
      if (confirmRequired) {
        setConfirmAction({ module, action: { action, confirm: true, force: false } });
      } else {
        await executeAction(module, action);
      }
    }
  };

  const executeAction = async (module: KernelModule, action: ModuleAction['action']) => {
    try {
      await driversApi.moduleAction(module.name, { action, confirm: true, force: false });
      refetch();
    } catch (err: any) {
      console.error('Action failed:', err);
    }
  };

  const handleConfirmAction = async () => {
    if (confirmAction) {
      await executeAction(confirmAction.module, confirmAction.action.action);
      setConfirmAction(null);
    }
  };

  const categories = Array.from(new Set(modules?.map((m) => m.category) || []));
  const filteredModules = modules?.filter((m) =>
    m.name.toLowerCase().includes(search.toLowerCase()) &&
    (!stateFilter || m.state === stateFilter) &&
    (!categoryFilter || m.category === categoryFilter)
  ) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-dark-100">Device Drivers & Kernel Modules</h1>
          <p className="text-dark-400">View and manage kernel modules</p>
        </div>
        <Button variant="secondary" onClick={refetch} loading={loading || refreshing}>
          <RefreshCw className={clsx('w-4 h-4', (loading || refreshing) && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      <Card>
        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-500" />
            <Input
              placeholder="Search modules..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
            className="w-full sm:w-40"
          >
            {stateOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </Select>
          <Select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full sm:w-40"
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </Select>
        </div>

        {loading && !modules ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner size="lg" />
          </div>
        ) : error && !modules ? (
          <div className="text-center py-8 text-danger-400">Failed to load modules: {error}</div>
        ) : filteredModules.length === 0 ? (
          <EmptyState
            icon={<HardDrive className="w-12 h-12" />}
            title="No modules found"
            message="Try adjusting your search or filter criteria"
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <th>Module</th>
                <th className="w-24">Category</th>
                <th className="w-24">State</th>
                <th className="w-20">Size</th>
                <th className="w-20">Used By</th>
                <th className="w-28">Dependencies</th>
                <th className="w-48">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredModules.map((module) => (
                <tr key={module.name}>
                  <td className="font-mono text-sm">
                    {module.name}
                    {module.description && (
                      <p className="text-xs text-dark-500 truncate max-w-xs">{module.description}</p>
                    )}
                  </td>
                  <td>
                    <Badge variant="info">
                      {(() => {
                        const Icon = categoryIcons[module.category] || HardDrive;
                        return <Icon className="w-3 h-3 mr-1" />;
                      })()}
                      {module.category}
                    </Badge>
                  </td>
                  <td>
                    <Badge className={getStateBadgeClass(module.state)}>
                      {module.state}
                    </Badge>
                  </td>
                  <td className="font-mono text-sm">{formatBytes(module.size)}</td>
                  <td className="font-mono text-sm">{module.used_by}</td>
                  <td className="font-mono text-xs text-dark-400 truncate max-w-xs">
                    {module.dependencies.join(', ') || '—'}
                  </td>
                  <td>
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="ghost" onClick={() => handleAction(module, 'info')}>
                        <Info className="w-3.5 h-3.5" />
                      </Button>
                      {module.state !== 'live' && (
                        <Button size="sm" variant="primary" onClick={() => handleAction(module, 'load')}>
                          <Check className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      {module.state === 'live' && (
                        <Button size="sm" variant="danger" onClick={() => handleAction(module, 'unload')}>
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      )}
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
          ? `Are you sure you want to ${confirmAction.action.action} ${confirmAction.module.name}?${confirmAction.action.action === 'unload' ? ' This may affect system functionality.' : ''}`
          : ''}
        confirmText={confirmAction?.action.action || 'Confirm'}
        variant={confirmAction?.action.action === 'unload' ? 'danger' : 'warning'}
      />

      <Modal
        isOpen={showInfo}
        onClose={() => { setShowInfo(false); setSelectedModule(null); }}
        title={selectedModule ? `Module Info: ${selectedModule.name}` : 'Module Info'}
        size="lg"
      >
        <div className="h-[70vh] overflow-y-auto bg-dark-950 rounded-lg p-4 font-mono text-sm text-dark-300 whitespace-pre-wrap">
          {moduleInfo ? (
            Object.entries(moduleInfo).map(([key, value]) => (
              <div key={key} className="mb-2">
                <span className="text-dark-400">{key}:</span>{' '}
                <span className="text-dark-100">{JSON.stringify(value)}</span>
              </div>
            ))
          ) : (
            'Loading...'
          )}
        </div>
        <div className="modal-footer">
          <Button onClick={() => { setShowInfo(false); setSelectedModule(null); }}>
            Close
          </Button>
        </div>
      </Modal>
    </div>
  );
}

export default Drivers;