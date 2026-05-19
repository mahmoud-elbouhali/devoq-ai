import { computed, onBeforeUnmount, ref } from "vue";
import { acquireCameraStream, describeTrack } from "@/utils/cameraStream";

export interface CameraDeviceOption {
  deviceId: string;
  label: string;
}

export function useCamera() {
  const videoRef = ref<HTMLVideoElement | null>(null);
  const devices = ref<CameraDeviceOption[]>([]);
  const selectedDeviceId = ref("");
  const stream = ref<MediaStream | null>(null);
  const isStreaming = ref(false);
  const error = ref<string | null>(null);
  const status = ref<string>("idle");

  const selectedCameraLabel = computed(() => {
    return devices.value.find((device) => device.deviceId === selectedDeviceId.value)?.label || "";
  });

  async function loadDevices() {
    try {
      const mediaDevices = await navigator.mediaDevices.enumerateDevices();
      devices.value = mediaDevices
        .filter((device) => device.kind === "videoinput")
        .map((device, index) => ({
          deviceId: device.deviceId,
          label: device.label || `Caméra ${index + 1}`,
        }));

      if (!selectedDeviceId.value && devices.value.length > 0) {
        selectedDeviceId.value = devices.value[0].deviceId;
      }
    } catch (caughtError) {
      error.value = caughtError instanceof Error ? caughtError.message : "Impossible de lister les caméras";
    }
  }

  async function startCamera(deviceId?: string) {
    error.value = null;
    status.value = "starting";
    const hadActiveStream = Boolean(stream.value);
    stopCamera();

    // Some webcams need a short cooldown before they can be reopened.
    if (hadActiveStream) {
      await delay(250);
    }

    if (!window.isSecureContext) {
      const msg = `Contexte non sécurisé — getUserMedia bloqué. Origine : ${window.location.origin}`;
      console.error("[useCamera]", msg);
      error.value = msg;
      status.value = "insecure-context";
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      error.value = "getUserMedia n'est pas disponible dans ce navigateur";
      status.value = "no-getusermedia";
      console.error("[useCamera] getUserMedia missing");
      return;
    }

    status.value = "requesting-permission";
    console.info("[useCamera] requesting camera", { deviceId });

    let mediaStream: MediaStream;
    let attemptLabel = "unknown";
    try {
      const result = await acquireStreamWithRecovery({
        deviceId,
        onAttempt(candidate) {
          attemptLabel = candidate.label;
          status.value = `requesting:${candidate.label}`;
          console.info("[useCamera] trying candidate", candidate);
        },
        onFailure(candidate, caughtError) {
          console.warn("[useCamera] candidate failed", candidate.label, caughtError);
        },
      });
      mediaStream = result.stream;
      attemptLabel = result.candidate.label;
    } catch (caughtError) {
      const name = caughtError instanceof Error ? caughtError.name : "UnknownError";
      const message = caughtError instanceof Error ? caughtError.message : String(caughtError);
      console.error("[useCamera] getUserMedia rejected", caughtError);
      error.value = formatCameraError(name, message);
      status.value = name === "TimeoutError" ? "permission-timeout" : `error:${name}`;
      isStreaming.value = false;
      return;
    }

    const tracks = mediaStream.getVideoTracks();
    console.info(
      "[useCamera] stream acquired",
      tracks.map((track) => describeTrack(track)),
    );
    status.value = `stream-acquired:${attemptLabel} (${tracks.length} track${tracks.length !== 1 ? "s" : ""})`;

    if (tracks.length === 0) {
      error.value = "Le flux ne contient aucune piste vidéo";
      status.value = "no-tracks";
      mediaStream.getTracks().forEach((t) => t.stop());
      return;
    }

    stream.value = mediaStream;
    status.value = "attaching";

    const attachAndPlay = async (): Promise<boolean> => {
      const video = videoRef.value;
      if (!video) {
        console.warn("[useCamera] videoRef is null at attach time");
        status.value = "videoref-null";
        return false;
      }
      video.srcObject = mediaStream;
      try {
        await video.play();
        await waitForVideoFrame(video);
        console.info("[useCamera] video.play() resolved", {
          readyState: video.readyState,
          videoWidth: video.videoWidth,
          videoHeight: video.videoHeight,
          attemptLabel,
        });
        status.value = `playing:${attemptLabel} ${video.videoWidth}x${video.videoHeight}`;
        return true;
      } catch (playError) {
        const name = playError instanceof Error ? playError.name : "PlayError";
        console.error("[useCamera] video.play() rejected", playError);
        error.value = `Échec de lecture vidéo : ${name}`;
        status.value = `play-error:${name}`;
        return false;
      }
    };

    let attached = await attachAndPlay();
    if (!attached) {
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
      attached = await attachAndPlay();
    }

    if (!attached) {
      mediaStream.getTracks().forEach((t) => t.stop());
      stream.value = null;
      isStreaming.value = false;
      return;
    }

    isStreaming.value = true;
    await loadDevices();

    const activeTrack = tracks[0];
    if (activeTrack) {
      selectedDeviceId.value = activeTrack.getSettings().deviceId || deviceId || selectedDeviceId.value;
    }
  }

  function stopCamera() {
    if (stream.value) {
      for (const track of stream.value.getTracks()) {
        track.stop();
      }
      stream.value = null;
    }

    if (videoRef.value) {
      videoRef.value.pause();
      videoRef.value.srcObject = null;
    }

    isStreaming.value = false;
    status.value = "stopped";
  }

  function captureFrame(type: "image/jpeg" | "image/png" = "image/jpeg", quality = 0.92): string | null {
    const video = videoRef.value;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      error.value = "L'image caméra n'est pas encore prête";
      return null;
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext("2d");
    if (!context) {
      error.value = "Impossible de capturer l'image";
      return null;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL(type, quality);
  }

  onBeforeUnmount(() => {
    stopCamera();
  });

  return {
    videoRef,
    devices,
    selectedDeviceId,
    selectedCameraLabel,
    isStreaming,
    error,
    status,
    loadDevices,
    startCamera,
    stopCamera,
    captureFrame,
  };
}

function formatCameraError(name: string, message: string): string {
  const normalized = `${name} ${message}`.toLowerCase();

  if (name === "NotReadableError" && normalized.includes("device in use")) {
    return "Caméra occupée : une autre application ou un autre onglet utilise déjà la caméra. Fermez Windows Camera, Teams, Zoom, OBS et les autres onglets qui l'utilisent, puis réessayez.";
  }

  if (name === "NotReadableError") {
    return "Caméra indisponible. Elle peut déjà être utilisée par une autre application, bloquée par le pilote, ou encore en cours de libération après une tentative précédente. Fermez les applications caméra, attendez un instant, puis réessayez.";
  }

  if (name === "NotAllowedError") {
    return "Accès caméra refusé. Autorisez l'accès dans le navigateur et dans les paramètres de confidentialité Windows, puis réessayez.";
  }

  if (name === "TimeoutError") {
    return "La demande caméra a expiré. Cela signifie souvent que le périphérique est bloqué par une autre application ou ne répond pas.";
  }

  return `${name}: ${message}`;
}

async function acquireStreamWithRecovery(options: Parameters<typeof acquireCameraStream>[0] = {}) {
  try {
    return await acquireCameraStream(options);
  } catch (error) {
    if (!(error instanceof Error) || !["NotReadableError", "AbortError", "TimeoutError"].includes(error.name)) {
      throw error;
    }

    // A short retry helps when the browser or USB webcam needs time to release the device.
    await delay(350);
    return acquireCameraStream(options);
  }
}

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

async function waitForVideoFrame(video: HTMLVideoElement, timeoutMs = 4000) {
  if (video.videoWidth > 0 && video.videoHeight > 0 && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    let settled = false;

    const finish = (callback: () => void) => {
      if (settled) {
        return;
      }

      settled = true;
      window.clearTimeout(timer);
      video.removeEventListener("loadedmetadata", handleReady);
      video.removeEventListener("canplay", handleReady);
      video.removeEventListener("resize", handleReady);
      callback();
    };

    const handleReady = () => {
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        finish(resolve);
      }
    };

    const timer = window.setTimeout(() => {
      finish(() => reject(new DOMException("Video metadata did not become ready", "AbortError")));
    }, timeoutMs);

    video.addEventListener("loadedmetadata", handleReady);
    video.addEventListener("canplay", handleReady);
    video.addEventListener("resize", handleReady);
    handleReady();
  });
}
