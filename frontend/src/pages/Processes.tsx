import { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  RefreshCw,
  X,
  Terminal,
  Cpu,
  MemoryStick,
  ExternalLink,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { Card, CardHeader, Badge, Button, Input, Select, Modal, Table, LoadingSpinner, EmptyState, ConfirmDialog } from '@/components/common';
import { useApi } from '@/hooks';
import { processesApi } from '@/services/api';
import { Process, ProcessState, ProcessAction } from '@/types';
import { formatBytes, formatUptime, getStateBadgeClass } from '@/utils/format';
import { clsx } from 'clsx';

const stateOptions = [
  { value: '', label: 'All States' },
  { value: 'running', label: 'Running' },
  { value: 'sleeping', label: 'Sleeping' },
  { value: 'stopped', label: 'Stopped' },
  { value: 'zombie', label: 'Zombie' },
];

export function Processes() {
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [usernameFilter, setUsernameFilter] = useState('');
  const [minCpu, setMinCpu] = useState('');
  const [selectedProcess, setSelectedProcess] = useState<Process | null>(null);
  const [showTree, setShowTree] = useState(false);
  const [treeData, setTreeData] = useState<any>(null);
  const [confirmAction, setConfirmAction] = useState<{ process: Process; action: ProcessAction } | null>(null);

  const { data: processes, loading, refreshing, error, refetch } = useApi<Process[]>(
    () => processesApi.listProcesses({
      name: search || undefined,
      username: usernameFilter || undefined,
      state: stateFilter as ProcessState || undefined,
      min_cpu: minCpu ? parseFloat(minCpu) : undefined,
    }),
    [search, stateFilter, usernameFilter, minCpu],
    { refreshInterval: 15000, cacheKey: `processes:${search}:${stateFilter}:${usernameFilter}:${minCpu}` }
  );

  const handleAction = async (process: Process, action: ProcessAction['action']) => {
    setConfirmAction({ process, action: { action, confirm: true, signal: 15 } });
  };

  const executeAction = async (process: Process, action: ProcessAction['action']) => {
    try {
      await processesApi.processAction(process.pid, { action, confirm: true, signal: 15 });
      refetch();
    } catch (err: any) {
      console.error('Action failed:', err);
    }
  };

  const handleConfirmAction = async () => {
    if (confirmAction) {
      await executeAction(confirmAction.process, confirmAction.action.action);
      setConfirmAction(null);
    }
  };

  const handleViewTree = async (process: Process) => {
    setSelectedProcess(process);
    setShowTree(true);
    try {
      const tree = await processesApi.getProcessTree(process.pid);
      setTreeData(tree);
    } catch (err) {
      setTreeData(null);
    }
  };

  const filteredProcesses = processes?.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.cmdline.join(' ').toLowerCase().includes(search.toLowerCase())
  ) || [];

  const sortProcesses = (a: Process, b: Process) => {
    const cpuA = a.cpu_percent || 0;
    const cpuB = b.cpu_percent || 0;
    return cpuB - cpuA;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-dark-100">Processes</h1>
          <p className="text-dark-400">View and manage running processes</p>
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
              placeholder="Search processes by name or command..."
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
          <Input
            placeholder="User"
            value={usernameFilter}
            onChange={(e) => setUsernameFilter(e.target.value)}
            className="w-full sm:w-32"
          />
          <Input
            type="number"
            placeholder="Min CPU %"
            value={minCpu}
            onChange={(e) => setMinCpu(e.target.value)}
            className="w-full sm:w-28"
            step="0.1"
          />
        </div>

        {loading && !processes ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner size="lg" />
          </div>
        ) : error && !processes ? (
          <div className="text-center py-8 text-danger-400">Failed to load processes: {error}</div>
        ) : filteredProcesses.length === 0 ? (
          <EmptyState
            icon={<Cpu className="w-12 h-12" />}
            title="No processes found"
            message="Try adjusting your search or filter criteria"
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <th className="w-12"></th>
                <th className="w-20">PID</th>
                <th>Name</th>
                <th className="w-24">User</th>
                <th className="w-20">State</th>
                <th className="w-16">CPU%</th>
                <th className="w-20">Memory%</th>
                <th className="w-24">RSS</th>
                <th className="w-16">Threads</th>
                <th className="w-20">Started</th>
                <th className="w-48">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProcesses.sort(sortProcesses).map((process) => (
                <tr key={process.pid}>
                  <td>
                    {process.children && process.children.length > 0 && (
                      <button
                        onClick={() => handleViewTree(process)}
                        className="p-1 text-dark-400 hover:text-dark-100"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                  <td className="font-mono text-sm">{process.pid}</td>
                  <td>
                    <div>
                      <p className="font-mono text-sm text-dark-100 truncate max-w-xs">{process.name}</p>
                      <p className="text-xs text-dark-500 truncate max-w-xs">{process.cmdline.join(' ')}</p>
                    </div>
                  </td>
                  <td className="text-sm text-dark-300">{process.username || '—'}</td>
                  <td>
                    <Badge className={getStateBadgeClass(process.state)}>
                      {process.state}
                    </Badge>
                  </td>
                  <td className="font-mono text-sm text-blue-400">{process.cpu_percent ? process.cpu_percent.toFixed(1) : '—'}</td>
                  <td className="font-mono text-sm text-accent-400">{process.memory_percent ? process.memory_percent.toFixed(1) : '—'}</td>
                  <td className="font-mono text-sm">{process.memory_rss ? formatBytes(process.memory_rss) : '—'}</td>
                  <td className="font-mono text-sm">{process.num_threads || '—'}</td>
                  <td className="font-mono text-sm text-dark-400">{process.create_time ? new Date(process.create_time).toLocaleTimeString() : '—'}</td>
                  <td>
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="ghost" onClick={() => handleViewTree(process)}>
                        <ChevronDown className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => {}}>
                        <Terminal className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => handleAction(process, 'terminate')}>
                        <X className="w-3.5 h-3.5" />
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
          ? `Are you sure you want to ${confirmAction.action.action} PID ${confirmAction.process.pid} (${confirmAction.process.name})?`
          : ''}
        confirmText={confirmAction?.action.action || 'Confirm'}
        variant="danger"
      />

      <Modal
        isOpen={showTree}
        onClose={() => { setShowTree(false); setSelectedProcess(null); }}
        title={selectedProcess ? `Process Tree: ${selectedProcess.name} (PID: ${selectedProcess.pid})` : 'Process Tree'}
        size="lg"
      >
        <div className="h-[60vh] overflow-y-auto bg-dark-950 rounded-lg p-4 font-mono text-sm text-dark-300">
          {treeData ? (
            <pre>{JSON.stringify(treeData, null, 2)}</pre>
          ) : (
            'No tree data available'
          )}
        </div>
        <div className="modal-footer">
          <Button onClick={() => { setShowTree(false); setSelectedProcess(null); }}>
            Close
          </Button>
        </div>
      </Modal>
    </div>
  );
}

export default Processes;