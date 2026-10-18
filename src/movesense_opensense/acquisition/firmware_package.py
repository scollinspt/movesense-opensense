from __future__ import annotations

import argparse
import hashlib
import json
import sys
import zipfile
from collections.abc import Sequence
from pathlib import Path, PurePosixPath
from typing import Any


class FirmwarePackageError(ValueError):
    pass


def _safe_member_name(name: str) -> str:
    path = PurePosixPath(name)
    if path.is_absolute() or ".." in path.parts:
        raise FirmwarePackageError(f"Unsafe ZIP member path: {name}")
    return name


def _image_record(
    archive: zipfile.ZipFile,
    manifest: dict[str, Any],
    image_name: str,
) -> dict[str, Any] | None:
    value = manifest.get(image_name)
    if value is None:
        return None
    if not isinstance(value, dict):
        raise FirmwarePackageError(f"Manifest entry {image_name} must be an object")
    bin_file = value.get("bin_file")
    dat_file = value.get("dat_file")
    if not isinstance(bin_file, str) or not isinstance(dat_file, str):
        raise FirmwarePackageError(
            f"Manifest entry {image_name} must name bin_file and dat_file"
        )
    _safe_member_name(bin_file)
    _safe_member_name(dat_file)
    names = set(archive.namelist())
    if bin_file not in names or dat_file not in names:
        raise FirmwarePackageError(
            f"Manifest entry {image_name} references missing image files"
        )
    return {
        "bin_file": bin_file,
        "bin_bytes": archive.getinfo(bin_file).file_size,
        "dat_file": dat_file,
        "dat_bytes": archive.getinfo(dat_file).file_size,
    }


def inspect_package(package_path: Path) -> dict[str, Any]:
    digest = hashlib.sha256()
    with package_path.open("rb") as package_file:
        for chunk in iter(lambda: package_file.read(1024 * 1024), b""):
            digest.update(chunk)

    try:
        with zipfile.ZipFile(package_path) as archive:
            for name in archive.namelist():
                _safe_member_name(name)
            try:
                raw_manifest = archive.read("manifest.json")
            except KeyError as error:
                raise FirmwarePackageError("DFU ZIP has no manifest.json") from error
            try:
                document = json.loads(raw_manifest)
            except (UnicodeDecodeError, json.JSONDecodeError) as error:
                raise FirmwarePackageError("DFU manifest is not valid JSON") from error
            manifest = document.get("manifest")
            if not isinstance(manifest, dict):
                raise FirmwarePackageError("DFU manifest has no manifest object")
            application = _image_record(archive, manifest, "application")
            softdevice_bootloader = _image_record(
                archive,
                manifest,
                "softdevice_bootloader",
            )
            if application is None:
                raise FirmwarePackageError("DFU package has no application image")
            return {
                "sha256": digest.hexdigest(),
                "file_bytes": package_path.stat().st_size,
                "application": application,
                "softdevice_bootloader": softdevice_bootloader,
                "contains_bootloader": softdevice_bootloader is not None,
            }
    except zipfile.BadZipFile as error:
        raise FirmwarePackageError("Firmware package is not a valid ZIP file") from error


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(description="Inspect a Nordic DFU package")
    result.add_argument("package", type=Path)
    return result


def main(argv: Sequence[str] | None = None) -> int:
    arguments = parser().parse_args(argv)
    try:
        print(json.dumps({"event": "package-inspection", **inspect_package(arguments.package)}))
    except (FirmwarePackageError, OSError) as error:
        print(
            json.dumps(
                {
                    "event": "error",
                    "message": str(error),
                    "error_type": type(error).__name__,
                }
            )
        )
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
