import { computed, ref } from "vue";
import { postCount } from "@/api/countApi";
import type { CountHistoryEntry, CountRequestPayload, CountResponse } from "@/types/count";

const HISTORY_KEY = "devoq_ai_count_history";
const MAX_HISTORY = 12;

type LiveState = "idle" | "counting" | "live" | "frozen" | "error";

function generateRequestId(): string {
  return `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function loadHistory(): CountHistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveHistory(entries: CountHistoryEntry[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, MAX_HISTORY)));
}

export function useLiveCount() {
  const state = ref<LiveState>("idle");
  const result = ref<CountResponse | null>(null);
  const error = ref<string | null>(null);
  const history = ref<CountHistoryEntry[]>(loadHistory());
  const lastFrame = ref<string | null>(null);
  const isLoopRunning = ref(false);

  let timerId: number | null = null;
  let requestInFlight = false;

  const hasResult = computed(() => result.value !== null);

  function appendHistory(entry: CountHistoryEntry) {
    history.value = [entry, ...history.value].slice(0, MAX_HISTORY);
    saveHistory(history.value);
  }

  async function countFrame(options: {
    imageBase64: string;
    itemCode?: string;
    productId?: number;
    cameraLabel?: string;
    metadata?: Record<string, unknown>;
  }): Promise<CountResponse | null> {
    error.value = null;
    state.value = isLoopRunning.value ? "live" : "counting";
    lastFrame.value = options.imageBase64;

    const payload: CountRequestPayload = {
      request_id: generateRequestId(),
      product_id: options.productId,
      item_code: options.itemCode,
      image_base64: options.imageBase64,
      metadata: {
        source: "devoq-ai-web",
        camera_label: options.cameraLabel,
        captured_at: new Date().toISOString(),
        ...(options.metadata || {}),
      },
    };

    try {
      const response = await postCount(payload);
      result.value = response;
      state.value = isLoopRunning.value ? "live" : "frozen";

      appendHistory({
        id: response.request_id,
        capturedAt: new Date().toISOString(),
        quantity: response.quantity,
        confidence: response.confidence,
        inferenceMs: response.inference_ms,
        mode: response.mode,
        cameraLabel: options.cameraLabel,
        itemCode: options.itemCode,
      });

      return response;
    } catch (caughtError) {
      error.value = caughtError instanceof Error ? caughtError.message : "Impossible de compter sur cette image";
      state.value = "error";
      return null;
    }
  }

  async function startLiveLoop(config: {
    captureFrame: () => string | null;
    intervalMs: number;
    itemCode?: string;
    productId?: number;
    cameraLabel?: string;
    metadata?: Record<string, unknown>;
  }) {
    if (isLoopRunning.value) {
      return;
    }

    isLoopRunning.value = true;
    error.value = null;
    state.value = "live";

    const tick = async () => {
      if (!isLoopRunning.value) {
        return;
      }

      if (requestInFlight) {
        timerId = window.setTimeout(tick, config.intervalMs);
        return;
      }

      const imageBase64 = config.captureFrame();
      if (!imageBase64) {
        error.value = "Aucune image disponible pour le comptage";
        state.value = "error";
        isLoopRunning.value = false;
        return;
      }

      requestInFlight = true;
      await countFrame({
        imageBase64,
        itemCode: config.itemCode,
        productId: config.productId,
        cameraLabel: config.cameraLabel,
        metadata: config.metadata,
      });
      requestInFlight = false;

      if (isLoopRunning.value) {
        timerId = window.setTimeout(tick, config.intervalMs);
      }
    };

    await tick();
  }

  function freezeLiveLoop() {
    isLoopRunning.value = false;
    if (timerId !== null) {
      window.clearTimeout(timerId);
      timerId = null;
    }
    state.value = result.value ? "frozen" : "idle";
  }

  function resetResults() {
    freezeLiveLoop();
    result.value = null;
    error.value = null;
    lastFrame.value = null;
    state.value = "idle";
  }

  function clearHistory() {
    history.value = [];
    saveHistory([]);
  }

  return {
    state,
    result,
    error,
    history,
    lastFrame,
    hasResult,
    isLoopRunning,
    countFrame,
    startLiveLoop,
    freezeLiveLoop,
    resetResults,
    clearHistory,
  };
}
