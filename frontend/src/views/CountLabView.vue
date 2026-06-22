<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { fetchEngineInfo, fetchHealth, postDatasetCapture } from "@/api/countApi";
import { useCamera } from "@/composables/useCamera";
import { useLiveCount } from "@/composables/useLiveCount";
import type { CountEngineInfo } from "@/types/count";

function createClientRequestId(): string {
  return `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createDefaultSessionName(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `camera-session-${year}${month}${day}`;
}

const productIdInput = ref("");
const itemCode = ref("");
const liveIntervalMs = ref(650);
const engineInfo = ref<CountEngineInfo | null>(null);
const healthStatus = ref<"idle" | "ok" | "error">("idle");
const healthMessage = ref("Verification du backend...");
const capturedImage = ref<string | null>(null);
const datasetSessionName = ref(createDefaultSessionName());
const datasetNotes = ref("");
const datasetSaveState = ref<"idle" | "saving" | "success" | "error">("idle");
const datasetSaveMessage = ref("Aucune capture dataset sauvegardee pour le moment.");
const datasetSavedCount = ref(0);
const showMetrics = ref(false);
const autoCapture = ref(false);
const AUTO_CAPTURE_INTERVAL_MS = 3000;
let autoCaptureTimer: ReturnType<typeof setInterval> | null = null;

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
  lastFrame,
  isLoopRunning,
  countFrame,
  startLiveLoop,
  freezeLiveLoop,
  resetResults,
} = useLiveCount();

const combinedError = computed(() => cameraError.value || countError.value || "");
const activeImage = computed(() => capturedImage.value || lastFrame.value);
const cameraStatusLabel = computed(() => {
  if (cameraError.value) {
    return cameraError.value;
  }

  const raw = cameraStatus.value;
  if (raw.startsWith("error:NotReadableError")) {
    return "Camera indisponible";
  }
  if (raw.startsWith("error:NotAllowedError")) {
    return "Acces camera refuse";
  }
  if (raw === "idle" || raw === "stopped") {
    return "en attente";
  }
  if (raw.startsWith("playing:")) {
    return "camera active";
  }
  if (raw.startsWith("requesting")) {
    return "demande d'acces camera";
  }
  if (raw === "permission-timeout") {
    return "delai d'acces camera depasse";
  }
  return raw;
});
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
      return "gele";
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
  return "indisponible";
});
const canSaveDatasetCapture = computed(() => {
  if (datasetSaveState.value === "saving") {
    return false;
  }

  return Boolean(capturedImage.value || isStreaming.value);
});

async function refreshBackendStatus() {
  try {
    const [health, info] = await Promise.all([fetchHealth(), fetchEngineInfo()]);
    healthStatus.value = "ok";
    healthMessage.value = `${health.service} est operationnel`;
    engineInfo.value = info;
  } catch (error) {
    healthStatus.value = "error";
    healthMessage.value = error instanceof Error ? error.message : "Backend indisponible";
  }
}

async function handleStartCamera() {
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

async function handleSaveDatasetCapture() {
  // Un seul clic = capture fraiche (si la camera tourne) + sauvegarde dataset.
  const frame = isStreaming.value ? captureFrame() : capturedImage.value;
  if (!frame) {
    datasetSaveState.value = "error";
    datasetSaveMessage.value = "Aucune image disponible pour le dataset. Lancez la camera ou capturez une image.";
    return;
  }

  capturedImage.value = frame;
  datasetSaveState.value = "saving";
  datasetSaveMessage.value = "Enregistrement de la capture dataset...";

  try {
    const response = await postDatasetCapture({
      request_id: createClientRequestId(),
      image_base64: frame,
      session_name: datasetSessionName.value || undefined,
      notes: datasetNotes.value || undefined,
      product_id: parsedProductId.value,
      item_code: itemCode.value || undefined,
      metadata: {
        source: "devoq-ai-web",
        camera_label: selectedCameraLabel.value,
        captured_at: new Date().toISOString(),
        flow: "dataset_capture",
        detector: activeDetectorLabel.value,
        previous_quantity: result.value?.quantity,
        previous_confidence: result.value?.confidence,
      },
    });

    datasetSavedCount.value += 1;
    datasetSaveState.value = "success";
    datasetSaveMessage.value = `Capture ${response.capture_id} enregistree dans ${response.image_path}`;
  } catch (error) {
    datasetSaveState.value = "error";
    datasetSaveMessage.value = error instanceof Error ? error.message : "Impossible de sauvegarder la capture dataset";
  }
}

function stopAutoCapture() {
  if (autoCaptureTimer !== null) {
    clearInterval(autoCaptureTimer);
    autoCaptureTimer = null;
  }
}

function startAutoCapture() {
  stopAutoCapture();
  autoCaptureTimer = setInterval(() => {
    // ne capture que si la camera tourne et qu'aucune sauvegarde n'est en cours
    if (!isStreaming.value || datasetSaveState.value === "saving") {
      return;
    }
    void handleSaveDatasetCapture();
  }, AUTO_CAPTURE_INTERVAL_MS);
}

watch(autoCapture, (enabled) => {
  if (enabled) {
    startAutoCapture();
  } else {
    stopAutoCapture();
  }
});

onBeforeUnmount(() => {
  stopAutoCapture();
});

onMounted(async () => {
  await refreshBackendStatus();
  await loadDevices();
});
</script>

<template>
  <main class="screen">
    <section class="workspace">
      <article class="block controls-column">
        <div class="block-head">
          <div>
            <h2>Comptage</h2>
            <p>Configurer la camera puis lancer un comptage.</p>
          </div>
        </div>

        <div class="button-row">
          <button class="secondary-button" @click="refreshBackendStatus">Actualiser</button>
          <button class="secondary-button" @click="loadDevices">Recharger</button>
        </div>

        <div class="field-grid">
          <label>
            <span>Camera</span>
            <select v-model="selectedDeviceId">
              <option value="" disabled>Selectionner un peripherique</option>
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
            <span>Intervalle live</span>
            <input v-model.number="liveIntervalMs" type="number" min="300" step="50" placeholder="650" />
          </label>
        </div>

        <div class="button-row action-row controls-actions">
          <button class="primary-button" @click="handleStartCamera">Demarrer camera</button>
          <button class="secondary-button" :disabled="!isStreaming" @click="stopCamera">Arreter</button>
          <button class="secondary-button" :disabled="!isStreaming" @click="handleCapture">Capturer</button>
          <button class="secondary-button" :disabled="!isStreaming || isLoopRunning" @click="handleCountOnce">
            Compter une fois
          </button>
          <button class="secondary-button" :disabled="!isStreaming || isLoopRunning" @click="handleStartLive">
            Demarrer live
          </button>
          <button class="secondary-button" :disabled="!isLoopRunning" @click="handleFreeze">Geler</button>
        </div>

        <p class="meta-line">etat camera {{ cameraStatusLabel }}</p>
        <p v-if="combinedError" class="feedback error">{{ combinedError }}</p>
      </article>

      <article class="block camera-column">
        <div class="camera-stage">
          <div class="frame camera-frame">
            <video ref="videoRef" autoplay playsinline muted></video>
            <div v-if="!isStreaming" class="frame-placeholder">
              La camera apparaitra ici apres autorisation.
            </div>
          </div>
        </div>

        <div class="metrics-panel">
          <button class="secondary-button toggle-metrics" @click="showMetrics = !showMetrics">
            {{ showMetrics ? "Masquer les metriques" : "Afficher les metriques" }}
          </button>

          <template v-if="showMetrics">
            <dl class="metrics">
              <div>
                <dt>Etat</dt>
                <dd>{{ stateLabel }}</dd>
              </div>
              <div>
                <dt>Quantite</dt>
                <dd>{{ result?.quantity ?? "-" }}</dd>
              </div>
              <div>
                <dt>Confiance</dt>
                <dd>{{ formattedConfidence }}</dd>
              </div>
              <div>
                <dt>Latence</dt>
                <dd>{{ result?.inference_ms ?? "-" }} ms</dd>
              </div>
            </dl>

            <div v-if="result?.warnings?.length" class="feedback">
              <strong>Avertissements</strong>
              <p v-for="warning in result.warnings" :key="warning">{{ warning }}</p>
            </div>
          </template>
        </div>
      </article>

      <div class="side-column">
        <article class="block">
          <div class="block-head">
            <div>
              <h2>Resultat</h2>
              <p>Derniere image analysee et metriques du comptage.</p>
            </div>
            <button class="secondary-button" @click="handleResetSession">Reinitialiser</button>
          </div>

          <div class="frame preview" :class="{ empty: !activeImage }">
            <img v-if="activeImage" :src="activeImage" alt="Apercu de l'image analysee" />
            <span v-else>Capturez une image ou lancez le live.</span>
          </div>
        </article>

        <article class="block">
          <div class="block-head">
            <div>
              <h2>Dataset</h2>
              <p>Sauvegarder l'image courante pour annotation.</p>
            </div>
            <p class="counter">{{ datasetSavedCount }}</p>
          </div>

          <div class="dataset-fields">
            <label>
              <span>Session</span>
              <input v-model="datasetSessionName" placeholder="camera-session-20260617" />
            </label>

            <label>
              <span>Notes</span>
              <input v-model="datasetNotes" placeholder="fond clair, ombre legere, 5 vis" />
            </label>
          </div>

          <p class="meta-line">sauvegarde dans datasets/raw/captures/&lt;session&gt;/</p>

          <div class="button-row action-row capture-row">
            <button class="primary-button" :disabled="!canSaveDatasetCapture" @click="handleSaveDatasetCapture">
              Capturer et sauver au dataset
            </button>
            <label class="auto-capture" :class="{ active: autoCapture }">
              <input type="checkbox" v-model="autoCapture" />
              <span>Capture auto (3s)</span>
            </label>
          </div>

          <p class="feedback" :data-state="datasetSaveState">
            {{ datasetSaveMessage }}
          </p>
        </article>
      </div>
    </section>
  </main>
</template>

<style scoped>
.screen {
  min-height: 100vh;
  padding: 1rem;
  color: #111111;
  background: #ffffff;
  font-family: "Helvetica Neue", Arial, sans-serif;
}

h1,
h2,
dt,
dd,
strong,
.counter {
  margin: 0;
}

h1 {
  max-width: 24rem;
  font-size: 1.5rem;
  line-height: 1.2;
  letter-spacing: -0.01em;
  font-weight: 600;
}

h2 {
  font-size: 1.15rem;
  line-height: 1.2;
  font-weight: 600;
}

.block-head p,
.meta-line,
.frame-placeholder,
.preview span,
.feedback p,
label span,
input::placeholder {
  color: #666666;
}

.workspace {
  display: grid;
  grid-template-columns: minmax(15rem, 0.85fr) minmax(0, 1.7fr) minmax(20rem, 0.95fr);
  column-gap: 0.6rem;
  row-gap: 1rem;
  align-items: start;
}

.controls-column {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.camera-column {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  gap: 0.75rem;
}

.metrics-panel {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  width: 100%;
  max-width: 36rem;
}

.toggle-metrics {
  align-self: flex-start;
}

.capture-row {
  align-items: center;
}

.auto-capture {
  flex-direction: row;
  align-items: center;
  gap: 0.45rem;
  white-space: nowrap;
  cursor: pointer;
  border: 1px solid #d0d0d0;
  padding: 0.55rem 0.7rem;
}

.auto-capture.active {
  border-color: #111111;
}

.auto-capture input[type="checkbox"] {
  width: 1rem;
  height: 1rem;
  padding: 0;
  border-radius: 0;
  cursor: pointer;
}

.side-column {
  display: grid;
  gap: 0.3rem;
}

.block {
  border: 1px solid #d9d9d9;
  padding: 0.5rem;
  background: #ffffff;
}

.block-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 0.75rem;
}

.compact-head {
  align-items: center;
}

.head-line {
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
  min-width: 0;
}

.block-head p {
  margin: 0;
  line-height: 1.4;
}

.compact-head .block-head p,
.head-line p {
  white-space: nowrap;
}

.field-grid,
.dataset-fields {
  display: grid;
  gap: 0.75rem;
}

.camera-stage {
  display: flex;
  justify-content: center;
  width: 100%;
}

.field-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.controls-column .field-grid {
  grid-template-columns: 1fr;
}

.controls-actions {
  flex-direction: column;
}

.controls-actions button {
  width: 100%;
}

label {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  font-size: 0.88rem;
}

input,
select,
button {
  font: inherit;
}

input,
select {
  border: 1px solid #d0d0d0;
  border-radius: 0;
  padding: 0.8rem 0.9rem;
  color: #111111;
  background: #ffffff;
}

button {
  border: 1px solid #111111;
  border-radius: 0;
  padding: 0.65rem 0.85rem;
  cursor: pointer;
  transition: background 140ms ease, color 140ms ease, opacity 140ms ease;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.button-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.action-row {
  margin: 0.75rem 0;
}

.primary-button {
  color: #ffffff;
  background: #111111;
}

.secondary-button {
  color: #111111;
  background: #ffffff;
}

.primary-button:hover:not(:disabled),
.secondary-button:hover:not(:disabled) {
  color: #ffffff;
  background: #111111;
}

.frame {
  position: relative;
  overflow: hidden;
  border: 1px solid #d9d9d9;
  background: #ffffff;
}

.frame video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  background: #000;
}

.frame,
.preview {
  min-height: 22rem;
}

.camera-frame {
  width: 100%;
  max-width: 36rem;
  min-height: 0;
}

.camera-frame::before {
  content: "";
  display: block;
  padding-top: 100%;
}

.camera-frame .frame-placeholder {
  position: absolute;
  inset: 0;
  min-height: 0;
}

.preview {
  margin-bottom: 0.5rem;
}

.preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.frame-placeholder,
.preview.empty {
  display: grid;
  place-items: center;
  min-height: 22rem;
  padding: 1rem;
  text-align: center;
}

.meta-line {
  margin: 0.5rem 0 0;
  font-size: 0.8rem;
  line-height: 1.5;
}

.metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1px;
  background: #d9d9d9;
  border: 1px solid #d9d9d9;
}

.metrics div {
  padding: 0.9rem;
  background: #ffffff;
}

dt {
  color: #666666;
  font-size: 0.76rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

dd {
  display: block;
  margin-top: 0.35rem;
  color: #111111;
  font-size: 1.25rem;
  line-height: 1.1;
}

.feedback {
  margin-top: 1rem;
  border: 1px solid #d9d9d9;
  padding: 0.9rem;
  line-height: 1.6;
  color: #111111;
}

.feedback[data-state="error"],
.feedback.error {
  border-color: #bdbdbd;
}

.counter {
  color: #111111;
  font-size: 1.4rem;
  line-height: 1;
  font-weight: 600;
}

@media (max-width: 1100px) {
  .workspace {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 760px) {
  .screen {
    padding: 1rem;
  }

  .head-line {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.2rem;
  }

  .head-line p {
    white-space: normal;
  }

  h1 {
    font-size: 1.35rem;
  }

  .field-grid,
  .metrics {
    grid-template-columns: 1fr;
  }
}
</style>
