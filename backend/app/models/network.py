from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from enum import Enum
from ipaddress import IPv4Address, IPv6Address


class Protocol(str, Enum):
    TCP = "tcp"
    UDP = "udp"
    TCP6 = "tcp6"
    UDP6 = "udp6"


class PortState(str, Enum):
    LISTEN = "listen"
    ESTABLISHED = "established"
    SYN_SENT = "syn_sent"
    SYN_RECV = "syn_recv"
    FIN_WAIT1 = "fin_wait1"
    FIN_WAIT2 = "fin_wait2"
    TIME_WAIT = "time_wait"
    CLOSE = "close"
    CLOSE_WAIT = "close_wait"
    LAST_ACK = "last_ack"
    CLOSING = "closing"
    UNKNOWN = "unknown"


class NetworkPortBase(BaseModel):
    port: int
    protocol: Protocol
    local_address: str
    local_ip: str
    state: PortState
    pid: Optional[int] = None
    process_name: Optional[str] = None
    process_cmdline: Optional[str] = None
    service_name: Optional[str] = None
    container_id: Optional[str] = None
    container_name: Optional[str] = None
    inode: Optional[int] = None
    uid: Optional[int] = None
    is_localhost: bool = False
    is_external: bool = False


class NetworkPortResponse(NetworkPortBase):
    pass


class PortFilter(BaseModel):
    protocol: Optional[Protocol] = None
    state: Optional[PortState] = None
    port: Optional[int] = None
    pid: Optional[int] = None
    process_name: Optional[str] = None
    local_only: bool = False
    external_only: bool = False


class NetworkInterface(BaseModel):
    name: str
    index: int
    mtu: int
    flags: List[str] = []
    ipv4_addresses: List[str] = []
    ipv6_addresses: List[str] = []
    mac_address: Optional[str] = None
    speed: Optional[int] = None
    duplex: Optional[str] = None
    operstate: str
    carrier: Optional[bool] = None
    statistics: Dict[str, int] = {}


class NetworkConnection(BaseModel):
    protocol: Protocol
    local_address: str
    local_port: int
    remote_address: str
    remote_port: int
    state: PortState
    pid: Optional[int] = None
    process_name: Optional[str] = None
    uid: Optional[int] = None
    inode: Optional[int] = None
    timer: Optional[str] = None
    rx_queue: Optional[int] = None
    tx_queue: Optional[int] = None