const API_BASE_URL = "https://brass-studio-server.onrender.com";

const fileInput = document.getElementById("audioFile");
const uploadButton = document.getElementById("uploadButton");
const fileNameDisplay = document.getElementById("fileName");
const statusDisplay = document.getElementById("status");
const resultDisplay = document.getElementById("result");

uploadButton.disabled = true;

fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];

  if (!file) {
    fileNameDisplay.textContent = "ファイルが選択されていません";
    uploadButton.disabled = true;
    resultDisplay.innerHTML = "";
    return;
  }

  const ext = file.name.split(".").pop().toLowerCase();

  if (!["mp3", "wav", "m4a"].includes(ext)) {
    showStatus("MP3 / WAV / M4Aのみ対応しています。", true);
    uploadButton.disabled = true;
    return;
  }

  fileNameDisplay.textContent = file.name;
  uploadButton.disabled = false;
  showStatus("", false);
  resultDisplay.innerHTML = "";
});

uploadButton.addEventListener("click", uploadFile);

async function uploadFile() {
  const file = fileInput.files[0];

  if (!file) {
    showStatus("音声ファイルを選択してください。", true);
    return;
  }

  uploadButton.disabled = true;
  showStatus("アップロード中...", false);

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

    showStatus("解析完了", false);

    resultDisplay.innerHTML = `
      <div class="card">
        <h3>解析結果</h3>
        <p><strong>ファイル名：</strong>${escapeHtml(data.filename)}</p>
        <p><strong>形式：</strong>${escapeHtml(data.format.toUpperCase())}</p>
        <p><strong>長さ：</strong>${formatTime(data.duration)}</p>
      </div>
    `;

  } catch (err) {
    showStatus(err.message, true);
  } finally {
    uploadButton.disabled = false;
  }
}

async function healthCheck() {
  try {
    const res = await fetch(`${API_BASE_URL}/health`);

    if (!res.ok) throw new Error();

    const data = await res.json();

    if (data.status === "ok") {
      showStatus("サーバー接続OK", false);
    }
  } catch {
    showStatus("サーバーに接続できません", true);
  }
}

function formatTime(sec) {
  sec = Math.round(sec);

  const min = Math.floor(sec / 60);
  const s = sec % 60;

  return `${min}:${String(s).padStart(2, "0")}`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function showStatus(message, error) {
  statusDisplay.textContent = message;

  if (error) {
    statusDisplay.style.color = "#e53935";
  } else {
    statusDisplay.style.color = "#2e7d32";
  }
}

healthCheck();