"use strict";
const API_BASE_URL="https://brass-studio-api.onrender.com";
const $=id=>document.getElementById(id);const partInputs=[...document.querySelectorAll('input[name="part"]')];
const ui={audioFile:$("audioFile"),fileInfo:$("fileInfo"),audioPlayer:$("audioPlayer"),sourceError:$("sourceError"),selectAll:$("selectAll"),clearAll:$("clearAll"),partsError:$("partsError"),songTitle:$("songTitle"),tempoMode:$("tempoMode"),manualTempoField:$("manualTempoField"),manualTempo:$("manualTempo"),timeSignature:$("timeSignature"),analyzeButton:$("analyzeButton"),progressCard:$("progressCard"),progressLabel:$("progressLabel"),resultCard:$("resultCard"),resultBpm:$("resultBpm"),bpmConfidence:$("bpmConfidence"),resultKey:$("resultKey"),keyConfidence:$("keyConfidence"),resultTime:$("resultTime"),timeConfidence:$("timeConfidence"),resultMeasures:$("resultMeasures"),resultNotice:$("resultNotice"),musicXmlButton:$("musicXmlButton"),pdfButton:$("pdfButton"),resetButton:$("resetButton"),toast:$("toast")};
const state={file:null,objectUrl:"",result:null};
ui.audioFile.onchange=()=>{const f=ui.audioFile.files?.[0];if(!f)return;const ext=f.name.split('.').pop().toLowerCase();if(!['mp3','wav','m4a'].includes(ext)||!f.size||f.size>200*1024*1024){ui.sourceError.textContent='MP3・WAV・M4A、200MB以下を選択してください';state.file=null;update();return;}state.file=f;ui.sourceError.textContent='';if(state.objectUrl)URL.revokeObjectURL(state.objectUrl);state.objectUrl=URL.createObjectURL(f);ui.audioPlayer.src=state.objectUrl;ui.audioPlayer.hidden=false;ui.fileInfo.textContent=`${f.name} / ${formatBytes(f.size)}`;if(!ui.songTitle.value.trim())ui.songTitle.value=f.name.replace(/\.[^.]+$/,'');update();};
ui.selectAll.onclick=()=>{partInputs.forEach(x=>x.checked=true);update();};ui.clearAll.onclick=()=>{partInputs.forEach(x=>x.checked=false);update();};partInputs.forEach(x=>x.onchange=update);ui.tempoMode.onchange=()=>ui.manualTempoField.hidden=ui.tempoMode.value!=="manual";
ui.analyzeButton.onclick=analyze;ui.musicXmlButton.onclick=downloadMusicXml;ui.pdfButton.onclick=openPdf;ui.resetButton.onclick=()=>location.reload();
function selected(){return partInputs.filter(x=>x.checked).map(x=>x.value)}function update(){const ok=selected().length>0;ui.partsError.textContent=ok?'':'1つ以上選択してください';ui.analyzeButton.disabled=!state.file||!ok}update();
async function analyze(){
  ui.analyzeButton.disabled=true;
  ui.progressCard.hidden=false;
  ui.progressLabel.textContent="APIを起動しています";
  ui.resultCard.hidden=true;
  ui.sourceError.textContent="";

  try{
    await fetch(`${API_BASE_URL}/health`,{
      method:"GET",
      mode:"cors",
      cache:"no-store"
    });

    ui.progressLabel.textContent="音源をアップロード中";

    const fd=new FormData();
    fd.append("audio",state.file,state.file.name);

    const q=new URLSearchParams({
      parts:selected().join(","),
      time_signature:ui.timeSignature.value,
      title:ui.songTitle.value.trim()||"Untitled"
    });

    if(ui.tempoMode.value==="manual"){
      q.set("manual_bpm",String(Number(ui.manualTempo.value)||120));
    }

    const r=await fetch(`${API_BASE_URL}/analyze?${q.toString()}`,{
      method:"POST",
      mode:"cors",
      body:fd
    });

    const text=await r.text();

    let d;
    try{
      d=JSON.parse(text);
    }catch{
      throw new Error(`API応答エラー: HTTP ${r.status}`);
    }

    if(!r.ok){
      throw new Error(d.detail||`解析に失敗しました: HTTP ${r.status}`);
    }

    state.result=d;
    ui.resultBpm.textContent=d.analysis.bpm;
    ui.bpmConfidence.textContent=`信頼度 ${d.analysis.bpmConfidence}%`;
    ui.resultKey.textContent=d.analysis.key;
    ui.keyConfidence.textContent=`信頼度 ${d.analysis.keyConfidence}%`;
    ui.resultTime.textContent=d.analysis.timeSignature;
    ui.timeConfidence.textContent=`信頼度 ${d.analysis.timeSignatureConfidence}%`;
    ui.resultMeasures.textContent=d.analysis.measureCount;
    ui.resultNotice.textContent=d.notice;
    ui.resultCard.hidden=false;

  }catch(e){
    console.error(e);

    if(e instanceof TypeError){
      ui.sourceError.textContent=
        "APIに接続できませんでした。Renderを開いてから、もう一度試してください。";
    }else{
      ui.sourceError.textContent=e.message||"解析に失敗しました";
    }
  }finally{
    ui.progressCard.hidden=true;
    update();
  }
}
function downloadMusicXml(){const x=state.result?.musicxml;if(!x)return;const bin=atob(x.base64),bytes=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);const url=URL.createObjectURL(new Blob([bytes],{type:'application/vnd.recordare.musicxml+xml'}));const a=document.createElement('a');a.href=url;a.download=x.filename||'score.musicxml';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function openPdf(){if(!state.result)return;const d=state.result,w=window.open('','_blank');if(!w)return;w.document.write(`<html><body><button onclick="print()">PDFとして保存</button><h1>${escapeHtml(d.title)}</h1><p>${d.analysis.bpm} BPM / ${escapeHtml(d.analysis.key)} / ${escapeHtml(d.analysis.timeSignature)}</p></body></html>`);w.document.close();}
function formatBytes(b){return b<1024*1024?`${(b/1024).toFixed(1)} KB`:`${(b/1024/1024).toFixed(1)} MB`}function escapeHtml(v){return String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')}
