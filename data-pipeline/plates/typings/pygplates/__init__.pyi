# Only what histeclipse_plates uses (pyGPlates 1.0.0).
from collections.abc import Iterable, Sequence

class PointOnSphere:
    def __init__(self, latitude: float, longitude: float) -> None: ...

class PolygonOnSphere:
    def __init__(self, points: Sequence[tuple[float, float]]) -> None: ...

class FeatureType:
    gpml_unclassified_feature: FeatureType

class Feature:
    @staticmethod
    def create_reconstructable_feature(
        feature_type: FeatureType,
        geometry: PolygonOnSphere,
        *,
        reconstruction_plate_id: int,
    ) -> Feature: ...

class FeatureCollection:
    def __init__(self, features: str | Iterable[Feature] = ...) -> None: ...
    def __len__(self) -> int: ...
    def write(self, filename: str) -> None: ...

class RotationModel:
    def __init__(self, rotation_features: Sequence[str] | FeatureCollection) -> None: ...

class ReconstructedFeatureGeometry: ...

def reconstruct(
    reconstructable_features: FeatureCollection,
    rotation_model: RotationModel,
    reconstructed_geometries: list[ReconstructedFeatureGeometry],
    reconstruction_time: float,
) -> None: ...

class PlatePartitioner:
    def __init__(
        self,
        partitioning_features: Sequence[ReconstructedFeatureGeometry],
        rotation_model: RotationModel,
    ) -> None: ...
    def partition_point(self, point: PointOnSphere) -> ReconstructedFeatureGeometry | None: ...
