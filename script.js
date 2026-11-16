
(function(){
"use strict";
var W=600,H=760,KEY="ohdi.books.v1";
var $=function(s){return document.querySelector(s)};
var books=[],mode=null,editing=null,delId=null,cur=null,pi=0;
var tool={t:"pen",color:"#e60000",size:3,em:"free"};
var COLORS=["#e60000","#0033ff","#ffe600","#00b050","#ffffff","#000000"];

/* ---------- 저장 ---------- */
var dbp=null,warned=false;
function db(){if(!dbp)dbp=new Promise(function(res,rej){var r=indexedDB.open("ohdi",1);r.onupgradeneeded=function(){r.result.createObjectStore("kv")};r.onsuccess=function(){res(r.result)};r.onerror=function(){rej(r.error)}});return dbp}
function idbPut(v){return db().then(function(d){return new Promise(function(res,rej){var t=d.transaction("kv","readwrite");t.objectStore("kv").put(v,"books");t.oncomplete=res;t.onerror=t.onabort=function(){rej(t.error||new Error("저장 실패"))}})})}
function idbGet(){return db().then(function(d){return new Promise(function(res,rej){var q=d.transaction("kv","readonly").objectStore("kv").get("books");q.onsuccess=function(){res(q.result)};q.onerror=function(){rej(q.error)}})})}
function save(){idbPut(books).catch(function(){if(!warned){warned=true;toast("이 브라우저에서는 저장할 수 없거나 공간이 부족합니다")}})}
var SAMPLES=["수학 3-1 도형","영어 회화 Unit 4","과학 실험 노트","국어 독해 연습","사회 지도 읽기","한자 쓰기 기초"];
function dropSamples(l){return l.filter(function(b){return!(SAMPLES.indexOf(b.title)>-1&&!b.cover&&b.pages.every(function(p){return!p.bg&&!p.strokes.length}))})}
function load(){
  return idbGet().then(function(v){books=Array.isArray(v)?dropSamples(v):[];if(!books.length)legacy()}).catch(legacy);
}
function legacy(){
  try{var r=localStorage.getItem(KEY);if(r){var o=JSON.parse(r);if(Array.isArray(o))books=dropSamples(o)}}catch(e){}
}
function uid(){return"b"+Date.now().toString(36)+Math.random().toString(36).slice(2,6)}
var st=null;function later(){clearTimeout(st);st=setTimeout(save,400)}

/* ---------- 토스트 ---------- */
var tt=null;function toast(m){var e=$("#toast");e.textContent=m;e.classList.add("on");clearTimeout(tt);tt=setTimeout(function(){e.classList.remove("on")},2200)}

/* ---------- 목록 ---------- */
function esc(s){return String(s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
function renderLib(){
  var q=$("#q").value.trim().toLowerCase(),g=$("#grid"),h="";
  var list=books.filter(function(b){return!q||(b.title+" "+(b.desc||"")).toLowerCase().indexOf(q)>-1});
  list.forEach(function(b){
    var cv=b.cover||(b.pages[0]&&b.pages[0].bg)||null;
    h+='<article class="card'+(mode?" pick":"")+'" data-id="'+b.id+'"><div class="cover">'+(cv?'<img alt="" src="'+cv+'">':"표지")+'</div><h3>'+esc(b.title)+'</h3><p>'+esc(b.desc||"")+'</p><div class="acts"><button data-a="open">열기</button><i>|</i><button data-a="del">삭제</button><i>|</i><button data-a="edit">수정</button></div></article>';
  });
  g.innerHTML=h||'<div class="empty">'+(books.length?"검색 결과가 없습니다.":"교재가 없습니다. 왼쪽의 교재생성을 눌러 추가하세요.")+'</div>';
}
$("#q").addEventListener("input",renderLib);
$("#grid").addEventListener("click",function(e){
  var c=e.target.closest(".card");if(!c)return;
  var id=c.dataset.id,a=e.target.closest("button");
  if(a){act(a.dataset.a,id);return}
  if(mode)act(mode,id);
});
function act(a,id){if(a==="open")openBook(id);else if(a==="del")askDel(id);else if(a==="edit")openForm(id)}
function setMode(m){
  mode=(mode===m)?null:m;
  $("#m-del").setAttribute("aria-pressed",mode==="del");
  $("#m-edit").setAttribute("aria-pressed",mode==="edit");
  var old=document.querySelector(".hint");if(old)old.remove();
  if(mode){var h=document.createElement("div");h.className="hint";h.textContent=mode==="del"?"삭제할 교재를 선택하세요":"수정할 교재를 선택하세요";document.body.appendChild(h)}
  renderLib();
}
$("#m-del").onclick=function(){setMode("del")};
$("#m-edit").onclick=function(){setMode("edit")};
$("#m-new").onclick=function(){openForm(null)};
$("#m-quit").onclick=function(){
  $("#v-lib").innerHTML='<div class="closed"><div class="logo" style="padding:0">OHDI</div>종료되었습니다.<button class="menu" style="width:auto;justify-content:center" onclick="location.reload()">다시 시작</button></div>';
};

/* ---------- 삭제 ---------- */
function askDel(id){var b=find(id);if(!b)return;delId=id;$("#dName").textContent="{ "+b.title+" }";$("#sc-del").classList.add("on");$("#dNo").focus()}
function find(id){for(var i=0;i<books.length;i++)if(books[i].id===id)return books[i]}
$("#dNo").onclick=function(){$("#sc-del").classList.remove("on");delId=null};
$("#dYes").onclick=function(){
  books=books.filter(function(b){return b.id!==delId});save();delId=null;
  $("#sc-del").classList.remove("on");renderLib();toast("삭제했습니다")
};

/* ---------- 생성/수정 폼 ---------- */
var fImgs=[],fCover=null,autoT=false;
function shrink(file,max){
  return new Promise(function(res){
    var fr=new FileReader();
    fr.onload=function(){var im=new Image();im.onload=function(){
      var s=Math.min(1,max/Math.max(im.width,im.height)),c=document.createElement("canvas");
      c.width=Math.round(im.width*s);c.height=Math.round(im.height*s);
      var x=c.getContext("2d");x.fillStyle="#fff";x.fillRect(0,0,c.width,c.height);x.drawImage(im,0,0,c.width,c.height);
      res(c.toDataURL("image/jpeg",.72))};im.onerror=function(){res(null)};im.src=fr.result};
    fr.onerror=function(){res(null)};fr.readAsDataURL(file);
  });
}
function cvShow(src){$("#cvbox").innerHTML=src?'<img alt="선택한 표지" src="'+src+'">':"표지 이미지 선택"}
function openForm(id){
  editing=id?find(id):null;fImgs=[];fCover=null;autoT=false;
  $("#fTitle").textContent=editing?"교재 수정하기":"교재 생성하기";
  $("#fT").value=editing?editing.title:"";$("#fD").value=editing?editing.desc||"":"";
  $("#fA").value="";$("#fB").value="";
  $("#dzt").innerHTML=editing?'교 재 다 시 업 로 드<small>새 파일을 올리면 페이지가 교체됩니다. 비워 두면 기존 판서가 유지됩니다.</small>':'교 재 업 로 드<small>이미지, PDF, HWP, HWPX, DOCX, PPTX 파일을 끌어놓거나 눌러서 선택. 올리지 않으면 빈 페이지로 만듭니다.</small>';
  document.querySelector('input[name=cvm][value=upload]').checked=true;
  cvShow(editing?editing.cover||(editing.pages[0]&&editing.pages[0].bg):null);
  $("#sc-form").classList.add("on");$("#fT").focus();
}
function closeForm(){$("#sc-form").classList.remove("on")}
$("#fClose").onclick=closeForm;
$("#cvbox").onclick=function(){$("#cvfile").click()};
$("#cvbox").onkeydown=function(e){if(e.key==="Enter"||e.key===" "){e.preventDefault();$("#cvfile").click()}};
$("#cvfile").onchange=function(){
  var f=this.files[0];if(!f)return;document.querySelector('input[name=cvm][value=upload]').checked=true;
  shrink(f,500).then(function(d){fCover=d;cvShow(d)});this.value="";
};
document.querySelectorAll("input[name=cvm]").forEach(function(r){r.onchange=function(){
  if(this.value==="first"){var s=fImgs[0]||(editing&&editing.pages[0]&&editing.pages[0].bg)||null;cvShow(s);if(!s)toast("첫 페이지로 쓸 이미지가 없습니다")}
  else cvShow(fCover||(editing&&editing.cover)||null)}});
/* ---------- 문서 변환 (이미지 / PDF / HWP / HWPX / DOCX / PPTX → 페이지 이미지) ---------- */
var LIBS={
  pdf:["https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js","https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js"],
  zip:["https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"],
  pako:["https://cdnjs.cloudflare.com/ajax/libs/pako/2.1.0/pako.min.js"],
  cfb:["https://cdn.jsdelivr.net/npm/cfb@1.2.2/dist/cfb.min.js"],
  h2c:["https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"],
  docx:["https://cdn.jsdelivr.net/npm/docx-preview@0.3.3/dist/docx-preview.min.js"],
  pptx:["https://cdn.jsdelivr.net/npm/pptx-preview@1.0.7/dist/pptx-preview.umd.js"]
};
var libP={};
function loadScript(u){return new Promise(function(res,rej){var s=document.createElement("script");s.src=u;s.onload=res;s.onerror=function(){rej(new Error("변환 도구를 불러오지 못했습니다. 인터넷 연결을 확인하세요."))};document.head.appendChild(s)})}
function loadLib(){
  var names=Array.prototype.slice.call(arguments);
  return Promise.all(names.map(function(n){
    if(!libP[n])libP[n]=LIBS[n].reduce(function(p,u){return p.then(function(){return loadScript(u)})},Promise.resolve()).catch(function(e){delete libP[n];throw e});
    return libP[n];
  }));
}
function readBuf(f){return new Promise(function(res,rej){var r=new FileReader();r.onload=function(){res(r.result)};r.onerror=function(){rej(new Error("파일을 읽지 못했습니다."))};r.readAsArrayBuffer(f)})}
function toJpeg(c,max,q){
  var s=Math.min(1,max/Math.max(c.width,c.height));
  if(s<1){var d=document.createElement("canvas");d.width=Math.round(c.width*s);d.height=Math.round(c.height*s);var x=d.getContext("2d");x.fillStyle="#fff";x.fillRect(0,0,d.width,d.height);x.drawImage(c,0,0,d.width,d.height);c=d}
  return c.toDataURL("image/jpeg",q||.78);
}
var PMAX=1400;

/* PDF */
function convPdf(buf,prog){
  return loadLib("pdf").then(function(){
    return window.pdfjsLib.getDocument({data:new Uint8Array(buf)}).promise;
  }).then(function(pdf){
    var out=[],n=pdf.numPages;
    function one(i){
      if(i>n)return out;
      prog("PDF "+i+" / "+n+" 페이지");
      return pdf.getPage(i).then(function(pg){
        var v0=pg.getViewport({scale:1}),s=PMAX/Math.max(v0.width,v0.height),vp=pg.getViewport({scale:s});
        var c=document.createElement("canvas");c.width=Math.round(vp.width);c.height=Math.round(vp.height);
        var x=c.getContext("2d");x.fillStyle="#fff";x.fillRect(0,0,c.width,c.height);
        return pg.render({canvasContext:x,viewport:vp}).promise.then(function(){out.push(c.toDataURL("image/jpeg",.78));pg.cleanup();return one(i+1)});
      });
    }
    return one(1);
  }).catch(function(e){
    if(e&&e.name==="PasswordException")throw new Error("암호가 걸린 PDF는 열 수 없습니다.");
    throw e;
  });
}

/* 화면 밖 렌더 상자 + html2canvas 캡처 */
function makeBox(w){var b=document.createElement("div");b.style.cssText="position:fixed;left:0;top:0;z-index:-1;width:"+w+"px;background:#fff;pointer-events:none";document.body.appendChild(b);return b}
function snap(nodes,prog,label,split){
  var out=[],i=0;
  function one(){
    if(i>=nodes.length)return out;
    var el=nodes[i++];prog(label+" "+i+" / "+nodes.length+" 페이지");
    var r=el.getBoundingClientRect(),sc=Math.min(2,PMAX/Math.max(r.width,r.height));
    return window.html2canvas(el,{scale:sc,backgroundColor:"#fff",logging:false,useCORS:true}).then(function(c){
      if(split&&c.height>c.width*1.6){
        var ph=Math.round(c.width*1.4142);
        for(var y=0;y<c.height;y+=ph){var h=Math.min(ph,c.height-y),d=document.createElement("canvas");d.width=c.width;d.height=ph;var x=d.getContext("2d");x.fillStyle="#fff";x.fillRect(0,0,d.width,ph);x.drawImage(c,0,y,c.width,h,0,0,c.width,h);out.push(toJpeg(d,PMAX))}
      }else out.push(toJpeg(c,PMAX));
      return one()});
  }
  return one();
}
function wait(ms){return new Promise(function(r){setTimeout(r,ms)})}

/* DOCX */
function convDocx(buf,prog){
  var box;
  return loadLib("zip").then(function(){return loadLib("docx","h2c")}).then(function(){
    box=makeBox(900);prog("DOCX 레이아웃 계산 중");
    return window.docx.renderAsync(buf,box,null,{className:"docx",inWrapper:true,breakPages:true,ignoreLastRenderedPageBreak:false});
  }).then(function(){return(document.fonts&&document.fonts.ready)||0}).then(function(){return wait(250)}).then(function(){
    var w=box.querySelector(".docx-wrapper");if(w){w.style.background="#fff";w.style.padding="0";w.style.display="block"}
    box.style.width="auto";
    var secs=[].slice.call(box.querySelectorAll("section.docx"));
    secs.forEach(function(s){s.style.boxShadow="none";s.style.margin="0"});
    if(!secs.length)throw new Error("문서에서 페이지를 찾지 못했습니다.");
    return snap(secs,prog,"DOCX",true);
  }).then(function(r){box.remove();return r},function(e){if(box)box.remove();throw e});
}

/* PPTX */
function convPptx(buf,prog){
  var box;
  return loadLib("h2c","pptx").then(function(){
    box=makeBox(960);prog("PPTX 슬라이드 그리는 중");
    var pv=window.pptxPreview.init(box,{width:960,height:540,mode:"list"});
    return pv.preview(buf);
  }).then(function(){return wait(500)}).then(function(){
    var sl=[].slice.call(box.querySelectorAll(".pptx-preview-slide-wrapper"));
    if(!sl.length)throw new Error("슬라이드를 찾지 못했습니다.");
    sl.forEach(function(s){s.style.margin="0";s.style.position="relative"});
    return snap(sl,prog,"PPTX");
  }).then(function(r){box.remove();return r},function(e){if(box)box.remove();throw e});
}

/* 텍스트 문서(HWP, HWPX)를 페이지 이미지로 조판 */
var PW=880,PH=1114,PM=76,FONT='"Gothic A1","Malgun Gothic","Apple SD Gothic Neo","Noto Sans KR",sans-serif';
function wrapText(x,text,maxW){
  var lines=[],line="",toks=text.replace(/\t/g,"    ").match(/[\x21-\x7e]+|[ ]+|[\s\S]/g)||[];
  toks.forEach(function(t){
    var w=x.measureText(t).width;
    if(line&&x.measureText(line+t).width>maxW&&!/^ +$/.test(t)){lines.push(line.replace(/ +$/,""));line=""}
    if(w>maxW){for(var i=0;i<t.length;i++){var ch=t[i];if(x.measureText(line+ch).width>maxW&&line){lines.push(line);line=""}line+=ch}}
    else line+=(line===""&&/^ +$/.test(t)&&lines.length&&false)?"":t;
  });
  if(line!==""||!lines.length)lines.push(line);
  return lines;
}
function layoutBlocks(blocks,prog){
  var pages=[],c,x,y;
  function np(){c=document.createElement("canvas");c.width=PW;c.height=PH;x=c.getContext("2d");x.fillStyle="#fff";x.fillRect(0,0,PW,PH);x.textBaseline="top";y=PM;pages.push(c)}
  np();
  var LH=38,FS=23,CW=PW-2*PM;
  blocks.forEach(function(b){
    if(b.type==="text"){
      x.font=FS+"px "+FONT;x.fillStyle="#111";
      b.text.split("\n").forEach(function(par){
        if(!par.trim()){y+=LH*.55;return}
        wrapText(x,par,CW).forEach(function(ln){
          if(y+LH>PH-PM)np();
          x.font=FS+"px "+FONT;x.fillStyle="#111";x.fillText(ln,PM,y+4);y+=LH;
        });
        y+=6;
      });
    }else if(b.type==="img"){
      var s=Math.min(1,CW/b.img.width,(PH-2*PM)/b.img.height),w=b.img.width*s,h=b.img.height*s;
      if(y+h>PH-PM&&y>PM)np();
      x.drawImage(b.img,PM+(CW-w)/2,y,w,h);y+=h+14;
    }else if(b.type==="row"){
      var n=Math.max(1,b.cells.length),cw=CW/n,f=21,lh=30;
      x.font=f+"px "+FONT;
      var ls=b.cells.map(function(t){return wrapText(x,t,cw-18)}),mh=0;
      ls.forEach(function(l){mh=Math.max(mh,l.length)});var h2=mh*lh+14;
      if(y+h2>PH-PM&&y>PM)np();
      x.strokeStyle="#777";x.lineWidth=1.5;x.fillStyle="#111";x.font=f+"px "+FONT;
      ls.forEach(function(l,i){x.strokeRect(PM+i*cw,y,cw,h2);l.forEach(function(t,k){x.fillText(t,PM+i*cw+9,y+8+k*lh)})});
      y+=h2+10;
    }
  });
  return pages.map(function(p){return p.toDataURL("image/jpeg",.8)});
}
function fontsReady(){try{return Promise.all([document.fonts.load('23px "Gothic A1"'),document.fonts.load('21px "Gothic A1"')]).catch(function(){})}catch(e){return Promise.resolve()}}
function dataImg(src){return new Promise(function(res){var im=new Image();im.onload=function(){res(im)};im.onerror=function(){res(null)};im.src=src})}

/* HWPX (ZIP + XML) */
function convHwpx(buf,prog){
  var zip,imgs={};
  return loadLib("zip").then(function(){return window.JSZip.loadAsync(buf)}).then(function(z){
    zip=z;prog("HWPX 읽는 중");
    var names=Object.keys(zip.files),secs=names.filter(function(n){return/^Contents\/section\d+\.xml$/i.test(n)}).sort(function(a,b){return parseInt(a.match(/\d+/)[0],10)-parseInt(b.match(/\d+/)[0],10)});
    if(!secs.length)throw new Error("HWPX 본문을 찾지 못했습니다. (암호가 걸렸거나 손상된 파일일 수 있습니다)");
    var bins=names.filter(function(n){return/^BinData\/.+\.(png|jpe?g|gif|bmp|webp)$/i.test(n)});
    return Promise.all(bins.map(function(n){
      var ext=n.split(".").pop().toLowerCase();ext=ext==="jpg"?"jpeg":ext;
      return zip.file(n).async("base64").then(function(b){return dataImg("data:image/"+ext+";base64,"+b)}).then(function(im){if(im)imgs[n.replace(/^BinData\//,"").replace(/\.[^.]+$/,"")]=im});
    })).then(function(){
      return secs.reduce(function(p,n){return p.then(function(acc){return zip.file(n).async("string").then(function(s){return acc.concat([s])})})},Promise.resolve([]));
    });
  }).then(function(xmls){
    var blocks=[];
    function ln(e){return e.localName||e.nodeName.replace(/^.*:/,"")}
    function cellText(el){var t=[];(function r(n){for(var c=n.firstChild;c;c=c.nextSibling){if(c.nodeType!==1)continue;var l=ln(c);if(l==="t")t.push(c.textContent);else if(l==="lineBreak")t.push(" ");else r(c)}})(el);return t.join("").replace(/\s+/g," ").trim()}
    function tbl(el){
      for(var tr=el.firstChild;tr;tr=tr.nextSibling){
        if(tr.nodeType!==1||ln(tr)!=="tr")continue;var cells=[];
        for(var tc=tr.firstChild;tc;tc=tc.nextSibling){if(tc.nodeType===1&&ln(tc)==="tc")cells.push(cellText(tc))}
        if(cells.length)blocks.push({type:"row",cells:cells});
      }
      blocks.push({type:"text",text:""});
    }
    function para(p){
      var buf="";
      function flush(){if(buf!==""){blocks.push({type:"text",text:buf});buf=""}}
      (function r(n){
        for(var c=n.firstChild;c;c=c.nextSibling){
          if(c.nodeType!==1)continue;var l=ln(c);
          if(l==="t")buf+=c.textContent;
          else if(l==="lineBreak")buf+="\n";
          else if(l==="tab")buf+="\t";
          else if(l==="tbl"){flush();tbl(c)}
          else if(l==="pic"){flush();var im=c.getElementsByTagName("*"),ref=null;for(var i=0;i<im.length;i++){if(ln(im[i])==="img"){ref=im[i].getAttribute("binaryItemIDRef");break}}if(ref&&imgs[ref])blocks.push({type:"img",img:imgs[ref]})}
          else r(c);
        }
      })(p);
      if(buf==="")buf="";
      blocks.push({type:"text",text:buf});
      // 문단 끝에서 줄을 나눔: 빈 문단은 여백으로 표현
    }
    function walk(n){for(var c=n.firstChild;c;c=c.nextSibling){if(c.nodeType!==1)continue;var l=ln(c);if(l==="p")para(c);else walk(c)}}
    xmls.forEach(function(s){var d=new DOMParser().parseFromString(s,"application/xml");walk(d.documentElement)});
    // 연속 text 블록을 문단 단위 개행으로 합침
    var merged=[];blocks.forEach(function(b){var l=merged[merged.length-1];if(b.type==="text"&&l&&l.type==="text")l.text+="\n"+b.text;else merged.push(b)});
    prog("HWPX 페이지 나누는 중");
    return fontsReady().then(function(){return layoutBlocks(merged,prog)});
  });
}

/* HWP 5.x (복합 문서 + zlib + 레코드) */
function hwpText(d){
  var dv=new DataView(d.buffer,d.byteOffset,d.byteLength),s="",i=0,n=d.byteLength;
  while(i+2<=n){
    var c=dv.getUint16(i,true);i+=2;
    if(c>=32){s+=String.fromCharCode(c);continue}
    if(c===10){s+="\n";continue}
    if(c===13)break;
    if(c===0)continue;
    if(c===9){s+="\t";i+=14;continue}
    if(c===24){s+="-";continue}
    if(c===30||c===31){s+=" ";continue}
    if(c>=25&&c<=29)continue;
    i+=14;
  }
  return s;
}
function convHwp(buf,prog){
  return loadLib("cfb","pako").then(function(){
    prog("HWP 읽는 중");
    var u8=new Uint8Array(buf),f;
    try{f=window.CFB.read(u8,{type:"array"})}catch(e){throw new Error("HWP 5.x 형식이 아닙니다. 한글에서 HWPX 또는 PDF로 저장한 뒤 올려 주세요.")}
    var fh=window.CFB.find(f,"/FileHeader");if(!fh)throw new Error("HWP 5.x 형식이 아닙니다. 한글에서 HWPX 또는 PDF로 저장한 뒤 올려 주세요.");
    var h=new Uint8Array(fh.content),flags=new DataView(h.buffer,h.byteOffset,h.byteLength).getUint32(36,true);
    if(flags&2)throw new Error("암호가 걸린 HWP는 열 수 없습니다.");
    if(flags&4)throw new Error("배포용 HWP는 열 수 없습니다. 한글에서 PDF로 저장한 뒤 올려 주세요.");
    var compressed=!!(flags&1),paras=[];
    for(var si=0;si<500;si++){
      var e=window.CFB.find(f,"/BodyText/Section"+si);if(!e)break;
      var data=new Uint8Array(e.content);
      if(compressed){try{data=window.pako.inflateRaw(data)}catch(x){data=window.pako.inflate(data)}}
      var dv=new DataView(data.buffer,data.byteOffset,data.byteLength),p=0,L=data.byteLength;
      while(p+4<=L){
        var hd=dv.getUint32(p,true);p+=4;
        var tag=hd&0x3ff,size=hd>>>20;
        if(size===0xfff){size=dv.getUint32(p,true);p+=4}
        if(tag===0x43){paras.push(hwpText(data.subarray(p,p+size)))}
        p+=size;
      }
    }
    if(!paras.length)throw new Error("HWP에서 글을 찾지 못했습니다.");
    prog("HWP 페이지 나누는 중");
    return fontsReady().then(function(){return layoutBlocks([{type:"text",text:paras.join("\n")}],prog)});
  });
}

function extOf(n){var m=/\.([^.]+)$/.exec(n||"");return m?m[1].toLowerCase():""}
function convertFile(f,prog){
  var e=extOf(f.name);
  if(/^image\//.test(f.type)||/^(png|jpe?g|gif|webp|bmp)$/.test(e))return shrink(f,PMAX).then(function(d){if(!d)throw new Error(f.name+" 이미지를 읽지 못했습니다.");return[d]});
  if(e==="doc"||e==="ppt")throw new Error("."+e+" 파일은 열 수 없습니다. ."+e+"x로 저장해서 올려 주세요.");
  var fn={pdf:convPdf,docx:convDocx,pptx:convPptx,hwpx:convHwpx,hwp:convHwp}[e];
  if(!fn)throw new Error("지원하지 않는 형식입니다. (이미지, PDF, HWP, HWPX, DOCX, PPTX)");
  return readBuf(f).then(function(b){return fn(b,prog)});
}
function busy(on,msg){$("#sc-busy").classList.toggle("on",on);if(msg!=null)$("#busyMsg").textContent=msg}
function takeFiles(fl){
  var a=Array.prototype.slice.call(fl).sort(function(x,y){return x.name.localeCompare(y.name,undefined,{numeric:true})});
  if(!a.length)return;
  var all=[],i=0;busy(true,"불러오는 중…");
  function next(){
    if(i>=a.length)return;
    var f=a[i++];busy(true,f.name+" 변환 중…");
    return Promise.resolve().then(function(){return convertFile(f,function(m){busy(true,f.name+"\n"+m)})}).then(function(p){all=all.concat(p);return next()});
  }
  Promise.resolve().then(next).then(function(){
    busy(false);
    if(!all.length){toast("불러온 페이지가 없습니다");return}
    fImgs=all;
    var nm=a[0].name.replace(/\.[^.]+$/,"");
    if(!$("#fT").value.trim()||autoT){$("#fT").value=nm;autoT=true}
    $("#dzt").innerHTML="교재 업로드 완료<small>"+fImgs.length+"페이지를 불러왔습니다. 위에서 가져올 범위를 정할 수 있습니다.</small>";
    $("#fA").value=1;$("#fB").value=fImgs.length;
    if(document.querySelector("input[name=cvm]:checked").value==="first")cvShow(fImgs[0]);
  }).catch(function(e){
    busy(false);console.error(e);
    $("#dzt").innerHTML="불러오지 못했습니다<small>"+esc(e&&e.message?e.message:"알 수 없는 오류")+"</small>";
    toast("불러오지 못했습니다");
  });
}
$("#fT").addEventListener("input",function(){autoT=false});
$("#bkfile").onchange=function(){takeFiles(this.files);this.value=""};
var dz=$("#dz");
["dragenter","dragover"].forEach(function(n){dz.addEventListener(n,function(e){e.preventDefault();dz.classList.add("over")})});
["dragleave","drop"].forEach(function(n){dz.addEventListener(n,function(e){e.preventDefault();dz.classList.remove("over")})});
dz.addEventListener("drop",function(e){if(e.dataTransfer&&e.dataTransfer.files.length)takeFiles(e.dataTransfer.files)});
dz.onkeydown=function(e){if(e.key==="Enter"||e.key===" "){e.preventDefault();$("#bkfile").click()}};
$("#fOk").onclick=function(){
  var title=$("#fT").value.trim();if(!title){toast("제목을 입력하세요");$("#fT").focus();return}
  var a=parseInt($("#fA").value,10),b=parseInt($("#fB").value,10),pages=null;
  if(fImgs.length){
    a=a>0?a:1;b=b>0?b:fImgs.length;if(b<a){var t=a;a=b;b=t}
    a=Math.min(a,fImgs.length);b=Math.min(b,fImgs.length);
    pages=fImgs.slice(a-1,b).map(function(d){return{bg:d,strokes:[]}});
  }else if(!editing){
    var n=(a>0&&b>=a)?Math.min(b-a+1,200):5;pages=[];for(var i=0;i<n;i++)pages.push({bg:null,strokes:[]});
  }
  var mode2=document.querySelector("input[name=cvm]:checked").value,cover=null;
  if(mode2==="first")cover=pages&&pages[0]?pages[0].bg:(editing?editing.pages[0]&&editing.pages[0].bg:null);
  else cover=fCover||(editing?editing.cover:null);
  if(editing){editing.title=title;editing.desc=$("#fD").value.trim();editing.cover=cover;if(pages)editing.pages=pages;toast("수정했습니다")}
  else{books.unshift({id:uid(),title:title,desc:$("#fD").value.trim(),cover:cover,pages:pages});toast("교재를 만들었습니다")}
  save();closeForm();renderLib();
};

/* ---------- 판서: 그리기 ---------- */
var bgc=$("#bg"),ink=$("#ink"),bx=bgc.getContext("2d"),ix=ink.getContext("2d");
bx.setTransform(2,0,0,2,0,0);ix.setTransform(2,0,0,2,0,0);
var imgCache={};
function loadImg(src,cb){
  if(!src){cb(null);return}
  if(imgCache[src]){cb(imgCache[src]);return}
  var im=new Image();im.onload=function(){imgCache[src]=im;cb(im)};im.onerror=function(){cb(null)};im.src=src;
}
function paintBg(ctx,img){
  ctx.fillStyle="#fff";ctx.fillRect(0,0,W,H);
  if(img){var s=Math.min(W/img.width,H/img.height),w=img.width*s,h=img.height*s;ctx.drawImage(img,(W-w)/2,(H-h)/2,w,h)}
  else{ctx.strokeStyle="#ead7f0";ctx.lineWidth=1;ctx.beginPath();for(var y=40;y<H;y+=40){ctx.moveTo(0,y);ctx.lineTo(W,y)}ctx.stroke()}
}
function paintStrokes(ctx,strokes,T){
  ctx.clearRect(0,0,W,H);ctx.lineCap="round";ctx.lineJoin="round";
  strokes.forEach(function(s){
    var p=s.pts;if(T!=null)p=p.filter(function(q){return q[2]<=T});
    if(!p.length)return;
    ctx.globalCompositeOperation=s.tool==="eraser"?"destination-out":"source-over";
    ctx.globalAlpha=s.tool==="hl"?.35:1;
    ctx.strokeStyle=s.tool==="eraser"?"#000":s.color;
    ctx.lineWidth=s.tool==="eraser"?s.size*4+6:s.tool==="hl"?s.size*3+8:s.size;
    if(s.tool==="hl")ctx.lineCap="butt";else ctx.lineCap="round";
    ctx.beginPath();ctx.moveTo(p[0][0],p[0][1]);
    if(p.length===1){ctx.lineTo(p[0][0]+.01,p[0][1])}
    else{for(var i=1;i<p.length-1;i++){var mx=(p[i][0]+p[i+1][0])/2,my=(p[i][1]+p[i+1][1])/2;ctx.quadraticCurveTo(p[i][0],p[i][1],mx,my)}
      ctx.lineTo(p[p.length-1][0],p[p.length-1][1])}
    ctx.stroke();
  });
  ctx.globalAlpha=1;ctx.globalCompositeOperation="source-over";
}
var RES=2,view={z:1,tx:0,ty:0},resT=null,panMode=false,selMode=false;
function setRes(r){
  if(r===RES)return;RES=r;
  bgc.width=ink.width=Math.round(W*r);bgc.height=ink.height=Math.round(H*r);
  bx.setTransform(r,0,0,r,0,0);ix.setTransform(r,0,0,r,0,0);
  if(cur)showPage();
}
var vbase={w:0,h:0};
function stageR(){return $("#stage").getBoundingClientRect()}
function ensureBase(){
  if(view.z>1.001)return;
  var r=$("#page").getBoundingClientRect(),st=stageR();
  vbase.w=r.width;vbase.h=r.height;view.tx=r.left-st.left;view.ty=r.top-st.top;
}
function applyView(){
  var zi=$("#zi"),pg=$("#page"),zm=view.z>1.001;
  pg.classList.toggle("zoomed",zm);
  if(zm){zi.style.width=vbase.w+"px";zi.style.height=vbase.h+"px";zi.style.transform="translate("+view.tx+"px,"+view.ty+"px) scale("+view.z+")"}
  else{zi.style.width="";zi.style.height="";zi.style.transform=""}
  $("#b-pan").disabled=!zm;$("#b-reset").disabled=!zm;
  refreshZB();
}
function clampView(){
  var st=stageR(),cw=vbase.w*view.z,ch=vbase.h*view.z;
  view.tx=cw<=st.width?(st.width-cw)/2:Math.min(0,Math.max(st.width-cw,view.tx));
  view.ty=ch<=st.height?(st.height-ch)/2:Math.min(0,Math.max(st.height-ch,view.ty));
}
function resSoon(){clearTimeout(resT);resT=setTimeout(function(){setRes(view.z>1.001?4:2)},180)}
function zoomAt(z,cx,cy){
  ensureBase();z=Math.max(1,Math.min(8,z));var k=z/view.z;
  view.tx=cx-(cx-view.tx)*k;view.ty=cy-(cy-view.ty)*k;view.z=z;
  if(z<=1.001){view.z=1}else clampView();
  applyView();resSoon();
}
function resetView(){view.z=1;view.tx=0;view.ty=0;panMode=false;$("#b-pan").classList.remove("act");$("#b-pan").setAttribute("aria-pressed","false");applyView();clearTimeout(resT);setRes(2)}
function showPage(){
  var pg=cur.pages[pi];
  loadImg(pg.bg,function(img){if(cur&&cur.pages[pi]===pg)paintBg(bx,img)});
  paintStrokes(ix,pg.strokes);
  $("#pno").textContent=(pi+1)+" / "+cur.pages.length;
}
function openBook(id){
  cur=find(id);if(!cur)return;
  if(!cur.pages.length)cur.pages.push({bg:null,strokes:[]});
  pi=0;$("#v-lib").classList.remove("on");$("#v-board").classList.add("on");
  $("#pen").classList.remove("on");$("#b-pen").setAttribute("aria-pressed","false");$("#b-pen").classList.remove("act");
  closeOv();cancelSel();resetView();showPage();
}
function go(n){
  if(n<0||n>=cur.pages.length){toast(n<0?"첫 페이지입니다":"마지막 페이지입니다");return}
  pi=n;resetView();showPage();if(rec)ops.push({t:now(),k:"goto",p:pi});
}
$("#b-prev").onclick=function(){go(pi-1)};
$("#b-next").onclick=function(){go(pi+1)};
$("#b-add").onclick=function(){
  cur.pages.splice(pi+1,0,{bg:null,strokes:[]});pi++;resetView();showPage();later();
  if(rec)ops.push({t:now(),k:"add",p:pi});toast("새 페이지를 추가했습니다");
};
$("#b-exit").onclick=function(){
  if(rec)stopRec();save();$("#v-board").classList.remove("on");$("#v-lib").classList.add("on");cur=null;renderLib();
};

var drawing=null,erasing=false;
function segD(p,a,b){
  var dx=b[0]-a[0],dy=b[1]-a[1],l=dx*dx+dy*dy,t=l?((p[0]-a[0])*dx+(p[1]-a[1])*dy)/l:0;t=Math.max(0,Math.min(1,t));
  var x=a[0]+t*dx-p[0],y=a[1]+t*dy-p[1];return Math.sqrt(x*x+y*y);
}
function hitStroke(s,p,r){
  var q=s.pts;if(!q.length)return false;if(q.length===1)return Math.hypot(q[0][0]-p[0],q[0][1]-p[1])<=r;
  for(var i=1;i<q.length;i++)if(segD(p,q[i-1],q[i])<=r)return true;return false;
}
function eraseAt(p){
  var arr=cur.pages[pi].strokes,ch=false,rad=Math.max(3,10/view.z);
  for(var i=arr.length-1;i>=0;i--){
    var s=arr[i];if(s.tool==="eraser")continue;
    if(hitStroke(s,p,rad+s.size/2)){arr.splice(i,1);ch=true;if(rec)ops.push({t:now(),k:"del",p:pi,i:i})}
  }
  if(ch)paintStrokes(ix,arr);
}
function penOn(){return $("#pen").classList.contains("on")}
function curs(){ink.style.cursor=penOn()?(panMode&&view.z>1?"grab":tool.t==="eraser"?"cell":"crosshair"):(view.z>1.001?"grab":"default")}
function pos(e){var r=ink.getBoundingClientRect();return[(e.clientX-r.left)*W/r.width,(e.clientY-r.top)*H/r.height]}
ink.addEventListener("pointerdown",function(e){
  if(e.button>0)return;e.preventDefault();
  try{ink.setPointerCapture(e.pointerId)}catch(x){}
  if(!penOn()){if(view.z>1.001)panning={x:e.clientX,y:e.clientY,tx:view.tx,ty:view.ty};return}
  if(panMode&&view.z>1){panning={x:e.clientX,y:e.clientY,tx:view.tx,ty:view.ty};return}
  $("#emenu").classList.remove("on");
  var p=pos(e),t=now();
  if(tool.t==="eraser"&&tool.em==="stroke"){erasing=true;eraseAt(p);return}
  drawing={tool:tool.t,color:tool.color,size:tool.size,pts:[[p[0],p[1],t]]};
  cur.pages[pi].strokes.push(drawing);paintStrokes(ix,cur.pages[pi].strokes);
  if(rec)ops.push({t:t,k:"stroke",p:pi,s:drawing});
  if(!$("#pen").classList.contains("on")){}
});
var panning=null;
ink.addEventListener("pointermove",function(e){
  if(erasing){var ev=e.getCoalescedEvents?e.getCoalescedEvents():[e];if(!ev.length)ev=[e];ev.forEach(function(q){eraseAt(pos(q))});return}
  if(panning){view.tx=panning.tx+e.clientX-panning.x;view.ty=panning.ty+e.clientY-panning.y;clampView();applyView();return}
  if(!drawing)return;
  var evs=e.getCoalescedEvents?e.getCoalescedEvents():[e];if(!evs.length)evs=[e];
  evs.forEach(function(ev){var p=pos(ev);drawing.pts.push([p[0],p[1],now()])});
  paintStrokes(ix,cur.pages[pi].strokes);
});
function endDraw(){if(panning){panning=null;return}if(erasing){erasing=false;later();return}if(drawing){drawing=null;later()}}
ink.addEventListener("pointerup",endDraw);ink.addEventListener("pointercancel",endDraw);
function undo(){var s=cur.pages[pi].strokes;if(s.length){s.pop();showPage();later()}}
document.addEventListener("keydown",function(e){
  if(!cur||!$("#v-board").classList.contains("on"))return;
  if(/input|textarea/i.test(e.target.tagName))return;
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="z"){e.preventDefault();undo()}
  else if(e.key==="ArrowRight"||e.key==="PageDown")go(pi+1);
  else if(e.key==="ArrowLeft"||e.key==="PageUp")go(pi-1);
});

/* ---------- 도구 ---------- */
(function(){
  var h="";COLORS.forEach(function(c,i){h+='<button class="dot'+(c==="#ffffff"?" w":"")+'" style="background:'+c+'" data-c="'+c+'" aria-label="색상 '+(i+1)+'" aria-pressed="'+(c===tool.color)+'"></button>'});
  $("#cols").innerHTML=h;
})();
$("#cols").addEventListener("click",function(e){
  var b=e.target.closest(".dot");if(!b)return;tool.color=b.dataset.c;
  document.querySelectorAll(".dot").forEach(function(d){d.setAttribute("aria-pressed",d===b)});
  if(tool.t==="eraser")setTool("pen");
});
function setSize(n){tool.size=Math.max(1,Math.min(24,n));$("#szv").textContent=tool.size}
$("#szUp").onclick=function(){setSize(tool.size+1)};
$("#szDn").onclick=function(){setSize(tool.size-1)};
var ICON={pen:'<path d="M3 21l1.2-5L16 4.2a1.7 1.7 0 012.4 0l1.4 1.4a1.7 1.7 0 010 2.4L8 19.8z"/>',hl:'<path d="M14 3l7 7-8 8-3-1-4 4H3v-3l4-4-1-3z"/>',eraser:'<path d="M9 20h11M4.5 14.5L14 5l6 6-8 8H8z" fill="none" stroke="#fff" stroke-width="1.8" stroke-linejoin="round"/>'};
function setTool(t){
  tool.t=t;
  document.querySelectorAll(".wheel [data-tool]").forEach(function(b){b.setAttribute("aria-pressed",b.dataset.tool===t)});
  $("#mainTool").querySelector("svg").innerHTML=ICON[t];
  curs();
}
function emSet(m){
  tool.em=m;setTool("eraser");$("#emenu").classList.remove("on");
  $("#em-stroke").setAttribute("aria-checked",m==="stroke");$("#em-free").setAttribute("aria-checked",m==="free");
  toast(m==="stroke"?"한 획씩 지우기: 지울 선 위로 지나가세요":"직접 지우기: 지운 부분만 지워집니다");
}
$("#em-stroke").onclick=function(){emSet("stroke")};
$("#em-free").onclick=function(){emSet("free")};
document.querySelectorAll(".wheel [data-tool]").forEach(function(b){b.onclick=function(){
  var m=$("#emenu");
  if(b.dataset.tool==="eraser"){
    var open=!m.classList.contains("on");
    if(open){var wr=b.parentNode.getBoundingClientRect(),sr=$("#stage").getBoundingClientRect();m.classList.toggle("below",wr.top-sr.top<140)}
    setTool("eraser");m.classList.toggle("on",open);
  }else{m.classList.remove("on");setTool(b.dataset.tool)}
}});
document.addEventListener("pointerdown",function(e){if(!e.target.closest(".emenu")&&!e.target.closest("[data-tool=eraser]"))$("#emenu").classList.remove("on")});
var penDragged=false;
$("#mainTool").onclick=function(){if(penDragged){penDragged=false;return}setTool("pen")};
(function(){
  var m=$("#mainTool"),pen=$("#pen"),d=null;
  m.setAttribute("title","누른 채 끌어서 도구 옮기기");
  m.addEventListener("pointerdown",function(e){
    if(e.button>0)return;
    var st=$("#stage").getBoundingClientRect(),pr=pen.getBoundingClientRect(),l=1e9,t=1e9,r=-1e9,b=-1e9;
    [].forEach.call(pen.children,function(c){var q=c.getBoundingClientRect();l=Math.min(l,q.left);t=Math.min(t,q.top);r=Math.max(r,q.right);b=Math.max(b,q.bottom)});
    d={x:e.clientX,y:e.clientY,pl:pr.left-st.left,pt:pr.top-st.top,minx:st.left-l,maxx:st.right-r,miny:st.top-t,maxy:st.bottom-b,on:false};
    try{m.setPointerCapture(e.pointerId)}catch(x){}
  });
  m.addEventListener("pointermove",function(e){
    if(!d)return;
    var dx=e.clientX-d.x,dy=e.clientY-d.y;
    if(!d.on){if(Math.abs(dx)+Math.abs(dy)<6)return;d.on=true;m.classList.add("drag")}
    dx=Math.max(d.minx,Math.min(d.maxx,dx));dy=Math.max(d.miny,Math.min(d.maxy,dy));
    pen.style.transform="none";pen.style.bottom="auto";pen.style.left=(d.pl+dx)+"px";pen.style.top=(d.pt+dy)+"px";
  });
  function end(){if(d&&d.on){penDragged=true;setTimeout(function(){penDragged=false},0)}m.classList.remove("drag");d=null}
  m.addEventListener("pointerup",end);m.addEventListener("pointercancel",end);
  window.addEventListener("resize",function(){pen.style.left="";pen.style.top="";pen.style.bottom="";pen.style.transform=""});
})();
var clrArmed=null;
$("#clr").onclick=function(){
  if(!clrArmed){toast("한 번 더 누르면 이 페이지를 모두 지웁니다");clrArmed=setTimeout(function(){clrArmed=null},2500);return}
  clearTimeout(clrArmed);clrArmed=null;cur.pages[pi].strokes.length=0;showPage();later();
  if(rec)ops.push({t:now(),k:"clear",p:pi});toast("지웠습니다");
};
$("#b-pen").onclick=function(){
  var on=!$("#pen").classList.contains("on");$("#pen").classList.toggle("on",on);
  this.setAttribute("aria-pressed",on);this.classList.toggle("act",on);curs();
};

/* ---------- 모아보기 ---------- */
function refreshZB(){
  var ovOn=$("#ov").classList.contains("on");
  $("#b-zoom").classList.toggle("act",ovOn);$("#b-zoom").setAttribute("aria-pressed",ovOn);
  $("#b-zsel").classList.toggle("act",selMode);$("#b-zsel").setAttribute("aria-pressed",selMode);
  curs();
}
function closeOv(){$("#ov").classList.remove("on");$("#page").style.visibility="visible";refreshZB()}
function openOverview(){
  var ov=$("#ov");
  ov.innerHTML="";var tasks=cur.pages.map(function(pg,i){
    return new Promise(function(res){loadImg(pg.bg,function(img){
      var c=document.createElement("canvas");c.width=300;c.height=380;var x=c.getContext("2d");x.scale(.5,.5);paintBg(x,img);
      var t=document.createElement("canvas");t.width=W;t.height=H;paintStrokes(t.getContext("2d"),pg.strokes);x.drawImage(t,0,0);
      res(c.toDataURL("image/jpeg",.7))})})});
  Promise.all(tasks).then(function(u){
    ov.innerHTML=u.map(function(s,i){return'<button class="th'+(i===pi?" cur":"")+'" data-i="'+i+'" aria-label="'+(i+1)+'페이지로 이동"><img alt="" src="'+s+'"><span>'+(i+1)+'</span></button>'}).join("");
    ov.classList.add("on");var cu=ov.querySelector(".cur");if(cu)cu.scrollIntoView({block:"center"});$("#page").style.visibility="hidden";$("#pen").classList.remove("on");$("#b-pen").classList.remove("act");$("#b-pen").setAttribute("aria-pressed","false");
    $("#b-zoom").classList.add("act");$("#b-zoom").setAttribute("aria-pressed","true");
  });
}
function cancelSel(){selMode=false;$("#sel").classList.remove("on");$("#selr").style.display="none";applyView()}
function startSel(){
  if(view.z>1.001){}
  selMode=true;$("#sel").classList.add("on");toast("확대할 구간을 드래그하세요");refreshZB();
}
$("#b-zoom").onclick=function(){
  if($("#ov").classList.contains("on")){closeOv();return}
  cancelSel();openOverview();
};
$("#b-zsel").onclick=function(){if(selMode){cancelSel();return}if($("#ov").classList.contains("on"))closeOv();startSel()};
$("#b-zin").onclick=function(){if($("#ov").classList.contains("on"))closeOv();var r=stageR();zoomAt(view.z*1.4,r.width/2,r.height/2)};
$("#b-zout").onclick=function(){if($("#ov").classList.contains("on"))closeOv();var r=stageR();zoomAt(view.z/1.4,r.width/2,r.height/2)};
$("#b-reset").onclick=function(){cancelSel();resetView()};
$("#b-pan").onclick=function(){panMode=!panMode;this.classList.toggle("act",panMode);this.setAttribute("aria-pressed",panMode);curs()};
(function(){
  var sel=$("#sel"),r0=null,st=null;
  sel.addEventListener("pointerdown",function(e){
    e.preventDefault();try{sel.setPointerCapture(e.pointerId)}catch(x){}
    r0=stageR();st=[e.clientX-r0.left,e.clientY-r0.top];
    var q=$("#selr");q.style.display="block";q.style.left=st[0]+"px";q.style.top=st[1]+"px";q.style.width="0";q.style.height="0";
  });
  sel.addEventListener("pointermove",function(e){
    if(!st)return;var x=Math.max(0,Math.min(r0.width,e.clientX-r0.left)),y=Math.max(0,Math.min(r0.height,e.clientY-r0.top)),q=$("#selr");
    q.style.left=Math.min(st[0],x)+"px";q.style.top=Math.min(st[1],y)+"px";q.style.width=Math.abs(x-st[0])+"px";q.style.height=Math.abs(y-st[1])+"px";
  });
  function fin(e){
    if(!st)return;
    var x=Math.max(0,Math.min(r0.width,e.clientX-r0.left)),y=Math.max(0,Math.min(r0.height,e.clientY-r0.top));
    var sx=Math.min(st[0],x),sy=Math.min(st[1],y),sw=Math.abs(x-st[0]),sh=Math.abs(y-st[1]);st=null;
    $("#selr").style.display="none";
    if(sw<14||sh<14){toast("조금 더 크게 드래그하세요");return}
    ensureBase();
    var lx=(sx-view.tx)/view.z,ly=(sy-view.ty)/view.z,lw=sw/view.z,lh=sh/view.z;
    var z=Math.max(1,Math.min(8,r0.width/lw,r0.height/lh));
    view.z=z;view.tx=(r0.width-lw*z)/2-lx*z;view.ty=(r0.height-lh*z)/2-ly*z;
    if(z<=1.001){view.z=1}else clampView();
    selMode=false;sel.classList.remove("on");applyView();resSoon();
  }
  sel.addEventListener("pointerup",fin);
  sel.addEventListener("pointercancel",function(){st=null;$("#selr").style.display="none"});
  $("#stage").addEventListener("wheel",function(e){
    var r=stageR();
    if(e.ctrlKey||e.metaKey){e.preventDefault();zoomAt(view.z*(e.deltaY<0?1.15:1/1.15),e.clientX-r.left,e.clientY-r.top)}
    else if(view.z>1.001){e.preventDefault();view.tx-=e.deltaX;view.ty-=e.deltaY;clampView();applyView()}
  },{passive:false});
  window.addEventListener("resize",function(){if(view.z>1.001)resetView()});
})();
$("#ov").addEventListener("click",function(e){var b=e.target.closest(".th");if(!b)return;pi=+b.dataset.i;closeOv();resetView();showPage();if(rec)ops.push({t:now(),k:"goto",p:pi})});

/* ---------- 녹화(판서 과정 다시보기) ---------- */
var rec=false,ops=[],t0=0,base=null,recLen=0;
function now(){return rec?Math.round(performance.now()-t0):0}
function clone(o){return JSON.parse(JSON.stringify(o))}
$("#b-rec").onclick=function(){rec?stopRec(true):startRec()};
function startRec(){
  rec=true;t0=performance.now();ops=[];
  base={pages:cur.pages.map(function(p){return{bg:p.bg,strokes:clone(p.strokes)}}),start:pi};
  $("#b-rec").classList.add("on");$("#b-rec").textContent="●";toast("녹화를 시작했습니다. 다시 누르면 끝납니다");
}
function stopRec(show){
  recLen=Math.round(performance.now()-t0);rec=false;
  $("#b-rec").classList.remove("on");$("#b-rec").textContent="REC";
  if(show){if(!ops.length){toast("녹화된 판서가 없습니다");return}openReplay()}
}
var rcv=$("#rcv"),rx=rcv.getContext("2d"),rPlaying=false,rT=0,rLast=0,raf=0;
var scratch=document.createElement("canvas");scratch.width=W;scratch.height=H;
function stateAt(T){
  var pages=base.pages.map(function(p){return{bg:p.bg,strokes:clone(p.strokes)}}),c=base.start;
  ops.forEach(function(o){
    if(o.t>T)return;
    if(o.k==="add"){pages.splice(o.p,0,{bg:null,strokes:[]});c=o.p}
    else if(o.k==="goto")c=o.p;
    else if(o.k==="del"){if(pages[o.p])pages[o.p].strokes.splice(o.i,1)}
    else if(o.k==="clear"){if(pages[o.p])pages[o.p].strokes=[]}
    else if(o.k==="stroke"&&pages[o.p])pages[o.p].strokes.push(o.s);
  });
  return{page:pages[Math.min(c,pages.length-1)]};
}
function drawReplay(T){
  var s=stateAt(T);
  loadImg(s.page.bg,function(img){
    paintBg(rx,img);paintStrokes(scratch.getContext("2d"),s.page.strokes,T);rx.drawImage(scratch,0,0);
  });
  var sec=Math.floor(T/1000);$("#rTime").textContent=Math.floor(sec/60)+":"+("0"+sec%60).slice(-2);
  $("#rSeek").value=recLen?Math.round(T/recLen*1000):0;
}
function openReplay(){rT=0;rPlaying=false;$("#rPlay").textContent="▶ 재생";$("#sc-rec").classList.add("on");drawReplay(0)}
function tick(ts){
  if(!rPlaying)return;rT+=ts-rLast;rLast=ts;
  if(rT>=recLen){rT=recLen;rPlaying=false;$("#rPlay").textContent="▶ 다시 재생"}
  drawReplay(rT);if(rPlaying)raf=requestAnimationFrame(tick);
}
$("#rPlay").onclick=function(){
  if(rPlaying){rPlaying=false;this.textContent="▶ 재생";return}
  if(rT>=recLen)rT=0;rPlaying=true;this.textContent="❚❚ 일시정지";rLast=performance.now();raf=requestAnimationFrame(tick);
};
$("#rSeek").oninput=function(){rT=this.value/1000*recLen;drawReplay(rT)};
$("#rClose").onclick=function(){rPlaying=false;cancelAnimationFrame(raf);$("#sc-rec").classList.remove("on")};

/* ---------- 시작 ---------- */
document.addEventListener("keydown",function(e){
  if(e.key==="Escape"){cancelSel();refreshZB();["sc-form","sc-del"].forEach(function(i){$("#"+i).classList.remove("on")})}
});
load().then(renderLib);
})();
