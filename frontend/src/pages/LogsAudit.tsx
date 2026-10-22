import { useState, useEffect, type ReactNode } from 'react';
import {
  Search,
  Filter,
  RefreshCw,
  FilterX,
  Download,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Ban,
  ChevronLeft,
  ChevronRight,
  Activity,
} from 'lucide-react';
import { Card, CardHeader, Badge, Button, Input, Select, Modal, Table, LoadingSpinner, EmptyState } from '@/components/common';
import { useApi } from '@/hooks';
import { systemApi } from '@/services/api';
import { AuditLog, AuditFilter, AuditStats, AuditAction, AuditResult } from '@/types';
import { formatBytes, formatUptime, getStateBadgeClass } from '@/utils/format';
import { clsx } from 'clsx';

const actionOptions = [
  { value: '', label: 'All Actions' },
  { value: 'start', label: 'Start' },
  { value: 'stop', label: 'Stop' },
  { value: 'restart', label: 'Restart' },
  { value: 'enable', label: 'Enable' },
  { value: 'disable', label: 'Disable' },
  { value: 'reload', label: 'Reload' },
  { value: 'pause', label: 'Pause' },
  { value: 'unpause', label: 'Unpause' },
  { value: 'kill', label: 'Kill' },
  { value: 'terminate', label: 'Terminate' },
  { value: 'load', label: 'Load' },
  { value: 'unload', label: 'Unload' },
  { value: 'create', label: 'Create' },
  { value: 'remove', label: 'Remove' },
  { value: 'update', label: 'Update' },
];

const resultOptions = [
  { value: '', label: 'All Results' },
  { value: 'success', label: 'Success' },
  { value: 'failed', label: 'Failed' },
  { value: 'denied', label: 'Denied' },
  { value: 'partial', label: 'Partial' },
];

const resourceTypeOptions = [
  { value: '', label: 'All Types' },
  { value: 'service', label: 'Service' },
  { value: 'container', label: 'Container' },
  { value: 'process', label: 'Process' },
  { value: 'kernel_module', label: 'Kernel Module' },
];

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-dark-500">{label}</p>
      <div className="text-sm text-dark-100 mt-0.5 break-words">{value}</div>
    </div>
  );
}

export function LogsAudit() {
  const [search, setSearch] = useState('');
  const [resourceTypeFilter, setResourceTypeFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [resultFilter, setResultFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  const { data: logs, loading, refreshing, error, refetch } = useApi<AuditLog[]>(
    () => systemApi.getAuditLogs({
      resource_type: resourceTypeFilter || undefined,
      action: actionFilter as AuditAction || undefined,
      result: resultFilter as AuditResult || undefined,
      start_time: startDate ? new Date(startDate) : undefined,
      end_time: endDate ? new Date(endDate) : undefined,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    }),
    [resourceTypeFilter, actionFilter, resultFilter, startDate, endDate, page, pageSize],
    { refreshInterval: 30000, cacheKey: `logs:${resourceTypeFilter}:${actionFilter}:${resultFilter}:${startDate}:${endDate}:${page}` }
  );

  const { data: stats } = useApi<AuditStats>(
    () => systemApi.getAuditStats(),
    []
  );

  const filteredLogs = logs?.filter((log) =>
    log.resource_name.toLowerCase().includes(search.toLowerCase()) ||
    log.resource_id?.toLowerCase().includes(search.toLowerCase()) ||
    log.error_details?.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const totalPages = Math.ceil((stats?.total_events || 0) / pageSize);

  const hasFilters = Boolean(
    resourceTypeFilter || actionFilter || resultFilter || startDate || endDate
  );

  const handleExport = async () => {
    try {
      const response = await systemApi.getAuditLogs({
        resource_type: resourceTypeFilter || undefined,
        action: actionFilter as AuditAction || undefined,
        result: resultFilter as AuditResult || undefined,
        start_time: startDate ? new Date(startDate) : undefined,
        end_time: endDate ? new Date(endDate) : undefined,
        limit: 10000,
        offset: 0,
      });
      const csv = [
        ['Timestamp', 'Resource Type', 'Resource Name', 'Resource ID', 'Action', 'Previous State', 'Resulting State', 'Result', 'Error', 'User', 'Interface'],
        ...response.map((log: AuditLog) => [
          log.timestamp,
          log.resource_type,
          log.resource_name,
          log.resource_id || '',
          log.action,
          log.previous_state || '',
          log.resulting_state || '',
          log.result,
          log.error_details || '',
          log.user_identity || '',
          log.interface || '',
        ]),
      ].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-dark-100">Logs & Audit History</h1>
          <p className="text-dark-400">View and search audit logs</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={handleExport} disabled={loading}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          <Button variant="secondary" onClick={refetch} loading={loading || refreshing}>
            <RefreshCw className={clsx('w-4 h-4', (loading || refreshing) && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      {stats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-dark-400">Total Events</p>
                <p className="text-3xl font-bold text-dark-100">{stats.total_events}</p>
              </div>
              <div className="p-3 rounded-xl bg-blue-900/30">
                <Activity className="w-6 h-6 text-blue-400" />
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-dark-400">Successful</p>
                <p className="text-3xl font-bold text-accent-400">{stats.success_count}</p>
              </div>
              <div className="p-3 rounded-xl bg-accent-900/30">
                <CheckCircle className="w-6 h-6 text-accent-400" />
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-dark-400">Failed</p>
                <p className="text-3xl font-bold text-danger-400">{stats.failed_count}</p>
              </div>
              <div className="p-3 rounded-xl bg-danger-900/30">
                <XCircle className="w-6 h-6 text-danger-400" />
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-dark-400">Denied</p>
                <p className="text-3xl font-bold text-warning-400">{stats.denied_count}</p>
              </div>
              <div className="p-3 rounded-xl bg-warning-900/30">
                <Ban className="w-6 h-6 text-warning-400" />
              </div>
            </div>
          </Card>
        </div>
      )}

      <Card>
        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-500" />
            <Input
              placeholder="Search logs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select
            value={resourceTypeFilter}
            onChange={(e) => setResourceTypeFilter(e.target.value)}
            className="w-full sm:w-40"
          >
            {resourceTypeOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </Select>
          <Select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="w-full sm:w-40"
          >
            {actionOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </Select>
          <Select
            value={resultFilter}
            onChange={(e) => setResultFilter(e.target.value)}
            className="w-full sm:w-40"
          >
            {resultOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </Select>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full sm:w-36"
          />
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full sm:w-36"
          />
        </div>

        {hasFilters && (
          <Button variant="ghost" size="sm" className="mb-4" onClick={() => {
            setResourceTypeFilter('');
            setActionFilter('');
            setResultFilter('');
            setStartDate('');
            setEndDate('');
          }}>
            <FilterX className="w-4 h-4 mr-1" />
            Clear Filters
          </Button>
        )}

        {loading && !logs ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner size="lg" />
          </div>
        ) : error && !logs ? (
          <div className="text-center py-8 text-danger-400">Failed to load logs: {error}</div>
        ) : filteredLogs.length === 0 ? (
          <EmptyState
            icon={<Clock className="w-12 h-12" />}
            title="No audit logs found"
            message="Try adjusting your search or filter criteria"
          />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <th className="w-40">Timestamp</th>
                  <th className="w-24">Type</th>
                  <th>Resource</th>
                  <th className="w-24">Action</th>
                  <th className="w-24">Result</th>
                  <th className="w-24">User</th>
                  <th className="w-48">Details</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="cursor-pointer" onClick={() => { setSelectedLog(log); setShowDetail(true); }}>
                    <td className="font-mono text-sm">{new Date(log.timestamp).toLocaleString()}</td>
                    <td>
                      <Badge variant="info">{log.resource_type}</Badge>
                    </td>
                    <td>
                      <div>
                        <p className="font-mono text-sm text-dark-100 truncate max-w-xs">{log.resource_name}</p>
                        {log.resource_id && <p className="text-xs text-dark-500">{log.resource_id}</p>}
                      </div>
                    </td>
                    <td className="font-mono text-sm capitalize">{log.action}</td>
                    <td>
                      <Badge className={getStateBadgeClass(log.result)}>
                        {log.result}
                      </Badge>
                    </td>
                    <td className="text-sm text-dark-300">{log.user_identity || '—'}</td>
                    <td className="text-sm text-dark-400">
                      {log.error_details ? (
                        <span className="text-danger-400">{log.error_details}</span>
                      ) : log.previous_state || log.resulting_state ? (
                        <>
                          {log.previous_state && <span>{log.previous_state} → </span>}
                          {log.resulting_state}
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>

            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-dark-400">
                Page {page} of {totalPages} ({stats?.total_events || 0} total)
              </p>
              <div className="flex items-center gap-2">
                <Button variant="secondary" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="secondary" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>

      <Modal
        isOpen={showDetail}
        onClose={() => { setShowDetail(false); setSelectedLog(null); }}
        title="Audit Log Details"
        size="lg"
      >
        {selectedLog && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <DetailRow label="ID" value={selectedLog.id.toString()} />
              <DetailRow label="Timestamp" value={new Date(selectedLog.timestamp).toLocaleString()} />
              <DetailRow label="Resource Type" value={selectedLog.resource_type} />
              <DetailRow label="Resource Name" value={selectedLog.resource_name} />
              <DetailRow label="Resource ID" value={selectedLog.resource_id || '—'} />
              <DetailRow label="Action" value={selectedLog.action} />
              <DetailRow
                label="Result"
                value={
                  <Badge className={getStateBadgeClass(selectedLog.result)}>
                    {selectedLog.result}
                  </Badge>
                }
              />
              <DetailRow label="Previous State" value={selectedLog.previous_state || '—'} />
              <DetailRow label="Resulting State" value={selectedLog.resulting_state || '—'} />
              <DetailRow label="User Identity" value={selectedLog.user_identity || '—'} />
              <DetailRow label="Interface" value={selectedLog.interface || '—'} />
            </div>
            {selectedLog.error_details && (
              <div className="bg-danger-900/30 border border-danger-800 rounded-lg p-4">
                <h4 className="text-danger-400 font-medium mb-2">Error Details</h4>
                <pre className="text-sm text-danger-300 whitespace-pre-wrap">{selectedLog.error_details}</pre>
              </div>
            )}
          </div>
        )}
        <div className="modal-footer">
          <Button onClick={() => { setShowDetail(false); setSelectedLog(null); }}>
            Close
          </Button>
        </div>
      </Modal>
    </div>
  );
}
export default LogsAudit;