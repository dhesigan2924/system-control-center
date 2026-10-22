import { useState, useEffect } from 'react';
import {
  Server,
  Database,
  HardDrive,
  Wifi,
  Shield,
  Bell,
  Palette,
  Key,
  RefreshCw,
  Save,
  Loader2,
  CheckCircle,
} from 'lucide-react';
import { Card, CardHeader, Button, Input, Select, Badge } from '@/components/common';
import { useApi } from '@/hooks';
import { metricsApi } from '@/services/api';
import { clsx } from 'clsx';

const sections = [
  { id: 'general', name: 'General', icon: Server, description: 'Application settings and preferences' },
  { id: 'api', name: 'API & Backend', icon: Database, description: 'Backend connection and API settings' },
  { id: 'monitoring', name: 'Monitoring', icon: HardDrive, description: 'Refresh intervals and metrics collection' },
  { id: 'network', name: 'Network', icon: Wifi, description: 'Network scanning and port monitoring' },
  { id: 'security', name: 'Security', icon: Shield, description: 'Authentication and access control' },
  { id: 'notifications', name: 'Notifications', icon: Bell, description: 'Alert and notification preferences' },
  { id: 'appearance', name: 'Appearance', icon: Palette, description: 'Theme and display settings' },
];

export function Settings() {
  const [activeSection, setActiveSection] = useState('general');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [settings, setSettings] = useState({
    general: {
      appName: 'Local System Control Center',
      language: 'en',
      timezone: 'UTC',
      dateFormat: 'YYYY-MM-DD',
      timeFormat: '24h',
    },
    api: {
      backendUrl: 'http://127.0.0.1:8080',
      timeout: 30000,
      wsReconnectInterval: 5000,
      maxRetries: 3,
    },
    monitoring: {
      metricsRefreshInterval: 2000,
      overviewRefreshInterval: 5000,
      servicesRefreshInterval: 5000,
      processesRefreshInterval: 3000,
      networkRefreshInterval: 5000,
      driversRefreshInterval: 10000,
      enableAutoRefresh: true,
      maxLogLines: 5000,
      auditRetentionDays: 90,
    },
    network: {
      scanLocalPorts: true,
      scanExternalPorts: false,
      resolveHostnames: false,
      showProcessInfo: true,
      showContainerInfo: true,
    },
    security: {
      enableAuth: false,
      sessionTimeout: 604800,
      requireConfirmForActions: true,
      logFailedAttempts: true,
      maxFailedAttempts: 5,
    },
    notifications: {
      enableToastNotifications: true,
      notifyOnServiceFailure: true,
      notifyOnContainerFailure: true,
      notifyOnHighCpu: false,
      notifyOnHighMemory: false,
      cpuThreshold: 90,
      memoryThreshold: 90,
    },
    appearance: {
      theme: 'dark',
      compactMode: false,
      showAnimations: true,
      sidebarCollapsed: false,
      fontSize: 'medium',
    },
  });

  const handleSave = async (section: string) => {
    setSaving(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 500));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (section: string, key: string, value: any) => {
    setSettings((prev) => ({
      ...prev,
      [section]: { ...prev[section], [key]: value },
    }));
  };

  const renderSection = () => {
    switch (activeSection) {
      case 'general':
        return (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm text-dark-400 mb-1">Application Name</label>
                <Input
                  value={settings.general.appName}
                  onChange={(e) => handleChange('general', 'appName', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm text-dark-400 mb-1">Language</label>
                <Select
                  value={settings.general.language}
                  onChange={(e) => handleChange('general', 'language', e.target.value)}
                >
                  <option value="en">English</option>
                  <option value="de">German</option>
                  <option value="fr">French</option>
                  <option value="es">Spanish</option>
                </Select>
              </div>
              <div>
                <label className="block text-sm text-dark-400 mb-1">Timezone</label>
                <Select
                  value={settings.general.timezone}
                  onChange={(e) => handleChange('general', 'timezone', e.target.value)}
                >
                  <option value="UTC">UTC</option>
                  <option value="America/New_York">Eastern Time</option>
                  <option value="America/Chicago">Central Time</option>
                  <option value="America/Denver">Mountain Time</option>
                  <option value="America/Los_Angeles">Pacific Time</option>
                  <option value="Europe/London">London</option>
                  <option value="Europe/Paris">Paris</option>
                  <option value="Europe/Berlin">Berlin</option>
                  <option value="Asia/Tokyo">Tokyo</option>
                  <option value="Asia/Shanghai">Shanghai</option>
                </Select>
              </div>
              <div>
                <label className="block text-sm text-dark-400 mb-1">Date Format</label>
                <Select
                  value={settings.general.dateFormat}
                  onChange={(e) => handleChange('general', 'dateFormat', e.target.value)}
                >
                  <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                  <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                  <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                </Select>
              </div>
              <div>
                <label className="block text-sm text-dark-400 mb-1">Time Format</label>
                <Select
                  value={settings.general.timeFormat}
                  onChange={(e) => handleChange('general', 'timeFormat', e.target.value)}
                >
                  <option value="24h">24 Hour</option>
                  <option value="12h">12 Hour</option>
                </Select>
              </div>
            </div>
          </div>
        );
      case 'api':
        return (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm text-dark-400 mb-1">Backend URL</label>
                <Input
                  value={settings.api.backendUrl}
                  onChange={(e) => handleChange('api', 'backendUrl', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm text-dark-400 mb-1">Request Timeout (ms)</label>
                <Input
                  type="number"
                  value={settings.api.timeout}
                  onChange={(e) => handleChange('api', 'timeout', parseInt(e.target.value))}
                />
              </div>
              <div>
                <label className="block text-sm text-dark-400 mb-1">WebSocket Reconnect Interval (ms)</label>
                <Input
                  type="number"
                  value={settings.api.wsReconnectInterval}
                  onChange={(e) => handleChange('api', 'wsReconnectInterval', parseInt(e.target.value))}
                />
              </div>
              <div>
                <label className="block text-sm text-dark-400 mb-1">Max Retries</label>
                <Input
                  type="number"
                  value={settings.api.maxRetries}
                  onChange={(e) => handleChange('api', 'maxRetries', parseInt(e.target.value))}
                />
              </div>
            </div>
          </div>
        );
      case 'monitoring':
        return (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="block text-sm text-dark-400 mb-1">Metrics Refresh (ms)</label>
                <Input
                  type="number"
                  value={settings.monitoring.metricsRefreshInterval}
                  onChange={(e) => handleChange('monitoring', 'metricsRefreshInterval', parseInt(e.target.value))}
                />
              </div>
              <div>
                <label className="block text-sm text-dark-400 mb-1">Overview Refresh (ms)</label>
                <Input
                  type="number"
                  value={settings.monitoring.overviewRefreshInterval}
                  onChange={(e) => handleChange('monitoring', 'overviewRefreshInterval', parseInt(e.target.value))}
                />
              </div>
              <div>
                <label className="block text-sm text-dark-400 mb-1">Services Refresh (ms)</label>
                <Input
                  type="number"
                  value={settings.monitoring.servicesRefreshInterval}
                  onChange={(e) => handleChange('monitoring', 'servicesRefreshInterval', parseInt(e.target.value))}
                />
              </div>
              <div>
                <label className="block text-sm text-dark-400 mb-1">Processes Refresh (ms)</label>
                <Input
                  type="number"
                  value={settings.monitoring.processesRefreshInterval}
                  onChange={(e) => handleChange('monitoring', 'processesRefreshInterval', parseInt(e.target.value))}
                />
              </div>
              <div>
                <label className="block text-sm text-dark-400 mb-1">Network Refresh (ms)</label>
                <Input
                  type="number"
                  value={settings.monitoring.networkRefreshInterval}
                  onChange={(e) => handleChange('monitoring', 'networkRefreshInterval', parseInt(e.target.value))}
                />
              </div>
              <div>
                <label className="block text-sm text-dark-400 mb-1">Drivers Refresh (ms)</label>
                <Input
                  type="number"
                  value={settings.monitoring.driversRefreshInterval}
                  onChange={(e) => handleChange('monitoring', 'driversRefreshInterval', parseInt(e.target.value))}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={settings.monitoring.enableAutoRefresh}
                    onChange={(e) => handleChange('monitoring', 'enableAutoRefresh', e.target.checked)}
                    className="w-4 h-4 rounded border-dark-600 text-accent-500 focus:ring-accent-500"
                  />
                  <span className="text-dark-300">Enable Auto Refresh</span>
                </label>
              </div>
              <div>
                <label className="block text-sm text-dark-400 mb-1">Max Log Lines</label>
                <Input
                  type="number"
                  value={settings.monitoring.maxLogLines}
                  onChange={(e) => handleChange('monitoring', 'maxLogLines', parseInt(e.target.value))}
                />
              </div>
              <div>
                <label className="block text-sm text-dark-400 mb-1">Audit Retention (days)</label>
                <Input
                  type="number"
                  value={settings.monitoring.auditRetentionDays}
                  onChange={(e) => handleChange('monitoring', 'auditRetentionDays', parseInt(e.target.value))}
                />
              </div>
            </div>
          </div>
        );
      case 'network':
        return (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={settings.network.scanLocalPorts}
                    onChange={(e) => handleChange('network', 'scanLocalPorts', e.target.checked)}
                    className="w-4 h-4 rounded border-dark-600 text-accent-500 focus:ring-accent-500"
                  />
                  <span className="text-dark-300">Scan Local Ports (127.0.0.1)</span>
                </label>
              </div>
              <div className="sm:col-span-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={settings.network.scanExternalPorts}
                    onChange={(e) => handleChange('network', 'scanExternalPorts', e.target.checked)}
                    className="w-4 h-4 rounded border-dark-600 text-accent-500 focus:ring-accent-500"
                  />
                  <span className="text-dark-300">Scan External Ports (0.0.0.0/::)</span>
                </label>
              </div>
              <div className="sm:col-span-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={settings.network.resolveHostnames}
                    onChange={(e) => handleChange('network', 'resolveHostnames', e.target.checked)}
                    className="w-4 h-4 rounded border-dark-600 text-accent-500 focus:ring-accent-500"
                  />
                  <span className="text-dark-300">Resolve Hostnames</span>
                </label>
              </div>
              <div className="sm:col-span-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={settings.network.showProcessInfo}
                    onChange={(e) => handleChange('network', 'showProcessInfo', e.target.checked)}
                    className="w-4 h-4 rounded border-dark-600 text-accent-500 focus:ring-accent-500"
                  />
                  <span className="text-dark-300">Show Process Information</span>
                </label>
              </div>
              <div className="sm:col-span-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={settings.network.showContainerInfo}
                    onChange={(e) => handleChange('network', 'showContainerInfo', e.target.checked)}
                    className="w-4 h-4 rounded border-dark-600 text-accent-500 focus:ring-accent-500"
                  />
                  <span className="text-dark-300">Show Container Information</span>
                </label>
              </div>
            </div>
          </div>
        );
      case 'security':
        return (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={settings.security.enableAuth}
                    onChange={(e) => handleChange('security', 'enableAuth', e.target.checked)}
                    className="w-4 h-4 rounded border-dark-600 text-accent-500 focus:ring-accent-500"
                  />
                  <span className="text-dark-300">Enable Authentication</span>
                </label>
              </div>
              <div className="sm:col-span-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={settings.security.requireConfirmForActions}
                    onChange={(e) => handleChange('security', 'requireConfirmForActions', e.target.checked)}
                    className="w-4 h-4 rounded border-dark-600 text-accent-500 focus:ring-accent-500"
                  />
                  <span className="text-dark-300">Require Confirmation for Actions</span>
                </label>
              </div>
              <div className="sm:col-span-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={settings.security.logFailedAttempts}
                    onChange={(e) => handleChange('security', 'logFailedAttempts', e.target.checked)}
                    className="w-4 h-4 rounded border-dark-600 text-accent-500 focus:ring-accent-500"
                  />
                  <span className="text-dark-300">Log Failed Authorization Attempts</span>
                </label>
              </div>
              <div>
                <label className="block text-sm text-dark-400 mb-1">Session Timeout (seconds)</label>
                <Input
                  type="number"
                  value={settings.security.sessionTimeout}
                  onChange={(e) => handleChange('security', 'sessionTimeout', parseInt(e.target.value))}
                />
              </div>
              <div>
                <label className="block text-sm text-dark-400 mb-1">Max Failed Attempts</label>
                <Input
                  type="number"
                  value={settings.security.maxFailedAttempts}
                  onChange={(e) => handleChange('security', 'maxFailedAttempts', parseInt(e.target.value))}
                />
              </div>
            </div>
          </div>
        );
      case 'notifications':
        return (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={settings.notifications.enableToastNotifications}
                    onChange={(e) => handleChange('notifications', 'enableToastNotifications', e.target.checked)}
                    className="w-4 h-4 rounded border-dark-600 text-accent-500 focus:ring-accent-500"
                  />
                  <span className="text-dark-300">Enable Toast Notifications</span>
                </label>
              </div>
              <div className="sm:col-span-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={settings.notifications.notifyOnServiceFailure}
                    onChange={(e) => handleChange('notifications', 'notifyOnServiceFailure', e.target.checked)}
                    className="w-4 h-4 rounded border-dark-600 text-accent-500 focus:ring-accent-500"
                  />
                  <span className="text-dark-300">Notify on Service Failure</span>
                </label>
              </div>
              <div className="sm:col-span-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={settings.notifications.notifyOnContainerFailure}
                    onChange={(e) => handleChange('notifications', 'notifyOnContainerFailure', e.target.checked)}
                    className="w-4 h-4 rounded border-dark-600 text-accent-500 focus:ring-accent-500"
                  />
                  <span className="text-dark-300">Notify on Container Failure</span>
                </label>
              </div>
              <div className="sm:col-span-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={settings.notifications.notifyOnHighCpu}
                    onChange={(e) => handleChange('notifications', 'notifyOnHighCpu', e.target.checked)}
                    className="w-4 h-4 rounded border-dark-600 text-accent-500 focus:ring-accent-500"
                  />
                  <span className="text-dark-300">Notify on High CPU Usage</span>
                </label>
              </div>
              <div className="sm:col-span-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={settings.notifications.notifyOnHighMemory}
                    onChange={(e) => handleChange('notifications', 'notifyOnHighMemory', e.target.checked)}
                    className="w-4 h-4 rounded border-dark-600 text-accent-500 focus:ring-accent-500"
                  />
                  <span className="text-dark-300">Notify on High Memory Usage</span>
                </label>
              </div>
              <div>
                <label className="block text-sm text-dark-400 mb-1">CPU Alert Threshold (%)</label>
                <Input
                  type="number"
                  min="1"
                  max="100"
                  value={settings.notifications.cpuThreshold}
                  onChange={(e) => handleChange('notifications', 'cpuThreshold', parseInt(e.target.value))}
                />
              </div>
              <div>
                <label className="block text-sm text-dark-400 mb-1">Memory Alert Threshold (%)</label>
                <Input
                  type="number"
                  min="1"
                  max="100"
                  value={settings.notifications.memoryThreshold}
                  onChange={(e) => handleChange('notifications', 'memoryThreshold', parseInt(e.target.value))}
                />
              </div>
            </div>
          </div>
        );
      case 'appearance':
        return (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm text-dark-400 mb-1">Theme</label>
                <Select
                  value={settings.appearance.theme}
                  onChange={(e) => handleChange('appearance', 'theme', e.target.value)}
                >
                  <option value="dark">Dark</option>
                  <option value="light">Light</option>
                  <option value="system">System</option>
                </Select>
              </div>
              <div>
                <label className="block text-sm text-dark-400 mb-1">Font Size</label>
                <Select
                  value={settings.appearance.fontSize}
                  onChange={(e) => handleChange('appearance', 'fontSize', e.target.value)}
                >
                  <option value="small">Small</option>
                  <option value="medium">Medium</option>
                  <option value="large">Large</option>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={settings.appearance.compactMode}
                    onChange={(e) => handleChange('appearance', 'compactMode', e.target.checked)}
                    className="w-4 h-4 rounded border-dark-600 text-accent-500 focus:ring-accent-500"
                  />
                  <span className="text-dark-300">Compact Mode</span>
                </label>
              </div>
              <div className="sm:col-span-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={settings.appearance.showAnimations}
                    onChange={(e) => handleChange('appearance', 'showAnimations', e.target.checked)}
                    className="w-4 h-4 rounded border-dark-600 text-accent-500 focus:ring-accent-500"
                  />
                  <span className="text-dark-300">Show Animations</span>
                </label>
              </div>
              <div className="sm:col-span-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={settings.appearance.sidebarCollapsed}
                    onChange={(e) => handleChange('appearance', 'sidebarCollapsed', e.target.checked)}
                    className="w-4 h-4 rounded border-dark-600 text-accent-500 focus:ring-accent-500"
                  />
                  <span className="text-dark-300">Sidebar Collapsed by Default</span>
                </label>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-dark-100">Settings</h1>
          <p className="text-dark-400">Configure the Local System Control Center</p>
        </div>
        <Button variant="primary" onClick={() => handleSave(activeSection)} loading={saving} disabled={saving}>
          <Save className="w-4 h-4 mr-2" />
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : 'Save Changes'}
        </Button>
      </div>

      {saved && (
        <div className="fixed bottom-4 right-4 z-50 animate-slide-in">
          <div className="bg-accent-900/30 border border-accent-800 text-accent-400 px-4 py-3 rounded-lg shadow-lg flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            Settings saved successfully
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-4">
        <Card className="lg:col-span-1 h-fit sticky top-24">
          <CardHeader>
            <h2 className="text-lg font-semibold text-dark-100">Settings</h2>
          </CardHeader>
          <nav className="flex flex-col gap-1">
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={clsx(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                  activeSection === section.id
                    ? 'bg-accent-900/30 text-accent-400 border-l-2 border-accent-500'
                    : 'text-dark-300 hover:text-dark-100 hover:bg-dark-800/50'
                )}
              >
                <section.icon className="w-5 h-5 flex-shrink-0" />
                <span className="truncate">{section.name}</span>
              </button>
            ))}
          </nav>
        </Card>

        <div className="lg:col-span-3 space-y-6">
          {renderSection()}
        </div>
      </div>
    </div>
  );
}

export default Settings;