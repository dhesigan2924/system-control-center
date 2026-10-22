import asyncio
import re
import socket
import psutil
from typing import List, Optional, Dict, Any
from ipaddress import ip_address

from app.core.utils import run_command, parse_ss_output
from app.core.exceptions import OperationFailedError
from app.models.network import (
    NetworkPortBase, Protocol, PortState, PortFilter,
    NetworkInterface, NetworkConnection
)


class NetworkService:
    def __init__(self):
        self._port_cache: List[NetworkPortBase] = []

    async def list_listening_ports(self, filter: Optional[PortFilter] = None) -> List[NetworkPortBase]:
        ports = await self._get_ports_from_ss()
        ports += self._get_ports_from_psutil()

        unique_ports = {}
        for port in ports:
            key = (port.protocol, port.port, port.local_ip)
            if key not in unique_ports:
                unique_ports[key] = port

        result = list(unique_ports.values())

        if filter:
            result = self._apply_filter(result, filter)

        return result

    async def _get_ports_from_ss(self) -> List[NetworkPortBase]:
        # -H omits the header, so the columns are always:
        # netid state recv-q send-q local-address peer-address process
        result = await run_command(["ss", "-tulnpH"])
        ports = []

        for line in result.stdout.strip().split('\n'):
            if not line.strip():
                continue

            parts = line.split()
            if len(parts) < 5:
                continue

            netid = parts[0].lower()
            state = parts[1].upper()
            local_addr = parts[4]
            process_info = ' '.join(parts[6:]) if len(parts) > 6 else ''

            # TCP sockets are LISTEN, UDP sockets are bound (UNCONN)
            if state != 'LISTEN' and not (netid.startswith('udp') and state == 'UNCONN'):
                continue

            ip, port_str = self._parse_address(local_addr)
            if not port_str:
                continue

            pid, process_name = self._parse_process_info(process_info)
            protocol = self._protocol_from_netid(netid)

            port = NetworkPortBase(
                port=int(port_str),
                protocol=protocol,
                local_address=local_addr,
                local_ip=ip,
                state=PortState.LISTEN,
                pid=pid,
                process_name=process_name,
                is_localhost=ip in ("127.0.0.1", "::1", "0.0.0.0", "::", "*"),
                is_external=ip not in ("127.0.0.1", "::1", "0.0.0.0", "::", "*") and not ip.startswith("127."),
            )
            ports.append(port)

        return ports

    def _get_ports_from_psutil(self) -> List[NetworkPortBase]:
        ports = []
        try:
            for conn in psutil.net_connections(kind='inet'):
                if conn.status != 'LISTEN':
                    continue

                local_ip = conn.laddr.ip if conn.laddr else ""
                local_port = conn.laddr.port if conn.laddr else 0
                pid = conn.pid
                process_name = None

                if pid:
                    try:
                        proc = psutil.Process(pid)
                        process_name = proc.name()
                    except (psutil.NoSuchProcess, psutil.AccessDenied):
                        pass

                protocol = Protocol.TCP if conn.type == socket.SOCK_STREAM else Protocol.UDP

                port = NetworkPortBase(
                    port=local_port,
                    protocol=protocol,
                    local_address=f"{local_ip}:{local_port}",
                    local_ip=local_ip,
                    state=PortState.LISTEN,
                    pid=pid,
                    process_name=process_name,
                    is_localhost=local_ip in ("127.0.0.1", "::1", "0.0.0.0", "::"),
                    is_external=local_ip not in ("127.0.0.1", "::1") and not local_ip.startswith("127."),
                )
                ports.append(port)
        except Exception:
            pass

        return ports

    def _parse_address(self, addr: str) -> tuple:
        if ']:' in addr:
            ip = addr.split(']:')[0].strip('[')
            port = addr.split(']:')[1]
        elif addr.count(':') == 1:
            ip, port = addr.split(':')
        else:
            parts = addr.rsplit(':', 1)
            if len(parts) == 2:
                ip, port = parts
            else:
                return "", ""
        # strip the interface scope, e.g. "127.0.0.53%lo" -> "127.0.0.53"
        ip = ip.split('%')[0]
        return ip, port

    def _parse_process_info(self, process_str: str) -> tuple:
        pid = None
        name = None
        match = re.search(r'pid=(\d+)', process_str)
        if match:
            pid = int(match.group(1))
        # ss prints: users:(("kdeconnectd",pid=2647,fd=32))
        match = re.search(r'"([^"]+)"', process_str)
        if match:
            name = match.group(1)
        return pid, name

    def _determine_protocol(self, addr: str) -> Protocol:
        if addr.startswith('['):
            return Protocol.TCP6 if 'tcp' in addr.lower() else Protocol.UDP6
        return Protocol.TCP if 'tcp' in addr.lower() else Protocol.UDP

    @staticmethod
    def _protocol_from_netid(netid: str) -> Protocol:
        mapping = {
            'tcp': Protocol.TCP,
            'tcp6': Protocol.TCP6,
            'udp': Protocol.UDP,
            'udp6': Protocol.UDP6,
        }
        return mapping.get(netid, Protocol.TCP)

    @staticmethod
    def _parse_state(status: Optional[str]) -> PortState:
        if not status:
            return PortState.UNKNOWN
        try:
            return PortState(status.lower())
        except ValueError:
            return PortState.UNKNOWN

    def _apply_filter(self, ports: List[NetworkPortBase], filter: PortFilter) -> List[NetworkPortBase]:
        result = ports
        if filter.protocol:
            result = [p for p in result if p.protocol == filter.protocol]
        if filter.state:
            result = [p for p in result if p.state == filter.state]
        if filter.port:
            result = [p for p in result if p.port == filter.port]
        if filter.pid:
            result = [p for p in result if p.pid == filter.pid]
        if filter.process_name:
            result = [p for p in result if filter.process_name.lower() in (p.process_name or "").lower()]
        if filter.local_only:
            result = [p for p in result if p.is_localhost]
        if filter.external_only:
            result = [p for p in result if p.is_external]
        return result

    async def get_port_details(self, port: int, protocol: Protocol) -> Optional[NetworkPortBase]:
        ports = await self.list_listening_ports(PortFilter(port=port, protocol=protocol))
        return ports[0] if ports else None

    async def list_interfaces(self) -> List[NetworkInterface]:
        interfaces = []
        try:
            stats = psutil.net_if_stats()
            addrs = psutil.net_if_addrs()
            io_counters = psutil.net_io_counters(pernic=True)

            for name, stat in stats.items():
                ipv4 = []
                ipv6 = []
                mac = None

                for addr in addrs.get(name, []):
                    if addr.family == 2:
                        ipv4.append(addr.address)
                    elif addr.family == 10:
                        ipv6.append(addr.address)
                    elif addr.family == 17:
                        mac = addr.address

                counters = io_counters.get(name)
                statistics = {}
                if counters:
                    statistics = {
                        "bytes_sent": counters.bytes_sent,
                        "bytes_recv": counters.bytes_recv,
                        "packets_sent": counters.packets_sent,
                        "packets_recv": counters.packets_recv,
                        "errin": counters.errin,
                        "errout": counters.errout,
                        "dropin": counters.dropin,
                        "dropout": counters.dropout,
                    }

                flags = []
                if stat.isup:
                    flags.append("UP")
                if stat.isrunning:
                    flags.append("RUNNING")
                if not stat.isup:
                    flags.append("DOWN")

                interfaces.append(NetworkInterface(
                    name=name,
                    index=0,
                    mtu=stat.mtu,
                    flags=flags,
                    ipv4_addresses=ipv4,
                    ipv6_addresses=ipv6,
                    mac_address=mac,
                    speed=stat.speed,
                    duplex=stat.duplex.name if stat.duplex else None,
                    operstate="up" if stat.isup else "down",
                    statistics=statistics,
                ))
        except Exception:
            pass

        return interfaces

    async def list_connections(self) -> List[NetworkConnection]:
        connections = []
        try:
            for conn in psutil.net_connections(kind='inet'):
                protocol = Protocol.TCP if conn.type == socket.SOCK_STREAM else Protocol.UDP
                state = self._parse_state(conn.status)

                process_name = None
                if conn.pid:
                    try:
                        proc = psutil.Process(conn.pid)
                        process_name = proc.name()
                    except (psutil.NoSuchProcess, psutil.AccessDenied):
                        pass

                connections.append(NetworkConnection(
                    protocol=protocol,
                    local_address=f"{conn.laddr.ip}:{conn.laddr.port}" if conn.laddr else "",
                    local_port=conn.laddr.port if conn.laddr else 0,
                    remote_address=f"{conn.raddr.ip}:{conn.raddr.port}" if conn.raddr else "",
                    remote_port=conn.raddr.port if conn.raddr else 0,
                    state=state,
                    pid=conn.pid,
                    process_name=process_name,
                    uid=None,
                ))
        except Exception:
            pass

        return connections


network_service = NetworkService()