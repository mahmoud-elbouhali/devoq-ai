## Downloaded Model Assets

### `yolox_s.pth`

- Source: official YOLOX release by Megvii-BaseDetection
- URL: `https://github.com/Megvii-BaseDetection/YOLOX/releases/download/0.1.1rc0/yolox_s.pth`
- Intended use here: starting checkpoint for fine-tuning on the screw dataset

Notes:

- This is a generic pretrained checkpoint, not a screw-specific model.
- It is not directly used by the current `yolox_onnx` runtime path until you fine-tune and export an ONNX model.

### `yolox.onnx`

- Intended path for runtime activation in the local AI microservice.
- When present, `make dev-yolox` enables `AI_DETECTOR_MODE=yolox_onnx`.

Notes:

- If this file is the official generic COCO ONNX model, it validates the YOLOX runtime path only.
- Final screw counting quality still requires a screw-specific fine-tuned model.
