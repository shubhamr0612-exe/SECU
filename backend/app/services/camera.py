"""CameraService — architecturally isolated, DISABLED in V1.

Privacy: V1 must NOT use facial recognition, identify people, infer age/gender/
emotion, or take photos automatically. This interface exists only so a future,
opt-in "Take a selfie" feature (V1.1) can be added without redesign. All methods
raise by default.
"""


class CameraService:
    enabled = False

    def capture_selfie(self):  # pragma: no cover
        raise NotImplementedError("Camera disabled in V1 by design (privacy).")

    def identify(self, *_):  # pragma: no cover
        raise NotImplementedError("Facial recognition is forbidden by product policy.")
