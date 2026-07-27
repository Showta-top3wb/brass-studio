const API_BASE_URL = "https://brass-studio-server.onrender.com";

const apiStatus = document.getElementById("apiStatus");
const fileInput = document.getElementById("audioFile");
const fileNameDisplay = document.getElementById("fileName");
const uploadButton = document.getElementById("uploadButton");
const resultFilename = document.getElementById("resultFilename");
const resultSize = document.getElementById("resultSize");
const resultDuration = document.getElementById("resultDuration");
const errorMessage = document.getElementById("errorMessage");

uploadButton.disabled = true;

fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];

  clearResult();
  clearError();

  if (!file) {
    fileNameDisplay.textContent = "ファイル未選択";
    uploadButton.disabled = true;
    return;
  }

  const extension = file.name.split(".").pop().toLowerCase();

  if (!["mp3", "wav", "m4a"].includes(extension)) {
    fileNameDisplay.textContent = file.name;
    uploadButton.disabled = true;
    showError("MP3、WAV、M4Aファイルのみ対応しています。");
    return;
  }

  fileNameDisplay.textContent = file.name;
  uploadButton.disabled = false;
});

uploadButton.addEventListener("click", async () => {
  const file = fileInput.files[0];

  if (!file) {
    showError("音声ファイルを選択してください。");
    return;
  }

  clearResult();
  clearError();

  uploadButton.disabled = true;
  uploadButton.textContent = "アップロード中…";

  const formData = new FormData();
  formData.append("file", file);

  try {
    const response = await fetch(`${API_BASE_URL}/upload`, {
      method: "POST",
      body: formData
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.detail || "アップロードに失敗しました。");
    }

    resultFilename.textContent = data.filename || file.name;
    resultSize.textContent = formatFileSize(file.size);
    resultDuration.textContent = formatDuration(data.duration);
  } catch (error) {
    showError(
      error instanceof Error
        ? error.message
        : "サーバーとの通信に失敗しました。"
    );
  } finally {
    uploadButton.disabled = false;
    uploadButton.textContent = "アップロード";
  }
});

async function checkApiStatus() {
  apiStatus.textContent = "確認中…";

  try {
    const response = await fetch(`${API_BASE_URL}/health`, {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error();
    }

    const data = await response.json();

    if (data.status !== "ok") {
      throw new Error();
    }

    apiStatus.textContent = "接続済み";
  } catch {
    apiStatus.textContent = "接続できません";
    showError("APIサーバーに接続できませんでした。");
  }
}

function formatDuration(seconds) {
  const totalSeconds = Math.round(Number(seconds));

  if (!Number.isFinite(totalSeconds)) {
    return "-";
  }

  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;

  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

function formatFileSize(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function clearResult() {
  resultFilename.textContent = "-";
  resultSize.textContent = "-";
  resultDuration.textContent = "-";
}

function clearError() {
  errorMessage.textContent = "なし";
}

function showError(message) {
  errorMessage.textContent = message;
}

checkApiStatus();