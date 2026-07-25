"use strict";

const $ = (id) => document.getElementById(id);
const parts = [...document.querySelectorAll('input[name="part"]')];

const ui = {
  fileTab: $("fileTab"), urlTab: $("urlTab"),
  filePanel: $("filePanel"), urlPanel: $("urlPanel"),
  audioFile: $("audioFile"), sourceUrl: $("sourceUrl"),
  fileName: $("fileName"), audioPlayer: $("audioPlayer"),
  sourceError: $("sourceError"), audioInfoCard: $("audioInfoCard"),
  duration: $("duration"), sampleRate: $("sampleRate"),
  channels: $("channels"), fileSize: $("fileSize"),
  waveform: $("waveform"), allParts: $("allParts"), noParts: $("noParts"),
  partsError: $("partsError"), songTitle: $("songTitle"),
  tempoMode: $("tempoMode"), manualTempoField: $("manualTempoField"),
  manualTempo: $("manualTempo"), timeSignature: $("timeSignature"),
  analyzeButton: $("analyzeButton"), progressCard: $("progressCard"),
  progressText: $("progressText"), progressPercent: $("progressPercent"),
  progressBar: $("progressBar"), cancelButton: $("cancelButton"),
  resultCard: $("resultCard"), resultBpm: $("resultBpm"),
  resultKey: $("resultKey"), resultTime: $("resultTime"),
  resultMeasures: $("resultMeasures"), confidence: $("confidence"),
  musicXmlButton: $("musicXmlButton"), pdfButton: $("pdfButton"),
  resetButton: $("resetButton"), toast: $("toast")
};

const state = {
  mode: "file",
  file: null,
  objectUrl: "",
  audioBuffer: null,
  cancelled: false,
  result: null
};

const partMap = {
  trumpet:{name:"Trumpet",abbr:"Tpt.",clef:"G",line:2,chromatic:-2,diatonic:-1,midi:57},
  trombone:{name:"Trombone",abbr:"Tbn.",clef:"F",line:4,chromatic:0,diatonic:0,midi:58},
  "tenor-sax":{name:"Tenor Sax",abbr:"T. Sax",clef:"G",line:2,chromatic:-14,diatonic:-8,midi:67},
  tuba:{name:"Tuba",abbr:"Tba.",clef:"F",line:4,chromatic:0,diatonic:0,midi:59},
  "snare-drum":{name:"Snare Drum",abbr:"S.D.",clef:"percussion",line:2,chromatic:0,diatonic:0,midi:1,percussion:true},
  "bass-drum":{name:"Bass Drum",abbr:"B.D.",clef:"percussion",line:2,chromatic:0,diatonic:0,midi:1,percussion:true}
};

const keyNames = ["C","C♯","D","E♭","E","F","F♯","G","A♭","A","B♭","B"];

bind();
updateButton();

function bind(){
  ui.fileTab.onclick=()=>switchMode("file");
  ui.urlTab.onclick=()=>switchMode("url");
  ui.audioFile.onchange=selectFile;
  ui.sourceUrl.oninput=updateButton;
  ui.allParts.onclick=()=>setParts(true);
  ui.noParts.onclick=()=>setParts(false);
  parts.forEach(p=>p.onchange=updateButton);
  ui.tempoMode.onchange=()=>ui.manualTempoField.hidden=ui.tempoMode.value!=="manual";
  ui.analyzeButton.onclick=analyze;
  ui.cancelButton.onclick=()=>state.cancelled=true;
  ui.musicXmlButton.onclick=downloadMusicXML;
  ui.pdfButton.onclick=openPrint;
  ui.resetButton.onclick=reset;
}

function switchMode(mode){
  state.mode=mode;
  ui.filePanel.hidden=mode!=="file";
  ui.urlPanel.hidden=mode!=="url";
  ui.fileTab.classList.toggle("active",mode==="file");
  ui.urlTab.classList.toggle("active",mode==="url");
  ui.sourceError.textContent="";
  updateButton();
}

function selectFile(e){
  const file=e.target.files?.[0];
  if(!file)return;
  const ext=file.name.split(".").pop().toLowerCase();
  if(!["mp3","wav","m4a"].includes(ext)||file.size>200*1024*1024||!file.size){
    ui.sourceError.textContent="MP3・WAV・M4A、200MB以下のファイルを選択してください";
    return;
  }
  revokeUrl();
  state.file=file;
  state.audioBuffer=null;
  state.objectUrl=URL.createObjectURL(file);
  ui.audioPlayer.src=state.objectUrl;
  ui.audioPlayer.hidden=false;
  ui.fileName.textContent=`${file.name} / ${formatBytes(file.size)}`;
  if(!ui.songTitle.value)ui.songTitle.value=file.name.replace(/\.[^.]+$/,"");
  updateButton();
}

function setParts(on){
  parts.forEach(p=>p.checked=on);
  updateButton();
}

function selectedParts(){
  return parts.filter(p=>p.checked).map(p=>p.value);
}

function validUrl(){
  try{
    const u=new URL(ui.sourceUrl.value.trim());
    return u.hostname==="youtu.be"||u.hostname.includes("youtube.com")||u.hostname==="music.apple.com";
  }catch{return false}
}

function updateButton(){
  ui.partsError.textContent="";
  const sourceOk=state.mode==="file"?!!state.file:validUrl();
  ui.analyzeButton.disabled=!sourceOk||selectedParts().length===0;
}

async function analyze(){
  ui.sourceError.textContent="";
  ui.partsError.textContent="";
  if(!selectedParts().length){
    ui.partsError.textContent="1つ以上選択してください";
    return;
  }
  state.cancelled=false;
  state.result=null;
  ui.resultCard.hidden=true;
  ui.progressCard.hidden=false;
  setProgress(5,"準備中");
  try{
    let data;
    if(state.mode==="file"){
      const buffer=await decode(state.file);
      stopIfCancelled();
      state.audioBuffer=buffer;
      fillAudioInfo(buffer);
      setProgress(30,"波形を作成中");
      drawWaveform(buffer);
      await frame();
      const mono=toMono(buffer);
      stopIfCancelled();

      setProgress(52,"BPMを解析中");
      const tempo=ui.tempoMode.value==="manual"
        ? {bpm:clamp(Number(ui.manualTempo.value)||120,40,240),confidence:100}
        : estimateTempo(mono,buffer.sampleRate);
      await frame();
      stopIfCancelled();

      setProgress(72,"Keyを解析中");
      const key=estimateKey(mono,buffer.sampleRate);
      const time=ui.timeSignature.value==="auto"?"4/4":ui.timeSignature.value;
      const measures=estimateMeasures(buffer.duration,tempo.bpm,time);
      data={...tempo,...key,time,measures,duration:buffer.duration};
    }else{
      setProgress(45,"URLを確認中");
      await wait(250);
      const bpm=ui.tempoMode.value==="manual"?clamp(Number(ui.manualTempo.value)||120,40,240):120;
      const time=ui.timeSignature.value==="auto"?"4/4":ui.timeSignature.value;
      data={bpm,confidence:0,key:"C Major",keyConfidence:0,fifths:0,mode:"major",time,measures:8,duration:0};
    }
    stopIfCancelled();
    setProgress(90,"MusicXMLを準備中");
    await wait(200);

    state.result={
      title:ui.songTitle.value.trim()||(state.file?state.file.name.replace(/\.[^.]+$/,""):"Untitled"),
      parts:selectedParts(),
      createdAt:new Date(),
      ...data
    };
    setProgress(100,"完了");
    showResult();
  }catch(err){
    ui.progressCard.hidden=true;
    if(err.message==="cancelled")toast("解析を中止しました");
    else{
      console.error(err);
      ui.sourceError.textContent="この音源をSafariで解析できませんでした";
      toast("解析に失敗しました");
    }
  }
}

async function decode(file){
  const Ctx=window.AudioContext||window.webkitAudioContext;
  if(!Ctx)throw new Error("Web Audio API unsupported");
  const ctx=new Ctx();
  try{return await ctx.decodeAudioData((await file.arrayBuffer()).slice(0))}
  finally{await ctx.close()}
}

function fillAudioInfo(buffer){
  ui.audioInfoCard.hidden=false;
  ui.duration.textContent=formatTime(buffer.duration);
  ui.sampleRate.textContent=`${buffer.sampleRate.toLocaleString()} Hz`;
  ui.channels.textContent=buffer.numberOfChannels===1?"Mono":`${buffer.numberOfChannels}ch`;
  ui.fileSize.textContent=formatBytes(state.file.size);
}

function toMono(buffer){
  const mono=new Float32Array(buffer.length);
  for(let c=0;c<buffer.numberOfChannels;c++){
    const d=buffer.getChannelData(c);
    for(let i=0;i<d.length;i++)mono[i]+=d[i]/buffer.numberOfChannels;
  }
  return mono;
}

function drawWaveform(buffer){
  const canvas=ui.waveform;
  const dpr=Math.min(devicePixelRatio||1,2);
  const w=Math.max(1,canvas.clientWidth*dpr);
  const h=canvas.height*dpr;
  canvas.width=w;canvas.height=h;
  const ctx=canvas.getContext("2d");
  const data=toMono(buffer);
  const block=Math.max(1,Math.floor(data.length/w));
  ctx.clearRect(0,0,w,h);
  ctx.strokeStyle="#d4a64e";
  ctx.lineWidth=dpr;
  ctx.beginPath();
  for(let x=0;x<w;x++){
    let min=1,max=-1;
    for(let i=x*block;i<Math.min((x+1)*block,data.length);i++){
      const v=data[i];if(v<min)min=v;if(v>max)max=v;
    }
    ctx.moveTo(x,h/2+min*h*.43);
    ctx.lineTo(x,h/2+max*h*.43);
  }
  ctx.stroke();
}

function estimateTempo(samples,sampleRate){
  const rate=200;
  const step=Math.max(1,Math.floor(sampleRate/rate));
  const seconds=Math.min(samples.length/sampleRate,180);
  const env=new Float32Array(Math.floor(seconds*rate));
  let prev=0;
  for(let i=0;i<env.length;i++){
    let sum=0,start=i*step;
    for(let j=0;j<step&&start+j<samples.length;j++)sum+=Math.abs(samples[start+j]);
    const v=sum/step;env[i]=Math.max(0,v-prev*.9);prev=v;
  }
  let bestBpm=120,best=-1,total=0;
  for(let bpm=60;bpm<=200;bpm++){
    const lag=Math.round(rate*60/bpm);
    let score=0;
    for(let i=lag;i<env.length;i++)score+=env[i]*env[i-lag];
    total+=Math.max(0,score);
    if(score>best){best=score;bestBpm=bpm}
  }
  const confidence=total?Math.round(clamp(best/(total/141)*12,20,94)):20;
  return {bpm:bestBpm,confidence};
}

function estimateKey(samples,sampleRate){
  const max=Math.min(samples.length,Math.floor(sampleRate*45));
  const stride=Math.max(1,Math.floor(max/16000));
  const data=new Float32Array(Math.floor(max/stride));
  for(let i=0;i<data.length;i++)data[i]=samples[i*stride]||0;
  const chroma=new Float64Array(12);
  const sr=sampleRate/stride;
  for(let midi=36;midi<=83;midi++){
    const freq=440*Math.pow(2,(midi-69)/12);
    const coeff=2*Math.cos(2*Math.PI*freq/sr);
    let s0=0,s1=0,s2=0;
    for(const value of data){s0=value+coeff*s1-s2;s2=s1;s1=s0}
    chroma[midi%12]+=Math.sqrt(Math.max(0,s1*s1+s2*s2-coeff*s1*s2));
  }
  let root=0,best=-1;
  for(let i=0;i<12;i++)if(chroma[i]>best){best=chroma[i];root=i}
  const fifths={0:0,1:7,2:2,3:-3,4:4,5:-1,6:6,7:1,8:-4,9:3,10:-2,11:5}[root];
  return {key:`${keyNames[root]} Major`,keyConfidence:55,fifths,mode:"major"};
}

function estimateMeasures(duration,bpm,time){
  const [beats,type]=time.split("/").map(Number);
  return Math.max(1,Math.round((duration*bpm/60)/(beats*(4/type))));
}

function showResult(){
  const r=state.result;
  ui.resultBpm.textContent=r.bpm;
  ui.resultKey.textContent=r.key.replace(" Major","");
  ui.resultTime.textContent=r.time;
  ui.resultMeasures.textContent=r.measures;
  ui.confidence.textContent=`BPM信頼度 ${r.confidence}% / Key信頼度 ${r.keyConfidence}%`;
  ui.progressCard.hidden=true;
  ui.resultCard.hidden=false;
  ui.resultCard.scrollIntoView({behavior:"smooth",block:"start"});
  toast("解析が完了しました");
}

function createMusicXML(r){
  const [beats,type]=r.time.split("/").map(Number);
  const divisions=4;
  const duration=divisions*beats*(4/type);
  const list=r.parts.map((p,i)=>{
    const d=partMap[p];
    return `<score-part id="P${i+1}"><part-name>${xml(d.name)}</part-name><part-abbreviation>${xml(d.abbr)}</part-abbreviation></score-part>`;
  }).join("");
  const body=r.parts.map((p,i)=>{
    const d=partMap[p];
    let measures="";
    for(let m=1;m<=r.measures;m++){
      const attr=m===1?`<attributes><divisions>${divisions}</divisions><key><fifths>${r.fifths}</fifths><mode>${r.mode}</mode></key><time><beats>${beats}</beats><beat-type>${type}</beat-type></time><clef><sign>${d.clef}</sign><line>${d.line}</line></clef>${d.chromatic?`<transpose><diatonic>${d.diatonic}</diatonic><chromatic>${d.chromatic}</chromatic></transpose>`:""}${d.percussion?`<staff-details><staff-lines>1</staff-lines></staff-details>`:""}</attributes>`:"";
      const tempo=m===1?`<direction><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>${r.bpm}</per-minute></metronome></direction-type><sound tempo="${r.bpm}"/></direction>`:"";
      measures+=`<measure number="${m}">${attr}${tempo}<note><rest measure="yes"/><duration>${duration}</duration><voice>1</voice><type>whole</type></note>${m===r.measures?'<barline location="right"><bar-style>light-heavy</bar-style></barline>':""}</measure>`;
    }
    return `<part id="P${i+1}">${measures}</part>`;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="4.0"><work><work-title>${xml(r.title)}</work-title></work><movement-title>${xml(r.title)}</movement-title><identification><creator type="arranger">Brass Studio</creator><encoding><software>Brass Studio Ver.1.0</software></encoding></identification><part-list>${list}</part-list>${body}</score-partwise>`;
}

function downloadMusicXML(){
  if(!state.result)return;
  const blob=new Blob([createMusicXML(state.result)],{type:"application/vnd.recordare.musicxml+xml;charset=utf-8"});
  download(blob,`${safeName(state.result.title)}.musicxml`);
}

function openPrint(){
  if(!state.result)return;
  const r=state.result,w=window.open("","_blank");
  if(!w)return toast("ポップアップを許可してください");
  const p=r.parts.map(x=>`<section><b>${xml(partMap[x].name)}</b><div class="staff"></div></section>`).join("");
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${xml(r.title)}</title><style>body{font-family:-apple-system,sans-serif;padding:20px;color:#111}.bar{margin-bottom:20px}.bar button{padding:10px 14px}h1{text-align:center}section{margin:28px 0;break-inside:avoid}.staff{height:55px;margin-top:8px;background:repeating-linear-gradient(to bottom,#111 0,#111 1px,transparent 1px,transparent 11px)}@media print{.bar{display:none}@page{size:A4;margin:15mm}}</style></head><body><div class="bar"><button onclick="print()">PDFとして保存</button></div><h1>${xml(r.title)}</h1><p>${r.bpm} BPM / ${xml(r.key)} / ${r.time}</p>${p}</body></html>`);
  w.document.close();
}

function reset(){
  state.cancelled=true;state.result=null;state.audioBuffer=null;state.file=null;
  revokeUrl();ui.audioFile.value="";ui.sourceUrl.value="";ui.songTitle.value="";
  ui.audioPlayer.hidden=true;ui.audioInfoCard.hidden=true;ui.resultCard.hidden=true;ui.progressCard.hidden=true;
  setParts(true);switchMode("file");window.scrollTo({top:0,behavior:"smooth"});
}

function setProgress(n,text){
  ui.progressText.textContent=text;ui.progressPercent.textContent=`${n}%`;ui.progressBar.style.width=`${n}%`;
}

function stopIfCancelled(){if(state.cancelled)throw new Error("cancelled")}
function revokeUrl(){if(state.objectUrl){URL.revokeObjectURL(state.objectUrl);state.objectUrl=""}}
function download(blob,name){const u=URL.createObjectURL(blob),a=document.createElement("a");a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)}
function xml(v){return String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&apos;")}
function safeName(v){return (v||"score").replace(/[\\/:*?"<>|]/g,"_")}
function formatBytes(v){return v<1024**2?`${(v/1024).toFixed(1)} KB`:`${(v/1024**2).toFixed(1)} MB`}
function formatTime(v){return `${String(Math.floor(v/60)).padStart(2,"0")}:${String(Math.floor(v%60)).padStart(2,"0")}`}
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function wait(ms){return new Promise(r=>setTimeout(r,ms))}
function frame(){return new Promise(r=>requestAnimationFrame(r))}
let toastTimer;
function toast(text){clearTimeout(toastTimer);ui.toast.textContent=text;ui.toast.hidden=false;toastTimer=setTimeout(()=>ui.toast.hidden=true,2200)}
