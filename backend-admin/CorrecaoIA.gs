/**
 * CORREÇÃO POR IA — 1º TANE — Extensão Ibiúna
 * Adicione este arquivo ao projeto Apps Script do PAINEL DO PROFESSOR.
 * A chave deve ser definida em Propriedades do script: OPENAI_API_KEY.
 * Não coloque a chave na planilha ou no repositório.
 * Corrige somente entregas com CORRECAO_IA=SIM; exige revisão humana.
 */
const IA_SHEET_ID = '1TmsiHct_EdfPvUTjHyUV7O3GZJ_y6lVQgPRmMHf_edI';
const IA_MODEL = 'gpt-4.1-mini';
const IA_MAX_ARQUIVOS = 5;
const IA_MAX_BYTES = 12 * 1024 * 1024;
const IA_HEADERS = ['ID_CORRECAO','ID_ENTREGA','ID_ATIVIDADE','ALUNO','COMPONENTE','RESULTADO_IA','MENCAO','FEEDBACK','STATUS','CORRIGIDO_EM'];

function iaExigirAdmin_(){
  const emailPermitido=String(PropertiesService.getScriptProperties().getProperty('IA_ADMIN_EMAIL')||'').trim().toLowerCase();
  const emailAtual=String(Session.getActiveUser().getEmail()||'').trim().toLowerCase();
  if(!emailPermitido || !emailAtual || emailAtual!==emailPermitido)
    throw Error('Acesso negado. Configure IA_ADMIN_EMAIL e implante o painel com acesso restrito à conta docente.');
}
function iaSS_(){ return SpreadsheetApp.openById(IA_SHEET_ID); }
function iaSheet_(name){const sh=iaSS_().getSheetByName(name);if(!sh)throw Error('Aba ausente: '+name);return sh;}
function iaRows_(name){
  const sh=iaSheet_(name),v=sh.getDataRange().getValues(),h=v.shift().map(String);
  return v.map((r,i)=>Object.assign({__row:i+2},Object.fromEntries(h.map((x,j)=>[x,r[j]]))))
    .filter(r=>r[h[0]]!=='' && r[h[0]]!=null);
}
function iaLinks_(s){return String(s||'').split(/[\n;,]+/).map(x=>x.trim()).filter(Boolean);}
function iaDriveId_(url){const s=String(url||'');const m=s.match(/\/file\/d\/([\w-]+)/)||s.match(/[?&]id=([\w-]+)/);if(!m)throw Error('Link do Drive não reconhecido: '+s);return m[1];}
function iaValidarEntrega_(id){
  const entrega=iaRows_('ENTREGAS').find(r=>String(r.ID_ENTREGA)===String(id));
  if(!entrega)throw Error('Entrega não encontrada');
  const atividade=iaRows_('ATIVIDADES').find(r=>String(r.ID_ATIVIDADE)===String(entrega.ID_ATIVIDADE));
  if(!atividade)throw Error('Atividade não encontrada');
  if(String(atividade.CORRECAO_IA).toUpperCase()!=='SIM')throw Error('Correção por IA não ativada para esta atividade');
  if(!String(atividade.GABARITO_CRITERIOS||'').trim())throw Error('Gabarito vazio');
  const urls=iaLinks_(entrega.ARQUIVOS_URL);
  if(!urls.length && !String(entrega.RESPOSTA_TEXTO||'').trim())throw Error('Entrega sem conteúdo');
  if(urls.length>IA_MAX_ARQUIVOS)throw Error('Quantidade de arquivos maior que o limite de segurança');
  return {entrega,atividade,urls};
}
function iaCorrigirEntrega(idEntrega){
  iaExigirAdmin_();
  const lock=LockService.getScriptLock();if(!lock.tryLock(20000))throw Error('Outra correção está sendo processada');
  try{
    const v=iaValidarEntrega_(idEntrega);
    const existentes=iaRows_('CORRECOES').filter(r=>String(r.ID_ENTREGA)===String(idEntrega));
    if(existentes.some(r=>String(r.STATUS).toUpperCase()==='APROVADA'))throw Error('Correção já aprovada. Não será sobrescrita.');
    const key=PropertiesService.getScriptProperties().getProperty('OPENAI_API_KEY');
    if(!key)throw Error('Configure OPENAI_API_KEY nas Propriedades do script');
    const content=[{type:'text',text:
      'Você é um corretor escolar. Analise a TOTALIDADE das imagens, que são páginas de UMA MESMA entrega. '+
      'Compare EXCLUSIVAMENTE com o gabarito e a rubrica indicados. Em Curva ABC, use as proporções FIXAS de itens A=20%, B=30%, C=50%, e NÃO limites de faturamento. '+
      'Aceite inversões entre faturamentos empatados e diferenças pequenas de arredondamento. '+
      'Não invente conteúdo ilegível; aponte incerteza. Não desconte por estética/caligráfia legível. '+
      'Responda SOMENTE em JSON válido com os campos nota (número de 0 a 10), criterios (lista com criterio, pontos, maximo, comentario), '+
      'erros (lista de strings), feedback (string), confianca (alta/media/baixa), revisaoObrigatoria (boolean). '+
      'Atribua pontos respeitando o total 10,0 e cada peso do gabarito. Se faltar imagem ou houver conteúdo ilegível, indique revisãoObrigatoria=true.\n\n'+
      'ATIVIDADE: '+String(v.atividade.TITULO)+'\nGABARITO:\n'+String(v.atividade.GABARITO_CRITERIOS)+
      '\nRESPOSTA DE TEXTO DO ALUNO:\n'+String(v.entrega.RESPOSTA_TEXTO||'')
    }];
    v.urls.forEach((url,i)=>{
      const file=DriveApp.getFileById(iaDriveId_(url)),blob=file.getBlob(),mime=blob.getContentType().toLowerCase();
      if(!['image/jpeg','image/png','image/webp','image/gif'].includes(mime))
        throw Error('Arquivo '+(i+1)+' não é imagem compatível ('+mime+'). Revisão manual necessária.');
      if(blob.getSize()>IA_MAX_BYTES)throw Error('Imagem '+(i+1)+' muito grande; reduza seu tamanho');
      content.push({type:'text',text:'FOTO '+(i+1)+' DE '+v.urls.length});
      content.push({type:'image_url',image_url:{url:'data:'+mime+';base64,'+Utilities.base64Encode(blob.getBytes()),detail:'high'}});
    });
    const payload={model:IA_MODEL,temperature:0,response_format:{type:'json_object'},
      messages:[{role:'user',content}]};
    const response=UrlFetchApp.fetch('https://api.openai.com/v1/chat/completions',{
      method:'post',contentType:'application/json',headers:{Authorization:'Bearer '+key},
      payload:JSON.stringify(payload),muteHttpExceptions:true
    });
    const code=response.getResponseCode(),body=response.getContentText();
    if(code<200||code>=300)throw Error('Falha da API ('+code+'): '+body.slice(0,450));
    const result=JSON.parse(JSON.parse(body).choices[0].message.content);
    const nota=Number(result.nota);
    if(!Number.isFinite(nota)||nota<0||nota>10)throw Error('IA retornou nota inválida');
    const status='AGUARDANDO_REVISAO';
    const parecer=JSON.stringify({nota,criterios:result.criterios||[],erros:result.erros||[],
      confianca:result.confianca||'baixa',revisaoObrigatoria:result.revisaoObrigatoria!==false,
      arquivosAnalisados:v.urls.length,modelo:IA_MODEL});
    const sh=iaSheet_('CORRECOES'),values=sh.getDataRange().getValues(),headers=values[0].map(String);
    IA_HEADERS.forEach(h=>{if(!headers.includes(h))throw Error('Coluna ausente na aba CORRECOES: '+h)});
    const newRow={ID_CORRECAO:existentes[0]?existentes[0].ID_CORRECAO:'COR-'+Utilities.getUuid().slice(0,12).toUpperCase(),
      ID_ENTREGA:idEntrega,ID_ATIVIDADE:v.entrega.ID_ATIVIDADE,ALUNO:v.entrega.ALUNO,
      COMPONENTE:v.atividade.COMPONENTE,RESULTADO_IA:parecer,MENCAO:nota.toFixed(1).replace('.',','),
      FEEDBACK:String(result.feedback||''),STATUS:status,CORRIGIDO_EM:new Date()};
    if(existentes.length){
      sh.getRange(existentes[0].__row,1,1,headers.length).setValues([headers.map(h=>newRow[h]??'')]);
    }else sh.appendRow(headers.map(h=>newRow[h]??''));
    return {ok:true,idEntrega,aluno:v.entrega.ALUNO,nota,status,arquivos:v.urls.length,feedback:newRow.FEEDBACK};
  }finally{lock.releaseLock();}
}
function iaListarPendentes(componente){
  iaExigirAdmin_();
  const c=String(componente||'CFE').toUpperCase();
  const aprovadas=new Set(iaRows_('CORRECOES').filter(r=>String(r.STATUS)==='APROVADA').map(r=>String(r.ID_ENTREGA)));
  const atividades=new Map(iaRows_('ATIVIDADES').filter(r=>String(r.COMPONENTE).toUpperCase()===c&&String(r.CORRECAO_IA).toUpperCase()==='SIM').map(r=>[String(r.ID_ATIVIDADE),r]));
  return iaRows_('ENTREGAS').filter(r=>atividades.has(String(r.ID_ATIVIDADE)))
    .map(r=>({idEntrega:String(r.ID_ENTREGA),aluno:String(r.ALUNO),atividade:String(r.ID_ATIVIDADE),
      arquivos:iaLinks_(r.ARQUIVOS_URL).length,aprovada:aprovadas.has(String(r.ID_ENTREGA)),
      correcao:iaRows_('CORRECOES').find(x=>String(x.ID_ENTREGA)===String(r.ID_ENTREGA))||null}));
}
function iaAprovarCorrecao(idEntrega){
  iaExigirAdmin_();
  const sh=iaSheet_('CORRECOES'),rows=iaRows_('CORRECOES'),r=rows.find(x=>String(x.ID_ENTREGA)===String(idEntrega));
  if(!r)throw Error('Correção não encontrada');if(String(r.STATUS)==='APROVADA')return {ok:true};
  const col=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].indexOf('STATUS')+1;
  sh.getRange(r.__row,col).setValue('APROVADA');
  return {ok:true,idEntrega};
}
function iaPainelHtml_(){
  iaExigirAdmin_();
  const html=HtmlService.createHtmlOutput(`<!doctype html><html><head><meta charset="utf-8"><style>
    body{font:14px Arial;padding:14px;color:#192d49}button,select{padding:9px;margin:3px;border:1px solid #bbb;border-radius:7px}
    button{cursor:pointer;background:#173e69;color:white}.item{border:1px solid #ddd;border-radius:9px;padding:12px;margin:9px 0}
    .status{color:#805400}pre{white-space:pre-wrap}
    </style></head><body><h2>Correção por IA — revisão do professor</h2>
    <p>As notas são sugestões. Nenhum resultado é liberado automaticamente ao aluno.</p>
    <label>Componente <select id="c"><option>CFE</option><option>AI</option><option>EM</option><option>PORA</option></select></label>
    <button onclick="carregar()">Atualizar entregas</button><div id="msg"></div><div id="lista"></div>
    <script>
    const esc=s=>String(s??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[x]));
    function status(s){document.getElementById('msg').textContent=s;}
    function carregar(){status('Carregando...');google.script.run.withSuccessHandler(rows=>{
      status(rows.length+' entrega(s) encontradas');
      document.getElementById('lista').innerHTML=rows.map(r=>{
       const corr=r.correcao,st=corr?corr.STATUS:'SEM_CORRECAO';
       return '<div class="item"><b>'+esc(r.aluno)+'</b><p>'+esc(r.atividade)+' | '+r.arquivos+' arquivo(s) | <span class="status">'+esc(st)+'</span></p>'+
        (corr?'<p>Nota sugerida: <b>'+esc(corr.MENCAO)+'</b></p><pre>'+esc(corr.FEEDBACK)+'</pre>':'')+
        (!r.aprovada?'<button onclick="corrigir('+JSON.stringify(r.idEntrega)+')">Corrigir com IA</button>':'')+
        (corr&&!r.aprovada?'<button onclick="aprovar('+JSON.stringify(r.idEntrega)+')">Aprovar correção</button>':'')+'</div>';
      }).join('');
    }).withFailureHandler(e=>status('Erro: '+e.message)).iaListarPendentes(document.getElementById('c').value);}
    function corrigir(id){if(!confirm('Analisar todos os arquivos desta entrega usando IA?'))return;
       status('Analisando imagens de '+id+'...');google.script.run.withSuccessHandler(r=>{status('Nota sugerida: '+r.nota);carregar()})
       .withFailureHandler(e=>status('Erro: '+e.message)).iaCorrigirEntrega(id);}
    function aprovar(id){if(!confirm('Você conferiu a correção e concorda com a nota?'))return;
       google.script.run.withSuccessHandler(()=>carregar()).withFailureHandler(e=>status('Erro: '+e.message)).iaAprovarCorrecao(id);}
    carregar();
    <\/script></body></html>`).setWidth(880).setHeight(650);
  return html.setTitle('Correção por IA — 1º TANE');
}
