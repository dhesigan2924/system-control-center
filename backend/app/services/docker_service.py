import asyncio
import json
from concurrent.futures import ThreadPoolExecutor
from typing import List, Optional, Dict, Any
from datetime import datetime

import docker
from docker.errors import DockerException, NotFound, APIError

from app.core.exceptions import DockerError, ResourceNotFoundError, OperationFailedError
from app.config import get_settings
from app.models.docker import (
    ContainerBase, ContainerState, ContainerHealth, RestartPolicy,
    ContainerAction, ContainerActionResponse, ContainerLogs,
    DockerNetwork, DockerVolume, DockerInfo
)


class DockerService:
    def __init__(self):
        self._client: Optional[docker.DockerClient] = None
        self._settings = get_settings()
        self._available = None

    def _get_client(self) -> Optional[docker.DockerClient]:
        if self._client is None:
            try:
                self._client = docker.DockerClient(
                    base_url=self._settings.docker_socket,
                    timeout=self._settings.docker_timeout,
                )
                self._client.ping()
                self._available = True
            except DockerException as e:
                self._available = False
                self._client = None
        return self._client

    def is_available(self) -> bool:
        if self._available is None:
            self._get_client()
        return self._available or False

    def list_containers(self, all: bool = True) -> List[ContainerBase]:
        client = self._get_client()
        if client is None:
            return []

        try:
            container_list = client.containers.list(all=all)
        except DockerException as e:
            raise DockerError(f"Failed to list containers: {e}")

        # Collecting the stats of a container takes about a second, so the
        # containers are queried in parallel instead of one after the other.
        with ThreadPoolExecutor(max_workers=min(16, max(1, len(container_list)))) as executor:
            containers = list(executor.map(self._parse_container, container_list))

        return containers

    def count_containers(self, state: Optional[ContainerState] = None) -> int:
        """Count containers without collecting the (slow) per container stats."""
        client = self._get_client()
        if client is None:
            return 0

        try:
            container_list = client.containers.list(all=True)
        except DockerException:
            return 0

        if state is None:
            return len(container_list)

        return len([
            c for c in container_list
            if c.attrs.get("State", {}).get("Status") == state.value
        ])

    def get_container(self, container_id: str) -> ContainerBase:
        client = self._get_client()
        if client is None:
            raise DockerError("Docker daemon is not available")
        try:
            container = client.containers.get(container_id)
            return self._parse_container(container)
        except NotFound:
            raise ResourceNotFoundError("Container", container_id)
        except DockerException as e:
            raise DockerError(f"Failed to get container: {e}")

    def _parse_container(self, container) -> ContainerBase:
        attrs = container.attrs
        state = attrs.get("State", {})
        host_config = attrs.get("HostConfig", {})
        network_settings = attrs.get("NetworkSettings", {})
        mounts = attrs.get("Mounts", [])

        ports = []
        port_bindings = host_config.get("PortBindings", {}) or {}
        exposed_ports = attrs.get("Config", {}).get("ExposedPorts", {}) or {}

        for port_spec in exposed_ports:
            port, proto = port_spec.split("/")
            binding = port_bindings.get(port_spec, [])
            host_port = binding[0]["HostPort"] if binding else None
            host_ip = binding[0]["HostIp"] if binding else None
            ports.append({
                "container_port": int(port),
                "protocol": proto,
                "host_port": int(host_port) if host_port else None,
                "host_ip": host_ip,
            })

        mount_list = []
        for mount in mounts:
            mount_list.append({
                "type": mount.get("Type"),
                "source": mount.get("Source"),
                "destination": mount.get("Destination"),
                "mode": mount.get("Mode"),
                "rw": mount.get("RW", False),
                "propagation": mount.get("Propagation"),
            })

        networks = []
        for net_name, net_info in (network_settings.get("Networks") or {}).items():
            networks.append(net_name)

        restart_policy = RestartPolicy.NO
        policy = host_config.get("RestartPolicy", {})
        if policy.get("Name"):
            restart_policy = RestartPolicy(policy["Name"])

        health = ContainerHealth.NONE
        health_status = state.get("Health", {})
        if health_status.get("Status"):
            health = ContainerHealth(health_status["Status"])

        cpu_percent = None
        memory_usage = None
        memory_limit = None
        stats = None
        try:
            stats = container.stats(stream=False)
            cpu_delta = stats["cpu_stats"]["cpu_usage"]["total_usage"] - stats["precpu_stats"]["cpu_usage"]["total_usage"]
            system_delta = stats["cpu_stats"]["system_cpu_usage"] - stats["precpu_stats"]["system_cpu_usage"]
            if system_delta > 0 and cpu_delta > 0:
                cpu_percent = (cpu_delta / system_delta) * len(stats["cpu_stats"]["cpu_usage"].get("percpu_usage", [1])) * 100.0
            memory_usage = stats["memory_stats"].get("usage")
            memory_limit = stats["memory_stats"].get("limit")
        except Exception:
            pass

        return ContainerBase(
            id=attrs["Id"],
            name=attrs["Name"].lstrip("/"),
            image=attrs["Config"]["Image"],
            image_id=attrs.get("Image"),
            state=ContainerState(state.get("Status", "unknown")),
            status=state.get("Status", "unknown"),
            created=datetime.fromisoformat(attrs["Created"].replace("Z", "+00:00")) if attrs.get("Created") else datetime.now(),
            started_at=datetime.fromisoformat(state["StartedAt"].replace("Z", "+00:00")) if state.get("StartedAt") and state["StartedAt"] != "0001-01-01T00:00:00Z" else None,
            finished_at=datetime.fromisoformat(state["FinishedAt"].replace("Z", "+00:00")) if state.get("FinishedAt") and state["FinishedAt"] != "0001-01-01T00:00:00Z" else None,
            ports=ports,
            mounts=mount_list,
            networks=networks,
            labels=attrs.get("Config", {}).get("Labels", {}) or {},
            env=attrs.get("Config", {}).get("Env", []) or [],
            command=" ".join(attrs.get("Config", {}).get("Cmd", []) or []),
            working_dir=attrs.get("Config", {}).get("WorkingDir"),
            restart_policy=restart_policy,
            restart_count=attrs.get("RestartCount", 0),
            health=health,
            cpu_percent=cpu_percent,
            memory_usage=memory_usage,
            memory_limit=memory_limit,
        )

    async def execute_action(self, container_id: str, action: ContainerAction) -> ContainerActionResponse:
        client = self._get_client()
        try:
            container = client.containers.get(container_id)
            previous_state = container.status

            if action.action in ["stop", "kill", "remove", "restart"]:
                if not action.confirm:
                    return ContainerActionResponse(
                        success=False,
                        message=f"Action {action.action} requires confirmation",
                        error="Confirmation required"
                    )

            if action.action == "start":
                container.start()
            elif action.action == "stop":
                container.stop(timeout=action.timeout or 10)
            elif action.action == "restart":
                container.restart(timeout=action.timeout or 10)
            elif action.action == "pause":
                container.pause()
            elif action.action == "unpause":
                container.unpause()
            elif action.action == "kill":
                container.kill()
            elif action.action == "remove":
                container.remove(force=True)
            else:
                raise OperationFailedError("docker", f"Unknown action: {action.action}")

            await asyncio.sleep(0.5)
            container.reload()

            return ContainerActionResponse(
                success=True,
                message=f"Container {action.action} completed successfully",
                previous_state=previous_state,
                new_state=container.status,
            )
        except NotFound:
            raise ResourceNotFoundError("Container", container_id)
        except Exception as e:
            return ContainerActionResponse(
                success=False,
                message=f"Failed to {action.action} container",
                error=str(e)
            )

    async def get_logs(self, container_id: str, tail: int = 100, since: Optional[datetime] = None, until: Optional[datetime] = None, follow: bool = False) -> str:
        client = self._get_client()
        try:
            container = client.containers.get(container_id)
            logs = container.logs(
                tail=tail,
                since=since,
                until=until,
                follow=follow,
                timestamps=True,
            )
            return logs.decode("utf-8", errors="replace")
        except NotFound:
            raise ResourceNotFoundError("Container", container_id)
        except Exception as e:
            raise DockerError(f"Failed to get logs: {e}")

    def list_networks(self) -> List[DockerNetwork]:
        client = self._get_client()
        if client is None:
            return []
        networks = []
        try:
            for network in client.networks.list():
                attrs = network.attrs
                containers = []
                for container_id, info in (attrs.get("Containers") or {}).items():
                    containers.append(info.get("Name", container_id))
                networks.append(DockerNetwork(
                    id=attrs["Id"],
                    name=attrs["Name"],
                    driver=attrs["Driver"],
                    scope=attrs["Scope"],
                    internal=attrs.get("Internal", False),
                    attachable=attrs.get("Attachable", False),
                    containers=containers,
                    labels=attrs.get("Labels", {}) or {},
                ))
        except DockerException as e:
            raise DockerError(f"Failed to list networks: {e}")
        return networks

    def list_volumes(self) -> List[DockerVolume]:
        client = self._get_client()
        if client is None:
            return []
        volumes = []
        try:
            for volume in client.volumes.list():
                attrs = volume.attrs
                volumes.append(DockerVolume(
                    name=attrs["Name"],
                    driver=attrs["Driver"],
                    mountpoint=attrs["Mountpoint"],
                    labels=attrs.get("Labels", {}) or {},
                    scope=attrs.get("Scope", "local"),
                    created_at=datetime.fromisoformat(attrs["CreatedAt"].replace("Z", "+00:00")) if attrs.get("CreatedAt") else None,
                ))
        except DockerException as e:
            raise DockerError(f"Failed to list volumes: {e}")
        return volumes

    def get_info(self) -> DockerInfo:
        client = self._get_client()
        if client is None:
            # Docker daemon is not reachable, report an empty info instead of failing
            return DockerInfo(
                containers=0,
                containers_running=0,
                containers_paused=0,
                containers_stopped=0,
                images=0,
                server_version="",
                storage_driver="",
                logging_driver="",
                cgroup_driver="",
                kernel_version="",
                operating_system="",
                architecture="",
                cpus=0,
                memory_total=0,
                memory_available=0,
            )
        try:
            info = client.info()
            return DockerInfo(
                containers=info.get("Containers", 0),
                containers_running=info.get("ContainersRunning", 0),
                containers_paused=info.get("ContainersPaused", 0),
                containers_stopped=info.get("ContainersStopped", 0),
                images=info.get("Images", 0),
                server_version=info.get("ServerVersion", ""),
                storage_driver=info.get("Driver", ""),
                logging_driver=info.get("LoggingDriver", ""),
                cgroup_driver=info.get("CgroupDriver", ""),
                kernel_version=info.get("KernelVersion", ""),
                operating_system=info.get("OperatingSystem", ""),
                architecture=info.get("Architecture", ""),
                cpus=info.get("NCPU", 0),
                memory_total=info.get("MemTotal", 0),
                memory_available=info.get("MemTotal", 0),
            )
        except DockerException as e:
            raise DockerError(f"Failed to get Docker info: {e}")

    async def update_restart_policy(self, container_id: str, policy: RestartPolicy) -> ContainerActionResponse:
        client = self._get_client()
        try:
            container = client.containers.get(container_id)
            container.update(restart_policy={"Name": policy.value})
            return ContainerActionResponse(
                success=True,
                message=f"Restart policy updated to {policy.value}",
                new_state=policy.value,
            )
        except NotFound:
            raise ResourceNotFoundError("Container", container_id)
        except Exception as e:
            return ContainerActionResponse(
                success=False,
                message="Failed to update restart policy",
                error=str(e)
            )


docker_service = DockerService()