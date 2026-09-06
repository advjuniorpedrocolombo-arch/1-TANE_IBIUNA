const PROVA_AI_ENDPOINT='https://script.google.com/macros/s/AKfycbwrJVRjeNGNbYEzvQf87ZI_PsWR06EntxLSVIVRc-yJmvSo4mMn9NRp8GZYdD9rfmMgmA/exec';
const PROVA_AI_STORAGE_KEY='prova_ai_2026_tentativa';
const PROVA_AI_MAX_BYTES=15*1024*1024;

const PROVA_AI_TITULOS=[
  'TRANSFORMAÇÃO DIGITAL NAS ORGANIZAÇÕES',
  'COMUNICAÇÃO INTERNA NAS ORGANIZAÇÕES',
  'ATENDIMENTO AO CLIENTE COMO DIFERENCIAL COMPETITIVO',
  'GESTÃO DE PESSOAS NAS ORGANIZAÇÕES',
  'PLANEJAMENTO E TECNOLOGIA NAS ORGANIZAÇÕES'
];

const PROVA_AI_TEXTO_FOLHA_ROSTO='Avaliação apresentada ao Curso Técnico em Administração da Etec de Mairinque – Extensão Ibiúna, orientado pelo Prof. Junior Pedro Colombo, como requisito parcial para obtenção do título de técnico em Administração.';

(function(){
  const examArea=document.getElementById('examArea');
  if(!examArea)return;

  const style=document.createElement('style');
  style.textContent=`
    .prova-title-box{margin:0 0 18px;padding:18px;border-radius:16px;background:#fff7f7;border:2px solid var(--red);box-shadow:0 8px 20px rgba(181,18,27,.08)}
    .prova-title-box small{display:block;color:var(--red);font-size:.72rem;font-weight:900;text-transform:uppercase;letter-spacing:.08em;margin-bottom:7px}
    .prova-title-box strong{display:block;color:#7d0b12;font-size:1.22rem;line-height:1.35;margin-bottom:7px}
    .prova-title-box p{margin:0;color:#6e252a;font-size:.9rem;font-weight:700}
    .folha-rosto-box{margin:18px 0;padding:18px;border-radius:16px;background:#f8fafc;border:1px solid #d9dee7}
    .folha-rosto-box small{display:block;color:#475467;font-size:.72rem;font-weight:900;text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px}
    .folha-rosto-box strong{display:block;margin-bottom:8px;color:#222831}
    .folha-rosto-box blockquote{margin:0;padding:13px 15px;border-left:4px solid var(--red);background:#fff;border-radius:8px;color:#303743;line-height:1.55;font-size:.92rem}
    .folha-rosto-box .obs{margin-top:10px;color:#596273;font-size:.84rem;font-weight:700}
    .upload-panel{margin-top:20px;background:#fff;border:1px solid var(--line);border-radius:20px;box-shadow:0 10px 30px rgba(30,38,50,.07);overflow:hidden}
    .upload-head{padding:20px 22px;border-bottom:1px solid var(--line)}
    .upload-head small{display:block;color:var(--red);font-weight:900;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px}
    .upload-head h2{margin:0;font-size:1.35rem}
    .upload-body{padding:22px}
    .upload-note{padding:14px 16px;border-radius:14px;background:var(--blue-soft);color:#174a9c;border-left:5px solid var(--blue);font-size:.9rem;margin-bottom:16px}
    .upload-file{display:block;width:100%;padding:13px;border:1px dashed #b9c0ca;border-radius:12px;background:#fafafa;font-size:.92rem}
    .upload-meta{margin-top:10px;color:var(--muted);font-size:.82rem}
    .upload-btn{width:100%;margin-top:14px;border:0;border-radius:13px;padding:14px 18px;background:var(--red);color:#fff;font-weight:900;cursor:pointer}
    .upload-btn:disabled{background:#c9cdd3;color:#6b7280;cursor:not-allowed}
    .upload-status{display:none;margin-top:14px;padding:14px;border-radius:12px;font-size:.88rem;font-weight:800}
    .upload-status.ok{display:block;background:var(--green-soft);color:var(--green)}
    .upload-status.error{display:block;background:#fff1f1;color:#8e0d14}
    .upload-status.wait{display:block;background:var(--yellow-soft);color:var(--yellow)}
  `;
  document.head.appendChild(style);

  function getAttempt(){
    try{return JSON.parse(localStorage.getItem(PROVA_AI_STORAGE_KEY)||'null')}catch(e){return null}
  }

  function saveAttempt(a){
    localStorage.setItem(PROVA_AI_STORAGE_KEY,JSON.stringify(a));
  }

  function tituloDaTentativa(a){
    const i=Number(a&&a.textIndex);
    return PROVA_AI_TITULOS[i]||'TÍTULO NÃO IDENTIFICADO';
  }

  const randomText=document.getElementById('randomText');
  let titleBox=null;
  let folhaBox=null;

  if(randomText&&randomText.parentNode){
    titleBox=document.createElement('div');
    titleBox.className='prova-title-box';
    titleBox.style.display='none';
    titleBox.innerHTML='<small>Título sorteado para o trabalho</small><strong id="provaTituloSorteado"></strong><p>Use este título exatamente na CAPA e na FOLHA DE ROSTO do trabalho.</p>';
    randomText.parentNode.insertBefore(titleBox,randomText);

    folhaBox=document.createElement('div');
    folhaBox.className='folha-rosto-box';
    folhaBox.style.display='none';
    folhaBox.innerHTML='<small>Folha de rosto — texto obrigatório</small><strong>Utilize o texto abaixo na folha de rosto:</strong><blockquote>'+PROVA_AI_TEXTO_FOLHA_ROSTO+'</blockquote><div class="obs">O título da folha de rosto deve ser o mesmo título sorteado exibido acima.</div>';
    if(randomText.nextSibling){
      randomText.parentNode.insertBefore(folhaBox,randomText.nextSibling);
    }else{
      randomText.parentNode.appendChild(folhaBox);
    }
  }

  function atualizarOrientacoes(){
    const a=getAttempt();
    if(!a||typeof a.textIndex==='undefined')return;
    const titulo=tituloDaTentativa(a);
    const alvo=document.getElementById('provaTituloSorteado');
    if(alvo)alvo.textContent=titulo;
    if(titleBox)titleBox.style.display='block';
    if(folhaBox)folhaBox.style.display='block';
  }

  atualizarOrientacoes();

  const observer=new MutationObserver(atualizarOrientacoes);
  observer.observe(examArea,{attributes:true,attributeFilter:['style','class']});

  document.addEventListener('click',function(e){
    if(e.target&&(
      e.target.id==='startBtn'||
      e.target.id==='resumeBtn'
    )){
      setTimeout(atualizarOrientacoes,0);
    }
  });

  const panel=document.createElement('section');
  panel.className='upload-panel';
  panel.innerHTML='<div class="upload-head"><small>Entrega da avaliação</small><h2>Enviar arquivo PDF</h2></div><div class="upload-body"><div class="upload-note"><strong>📄 Envio obrigatório em PDF.</strong><br>Selecione o trabalho final exportado do Word ou editor similar. Limite máximo: 15 MB.</div><input id="provaPdfFile" class="upload-file" type="file" accept="application/pdf,.pdf"><div id="provaPdfMeta" class="upload-meta">Nenhum arquivo selecionado.</div><button id="provaPdfSend" class="upload-btn" type="button" disabled>ENVIAR PDF PARA CORREÇÃO</button><div id="provaPdfStatus" class="upload-status" aria-live="polite"></div></div>';
  examArea.appendChild(panel);

  const fileInput=document.getElementById('provaPdfFile');
  const sendBtn=document.getElementById('provaPdfSend');
  const meta=document.getElementById('provaPdfMeta');
  const status=document.getElementById('provaPdfStatus');

  function setStatus(type,msg){
    status.className='upload-status '+type;
    status.textContent=msg;
  }

  function fileToBase64(file){
    return new Promise((resolve,reject)=>{
      const reader=new FileReader();
      reader.onload=()=>resolve(String(reader.result||''));
      reader.onerror=()=>reject(new Error('Não foi possível ler o arquivo PDF.'));
      reader.readAsDataURL(file);
    });
  }

  fileInput.addEventListener('change',()=>{
    const file=fileInput.files&&fileInput.files[0];
    sendBtn.disabled=true;
    status.className='upload-status';

    if(!file){
      meta.textContent='Nenhum arquivo selecionado.';
      return;
    }

    const isPdf=file.type==='application/pdf'||file.name.toLowerCase().endsWith('.pdf');
    if(!isPdf){
      meta.textContent='Arquivo inválido. Selecione somente PDF.';
      setStatus('error','Somente arquivos PDF são aceitos.');
      return;
    }

    if(file.size>PROVA_AI_MAX_BYTES){
      meta.textContent='Arquivo acima de 15 MB.';
      setStatus('error','O PDF excede o limite máximo de 15 MB.');
      return;
    }

    meta.textContent=file.name+' • '+(file.size/1024/1024).toFixed(2)+' MB';
    sendBtn.disabled=false;
  });

  sendBtn.addEventListener('click',async()=>{
    const attempt=getAttempt();
    const file=fileInput.files&&fileInput.files[0];

    if(!attempt){
      setStatus('error','Tentativa não localizada. Retome ou reinicie a prova antes de enviar.');
      return;
    }

    if(!file){
      setStatus('error','Selecione o arquivo PDF antes de enviar.');
      return;
    }

    if(attempt.submitted){
      setStatus('ok','Esta prova já foi enviada neste navegador.');
      return;
    }

    const tituloSorteado=tituloDaTentativa(attempt);

    sendBtn.disabled=true;
    fileInput.disabled=true;
    setStatus('wait','Enviando PDF para o Google Drive. Aguarde...');

    try{
      const pdfBase64=await fileToBase64(file);
      const payload={
        nome:attempt.name,
        email:attempt.email,
        inicio:new Date(attempt.startTime).toISOString(),
        fim:new Date().toISOString(),
        versao:'Texto '+(Number(attempt.textIndex)+1),
        tema:tituloSorteado,
        titulo:tituloSorteado,
        textoFolhaRosto:PROVA_AI_TEXTO_FOLHA_ROSTO,
        mimeType:'application/pdf',
        pdfBase64,
        observacoes:'Envio realizado pela interface da 1ª Prova de Aplicativos Informatizados. Título sorteado: '+tituloSorteado
      };

      await fetch(PROVA_AI_ENDPOINT,{
        method:'POST',
        mode:'no-cors',
        headers:{'Content-Type':'text/plain;charset=utf-8'},
        body:JSON.stringify(payload)
      });

      attempt.submitted=true;
      attempt.submittedAt=Date.now();
      attempt.titulo=tituloSorteado;
      saveAttempt(attempt);

      setStatus('ok','✓ PDF encaminhado para entrega. Título registrado: '+tituloSorteado+'.');
      sendBtn.textContent='PDF ENCAMINHADO';

    }catch(err){
      fileInput.disabled=false;
      sendBtn.disabled=false;
      setStatus('error','Erro no envio: '+(err&&err.message?err.message:String(err)));
    }
  });

  const existing=getAttempt();
  if(existing&&existing.submitted){
    fileInput.disabled=true;
    sendBtn.disabled=true;
    sendBtn.textContent='PDF JÁ ENCAMINHADO';
    setStatus('ok','✓ Esta prova já foi encaminhada neste navegador.');
  }
})();
