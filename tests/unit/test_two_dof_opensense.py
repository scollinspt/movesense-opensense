from __future__ import annotations

import numpy as np

from movesense_opensense.opensense.two_dof import (
    quaternion_angle_degrees,
    quaternion_average,
    quaternion_multiply,
    quaternion_slerp,
)


def test_quaternion_multiplication_and_angle() -> None:
    identity = np.array([1.0, 0.0, 0.0, 0.0])
    quarter_turn = np.array([2**-0.5, 0.0, 0.0, 2**-0.5])

    assert np.allclose(quaternion_multiply(identity, quarter_turn), quarter_turn)
    assert quaternion_angle_degrees(identity, quarter_turn) == 90.0


def test_quaternion_average_aligns_antipodal_values() -> None:
    quaternion = np.array([2**-0.5, 2**-0.5, 0.0, 0.0])

    assert np.allclose(quaternion_average(np.array([quaternion, -quaternion])), quaternion)


def test_quaternion_slerp_reaches_halfway_rotation() -> None:
    identity = np.array([1.0, 0.0, 0.0, 0.0])
    half_turn = np.array([0.0, 0.0, 0.0, 1.0])

    halfway = quaternion_slerp(identity, half_turn, 0.5)

    assert quaternion_angle_degrees(identity, halfway) == 90.0
