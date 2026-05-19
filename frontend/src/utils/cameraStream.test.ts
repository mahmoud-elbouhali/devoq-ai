import { afterEach, describe, expect, it, vi } from "vitest";
import { acquireCameraStream, createCameraConstraintCandidates } from "@/utils/cameraStream";

function makeStream(trackCount = 1): MediaStream {
  const tracks = Array.from({ length: trackCount }, (_, index) => ({
    label: `Camera ${index + 1}`,
    readyState: "live",
    getSettings: () => ({ deviceId: `device-${index + 1}` }),
    stop: vi.fn(),
  })) as unknown as MediaStreamTrack[];

  return {
    getVideoTracks: () => tracks,
    getTracks: () => tracks,
  } as unknown as MediaStream;
}

describe("createCameraConstraintCandidates", () => {
  it("builds device-specific candidates before generic fallbacks", () => {
    const candidates = createCameraConstraintCandidates("abc123");

    expect(candidates[0]?.label).toBe("selected-device-exact");
    expect(candidates.some((candidate) => candidate.label === "selected-device-640x480@30")).toBe(true);
    expect(candidates.some((candidate) => candidate.label === "default-device")).toBe(true);
  });

  it("deduplicates identical candidates when no device is selected", () => {
    const candidates = createCameraConstraintCandidates();
    const labels = candidates.map((candidate) => candidate.label);

    expect(labels[0]).toBe("default-device");
    expect(new Set(labels).size).toBe(labels.length);
  });
});

describe("acquireCameraStream", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("falls back to later candidates after recoverable failures", async () => {
    const getUserMedia = vi
      .fn()
      .mockRejectedValueOnce(new DOMException("unsupported", "OverconstrainedError"))
      .mockResolvedValueOnce(makeStream());

    vi.stubGlobal("window", globalThis);
    vi.stubGlobal("navigator", {
      mediaDevices: {
        getUserMedia,
      },
    });

    const attempts: string[] = [];
    const result = await acquireCameraStream({
      deviceId: "abc123",
      onAttempt(candidate) {
        attempts.push(candidate.label);
      },
    });

    expect(attempts.slice(0, 2)).toEqual([
      "selected-device-exact",
      "selected-device-1920x1080@30",
    ]);
    expect(result.candidate.label).toBe("selected-device-1920x1080@30");
    expect(getUserMedia).toHaveBeenCalledTimes(2);
  });

  it("stops immediately on non-recoverable permission errors", async () => {
    const getUserMedia = vi
      .fn()
      .mockRejectedValue(new DOMException("blocked", "NotAllowedError"));

    vi.stubGlobal("window", globalThis);
    vi.stubGlobal("navigator", {
      mediaDevices: {
        getUserMedia,
      },
    });

    await expect(acquireCameraStream({ deviceId: "abc123" })).rejects.toMatchObject({
      name: "NotAllowedError",
    });
    expect(getUserMedia).toHaveBeenCalledTimes(1);
  });

  it("stops immediately when the browser reports the camera is already in use", async () => {
    const getUserMedia = vi
      .fn()
      .mockRejectedValue(new DOMException("Device in use", "NotReadableError"));

    vi.stubGlobal("window", globalThis);
    vi.stubGlobal("navigator", {
      mediaDevices: {
        getUserMedia,
      },
    });

    await expect(acquireCameraStream({ deviceId: "abc123" })).rejects.toMatchObject({
      name: "NotReadableError",
      message: "Device in use",
    });
    expect(getUserMedia).toHaveBeenCalledTimes(1);
  });
});
