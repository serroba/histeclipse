# The parts of onnxruntime the passage vectors use.
import numpy as np
from numpy.typing import NDArray

class InferenceSession:
    def __init__(self, path: str) -> None: ...
    def run(
        self, output_names: None, input_feed: dict[str, NDArray[np.int64]]
    ) -> list[NDArray[np.float32]]: ...
