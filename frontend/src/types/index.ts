export type ServiceState = 'active' | 'inactive' | 'failed' | 'activating' | 'deactivating' | 'reloading' | 'unknown';
export type ServiceType = 'systemd' | 'docker' | 'process' | 'driver';

export interface Service {
  id: string;
  name: string;
  display_name: string | null;
  description: string | null;
  service_type: ServiceType;
  state: ServiceState;
  enabled: boolean | null;
  pid: number | null;
  cpu_percent: number | null;
  memory_kb: number | null;
  uptime_seconds: number | null;
  load_state: string | null;
  active_state: string | null;
  sub_state: string | null;
  fragment_path: string | null;
  exec_start: string | null;
  exec_stop: string | null;
  environment: Record<string, string> | null;
  dependencies: string[] | null;
}

export interface ServiceAction {
  action: 'start' | 'stop' | 'restart' | 'reload' | 'enable' | 'disable';
  confirm: boolean;
}

export interface ServiceActionResponse {
  success: boolean;
  message: string;
  previous_state: string | null;
  new_state: string | null;
  error: string | null;
}

export type ContainerState = 'created' | 'running' | 'paused' | 'restarting' | 'removing' | 'exited' | 'dead' | 'unknown';
export type ContainerHealth = 'healthy' | 'unhealthy' | 'starting' | 'none';
export type RestartPolicy = 'no' | 'on-failure' | 'always' | 'unless-stopped';

export interface ContainerPort {
  container_port: number;
  protocol: string;
  host_port: number | null;
  host_ip: string | null;
}

export interface Container {
  id: string;
  name: string;
  image: string;
  image_id: string | null;
  state: ContainerState;
  status: string;
  created: string;
  started_at: string | null;
  finished_at: string | null;
  ports: ContainerPort[];
  mounts: any[];
  networks: string[];
  labels: Record<string, string>;
  env: string[];
  command: string | null;
  working_dir: string | null;
  restart_policy: RestartPolicy;
  restart_count: number;
  health: ContainerHealth;
  cpu_percent: number | null;
  memory_usage: number | null;
  memory_limit: number | null;
  network_rx: number | null;
  network_tx: number | null;
  block_read: number | null;
  block_write: number | null;
  pids: number | null;
}

export interface ContainerAction {
  action: 'start' | 'stop' | 'restart' | 'pause' | 'unpause' | 'kill' | 'remove';
  confirm: boolean;
  timeout?: number;
}

export interface ContainerActionResponse {
  success: boolean;
  message: string;
  previous_state: string | null;
  new_state: string | null;
  error: string | null;
}

export type ProcessState = 'running' | 'sleeping' | 'disk_sleep' | 'stopped' | 'tracing_stop' | 'zombie' | 'dead' | 'wake_kill' | 'waking' | 'idle' | 'unknown';

export interface Process {
  pid: number;
  ppid: number | null;
  name: string;
  cmdline: string[];
  username: string | null;
  state: ProcessState;
  cpu_percent: number | null;
  memory_percent: number | null;
  memory_rss: number | null;
  memory_vms: number | null;
  create_time: string | null;
  num_threads: number | null;
  open_files: number | null;
  connections: any[];
  environ: Record<string, string>;
  cwd: string | null;
  exe: string | null;
  status: string | null;
  nice: number | null;
  ionice: number | null;
  rlimit: Record<string, number> | null;
  io_counters: Record<string, number> | null;
  cpu_times: Record<string, number> | null;
  cpu_affinity: number[] | null;
  memory_info: Record<string, number> | null;
  memory_full_info: Record<string, number> | null;
  children: number[] | null;
}

export interface ProcessAction {
  action: 'stop' | 'kill' | 'terminate';
  confirm: boolean;
  signal?: number;
}

export interface ProcessActionResponse {
  success: boolean;
  message: string;
  pid: number;
  previous_state: string | null;
  error: string | null;
}

export type ModuleState = 'live' | 'loading' | 'unloading' | 'unknown';
export type DriverCategory = 'network' | 'storage' | 'usb' | 'audio' | 'graphics' | 'input' | 'bluetooth' | 'wireless' | 'filesystem' | 'crypto' | 'virtualization' | 'power' | 'sensors' | 'other';

export interface KernelModule {
  name: string;
  size: number;
  used_by: number;
  dependencies: string[];
  state: ModuleState;
  refcount: number | null;
  init_state: string | null;
  src_version: string | null;
  vermagic: string | null;
  parameters: Record<string, string>;
  sections: Record<string, any>;
  description: string | null;
  author: string | null;
  license: string | null;
  alias: string[];
  depends: string[];
  category: DriverCategory;
}

export interface HardwareDevice {
  path: string;
  name: string | null;
  driver: string | null;
  vendor_id: string | null;
  device_id: string | null;
  subsystem: string | null;
  device_type: string | null;
  class_id: string | null;
  attributes: Record<string, string>;
  capabilities: string[];
  parent: string | null;
  children: string[];
}

export interface ModuleAction {
  action: 'load' | 'unload' | 'info';
  confirm: boolean;
  force?: boolean;
}

export interface ModuleActionResponse {
  success: boolean;
  message: string;
  module: string;
  error: string | null;
}

export type Protocol = 'tcp' | 'udp' | 'tcp6' | 'udp6';
export type PortState = 'listen' | 'established' | 'syn_sent' | 'syn_recv' | 'fin_wait1' | 'fin_wait2' | 'time_wait' | 'close' | 'close_wait' | 'last_ack' | 'closing' | 'unknown';

export interface NetworkPort {
  port: number;
  protocol: Protocol;
  local_address: string;
  local_ip: string;
  state: PortState;
  pid: number | null;
  process_name: string | null;
  process_cmdline: string | null;
  service_name: string | null;
  container_id: string | null;
  container_name: string | null;
  inode: number | null;
  uid: number | null;
  is_localhost: boolean;
  is_external: boolean;
}

export interface NetworkInterface {
  name: string;
  index: number;
  mtu: number;
  flags: string[];
  ipv4_addresses: string[];
  ipv6_addresses: string[];
  mac_address: string | null;
  speed: number | null;
  duplex: string | null;
  operstate: string;
  carrier: boolean | null;
  statistics: Record<string, number>;
}

export interface NetworkConnection {
  protocol: Protocol;
  local_address: string;
  local_port: number;
  remote_address: string;
  remote_port: number;
  state: PortState;
  pid: number | null;
  process_name: string | null;
  uid: number | null;
  inode: number | null;
  timer: string | null;
  rx_queue: number | null;
  tx_queue: number | null;
}

export type AuditAction = 'start' | 'stop' | 'restart' | 'enable' | 'disable' | 'reload' | 'pause' | 'unpause' | 'kill' | 'terminate' | 'load' | 'unload' | 'create' | 'remove' | 'update';
export type AuditResult = 'success' | 'failed' | 'denied' | 'partial';

export interface AuditLog {
  id: number;
  timestamp: string;
  resource_type: string;
  resource_name: string;
  resource_id: string | null;
  action: AuditAction;
  previous_state: string | null;
  resulting_state: string | null;
  result: AuditResult;
  error_details: string | null;
  user_identity: string | null;
  interface: string | null;
}

export interface AuditFilter {
  resource_type?: string;
  resource_name?: string;
  action?: AuditAction;
  result?: AuditResult;
  user_identity?: string;
  start_time?: string;
  end_time?: string;
  limit: number;
  offset: number;
}

export interface AuditStats {
  total_events: number;
  success_count: number;
  failed_count: number;
  denied_count: number;
  by_action: Record<string, number>;
  by_resource_type: Record<string, number>;
  by_user: Record<string, number>;
  recent_failures: AuditLog[];
}

export interface SystemOverview {
  total_services: number;
  running_services: number;
  stopped_services: number;
  failed_services: number;
  active_ports: number;
  running_containers: number;
  loaded_modules: number;
  recent_failures: number;
  cpu_percent: number;
  memory_percent: number;
  disk_percent: number;
  uptime: string;
}