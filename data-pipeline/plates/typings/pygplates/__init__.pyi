# Only what histeclipse_plates uses (pyGPlates 1.0.0).
from collections.abc import Iterable, Sequence

class PointOnSphere:
    def __init__(self, latitude: float, longitude: float) -> None: ...
    def to_lat_lon(self) -> tuple[float, float]: ...

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
    def get_reconstruction_plate_id(self) -> int: ...

class FeatureCollection:
    def __init__(self, features: str | Iterable[Feature] = ...) -> None: ...
    def __len__(self) -> int: ...
    def write(self, filename: str) -> None: ...

class FiniteRotation:
    def __mul__(self, point: PointOnSphere) -> PointOnSphere: ...

class RotationModel:
    def __init__(self, rotation_features: Sequence[str] | FeatureCollection) -> None: ...
    def get_rotation(
        self,
        to_time: float,
        moving_plate_id: int,
        from_time: float = ...,
        fixed_plate_id: int = ...,
    ) -> FiniteRotation: ...

class ReconstructedFeatureGeometry:
    def get_feature(self) -> Feature: ...

def reconstruct(
    reconstructable_features: FeatureCollection,
    rotation_model: RotationModel,
    reconstructed_geometries: list[ReconstructedFeatureGeometry],
    reconstruction_time: float,
) -> None: ...

class PlatePartitioner:
    def __init__(
        self,
        partitioning_features: Sequence[ReconstructedFeatureGeometry] | FeatureCollection,
        rotation_model: RotationModel,
    ) -> None: ...
    def partition_point(self, point: PointOnSphere) -> ReconstructedFeatureGeometry | None: ...
