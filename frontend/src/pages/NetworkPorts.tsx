import { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  RefreshCw,
  FilterX,
  Wifi,
  Server,
  Globe,
  Lock,
  Unlock,
  ExternalLink,
  Cpu,
  Activity,
} from 'lucide-react';
import { Card, CardHeader, Badge, Button, Input, Select, Modal, Table, LoadingSpinner, EmptyState } from '@/components/common';
import { useApi } from '@/hooks';
import { networkApi } from '@/services/api';
import { NetworkPort, Protocol, PortState, NetworkInterface } from '@/types';
import { formatBytes, formatUptime, getStateBadgeClass } from '@/utils/format';
import { clsx } from 'clsx';

const protocolOptions = [
  { value: '', label: 'All Protocols' },
  { value: 'tcp', label: 'TCP' },
  { value: 'udp', label: 'UDP' },
  { value: 'tcp6', label: 'TCP6' },
  { value: 'udp6', label: 'UDP6' },
];

const stateOptions = [
  { value: '', label: 'All States' },
  { value: 'listen', label: 'Listen' },
  { value: 'established', label: 'Established' },
];

export function NetworkPorts() {
  const [search, setSearch] = useState('');
  const [protocolFilter, setProtocolFilter] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [localOnly, setLocalOnly] = useState(false);
  const [externalOnly, setExternalOnly] = useState(false);
  const [selectedPort, setSelectedPort] = useState<NetworkPort | null>(null);
  const [showProcess, setShowProcess] = useState(false);
  const [processData, setProcessData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'ports' | 'interfaces' | 'connections'>('ports');

  const { data: ports, loading: portsLoading, refreshing: portsRefreshing, error: portsError, refetch: refetchPorts } = useApi<NetworkPort[]>(
    () => networkApi.listPorts({
      protocol: protocolFilter as Protocol || undefined,
      state: stateFilter as PortState || undefined,
      local_only: localOnly,
      external_only: externalOnly,
    }),
    [protocolFilter, stateFilter, localOnly, externalOnly],
    { refreshInterval: 15000, cacheKey: `network:ports:${protocolFilter}:${stateFilter}:${localOnly}:${externalOnly}` }
  );

  const { data: interfaces, loading: interfacesLoading } = useApi<NetworkInterface[]>(
    () => networkApi.listInterfaces(),
    [],
    { refreshInterval: 30000, cacheKey: 'network:interfaces' }
  );

  const handleViewProcess = async (port: NetworkPort) => {
    if (!port.pid) return;
    setSelectedPort(port);
    setShowProcess(true);
    try {
      const response = await networkApi.getPort(port.port, port.protocol);
      setProcessData(response);
    } catch (err) {
      setProcessData(null);
    }
  };

  const filteredPorts = ports?.filter((p) =>
    p.process_name?.toLowerCase().includes(search.toLowerCase()) ||
    p.service_name?.toLowerCase().includes(search.toLowerCase()) ||
    p.port.toString().includes(search)
  ) || [];

  const hasFilters = protocolFilter || stateFilter || localOnly || externalOnly;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-dark-100">Network Ports</h1>
          <p className="text-dark-400">Monitor listening ports and connections</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => { refetchPorts(); }} loading={portsLoading || portsRefreshing}>
            <RefreshCw className={clsx('w-4 h-4', (portsLoading || portsRefreshing) && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="flex gap-2 border-b border-dark-700 mb-4">
        {(['ports', 'interfaces', 'connections'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={clsx(
              'px-4 py-2 text-sm font-medium rounded-t-lg transition-colors',
              activeTab === tab
                ? 'text-accent-400 border-b-2 border-accent-500 bg-dark-800'
                : 'text-dark-400 hover:text-dark-100'
            )}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={() => {
              setProtocolFilter('');
              setStateFilter('');
              setLocalOnly(false);
              setExternalOnly(false);
            }}
          >
            <FilterX className="w-4 h-4 mr-1" />
            Clear Filters
          </Button>
        )}
      </div>

      {activeTab === 'ports' && (
        <Card>
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-500" />
              <Input
                placeholder="Search ports..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select
              value={protocolFilter}
              onChange={(e) => setProtocolFilter(e.target.value)}
              className="w-full sm:w-32"
            >
              {protocolOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </Select>
            <Select
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value)}
              className="w-full sm:w-32"
            >
              {stateOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </Select>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-sm text-dark-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={localOnly}
                  onChange={(e) => { setLocalOnly(e.target.checked); if (e.target.checked) setExternalOnly(false); }}
                  className="w-4 h-4 rounded border-dark-600 text-accent-500 focus:ring-accent-500"
                />
                <span>Localhost only</span>
              </label>
              <label className="flex items-center gap-2 text-sm text-dark-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={externalOnly}
                  onChange={(e) => { setExternalOnly(e.target.checked); if (e.target.checked) setLocalOnly(false); }}
                  className="w-4 h-4 rounded border-dark-600 text-accent-500 focus:ring-accent-500"
                />
                <span>External only</span>
              </label>
            </div>
          </div>

          {portsLoading && !ports ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner size="lg" />
            </div>
          ) : portsError && !ports ? (
            <div className="text-center py-8 text-danger-400">Failed to load ports: {portsError}</div>
          ) : filteredPorts.length === 0 ? (
            <EmptyState
              icon={<Wifi className="w-12 h-12" />}
              title="No ports found"
              message="Try adjusting your search or filter criteria"
            />
          ) : (
            <Table>
              <thead>
                <tr>
                  <th className="w-20">Port</th>
                  <th className="w-24">Protocol</th>
                  <th className="w-32">Address</th>
                  <th className="w-24">State</th>
                  <th>Process</th>
                  <th className="w-20">PID</th>
                  <th className="w-24">Type</th>
                  <th className="w-48">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPorts.map((port) => (
                  <tr key={`${port.protocol}-${port.port}`}>
                    <td className="font-mono text-sm font-medium">{port.port}</td>
                    <td>
                      <Badge variant="info">{port.protocol.toUpperCase()}</Badge>
                    </td>
                    <td className="font-mono text-sm">{port.local_address}</td>
                    <td>
                      <Badge className={getStateBadgeClass(port.state)}>
                        {port.state}
                      </Badge>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        {port.is_localhost && <Lock className="w-4 h-4 text-dark-400" aria-label="Localhost" />}
                        {port.is_external && <Globe className="w-4 h-4 text-warning-400" aria-label="External" />}
                        <span className="font-mono text-sm truncate max-w-xs">
                          {port.process_name || '—'}
                        </span>
                      </div>
                    </td>
                    <td className="font-mono text-sm">{port.pid || '—'}</td>
                    <td>
                      <div className="flex items-center gap-1">
                        {port.service_name && (
                          <Badge variant="info" className="text-xs">{port.service_name}</Badge>
                        )}
                        {port.container_name && (
                          <Badge variant="neutral" className="text-xs">
                            <Server className="w-3 h-3 mr-1" />
                            {port.container_name}
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        {port.pid && (
                          <Button size="sm" variant="ghost" onClick={() => handleViewProcess(port)}>
                            <Cpu className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        <Button size="sm" variant="ghost">
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
      )}

      {activeTab === 'interfaces' && (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-dark-100">Network Interfaces</h2>
          </CardHeader>
          {interfacesLoading && !interfaces ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner size="lg" />
            </div>
          ) : (
            <Table>
              <thead>
                <tr>
                  <th>Interface</th>
                  <th className="w-32">IPv4</th>
                  <th className="w-32">IPv6</th>
                  <th className="w-24">MAC</th>
                  <th className="w-20">MTU</th>
                  <th className="w-24">State</th>
                  <th className="w-32">Speed</th>
                  <th>Stats</th>
                </tr>
              </thead>
              <tbody>
                {interfaces.map((iface) => (
                  <tr key={iface.name}>
                    <td className="font-mono text-sm">{iface.name}</td>
                    <td className="font-mono text-sm">{iface.ipv4_addresses.join(', ') || '—'}</td>
                    <td className="font-mono text-sm">{iface.ipv6_addresses.join(', ') || '—'}</td>
                    <td className="font-mono text-sm">{iface.mac_address || '—'}</td>
                    <td className="font-mono text-sm">{iface.mtu}</td>
                    <td>
                      <Badge variant={iface.operstate === 'up' ? 'success' : 'neutral'}>
                        {iface.operstate}
                      </Badge>
                    </td>
                    <td className="font-mono text-sm">{iface.speed ? `${iface.speed} Mbps` : '—'}</td>
                    <td className="font-mono text-xs text-dark-400">
                      RX: {formatBytes(iface.statistics.bytes_recv || 0)} / TX: {formatBytes(iface.statistics.bytes_sent || 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      )}
    </div>
  );
}

export default NetworkPorts;