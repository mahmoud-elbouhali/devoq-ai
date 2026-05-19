<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { fetchEngineInfo, fetchHealth } from "@/api/countApi";
import { useCamera } from "@/composables/useCamera";
import { useLiveCount } from "@/composables/useLiveCount";
import type { CountEngineInfo } from "@/types/count";

const productIdInput = ref("");
const itemCode = ref("");
const liveIntervalMs = ref(650);
const engineInfo = ref<CountEngineInfo | null>(null);
const healthStatus = ref<"idle" | "ok" | "error">("idle");
const healthMessage = ref("Vérification du backend...");
const capturedImage = ref<string | null>(null);
const startClickCount = ref(0);

const {
  videoRef,
  devices,
  selectedDeviceId,
  selectedCameraLabel,
  isStreaming,
  error: cameraError,
  status: cameraStatus,
  loadDevices,
  startCamera,
  stopCamera,
  captureFrame,
} = useCamera();

const {
  state,
  result,
  error: countError,
  history,
  lastFrame,
  isLoopRunning,
  countFrame,
  startLiveLoop,
  freezeLiveLoop,
  resetResults,
  clearHistory,
} = useLiveCount();

const combinedError = computed(() => cameraError.value || countError.value || "");
const activeImage = computed(() => capturedImage.value || lastFrame.value);
const formattedConfidence = computed(() => {
  if (!result.value) {
    return "0.0%";
  }
  return `${(result.value.confidence * 100).toFixed(1)}%`;
});
const stateLabel = computed(() => {
  switch (state.value) {
    case "idle":
      return "inactif";
    case "counting":
      return "comptage";
    case "live":
      return "live";
    case "frozen":
      return "figé";
    case "error":
      return "erreur";
    default:
      return state.value;
  }
});
const parsedProductId = computed(() => {
  const parsed = Number(productIdInput.value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
});
const activeDetectorLabel = computed(() => {
  const capabilities = engineInfo.value?.capabilities ?? [];
  if (capabilities.includes("detector:yolox_onnx")) {
    return "yolox_onnx";
  }
  if (capabilities.includes("detector:baseline")) {
    return "baseline";
  }
  return "Détecteur indisponible";
});

async function refreshBackendStatus() {
  try {
    const [health, info] = await Promise.all([fetchHealth(), fetchEngineInfo()]);
    healthStatus.value = "ok";
    healthMessage.value = `${health.service} est opérationnel`;
    engineInfo.value = info;
  } catch (error) {
    healthStatus.value = "error";
    healthMessage.value = error instanceof Error ? error.message : "Backend indisponible";
  }
}

async function handleStartCamera() {
  startClickCount.value += 1;
  console.info("[CountLabView] handleStartCamera clicked", {
    count: startClickCount.value,
    selectedDeviceId: selectedDeviceId.value,
    isSecureContext: window.isSecureContext,
    hasMediaDevices: Boolean(navigator.mediaDevices?.getUserMedia),
  });
  await startCamera(selectedDeviceId.value || undefined);
}

function handleCapture() {
  const frame = captureFrame();
  if (!frame) {
    return;
  }
  capturedImage.value = frame;
}

async function handleCountOnce() {
  const frame = capturedImage.value || captureFrame();
  if (!frame) {
    return;
  }

  capturedImage.value = frame;
  await countFrame({
    imageBase64: frame,
    itemCode: itemCode.value || undefined,
    productId: parsedProductId.value,
    cameraLabel: selectedCameraLabel.value,
    metadata: {
      flow: "single_capture",
    },
  });
}

async function handleStartLive() {
  capturedImage.value = null;
  await startLiveLoop({
    captureFrame,
    intervalMs: liveIntervalMs.value,
    itemCode: itemCode.value || undefined,
    productId: parsedProductId.value,
    cameraLabel: selectedCameraLabel.value,
    metadata: {
      flow: "live_preview",
    },
  });
}

function handleFreeze() {
  freezeLiveLoop();
}

function handleResetSession() {
  capturedImage.value = null;
  resetResults();
}

onMounted(async () => {
  await refreshBackendStatus();
  await loadDevices();
});
</script>

<template>
  <main class="lab-shell">
    <section class="hero-card">
      <div>
        <p class="eyebrow">Devoq-AI Vision Lab</p>
        <h1>Laboratoire de comptage caméra pour le flux opérateur réel</h1>
        <p class="hero-copy">
          Démarrez la caméra, lancez un comptage en direct ou une capture unique,
          puis vérifiez la quantité, la confiance et la latence avant l’intégration métier.
        </p>
      </div>
      <div class="status-card" :data-state="healthStatus">
        <span class="status-label">Backend</span>
        <strong>{{ healthMessage }}</strong>
        <span v-if="engineInfo" class="status-meta">
          {{ engineInfo.model_version }} · {{ activeDetectorLabel }}
        </span>
      </div>
    </section>

    <section class="grid-layout">
      <article class="panel">
        <div class="panel-header">
          <div>
            <h2>Flux caméra</h2>
            <p>Aperçu en direct et acquisition d’image depuis le navigateur.</p>
          </div>
          <div class="button-row">
            <button class="ghost-button" @click="refreshBackendStatus">Actualiser le backend</button>
            <button class="ghost-button" @click="loadDevices">Recharger les caméras</button>
          </div>
        </div>

        <div class="control-grid">
          <label>
            <span>Caméra</span>
            <select v-model="selectedDeviceId">
              <option value="" disabled>Sélectionner un périphérique</option>
              <option v-for="device in devices" :key="device.deviceId" :value="device.deviceId">
                {{ device.label }}
              </option>
            </select>
          </label>

          <label>
            <span>ID produit</span>
            <input v-model="productIdInput" inputmode="numeric" placeholder="123" />
          </label>

          <label>
            <span>Code article</span>
            <input v-model="itemCode" placeholder="SKU-001" />
          </label>

          <label>
            <span>Intervalle live (ms)</span>
            <input v-model.number="liveIntervalMs" type="number" min="300" step="50" />
          </label>
        </div>

        <div class="button-row action-row">
          <button class="primary-button" @click="handleStartCamera">Démarrer la caméra</button>
          <button class="ghost-button" :disabled="!isStreaming" @click="stopCamera">Arrêter la caméra</button>
          <button class="ghost-button" :disabled="!isStreaming" @click="handleCapture">Capturer une image</button>
          <button class="primary-button" :disabled="!isStreaming || isLoopRunning" @click="handleCountOnce">
            Compter une fois
          </button>
          <button class="accent-button" :disabled="!isStreaming || isLoopRunning" @click="handleStartLive">
            Démarrer le comptage live
          </button>
          <button class="ghost-button" :disabled="!isLoopRunning" @click="handleFreeze">Geler</button>
        </div>

        <div class="video-frame">
          <video ref="videoRef" autoplay playsinline muted></video>
          <div v-if="!isStreaming" class="video-placeholder">
            L’aperçu caméra apparaîtra ici après autorisation.
          </div>
          <div class="camera-status-pill">cam: {{ cameraStatus }} · clicks: {{ startClickCount }}</div>
        </div>

        <p v-if="combinedError" class="error-banner">{{ combinedError }}</p>
      </article>

      <article class="panel">
        <div class="panel-header">
          <div>
            <h2>Session de comptage</h2>
            <p>Capture unique ou boucle live avec le détecteur IA actif.</p>
          </div>
          <button class="ghost-button" @click="handleResetSession">Réinitialiser</button>
        </div>

        <div class="preview-box" :class="{ empty: !activeImage }">
          <img v-if="activeImage" :src="activeImage" alt="Aperçu de l’image capturée" />
          <span v-else>Capturez une image ou lancez la boucle live pour voir la dernière image analysée.</span>
        </div>

        <div class="metrics-grid">
          <div class="metric-card">
            <span>État</span>
            <strong>{{ stateLabel }}</strong>
          </div>
          <div class="metric-card">
            <span>Quantité</span>
            <strong>{{ result?.quantity ?? "—" }}</strong>
          </div>
          <div class="metric-card">
            <span>Confiance</span>
            <strong>{{ formattedConfidence }}</strong>
          </div>
          <div class="metric-card">
            <span>Latence</span>
            <strong>{{ result?.inference_ms ?? "—" }} ms</strong>
          </div>
        </div>

        <div class="warning-box" v-if="result?.warnings?.length">
          <strong>Avertissements</strong>
          <p v-for="warning in result.warnings" :key="warning">{{ warning }}</p>
        </div>
      </article>
    </section>

    <section class="grid-layout secondary">
      <article class="panel">
        <div class="panel-header compact">
          <div>
            <h2>Capacités du moteur</h2>
            <p>Fonctionnalités annoncées par le backend actuel.</p>
          </div>
        </div>

        <ul class="capabilities-list">
          <li v-for="capability in engineInfo?.capabilities || []" :key="capability">
            {{ capability }}
          </li>
        </ul>
      </article>

      <article class="panel">
        <div class="panel-header compact">
          <div>
            <h2>Historique récent</h2>
            <p>Stocké localement dans le navigateur.</p>
          </div>
          <button class="ghost-button" @click="clearHistory">Effacer</button>
        </div>

        <div v-if="history.length === 0" class="history-empty">
          Aucun comptage enregistré pour le moment.
        </div>

        <ul v-else class="history-list">
          <li v-for="entry in history" :key="entry.id">
            <div>
              <strong>{{ entry.quantity }} pièces</strong>
              <span>{{ (entry.confidence * 100).toFixed(1) }}% de confiance</span>
            </div>
            <div>
              <span>{{ entry.inferenceMs }} ms</span>
              <span>{{ entry.itemCode || entry.cameraLabel || "capture" }}</span>
            </div>
          </li>
        </ul>
      </article>
    </section>
  </main>
</template>

<style scoped>
.lab-shell {
  min-height: 100vh;
  padding: 2rem;
  color: #f5f3ef;
  background:
    radial-gradient(circle at top left, rgba(230, 149, 53, 0.18), transparent 28%),
    radial-gradient(circle at top right, rgba(27, 87, 128, 0.24), transparent 32%),
    linear-gradient(145deg, #171411 0%, #22211f 48%, #111827 100%);
}

.hero-card,
.panel {
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 24px;
  background: rgba(17, 24, 39, 0.55);
  box-shadow: 0 18px 60px rgba(0, 0, 0, 0.22);
  backdrop-filter: blur(16px);
}

.hero-card {
  display: grid;
  grid-template-columns: 1.8fr 1fr;
  gap: 1.5rem;
  padding: 2rem;
  margin-bottom: 1.5rem;
}

.eyebrow {
  margin: 0 0 0.5rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: #fbbf24;
  font-size: 0.82rem;
}

h1 {
  margin: 0;
  font-size: clamp(2.2rem, 4vw, 4.4rem);
  line-height: 0.95;
  font-weight: 800;
}

.hero-copy,
.panel-header p,
.status-meta,
.history-empty,
.preview-box span,
.warning-box p {
  color: rgba(241, 245, 249, 0.72);
}

.status-card {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.4rem;
  padding: 1.2rem;
  border-radius: 18px;
  background: rgba(15, 23, 42, 0.72);
}

.status-card[data-state="ok"] {
  border: 1px solid rgba(74, 222, 128, 0.3);
}

.status-card[data-state="error"] {
  border: 1px solid rgba(248, 113, 113, 0.4);
}

.status-label {
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.09em;
  color: #fbbf24;
}

.grid-layout {
  display: grid;
  grid-template-columns: 1.35fr 1fr;
  gap: 1.5rem;
}

.grid-layout.secondary {
  margin-top: 1.5rem;
}

.panel {
  padding: 1.5rem;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 1rem;
}

.panel-header.compact h2,
.panel-header.compact h3,
.panel-header h2 {
  margin: 0;
}

.panel-header p {
  margin: 0.25rem 0 0;
}

.control-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.9rem;
}

label {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.92rem;
}

label span {
  color: rgba(255, 255, 255, 0.8);
}

input,
select,
button {
  font: inherit;
}

input,
select {
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 14px;
  padding: 0.82rem 0.9rem;
  color: #f8fafc;
  background: rgba(15, 23, 42, 0.86);
}

button {
  border: 0;
  border-radius: 999px;
  padding: 0.8rem 1.15rem;
  cursor: pointer;
  transition: transform 140ms ease, opacity 140ms ease, background 140ms ease;
}

button:hover:not(:disabled) {
  transform: translateY(-1px);
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.button-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.action-row {
  margin: 1.1rem 0;
}

.primary-button {
  color: #111827;
  background: linear-gradient(135deg, #f59e0b, #facc15);
}

.accent-button {
  color: #e2e8f0;
  background: linear-gradient(135deg, #0f766e, #14b8a6);
}

.ghost-button {
  color: #f8fafc;
  background: rgba(255, 255, 255, 0.08);
}

.video-frame,
.preview-box {
  position: relative;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 22px;
  background: rgba(2, 6, 23, 0.88);
}

.video-frame {
  aspect-ratio: 16 / 10;
  min-height: 240px;
}

.video-frame video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  background: #000;
}

.preview-box img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.video-placeholder {
  position: absolute;
  inset: 0;
  z-index: 1;
}

.camera-status-pill {
  position: absolute;
  top: 0.6rem;
  left: 0.6rem;
  z-index: 2;
  padding: 0.3rem 0.7rem;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.85);
  border: 1px solid rgba(251, 191, 36, 0.4);
  color: #fbbf24;
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-size: 0.78rem;
  pointer-events: none;
}

.video-placeholder,
.preview-box.empty {
  display: grid;
  place-items: center;
  min-height: 240px;
  padding: 1rem;
  text-align: center;
  color: rgba(226, 232, 240, 0.66);
}

.preview-box {
  min-height: 240px;
  margin-bottom: 1rem;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.8rem;
  margin-bottom: 1rem;
}

.metric-card {
  padding: 1rem;
  border-radius: 18px;
  background: rgba(30, 41, 59, 0.78);
}

.metric-card span {
  display: block;
  color: rgba(226, 232, 240, 0.72);
  font-size: 0.84rem;
}

.metric-card strong {
  display: block;
  margin-top: 0.35rem;
  font-size: 1.6rem;
}

.warning-box,
.error-banner {
  margin-top: 1rem;
  padding: 1rem;
  border-radius: 18px;
  background: rgba(15, 23, 42, 0.72);
}

.error-banner {
  color: #fecaca;
  border: 1px solid rgba(248, 113, 113, 0.3);
}

.capabilities-list,
.history-list {
  display: grid;
  gap: 0.8rem;
  padding: 0;
  margin: 0;
  list-style: none;
}

.capabilities-list li,
.history-list li {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.95rem 1rem;
  border-radius: 16px;
  background: rgba(15, 23, 42, 0.72);
}

.history-list strong {
  display: block;
}

.history-list span {
  display: block;
  color: rgba(226, 232, 240, 0.7);
  font-size: 0.88rem;
}

@media (max-width: 960px) {
  .lab-shell {
    padding: 1rem;
  }

  .hero-card,
  .grid-layout {
    grid-template-columns: 1fr;
  }

  .control-grid,
  .metrics-grid {
    grid-template-columns: 1fr;
  }
}
</style>
