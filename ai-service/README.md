# AI Service

This service supports two detector modes controlled by `AI_DETECTOR_MODE`.

## Modes

- `yolox_onnx`
  - Loads a YOLOX model exported to ONNX.
  - Better suited for overlapping screws and true instance counting.
- `baseline`
  - Fallback for stable top-down scenes with dark objects on a light background.
  - No trained model file required.

## Required YOLOX Environment Variables

- `AI_DETECTOR_MODE=yolox_onnx`
- `AI_MODEL_VERSION=yolox-screws-v1`
- `AI_YOLOX_MODEL_PATH=/models/yolox.onnx`

Optional but recommended:

- `AI_YOLOX_INPUT_SIZE=640`
- `AI_YOLOX_CONFIDENCE_THRESHOLD=0.35`
- `AI_YOLOX_NMS_THRESHOLD=0.45`
- `AI_YOLOX_CLASS_NAMES=screw`
- `AI_YOLOX_TARGET_CLASSES=screw`
- `AI_YOLOX_PROVIDERS=CPUExecutionProvider`

## Model Preparation

Expected workflow:

1. Train YOLOX on your annotated screw dataset.
2. Export the trained model to ONNX.
3. Mount the ONNX file into the container, typically under `/models/yolox.onnx`.
4. Switch `AI_DETECTOR_MODE` from `baseline` to `yolox_onnx`.

## Notes

- The current implementation assumes the ONNX output is already decoded into YOLO predictions (`cx, cy, w, h, obj, class...`).
- If your export format differs, adapt `app/detectors/yolox_onnx.py`.
- CPU inference works for functional integration. For production speed, you may later replace `onnxruntime` with a GPU-backed runtime image.

## Development Activation

The default development stack now starts with YOLOX ONNX enabled.

To run the current project in local development:

1. Place a compatible ONNX file at `models/yolox.onnx`.
2. Start the stack with:

   ```bash
   make dev
   ```

3. Check the backend info endpoint. The capabilities should include:

   - `detector:yolox_onnx`

If you explicitly want the alternate compose profile that also enables YOLOX, `make dev-yolox` remains available.

Important:

- The official generic YOLOX COCO model is useful to validate the runtime path.
- It is **not** a screw-specific model, so it should not be used as evidence of final counting quality on your white-surface screw images.
