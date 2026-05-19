import base64
import io

import numpy as np
from PIL import Image


def decode_data_url(data_url: str) -> np.ndarray:
    if "," not in data_url:
        raise ValueError("image_base64 must be a valid data URL")

    _, encoded = data_url.split(",", 1)
    binary = base64.b64decode(encoded)
    image = Image.open(io.BytesIO(binary)).convert("RGB")
    return np.array(image)
