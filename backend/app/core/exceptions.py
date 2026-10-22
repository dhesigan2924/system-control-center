class AppException(Exception):
    def __init__(self, message: str, code: str = "INTERNAL_ERROR", status_code: int = 500, details: dict = None):
        self.message = message
        self.code = code
        self.status_code = status_code
        self.details = details or {}
        super().__init__(message)


class PermissionDeniedError(AppException):
    def __init__(self, message: str = "Permission denied", details: dict = None):
        super().__init__(message, "PERMISSION_DENIED", 403, details)


class ResourceNotFoundError(AppException):
    def __init__(self, resource: str, identifier: str, details: dict = None):
        super().__init__(
            f"{resource} not found: {identifier}",
            "NOT_FOUND",
            404,
            {"resource": resource, "identifier": identifier, **(details or {})}
        )


class ValidationError(AppException):
    def __init__(self, message: str, details: dict = None):
        super().__init__(message, "VALIDATION_ERROR", 400, details)


class OperationFailedError(AppException):
    def __init__(self, operation: str, message: str, details: dict = None):
        super().__init__(
            f"{operation} failed: {message}",
            "OPERATION_FAILED",
            500,
            {"operation": operation, **(details or {})}
        )


class ServiceUnavailableError(AppException):
    def __init__(self, service: str, message: str = "Service unavailable", details: dict = None):
        super().__init__(
            f"{service}: {message}",
            "SERVICE_UNAVAILABLE",
            503,
            {"service": service, **(details or {})}
        )


class DockerError(AppException):
    def __init__(self, message: str, details: dict = None):
        super().__init__(message, "DOCKER_ERROR", 500, details)


class SystemdError(AppException):
    def __init__(self, message: str, details: dict = None):
        super().__init__(message, "SYSTEMD_ERROR", 500, details)