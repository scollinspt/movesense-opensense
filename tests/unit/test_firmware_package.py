from __future__ import annotations

import json
import zipfile
from pathlib import Path

import pytest

from movesense_opensense.acquisition.firmware_package import (
    FirmwarePackageError,
    inspect_package,
)


def write_package(path: Path, manifest: dict[str, object]) -> None:
    with zipfile.ZipFile(path, "w") as archive:
        archive.writestr("manifest.json", json.dumps({"manifest": manifest}))
        archive.writestr("app.bin", b"application")
        archive.writestr("app.dat", b"init")
        archive.writestr("sd_bl.bin", b"system")
        archive.writestr("sd_bl.dat", b"system-init")


def test_inspects_application_and_bootloader_images(tmp_path: Path) -> None:
    package = tmp_path / "firmware.zip"
    write_package(
        package,
        {
            "application": {"bin_file": "app.bin", "dat_file": "app.dat"},
            "softdevice_bootloader": {
                "bin_file": "sd_bl.bin",
                "dat_file": "sd_bl.dat",
            },
        },
    )

    result = inspect_package(package)

    assert result["contains_bootloader"] is True
    assert result["application"]["bin_bytes"] == len(b"application")
    assert result["softdevice_bootloader"]["dat_file"] == "sd_bl.dat"
    assert len(result["sha256"]) == 64


def test_rejects_missing_application(tmp_path: Path) -> None:
    package = tmp_path / "firmware.zip"
    write_package(
        package,
        {
            "softdevice_bootloader": {
                "bin_file": "sd_bl.bin",
                "dat_file": "sd_bl.dat",
            }
        },
    )

    with pytest.raises(FirmwarePackageError, match="no application image"):
        inspect_package(package)


def test_rejects_unsafe_member_path(tmp_path: Path) -> None:
    package = tmp_path / "firmware.zip"
    with zipfile.ZipFile(package, "w") as archive:
        archive.writestr("../escape.bin", b"unsafe")
        archive.writestr("manifest.json", '{"manifest": {}}')

    with pytest.raises(FirmwarePackageError, match="Unsafe ZIP member"):
        inspect_package(package)
