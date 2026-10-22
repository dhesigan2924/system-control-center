from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from enum import Enum


class ModuleState(str, Enum):
    LIVE = "live"
    LOADING = "loading"
    UNLOADING = "unloading"
    UNKNOWN = "unknown"


class DriverCategory(str, Enum):
    NETWORK = "network"
    STORAGE = "storage"
    USB = "usb"
    AUDIO = "audio"
    GRAPHICS = "graphics"
    INPUT = "input"
    BLUETOOTH = "bluetooth"
    WIRELESS = "wireless"
    FILESYSTEM = "filesystem"
    CRYPTO = "crypto"
    VIRTUALIZATION = "virtualization"
    POWER = "power"
    SENSORS = "sensors"
    OTHER = "other"


class KernelModuleBase(BaseModel):
    name: str
    size: int
    used_by: int
    dependencies: List[str] = []
    state: ModuleState = ModuleState.UNKNOWN
    refcount: Optional[int] = None
    init_state: Optional[str] = None
    module_path: Optional[str] = None
    version: Optional[str] = None
    src_version: Optional[str] = None
    vermagic: Optional[str] = None
    parameters: Dict[str, str] = {}
    sections: Dict[str, Dict[str, Any]] = {}
    description: Optional[str] = None
    author: Optional[str] = None
    license: Optional[str] = None
    alias: List[str] = []
    depends: List[str] = []
    category: DriverCategory = DriverCategory.OTHER


class KernelModuleResponse(KernelModuleBase):
    pass


class ModuleAction(BaseModel):
    action: str = Field(pattern="^(load|unload|info)$")
    confirm: bool = True
    force: bool = False


class ModuleActionResponse(BaseModel):
    success: bool
    message: str
    module: str
    error: Optional[str] = None


class HardwareDevice(BaseModel):
    path: str
    name: Optional[str] = None
    driver: Optional[str] = None
    vendor_id: Optional[str] = None
    device_id: Optional[str] = None
    subsystem: Optional[str] = None
    device_type: Optional[str] = None
    class_id: Optional[str] = None
    attributes: Dict[str, str] = {}
    capabilities: List[str] = []
    parent: Optional[str] = None
    children: List[str] = []


class DriverInfo(BaseModel):
    module_name: str
    module_path: Optional[str] = None
    version: Optional[str] = None
    description: Optional[str] = None
    author: Optional[str] = None
    license: Optional[str] = None
    supported_devices: List[Dict[str, str]] = []
    firmware_files: List[str] = []
    parameters: Dict[str, Dict[str, Any]] = {}