import axios, { AxiosRequestConfig } from 'axios';

const client = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

client.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message = error.response?.data?.detail || error.message || 'An error occurred';
    console.error('API Error:', message);
    return Promise.reject(new Error(message));
  }
);

// The response interceptor unwraps `response.data`, so the helpers below resolve
// with the payload itself instead of an axios response object.
const api = client as unknown as {
  get: <T = any>(url: string, config?: AxiosRequestConfig) => Promise<T>;
  post: <T = any>(url: string, data?: unknown, config?: AxiosRequestConfig) => Promise<T>;
};

export const systemApi = {
  listServices: (all = true, state?: string) =>
    api.get<any[]>('/system/services', { params: { all, state } }),
  getService: (name: string) =>
    api.get<any>(`/system/services/${name}`),
  serviceAction: (name: string, action: any) =>
    api.post<any>(`/system/services/${name}/action`, action),
  getServiceLogs: (name: string, lines = 100, since?: string) =>
    api.get<{ service: string; logs: string }>(`/system/services/${name}/logs`, { params: { lines, since } }),
  getAuditLogs: (params: any) =>
    api.get<any[]>('/system/audit', { params }),
  getAuditStats: () =>
    api.get<any>('/system/audit/stats'),
};

export const dockerApi = {
  listContainers: (all = true) =>
    api.get('/docker/containers', { params: { all } }),
  getContainer: (id: string) =>
    api.get(`/docker/containers/${id}`),
  containerAction: (id: string, action: any) =>
    api.post(`/docker/containers/${id}/action`, action),
  getContainerLogs: (id: string, params: any) =>
    api.get(`/docker/containers/${id}/logs`, { params }),
  updateRestartPolicy: (id: string, policy: string) =>
    api.post(`/docker/containers/${id}/restart-policy`, { policy }),
  listNetworks: () =>
    api.get('/docker/networks'),
  listVolumes: () =>
    api.get('/docker/volumes'),
  getInfo: () =>
    api.get('/docker/info'),
};

export const processesApi = {
  listProcesses: (params: any) =>
    api.get('/processes', { params }),
  getProcess: (pid: number) =>
    api.get(`/processes/${pid}`),
  getProcessTree: (pid: number) =>
    api.get(`/processes/${pid}/tree`),
  getProcessesByPort: (port: number) =>
    api.get(`/processes/port/${port}`),
  processAction: (pid: number, action: any) =>
    api.post(`/processes/${pid}/action`, action),
};

export const driversApi = {
  listModules: () =>
    api.get('/drivers/modules'),
  getModule: (name: string) =>
    api.get(`/drivers/modules/${name}`),
  getModuleInfo: (name: string) =>
    api.get(`/drivers/modules/${name}/info`),
  moduleAction: (name: string, action: any) =>
    api.post(`/drivers/modules/${name}/action`, action),
  listHardware: () =>
    api.get('/drivers/hardware'),
};

export const networkApi = {
  listPorts: (params: any) =>
    api.get('/network/ports', { params }),
  getPort: (port: number, protocol: string) =>
    api.get(`/network/ports/${port}/${protocol}`),
  listInterfaces: () =>
    api.get('/network/interfaces'),
  listConnections: () =>
    api.get('/network/connections'),
};

export const metricsApi = {
  getSystemMetrics: () =>
    api.get('/metrics/system'),
  getOverview: () =>
    api.get('/metrics/overview'),
  getHistory: () =>
    api.get('/metrics/history'),
  getServiceMetrics: (name: string) =>
    api.get(`/metrics/service/${name}`),
};

export default api;