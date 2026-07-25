"use strict";

const API_BASE_URL =
  "https://brass-studio-api.onrender.com";

const $ = (id) => document.getElementById(id);

const partInputs = [
  ...document.querySelectorAll(
    'input[name="part"]'
  )
];

const ui = {
  fileTab: $("fileTab"),
  urlTab: $("urlTab"),
  filePanel: $("filePanel"),
  urlPanel: $("urlPanel"),

  audioFile: $("audioFile"),
  sourceUrl: $("sourceUrl"),
  fileName: $("fileName"),
  audioPlayer: $("audioPlayer"),
  sourceError: $("sourceError"),

  audioInfoCard: $("audioInfoCard"),
  duration: $("duration"),
  sampleRate: $("sampleRate"),
  channels: $("channels"),
  fileSize: $("fileSize"),
  waveform: $("waveform"),

  allParts: $("allParts"),
  noParts: $("noParts"),
  partsError: $("partsError"),

  songTitle: $("songTitle"),
  tempoMode: $("tempoMode"),
  manualTempoField: $("manualTempoField"),
  manualTempo: $("manualTempo"),
  timeSignature: $("timeSignature"),

  analyzeButton: $("analyzeButton"),
  progressCard: $("progressCard"),
  progressText: $("progressText"),
  progressPercent: $("progressPercent"),
  progressBar: $("progressBar"),
  cancelButton: $("cancelButton"),

  resultCard: $("resultCard"),
  resultBpm: $("resultBpm"),
  resultKey: $("resultKey"),
  resultTime: $("resultTime"),
  resultMeasures: $("resultMeasures"),
  confidence: $("confidence"),

  musicXmlButton: $("musicXmlButton"),
  pdfButton: $("pdfButton"),
  resetButton: $("resetButton"),

  toast: $("toast")
};

const state = {
  inputMode: "file",
  file: null,
  audioUrl: "",
  audioBuffer: null,
  cancelled: false,
  result: null,
  serverConnected: false
};

const instruments = {
  trumpet: {
    name: "Trumpet",
    abbreviation: "Tpt.",
    clef: "G",
    clefLine: 2,
    diatonic: -1,
    chromatic: -2
  },

  trombone: {
    name: "Trombone",
    abbreviation: "Tbn.",
    clef: "F",
    clefLine: 4,
    diatonic: 0,
    chromatic: 0
  },

  "tenor-sax": {
    name: "Tenor Sax",
    abbreviation: "T. Sax",
    clef: "G",
    clefLine: 2,
    diatonic: -8,
    chromatic: -14
  },

  tuba: {
    name: "Tuba",
    abbreviation: "Tba.",
    clef: "F",
    clefLine: 4,
    diatonic: 0,
    chromatic: 0
  },

  "snare-drum": {
    name: "Snare Drum",
    abbreviation: "S.D.",
    clef: "percussion",
    clefLine: 2,
    percussion: true
  },

  "bass-drum": {
    name: "Bass Drum",
    abbreviation: "B.D.",
    clef: "percussion",
    clefLine: 2,
    percussion: true
  }
};

const keyNames = [
  "C",
  "C♯",
  "D",
  "E♭",
  "E",
  "F",
  "F♯",
  "G",
  "A♭",
  "A",
  "B♭",
  "B"
];

initialize();

function initialize() {
  bindEvents();
  updateAnalyzeButton();
}

function bindEvents() {
  ui.fileTab.addEventListener(
    "click",
    () => switchInputMode("file")
  );

  ui.urlTab.addEventListener(
    "click",
    () => switchInputMode("url")
  );

  ui.audioFile.addEventListener(
    "change",
    handleFileSelection
  );

  ui.sourceUrl.addEventListener(
    "input",
    updateAnalyzeButton
  );

  ui.allParts.addEventListener(
    "click",
    () => setAllParts(true)
  );

  ui.noParts.addEventListener(
    "click",
    () => setAllParts(false)
  );

  partInputs.forEach((input) => {
    input.addEventListener(
      "change",
      updateAnalyzeButton
    );
  });

  ui.tempoMode.addEventListener(
    "change",
    handleTempoMode
  );

  ui.analyzeButton.addEventListener(
    "click",
    startAnalysis
  );

  ui.cancelButton.addEventListener(
    "click",
    cancelAnalysis
  );

  ui.musicXmlButton.addEventListener(
    "click",
    downloadMusicXML
  );

  ui.pdfButton.addEventListener(
    "click",
    openPrintView
  );

  ui.resetButton.addEventListener(
    "click",
    resetProject
  );

  window.addEventListener(
    "beforeunload",
    revokeAudioUrl
  );
}

function switchInputMode(mode) {
  state.inputMode = mode;

  const fileMode = mode === "file";

  ui.filePanel.hidden = !fileMode;
  ui.urlPanel.hidden = fileMode;

  ui.fileTab.classList.toggle(
    "active",
    fileMode
  );

  ui.urlTab.classList.toggle(
    "active",
    !fileMode
  );

  ui.sourceError.textContent = "";

  updateAnalyzeButton();
}

function handleFileSelection(event) {
  const file = event.target.files?.[0];

  if (!file) {
    return;
  }

  const extension =
    file.name
      .split(".")
      .pop()
      ?.toLowerCase();

  const validExtension = [
    "mp3",
    "wav",
    "m4a"
  ].includes(extension);

  if (
    !validExtension ||
    file.size === 0 ||
    file.size > 200 * 1024 * 1024
  ) {
    ui.sourceError.textContent =
      "MP3・WAV・M4A、200MB以下のファイルを選択してください";

    ui.audioFile.value = "";
    state.file = null;
    updateAnalyzeButton();
    return;
  }

  revokeAudioUrl();

  state.file = file;
  state.audioBuffer = null;
  state.audioUrl =
    URL.createObjectURL(file);

  ui.audioPlayer.src =
    state.audioUrl;

  ui.audioPlayer.hidden = false;

  ui.fileName.textContent =
    `${file.name} / ${formatBytes(file.size)}`;

  if (!ui.songTitle.value.trim()) {
    ui.songTitle.value =
      removeExtension(file.name);
  }

  ui.sourceError.textContent = "";

  updateAnalyzeButton();
}

function handleTempoMode() {
  ui.manualTempoField.hidden =
    ui.tempoMode.value !== "manual";
}

function setAllParts(enabled) {
  partInputs.forEach((input) => {
    input.checked = enabled;
  });

  ui.partsError.textContent = "";

  updateAnalyzeButton();
}

function getSelectedParts() {
  return partInputs
    .filter((input) => input.checked)
    .map((input) => input.value);
}

function validateSourceUrl() {
  const value =
    ui.sourceUrl.value.trim();

  if (!value) {
    return false;
  }

  try {
    const url = new URL(value);
    const host =
      url.hostname.toLowerCase();

    return (
      host === "youtu.be" ||
      host.includes("youtube.com") ||
      host === "music.apple.com"
    );
  } catch {
    return false;
  }
}

function updateAnalyzeButton() {
  const sourceReady =
    state.inputMode === "file"
      ? Boolean(state.file)
      : validateSourceUrl();

  const partsReady =
    getSelectedParts().length > 0;

  ui.analyzeButton.disabled =
    !sourceReady || !partsReady;
}

async function uploadToServer(file) {
  const formData =
    new FormData();

  formData.append(
    "audio",
    file,
    file.name
  );

  const response = await fetch(
    `${API_BASE_URL}/analyze`,
    {
      method: "POST",
      body: formData
    }
  );

  if (!response.ok) {
    let message =
      "解析サーバーへの送信に失敗しました";

    try {
      const errorData =
        await response.json();

      message =
        errorData.detail || message;
    } catch {
      // JSON以外のエラー
    }

    throw new Error(message);
  }

  return response.json();
}

async function startAnalysis() {
  ui.sourceError.textContent = "";
  ui.partsError.textContent = "";

  const selectedParts =
    getSelectedParts();

  if (selectedParts.length === 0) {
    ui.partsError.textContent =
      "1つ以上のパートを選択してください";
    return;
  }

  if (
    state.inputMode === "file" &&
    !state.file
  ) {
    ui.sourceError.textContent =
      "音声ファイルを選択してください";
    return;
  }

  if (
    state.inputMode === "url" &&
    !validateSourceUrl()
  ) {
    ui.sourceError.textContent =
      "YouTubeまたはApple MusicのURLを入力してください";
    return;
  }

  state.cancelled = false;
  state.result = null;
  state.serverConnected = false;

  ui.resultCard.hidden = true;
  ui.progressCard.hidden = false;
  ui.analyzeButton.disabled = true;

  try {
    let analysisResult;

    if (state.inputMode === "file") {
      analysisResult =
        await analyzeFile();
    } else {
      analysisResult =
        await analyzeUrl();
    }

    stopIfCancelled();

    setProgress(
      92,
      "MusicXMLを準備中"
    );

    await wait(200);

    const title =
      ui.songTitle.value.trim() ||
      (
        state.file
          ? removeExtension(
              state.file.name
            )
          : "Untitled"
      );

    state.result = {
      title,
      parts: selectedParts,
      serverConnected:
        state.serverConnected,
      ...analysisResult
    };

    setProgress(
      100,
      "解析完了"
    );

    displayResult();
  } catch (error) {
    ui.progressCard.hidden = true;

    if (
      error.message === "cancelled"
    ) {
      showToast(
        "解析を中止しました"
      );
    } else {
      console.error(error);

      ui.sourceError.textContent =
        error.message ||
        "解析に失敗しました";

      showToast(
        "解析に失敗しました"
      );
    }
  } finally {
    updateAnalyzeButton();
  }
}

async function analyzeFile() {
  setProgress(
    5,
    "解析サーバーへ送信中"
  );

  const serverResult =
    await uploadToServer(
      state.file
    );

  stopIfCancelled();

  if (
    serverResult.status !==
    "connected"
  ) {
    throw new Error(
      "解析サーバーとの接続を確認できませんでした"
    );
  }

  state.serverConnected = true;

  setProgress(
    18,
    "サーバー接続成功"
  );

  await wait(200);

  setProgress(
    25,
    "音源を読み込み中"
  );

  const audioBuffer =
    await decodeAudioFile(
      state.file
    );

  stopIfCancelled();

  state.audioBuffer =
    audioBuffer;

  displayAudioInformation(
    audioBuffer
  );

  setProgress(
    38,
    "波形を作成中"
  );

  drawWaveform(
    audioBuffer
  );

  await nextFrame();

  const monoData =
    createMonoData(
      audioBuffer
    );

  stopIfCancelled();

  setProgress(
    56,
    "BPMを解析中"
  );

  const tempo =
    ui.tempoMode.value === "manual"
      ? {
          bpm: clamp(
            Number(
              ui.manualTempo.value
            ) || 120,
            40,
            240
          ),
          confidence: 100
        }
      : estimateTempo(
          monoData,
          audioBuffer.sampleRate
        );

  await nextFrame();

  stopIfCancelled();

  setProgress(
    76,
    "Keyを解析中"
  );

  const key =
    estimateKey(
      monoData,
      audioBuffer.sampleRate
    );

  const time =
    ui.timeSignature.value === "auto"
      ? "4/4"
      : ui.timeSignature.value;

  const measures =
    estimateMeasureCount(
      audioBuffer.duration,
      tempo.bpm,
      time
    );

  return {
    bpm: tempo.bpm,
    bpmConfidence:
      tempo.confidence,
    key: key.name,
    keyConfidence:
      key.confidence,
    fifths: key.fifths,
    mode: key.mode,
    time,
    measures
  };
}

async function analyzeUrl() {
  setProgress(
    30,
    "URLを確認中"
  );

  await wait(300);

  stopIfCancelled();

  const bpm =
    ui.tempoMode.value === "manual"
      ? clamp(
          Number(
            ui.manualTempo.value
          ) || 120,
          40,
          240
        )
      : 120;

  const time =
    ui.timeSignature.value === "auto"
      ? "4/4"
      : ui.timeSignature.value;

  return {
    bpm,
    bpmConfidence: 0,
    key: "C Major",
    keyConfidence: 0,
    fifths: 0,
    mode: "major",
    time,
    measures: 8
  };
}

async function decodeAudioFile(file) {
  const AudioContextClass =
    window.AudioContext ||
    window.webkitAudioContext;

  if (!AudioContextClass) {
    throw new Error(
      "このブラウザは音声解析に対応していません"
    );
  }

  const context =
    new AudioContextClass();

  try {
    const arrayBuffer =
      await file.arrayBuffer();

    return await context.decodeAudioData(
      arrayBuffer.slice(0)
    );
  } finally {
    await context.close();
  }
}

function displayAudioInformation(
  buffer
) {
  ui.audioInfoCard.hidden = false;

  ui.duration.textContent =
    formatTime(buffer.duration);

  ui.sampleRate.textContent =
    `${buffer.sampleRate.toLocaleString()} Hz`;

  ui.channels.textContent =
    buffer.numberOfChannels === 1
      ? "Mono"
      : `${buffer.numberOfChannels}ch`;

  ui.fileSize.textContent =
    formatBytes(
      state.file.size
    );
}

function createMonoData(buffer) {
  const mono =
    new Float32Array(
      buffer.length
    );

  for (
    let channel = 0;
    channel <
    buffer.numberOfChannels;
    channel += 1
  ) {
    const channelData =
      buffer.getChannelData(
        channel
      );

    for (
      let index = 0;
      index <
      channelData.length;
      index += 1
    ) {
      mono[index] +=
        channelData[index] /
        buffer.numberOfChannels;
    }
  }

  return mono;
}

function drawWaveform(buffer) {
  const canvas =
    ui.waveform;

  const ratio =
    Math.min(
      window.devicePixelRatio || 1,
      2
    );

  const width =
    Math.max(
      1,
      Math.floor(
        canvas.clientWidth *
        ratio
      )
    );

  const height =
    canvas.height * ratio;

  canvas.width = width;
  canvas.height = height;

  const context =
    canvas.getContext("2d");

  const data =
    createMonoData(buffer);

  const blockSize =
    Math.max(
      1,
      Math.floor(
        data.length / width
      )
    );

  context.clearRect(
    0,
    0,
    width,
    height
  );

  context.strokeStyle =
    "#d4a64e";

  context.lineWidth =
    ratio;

  context.beginPath();

  for (
    let x = 0;
    x < width;
    x += 1
  ) {
    let minimum = 1;
    let maximum = -1;

    const start =
      x * blockSize;

    const end =
      Math.min(
        start + blockSize,
        data.length
      );

    for (
      let index = start;
      index < end;
      index += 1
    ) {
      minimum =
        Math.min(
          minimum,
          data[index]
        );

      maximum =
        Math.max(
          maximum,
          data[index]
        );
    }

    context.moveTo(
      x,
      height / 2 +
      minimum *
      height *
      0.43
    );

    context.lineTo(
      x,
      height / 2 +
      maximum *
      height *
      0.43
    );
  }

  context.stroke();
}

function estimateTempo(
  samples,
  sampleRate
) {
  const targetRate = 200;

  const step =
    Math.max(
      1,
      Math.floor(
        sampleRate /
        targetRate
      )
    );

  const seconds =
    Math.min(
      samples.length /
      sampleRate,
      180
    );

  const envelope =
    new Float32Array(
      Math.floor(
        seconds *
        targetRate
      )
    );

  let previous = 0;

  for (
    let index = 0;
    index <
    envelope.length;
    index += 1
  ) {
    let sum = 0;

    const start =
      index * step;

    for (
      let offset = 0;
      offset < step &&
      start + offset <
      samples.length;
      offset += 1
    ) {
      sum += Math.abs(
        samples[
          start + offset
        ]
      );
    }

    const value =
      sum / step;

    envelope[index] =
      Math.max(
        0,
        value -
        previous * 0.9
      );

    previous = value;
  }

  let bestBpm = 120;
  let bestScore = -1;
  let totalScore = 0;

  for (
    let bpm = 60;
    bpm <= 200;
    bpm += 1
  ) {
    const lag =
      Math.round(
        targetRate *
        60 /
        bpm
      );

    let score = 0;

    for (
      let index = lag;
      index <
      envelope.length;
      index += 1
    ) {
      score +=
        envelope[index] *
        envelope[
          index - lag
        ];
    }

    totalScore +=
      Math.max(
        0,
        score
      );

    if (
      score >
      bestScore
    ) {
      bestScore = score;
      bestBpm = bpm;
    }
  }

  const confidence =
    totalScore > 0
      ? Math.round(
          clamp(
            bestScore /
            (
              totalScore /
              141
            ) *
            12,
            20,
            94
          )
        )
      : 20;

  return {
    bpm: bestBpm,
    confidence
  };
}

function estimateKey(
  samples,
  sampleRate
) {
  const maximumSamples =
    Math.min(
      samples.length,
      Math.floor(
        sampleRate * 45
      )
    );

  const stride =
    Math.max(
      1,
      Math.floor(
        maximumSamples /
        16000
      )
    );

  const reducedData =
    new Float32Array(
      Math.floor(
        maximumSamples /
        stride
      )
    );

  for (
    let index = 0;
    index <
    reducedData.length;
    index += 1
  ) {
    reducedData[index] =
      samples[
        index * stride
      ] || 0;
  }

  const chroma =
    new Float64Array(12);

  const reducedRate =
    sampleRate / stride;

  for (
    let midi = 36;
    midi <= 83;
    midi += 1
  ) {
    const frequency =
      440 *
      Math.pow(
        2,
        (midi - 69) /
        12
      );

    const coefficient =
      2 *
      Math.cos(
        2 *
        Math.PI *
        frequency /
        reducedRate
      );

    let current = 0;
    let previous = 0;
    let beforePrevious = 0;

    for (
      const value of
      reducedData
    ) {
      current =
        value +
        coefficient *
        previous -
        beforePrevious;

      beforePrevious =
        previous;

      previous =
        current;
    }

    const power =
      Math.max(
        0,
        previous *
        previous +
        beforePrevious *
        beforePrevious -
        coefficient *
        previous *
        beforePrevious
      );

    chroma[midi % 12] +=
      Math.sqrt(power);
  }

  let root = 0;
  let bestValue = -1;

  for (
    let index = 0;
    index <
    chroma.length;
    index += 1
  ) {
    if (
      chroma[index] >
      bestValue
    ) {
      bestValue =
        chroma[index];

      root = index;
    }
  }

  const fifthsMap = {
    0: 0,
    1: 7,
    2: 2,
    3: -3,
    4: 4,
    5: -1,
    6: 6,
    7: 1,
    8: -4,
    9: 3,
    10: -2,
    11: 5
  };

  return {
    name:
      `${keyNames[root]} Major`,
    confidence: 55,
    fifths:
      fifthsMap[root],
    mode: "major"
  };
}

function estimateMeasureCount(
  duration,
  bpm,
  time
) {
  const [
    beats,
    beatType
  ] =
    time
      .split("/")
      .map(Number);

  const quarterBeats =
    beats *
    (
      4 /
      beatType
    );

  return Math.max(
    1,
    Math.round(
      (
        duration *
        bpm /
        60
      ) /
      quarterBeats
    )
  );
}

function displayResult() {
  const result =
    state.result;

  ui.resultBpm.textContent =
    result.bpm;

  ui.resultKey.textContent =
    result.key
      .replace(
        " Major",
        ""
      )
      .replace(
        " Minor",
        "m"
      );

  ui.resultTime.textContent =
    result.time;

  ui.resultMeasures.textContent =
    result.measures;

  const connectionText =
    result.serverConnected
      ? " / サーバー接続済み"
      : "";

  ui.confidence.textContent =
    `BPM信頼度 ${result.bpmConfidence}% / ` +
    `Key信頼度 ${result.keyConfidence}%` +
    connectionText;

  ui.progressCard.hidden =
    true;

  ui.resultCard.hidden =
    false;

  ui.resultCard.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });

  showToast(
    result.serverConnected
      ? "解析サーバー接続に成功しました"
      : "解析が完了しました"
  );
}

function createMusicXML(
  result
) {
  const [
    beats,
    beatType
  ] =
    result.time
      .split("/")
      .map(Number);

  const divisions = 4;

  const measureDuration =
    divisions *
    beats *
    (
      4 /
      beatType
    );

  const partList =
    result.parts
      .map(
        (
          partKey,
          index
        ) => {
          const part =
            instruments[
              partKey
            ];

          return (
            `<score-part id="P${index + 1}">` +
            `<part-name>${escapeXml(part.name)}</part-name>` +
            `<part-abbreviation>${escapeXml(part.abbreviation)}</part-abbreviation>` +
            `</score-part>`
          );
        }
      )
      .join("");

  const scoreParts =
    result.parts
      .map(
        (
          partKey,
          index
        ) => {
          const part =
            instruments[
              partKey
            ];

          let measures = "";

          for (
            let measure = 1;
            measure <=
            result.measures;
            measure += 1
          ) {
            const attributes =
              measure === 1
                ? createAttributesXml(
                    part,
                    divisions,
                    beats,
                    beatType,
                    result
                  )
                : "";

            const tempo =
              measure === 1
                ? (
                    `<direction>` +
                    `<direction-type>` +
                    `<metronome>` +
                    `<beat-unit>quarter</beat-unit>` +
                    `<per-minute>${result.bpm}</per-minute>` +
                    `</metronome>` +
                    `</direction-type>` +
                    `<sound tempo="${result.bpm}"/>` +
                    `</direction>`
                  )
                : "";

            const finalBarline =
              measure ===
              result.measures
                ? (
                    `<barline location="right">` +
                    `<bar-style>light-heavy</bar-style>` +
                    `</barline>`
                  )
                : "";

            measures +=
              `<measure number="${measure}">` +
              attributes +
              tempo +
              `<note>` +
              `<rest measure="yes"/>` +
              `<duration>${measureDuration}</duration>` +
              `<voice>1</voice>` +
              `<type>whole</type>` +
              `</note>` +
              finalBarline +
              `</measure>`;
          }

          return (
            `<part id="P${index + 1}">` +
            measures +
            `</part>`
          );
        }
      )
      .join("");

  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n` +
    `<!DOCTYPE score-partwise PUBLIC ` +
    `"-//Recordare//DTD MusicXML 4.0 Partwise//EN" ` +
    `"http://www.musicxml.org/dtds/partwise.dtd">\n` +
    `<score-partwise version="4.0">` +
    `<work>` +
    `<work-title>${escapeXml(result.title)}</work-title>` +
    `</work>` +
    `<movement-title>${escapeXml(result.title)}</movement-title>` +
    `<identification>` +
    `<creator type="arranger">Brass Studio</creator>` +
    `<encoding>` +
    `<software>Brass Studio Ver.1.1</software>` +
    `</encoding>` +
    `</identification>` +
    `<part-list>${partList}</part-list>` +
    scoreParts +
    `</score-partwise>`
  );
}

function createAttributesXml(
  part,
  divisions,
  beats,
  beatType,
  result
) {
  const transpose =
    part.chromatic
      ? (
          `<transpose>` +
          `<diatonic>${part.diatonic}</diatonic>` +
          `<chromatic>${part.chromatic}</chromatic>` +
          `</transpose>`
        )
      : "";

  const staffDetails =
    part.percussion
      ? (
          `<staff-details>` +
          `<staff-lines>1</staff-lines>` +
          `</staff-details>`
        )
      : "";

  return (
    `<attributes>` +
    `<divisions>${divisions}</divisions>` +
    `<key>` +
    `<fifths>${result.fifths}</fifths>` +
    `<mode>${result.mode}</mode>` +
    `</key>` +
    `<time>` +
    `<beats>${beats}</beats>` +
    `<beat-type>${beatType}</beat-type>` +
    `</time>` +
    `<clef>` +
    `<sign>${part.clef}</sign>` +
    `<line>${part.clefLine}</line>` +
    `</clef>` +
    transpose +
    staffDetails +
    `</attributes>`
  );
}

function downloadMusicXML() {
  if (!state.result) {
    return;
  }

  const content =
    createMusicXML(
      state.result
    );

  const blob =
    new Blob(
      [content],
      {
        type:
          "application/vnd.recordare.musicxml+xml;charset=utf-8"
      }
    );

  downloadFile(
    blob,
    `${safeFileName(state.result.title)}.musicxml`
  );

  showToast(
    "MusicXMLを作成しました"
  );
}

function openPrintView() {
  if (!state.result) {
    return;
  }

  const result =
    state.result;

  const printWindow =
    window.open(
      "",
      "_blank"
    );

  if (!printWindow) {
    showToast(
      "ポップアップを許可してください"
    );
    return;
  }

  const partsHtml =
    result.parts
      .map(
        (partKey) => {
          const part =
            instruments[
              partKey
            ];

          return (
            `<section>` +
            `<strong>${escapeXml(part.name)}</strong>` +
            `<div class="staff"></div>` +
            `</section>`
          );
        }
      )
      .join("");

  printWindow.document.write(
    `<!doctype html>` +
    `<html lang="ja">` +
    `<head>` +
    `<meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<title>${escapeXml(result.title)}</title>` +
    `<style>` +
    `body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;padding:20px;color:#111}` +
    `.toolbar{margin-bottom:20px}` +
    `.toolbar button{padding:10px 14px}` +
    `h1{text-align:center}` +
    `section{margin:28px 0;break-inside:avoid}` +
    `.staff{height:55px;margin-top:8px;background:repeating-linear-gradient(to bottom,#111 0,#111 1px,transparent 1px,transparent 11px)}` +
    `@media print{.toolbar{display:none}@page{size:A4;margin:15mm}}` +
    `</style>` +
    `</head>` +
    `<body>` +
    `<div class="toolbar">` +
    `<button onclick="window.print()">PDFとして保存</button>` +
    `</div>` +
    `<h1>${escapeXml(result.title)}</h1>` +
    `<p>${result.bpm} BPM / ${escapeXml(result.key)} / ${result.time}</p>` +
    partsHtml +
    `</body>` +
    `</html>`
  );

  printWindow.document.close();
}

function cancelAnalysis() {
  state.cancelled = true;

  ui.progressText.textContent =
    "中止しています";
}

function resetProject() {
  state.cancelled = true;
  state.file = null;
  state.audioBuffer = null;
  state.result = null;
  state.serverConnected = false;

  revokeAudioUrl();

  ui.audioFile.value = "";
  ui.sourceUrl.value = "";
  ui.songTitle.value = "";

  ui.audioPlayer.hidden = true;
  ui.audioPlayer.removeAttribute(
    "src"
  );

  ui.audioInfoCard.hidden = true;
  ui.progressCard.hidden = true;
  ui.resultCard.hidden = true;

  ui.fileName.textContent =
    "MP3・WAV・M4A / 200MB以下";

  setAllParts(true);
  switchInputMode("file");

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });

  showToast(
    "新しいプロジェクトを開始しました"
  );
}

function setProgress(
  percent,
  text
) {
  ui.progressText.textContent =
    text;

  ui.progressPercent.textContent =
    `${percent}%`;

  ui.progressBar.style.width =
    `${percent}%`;
}

function stopIfCancelled() {
  if (state.cancelled) {
    throw new Error(
      "cancelled"
    );
  }
}

function revokeAudioUrl() {
  if (state.audioUrl) {
    URL.revokeObjectURL(
      state.audioUrl
    );

    state.audioUrl = "";
  }
}

function downloadFile(
  blob,
  fileName
) {
  const url =
    URL.createObjectURL(blob);

  const link =
    document.createElement("a");

  link.href = url;
  link.download = fileName;

  document.body.appendChild(
    link
  );

  link.click();
  link.remove();

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}

function escapeXml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function safeFileName(value) {
  return (
    value || "score"
  ).replace(
    /[\\/:*?"<>|]/g,
    "_"
  );
}

function removeExtension(
  fileName
) {
  return fileName.replace(
    /\.[^/.]+$/,
    ""
  );
}

function formatBytes(bytes) {
  if (
    bytes <
    1024 * 1024
  ) {
    return (
      `${(bytes / 1024).toFixed(1)} KB`
    );
  }

  return (
    `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  );
}

function formatTime(seconds) {
  const minutes =
    Math.floor(
      seconds / 60
    );

  const remainingSeconds =
    Math.floor(
      seconds % 60
    );

  return (
    `${String(minutes).padStart(2, "0")}:` +
    `${String(remainingSeconds).padStart(2, "0")}`
  );
}

function clamp(
  value,
  minimum,
  maximum
) {
  return Math.max(
    minimum,
    Math.min(
      maximum,
      value
    )
  );
}

function wait(milliseconds) {
  return new Promise(
    (resolve) => {
      setTimeout(
        resolve,
        milliseconds
      );
    }
  );
}

function nextFrame() {
  return new Promise(
    (resolve) => {
      requestAnimationFrame(
        resolve
      );
    }
  );
}

let toastTimer = null;

function showToast(message) {
  clearTimeout(
    toastTimer
  );

  ui.toast.textContent =
    message;

  ui.toast.hidden = false;

  toastTimer =
    setTimeout(() => {
      ui.toast.hidden = true;
    }, 2200);
}
