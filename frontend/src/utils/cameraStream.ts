export interface CameraConstraintCandidate {
  label: string;
  constraints: MediaStreamConstraints;
}

export interface AcquireCameraStreamOptions {
  deviceId?: string;
  timeoutMs?: number;
  perAttemptTimeoutMs?: number;
  onAttempt?: (candidate: CameraConstraintCandidate) => void;
  onFailure?: (candidate: CameraConstraintCandidate, error: unknown) => void;
}

export interface AcquireCameraStreamResult {
  stream: MediaStream;
  candidate: CameraConstraintCandidate;
}

const COMMON_PRESETS = [
  { width: 1920, height: 1080, frameRate: 30 },
  { width: 1280, height: 720, frameRate: 30 },
  { width: 1024, height: 768, frameRate: 30 },
  { width: 800, height: 600, frameRate: 30 },
  { width: 640, height: 480, frameRate: 30 },
  { width: 320, height: 240, frameRate: 15 },
] as const;

function withAudioDisabled(video: boolean | MediaTrackConstraints): MediaStreamConstraints {
  return {
    video,
    audio: false,
  };
}

function makeDeviceConstraint(
  deviceId: string,
  preset?: { width: number; height: number; frameRate: number },
  exact = false,
): MediaTrackConstraints {
  const constraint: MediaTrackConstraints = exact
    ? { deviceId: { exact: deviceId } }
    : { deviceId: { ideal: deviceId } };

  if (preset) {
    constraint.width = { ideal: preset.width };
    constraint.height = { ideal: preset.height };
    constraint.frameRate = { ideal: preset.frameRate };
  }

  return constraint;
}

export function createCameraConstraintCandidates(deviceId?: string): CameraConstraintCandidate[] {
  const candidates: CameraConstraintCandidate[] = [];

  if (deviceId) {
    candidates.push({
      label: "selected-device-exact",
      constraints: withAudioDisabled(makeDeviceConstraint(deviceId, undefined, true)),
    });

    for (const preset of COMMON_PRESETS) {
      candidates.push({
        label: `selected-device-${preset.width}x${preset.height}@${preset.frameRate}`,
        constraints: withAudioDisabled(makeDeviceConstraint(deviceId, preset)),
      });
    }
  }

  candidates.push({
    label: "default-device",
    constraints: withAudioDisabled(true),
  });

  for (const preset of COMMON_PRESETS) {
    candidates.push({
      label: `default-${preset.width}x${preset.height}@${preset.frameRate}`,
      constraints: withAudioDisabled({
        width: { ideal: preset.width },
        height: { ideal: preset.height },
        frameRate: { ideal: preset.frameRate },
      }),
    });
  }

  return dedupeCandidates(candidates);
}

function dedupeCandidates(candidates: CameraConstraintCandidate[]): CameraConstraintCandidate[] {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = JSON.stringify(candidate.constraints);
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      window.setTimeout(() => reject(new DOMException(`getUserMedia timed out after ${timeoutMs}ms`, "TimeoutError")), timeoutMs);
    }),
  ]);
}

function shouldContinueAfterFailure(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const normalized = `${error.name} ${error.message}`.toLowerCase();
  if (error.name === "NotReadableError" && normalized.includes("device in use")) {
    return false;
  }

  return !["NotAllowedError", "SecurityError", "TypeError"].includes(error.name);
}

export async function acquireCameraStream({
  deviceId,
  timeoutMs = 30000,
  perAttemptTimeoutMs = 12000,
  onAttempt,
  onFailure,
}: AcquireCameraStreamOptions = {}): Promise<AcquireCameraStreamResult> {
  const attempts = createCameraConstraintCandidates(deviceId);
  let lastError: unknown = null;
  const startedAt = performance.now();

  for (const candidate of attempts) {
    const elapsedMs = performance.now() - startedAt;
    const remainingMs = Math.max(250, timeoutMs - elapsedMs);
    if (remainingMs <= 250) {
      break;
    }

    onAttempt?.(candidate);

    try {
      const stream = await withTimeout(
        navigator.mediaDevices.getUserMedia(candidate.constraints),
        Math.min(perAttemptTimeoutMs, remainingMs),
      );

      const tracks = stream.getVideoTracks();
      if (tracks.length === 0) {
        stream.getTracks().forEach((track) => track.stop());
        throw new DOMException("Stream has no video tracks", "NotFoundError");
      }

      return { stream, candidate };
    } catch (error) {
      lastError = error;
      onFailure?.(candidate, error);

      if (!shouldContinueAfterFailure(error)) {
        throw error;
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new DOMException("Impossible d'obtenir un flux caméra dans le délai configuré", "TimeoutError");
}

export function describeTrack(track: MediaStreamTrack): string {
  const settings = typeof track.getSettings === "function" ? track.getSettings() : {};
  return `${track.label || "unknown"} state=${track.readyState} settings=${JSON.stringify(settings)}`;
}
