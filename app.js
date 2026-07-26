"use strict";

const API_BASE = "https://brass-studio-api.onrender.com";

const apiStatus = document.getElementById("apiStatus");
const audioFile = document.getElementById("audioFile");
const fileName = document.getElementById("fileName");
const uploadButton = document.getElementById("uploadButton");

const resultFilename = document.getElementById("resultFilename");
const resultSize = document.getElementById("resultSize");
const resultDuration = document.getElementById("resultDuration");

const errorMessage = document.getElementById("errorMessage");

let selectedFile = null;

window.addEventListener("DOMContentLoaded", () => {
    checkHealth();
});

audioFile.addEventListener("change", () => {

    selectedFile = audioFile.files[0] ?? null;

    if (selectedFile) {
        fileName.textContent = selectedFile.name;
        errorMessage.textContent = "なし";
    } else {
        fileName.textContent = "ファイル未選択";
    }

});

uploadButton.addEventListener("click", uploadAudio);

async function checkHealth() {

    try {

        const response = await fetch(`${API_BASE}/health`);

        if (!response.ok) {
            throw new Error();
        }

        const data = await response.json();

        apiStatus.textContent =
            `接続中 (API ${data.version})`;

    } catch {

        apiStatus.textContent = "接続失敗";

    }

}

async function uploadAudio() {

    if (!selectedFile) {

        errorMessage.textContent =
            "音源を選択してください。";

        return;
    }

    uploadButton.disabled = true;
    uploadButton.textContent = "アップロード中...";

    errorMessage.textContent = "";

    try {

        const formData = new FormData();

        formData.append(
            "audio",
            selectedFile
        );

        const response = await fetch(
            `${API_BASE}/upload`,
            {
                method: "POST",
                body: formData
            }
        );

        const data = await response.json();

        if (!response.ok) {

            throw new Error(
                data.detail ??
                "アップロードに失敗しました。"
            );

        }

        resultFilename.textContent =
            data.filename;

        resultSize.textContent =
            formatSize(data.size);

        resultDuration.textContent =
            `${Number(data.duration).toFixed(1)} 秒`;

    } catch (error) {

        errorMessage.textContent =
            error.message;

    } finally {

        uploadButton.disabled = false;
        uploadButton.textContent = "アップロード";

    }

}

function formatSize(bytes) {

    if (bytes < 1024) {
        return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;

}