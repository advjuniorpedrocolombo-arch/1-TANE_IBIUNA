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

  /* =========================================================
     LIMPA A TELA ANTERIOR
     Capa, folha de rosto e texto acadêmico ficam somente
     na área de envio do arquivo.
     ========================================================= */

  const regras=document.querySelectorAll('#instructionsPanel .rules li');
  regras.forEach(function(li){
    const txt=(li.textContent||'').toLowerCase();
    if(txt.includes('capa')||txt.includes('folha de rosto')){
      li.remove();
    }
  });

  const pdfNote=document.querySelector('#instructionsPanel .pdf-note');
  if(pdfNote){
    pdfNote.innerHTML='<strong>📄 FORMATO OBRIGATÓRIO DE ENTREGA</strong>O trabalho deverá ser produzido no <strong>Microsoft Word ou editor de texto similar</strong> e, ao final, <strong>salvo/exportado em PDF</strong>. Somente o arquivo PDF será aceito para envio.';
  }

  const taskText=document.querySelector('#examArea .task-box p');
  if(taskText){
    taskText.innerHTML='Copie o texto sorteado abaixo para o <strong>Microsoft Word ou editor similar</strong> e desenvolva/formate o documento conforme as orientações trabalhadas em aula. Ao finalizar, <strong>salve/exporte o arquivo em PDF</strong> para realizar a entrega.';
  }

  const style=document.createElement('style');
  style.textContent=`
    .upload-panel{margin-top:20px;background:#fff;border:1px solid var(--line);border-radius:20px;box-shadow:0 10px 30px rgba(30,38,50,.07);overflow:hidden}
    .upload-head{padding:20px 22px;border-bottom:1px solid var(--line)}
    .upload-head small{display:block;color:var(--red);font-weight:900;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px}
    .upload-head h2{margin:0;font-size:1.35rem}
    .upload-body{padding:22px}
    .orientacoes-entrega{margin-bottom:20px;padding:18px;border-radius:16px;background:#fff8f8;border:1px solid #efc7ca}
    .orientacoes-entrega h3{margin:0 0 14px;color:var(--red);font-size:1.08rem}
    .orientacao-item{margin-top:13px;padding-top:13px;border-top:1px solid #f0d8da}
    .orientacao-item:first-of-type{margin-top:0;padding-top:0;border-top:0}
    .orientacao-item strong{display:block;color:#303743;margin-bottom:5px}
    .titulo-sorteado{display:block;margin:7px 0 6px;padding:13px 14px;border-radius:11px;background:#fff;border:2px solid var(--red);color:#7d0b12;font-size:1.08rem;font-weight:900;text-align:center}
    .texto-folha-rosto{margin-top:7px;padding:13px 14px;border-left:4px solid var(--red);border-radius:8px;background:#fff;color:#303743;line-height:1.5;font-size:.9rem}
    .orientacao-aviso{margin-top:14px;padding:12px 14px;border-radius:10px;background:#fff0f1;color:#7d0b12;font-size:.86rem;font-weight:800}
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

  const panel=document.createElement('section');
  panel.className='upload-panel';
  panel.innerHTML=`
    <div class="upload-head">
      <small>Entrega da avaliação</small>
      <h2>Revisar orientações e enviar PDF</h2>
    </div>
    <div class="upload-body">
      <div class="orientacoes-entrega">
        <h3>⚠️ Confira antes de enviar</h3>

        <div class="orientacao-item">
          <strong>1. TÍTULO DO TRABALHO</strong>
          O título obrigatório correspondente ao texto sorteado é:
          <span id="provaTituloEntrega" class="titulo-sorteado">AGUARDANDO SORTEIO DO TEXTO</span>
          Utilize <strong>exatamente este título</strong> na CAPA e na FOLHA DE ROSTO.
        </div>

        <div class="orientacao-item">
          <strong>2. CAPA</strong>
          A capa deve utilizar o título sorteado acima e seguir o modelo/formatação trabalhados em aula.
        </div>

        <div class="orientacao-item">
          <strong>3. FOLHA DE ROSTO</strong>
          Utilize o mesmo título sorteado acima e insira obrigatoriamente o seguinte texto:
          <div class="texto-folha-rosto">${PROVA_AI_TEXTO_FOLHA_ROSTO}</div>
        </div>

        <div class="orientacao-aviso">
          Antes do envio, confira se CAPA e FOLHA DE ROSTO apresentam o mesmo título sorteado. A correção por IA verificará essa correspondência.
        </div>
      </div>

      <div class="upload-note">
        <strong>📄 Envio obrigatório em PDF.</strong><br>
        Selecione o trabalho final exportado do Word ou editor similar. Limite máximo: 15 MB.
      </div>

      <input id="provaPdfFile" class="upload-file" type="file" accept="application/pdf,.pdf">
      <div id="provaPdfMeta" class="upload-meta">Nenhum arquivo selecionado.</div>
      <button id="provaPdfSend" class="upload-btn" type="button" disabled>ENVIAR PDF PARA CORREÇÃO</button>
      <div id="provaPdfStatus" class="upload-status" aria-live="polite"></div>
    </div>`;

  examArea.appendChild(panel);

  const titleTarget=document.getElementById('provaTituloEntrega');
  const fileInput=document.getElementById('provaPdfFile');
  const sendBtn=document.getElementById('provaPdfSend');
  const meta=document.getElementById('provaPdfMeta');
  const status=document.getElementById('provaPdfStatus');

  function atualizarTituloEntrega(){
    const a=getAttempt();
    if(!a||typeof a.textIndex==='undefined'){
      titleTarget.textContent='AGUARDANDO SORTEIO DO TEXTO';
      return;
    }
    const titulo=tituloDaTentativa(a);
    titleTarget.textContent=titulo;
    a.titulo=titulo;
    saveAttempt(a);
  }

  atualizarTituloEntrega();

  document.addEventListener('click',function(e){
    if(e.target&&(e.target.id==='startBtn'||e.target.id==='resumeBtn')){
      setTimeout(atualizarTituloEntrega,50);
      setTimeout(atualizarTituloEntrega,250);
    }
  });

  const observer=new MutationObserver(atualizarTituloEntrega);
  observer.observe(examArea,{attributes:true,attributeFilter:['style','class']});

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

    if(tituloSorteado==='TÍTULO NÃO IDENTIFICADO'){
      setStatus('error','Não foi possível identificar o título sorteado. Retome a prova antes de enviar.');
      return;
    }

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
        pdfBase64:pdfBase64,
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
