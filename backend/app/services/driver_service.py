import asyncio
import json
import re
import os
from pathlib import Path
from typing import List, Optional, Dict, Any

from app.core.utils import run_command, run_command_sync, parse_lsmod_output
from app.core.exceptions import ResourceNotFoundError, OperationFailedError
from app.models.drivers import (
    KernelModuleBase, ModuleState, DriverCategory, HardwareDevice,
    DriverInfo, ModuleAction, ModuleActionResponse
)


class DriverService:
    def __init__(self):
        self._module_cache: Dict[str, KernelModuleBase] = {}
        self._category_map = self._build_category_map()
        self._cache_file = Path(__file__).resolve().parents[2] / "data" / "module_info_cache.json"
        self._load_disk_cache()

    def _load_disk_cache(self) -> None:
        """Reuse the modinfo results of a previous run, modinfo is expensive."""
        try:
            with open(self._cache_file, "r") as f:
                payload = json.load(f)
            for name, data in payload.items():
                self._module_cache[name] = KernelModuleBase(**data)
        except (OSError, ValueError, TypeError):
            pass

    def _save_disk_cache(self) -> None:
        try:
            self._cache_file.parent.mkdir(parents=True, exist_ok=True)
            payload = {name: info.model_dump(mode="json") for name, info in self._module_cache.items()}
            with open(self._cache_file, "w") as f:
                json.dump(payload, f)
        except (OSError, ValueError, TypeError):
            pass

    def _build_category_map(self) -> Dict[str, DriverCategory]:
        return {
            'net': DriverCategory.NETWORK,
            'ethernet': DriverCategory.NETWORK,
            'wifi': DriverCategory.WIRELESS,
            'bluetooth': DriverCategory.BLUETOOTH,
            'usb': DriverCategory.USB,
            'scsi': DriverCategory.STORAGE,
            'nvme': DriverCategory.STORAGE,
            'sata': DriverCategory.STORAGE,
            'ahci': DriverCategory.STORAGE,
            'raid': DriverCategory.STORAGE,
            'sound': DriverCategory.AUDIO,
            'snd': DriverCategory.AUDIO,
            'video': DriverCategory.GRAPHICS,
            'drm': DriverCategory.GRAPHICS,
            'gpu': DriverCategory.GRAPHICS,
            'input': DriverCategory.INPUT,
            'hid': DriverCategory.INPUT,
            'fs': DriverCategory.FILESYSTEM,
            'ext4': DriverCategory.FILESYSTEM,
            'xfs': DriverCategory.FILESYSTEM,
            'btrfs': DriverCategory.FILESYSTEM,
            'crypto': DriverCategory.CRYPTO,
            'kvm': DriverCategory.VIRTUALIZATION,
            'vbox': DriverCategory.VIRTUALIZATION,
            'vmware': DriverCategory.VIRTUALIZATION,
            'acpi': DriverCategory.POWER,
            'thermal': DriverCategory.POWER,
            'battery': DriverCategory.POWER,
            'hwmon': DriverCategory.SENSORS,
            'i2c': DriverCategory.SENSORS,
            'spi': DriverCategory.SENSORS,
        }

    def _categorize_module(self, name: str) -> DriverCategory:
        name_lower = name.lower()
        for keyword, category in self._category_map.items():
            if keyword in name_lower:
                return category
        return DriverCategory.OTHER

    async def list_modules(self) -> List[KernelModuleBase]:
        result = await run_command(["lsmod"])
        modules = parse_lsmod_output(result.stdout)

        # modinfo is executed for every module, so run them concurrently instead
        # of spawning one subprocess after the other.
        semaphore = asyncio.Semaphore(32)

        async def enrich(module: Dict[str, Any]) -> KernelModuleBase:
            name = module["module"]
            async with semaphore:
                info = await self.get_module_info(name)
            # lsmod reports the size in KiB and the usage count as a string
            info.size = self._parse_int(module.get("size")) * 1024
            info.used_by = self._parse_int(module.get("used_by"))
            info.dependencies = module["dependencies"]
            return info

        enriched = await asyncio.gather(*(enrich(module) for module in modules))
        self._save_disk_cache()
        return list(enriched)

    @staticmethod
    def _parse_int(value: Any) -> int:
        try:
            return int(value)
        except (TypeError, ValueError):
            return 0

    async def get_module_info(self, name: str) -> KernelModuleBase:
        if name in self._module_cache:
            return self._module_cache[name]

        try:
            result = await run_command(["modinfo", name])
            info = self._parse_modinfo(result.stdout)
            info.name = name
            info.category = self._categorize_module(name)
            self._apply_init_state(info, name)
            self._module_cache[name] = info
            return info
        except Exception as e:
            return KernelModuleBase(
                name=name,
                size=0,
                used_by=0,
                state=ModuleState.UNKNOWN,
                category=self._categorize_module(name),
            )

    def _apply_init_state(self, info: KernelModuleBase, name: str) -> None:
        """Read the module init state from sysfs (/sys/module/<name>/initstate)."""
        try:
            with open(f"/sys/module/{name}/initstate", "r") as f:
                init_state = f.read().strip()
        except OSError:
            return

        if not init_state:
            return

        info.init_state = init_state
        states = {
            "live": ModuleState.LIVE,
            "loading": ModuleState.LOADING,
            "unloading": ModuleState.UNLOADING,
        }
        if init_state in states:
            info.state = states[init_state]

    def _parse_modinfo(self, output: str) -> KernelModuleBase:
        info = KernelModuleBase(
            name="",
            size=0,
            used_by=0,
        )

        for line in output.strip().split('\n'):
            if ':' not in line:
                continue
            key, value = line.split(':', 1)
            key = key.strip().lower()
            value = value.strip()

            if key == 'filename':
                info.module_path = value
            elif key == 'version':
                info.version = value
            elif key == 'description':
                info.description = value
            elif key == 'author':
                info.author = value
            elif key == 'license':
                info.license = value
            elif key == 'srcversion':
                info.src_version = value
            elif key == 'vermagic':
                info.vermagic = value
            elif key == 'depends':
                info.depends = [d.strip() for d in value.split(',') if d.strip()]
            elif key == 'alias':
                info.alias.append(value)
            elif key == 'parm':
                match = re.match(r'(\w+):\s*(.*)', value)
                if match:
                    param_name, param_desc = match.groups()
                    info.parameters[param_name] = param_desc

        return info

    async def list_hardware_devices(self) -> List[HardwareDevice]:
        devices = []

        try:
            result = await run_command(["find", "/sys/bus", "-maxdepth", "3", "-name", "uevent"])
            for line in result.stdout.strip().split('\n'):
                if not line:
                    continue
                device = await self._parse_sysfs_device(line)
                if device:
                    devices.append(device)
        except Exception:
            pass

        return devices

    async def _parse_sysfs_device(self, uevent_path: str) -> Optional[HardwareDevice]:
        try:
            device_dir = os.path.dirname(uevent_path)
            relative_path = device_dir.replace("/sys/", "")

            # Read the uevent file directly instead of spawning a `cat` process.
            # Some sysfs entries are only readable by root, in that case the
            # device is still listed but without attributes.
            try:
                with open(uevent_path, "r") as f:
                    content = f.read()
            except OSError:
                content = ""

            attrs = {}
            for line in content.strip().split('\n'):
                if '=' in line:
                    key, value = line.split('=', 1)
                    attrs[key] = value

            driver = None
            driver_link = os.path.join(device_dir, "driver")
            if os.path.islink(driver_link):
                driver = os.path.basename(os.readlink(driver_link))

            return HardwareDevice(
                path=relative_path,
                name=attrs.get("DEVNAME") or attrs.get("NAME"),
                driver=driver,
                vendor_id=attrs.get("VENDOR_ID") or attrs.get("ID_VENDOR_ID"),
                device_id=attrs.get("DEVICE_ID") or attrs.get("ID_MODEL_ID"),
                subsystem=attrs.get("SUBSYSTEM"),
                device_type=attrs.get("DEVTYPE"),
                class_id=attrs.get("CLASS"),
                attributes=attrs,
            )
        except Exception:
            return None

    async def get_driver_info(self, module_name: str) -> DriverInfo:
        mod = await self.get_module_info(module_name)
        return DriverInfo(
            module_name=mod.name,
            module_path=mod.module_path,
            version=mod.version,
            description=mod.description,
            author=mod.author,
            license=mod.license,
            supported_devices=[{"alias": a} for a in mod.alias],
            firmware_files=[],
            parameters={p: {"description": d} for p, d in mod.parameters.items()},
        )

    async def execute_action(self, name: str, action: ModuleAction) -> ModuleActionResponse:
        if action.action in ["load", "unload"] and not action.confirm:
            return ModuleActionResponse(
                success=False,
                message=f"Module {action.action} requires confirmation",
                module=name,
                error="Confirmation required"
            )

        try:
            if action.action == "load":
                cmd = ["modprobe", name]
                if action.force:
                    cmd.append("--force")
                await run_command(cmd, check=True)
                message = f"Module {name} loaded successfully"
            elif action.action == "unload":
                if not await self._can_unload(name):
                    return ModuleActionResponse(
                        success=False,
                        message=f"Module {name} is in use or has dependents",
                        module=name,
                        error="Module busy"
                    )
                cmd = ["modprobe", "-r", name]
                if action.force:
                    cmd.append("--force")
                await run_command(cmd, check=True)
                message = f"Module {name} unloaded successfully"
            elif action.action == "info":
                info = await self.get_module_info(name)
                return ModuleActionResponse(
                    success=True,
                    message=f"Module info retrieved",
                    module=name,
                )
            else:
                raise OperationFailedError("driver", f"Unknown action: {action.action}")

            if name in self._module_cache:
                del self._module_cache[name]

            return ModuleActionResponse(
                success=True,
                message=message,
                module=name,
            )
        except Exception as e:
            return ModuleActionResponse(
                success=False,
                message=f"Failed to {action.action} module",
                module=name,
                error=str(e)
            )

    async def _can_unload(self, name: str) -> bool:
        try:
            result = await run_command(["lsmod"])
            for line in result.stdout.strip().split('\n'):
                parts = line.split()
                if len(parts) >= 3 and parts[0] == name:
                    if int(parts[2]) > 0:
                        return False
            return True
        except Exception:
            return False


driver_service = DriverService()