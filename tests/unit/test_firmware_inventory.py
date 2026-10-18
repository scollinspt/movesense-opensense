from movesense_opensense.acquisition.firmware_inventory import classify_services
from movesense_opensense.acquisition.gsp import (
    LEGACY_WHITEBOARD_WRITE_UUID,
    WRITE_CHARACTERISTIC_UUID,
)


def test_classifies_gsp_before_legacy_service() -> None:
    assert (
        classify_services(
            {LEGACY_WHITEBOARD_WRITE_UUID, WRITE_CHARACTERISTIC_UUID.upper()}
        )
        == "gsp-ready"
    )


def test_classifies_legacy_mds() -> None:
    assert classify_services({LEGACY_WHITEBOARD_WRITE_UUID}) == "legacy-mds"


def test_classifies_unknown_profile() -> None:
    assert classify_services({"00002a19-0000-1000-8000-00805f9b34fb"}) == "unknown"
