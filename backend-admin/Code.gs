const SHEET_ID='1TmsiHct_EdfPvUTjHyUV7O3GZJ_y6lVQgPRmMHf_edI';
const TURMA='1º TANE - Extensão Ibiúna';
const COMPONENTES=['AI','EM','CFE','PORA'];
const PROVA_EM_01='EM-PROVA-01';
const GABARITO_EM_01={q01:'b',q02:'a',q03:'b',q04:'c',q05:'b',q06:'c',q07:'b',q08:'c',q09:'b',q10:'d',q11:'b',q12:'a',q13:'a',q14:'b',q15:'c',q16:'b',q17:'b',q18:'d',q19:'a',q20:'a'};

function doGet(e){
  const page=String((e&&e.parameter&&e.parameter.page)||'').toLowerCase();
  return HtmlService.createHtmlOutputFromFile(page==='provas'?'AdminProvas':'Admin')
    .setTitle(page==='provas'?'Provas - 1º TANE':'Painel do Professor - 1º TANE')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}

function ss_(){
  if(!SHEET_ID || SHEET_ID.indexOf('COLE_AQUI')===0) throw new Error('Configure o SHEET_ID no Code.gs antes de usar o painel.');
  return SpreadsheetApp.openById(SHEET_ID);
}
function sh_(nome){const sh=ss_().getSheetByName(nome);if(!sh)throw new Error('Aba não encontrada: '+nome);return sh}
function rows_(nome){const sh=sh_(nome);const lastRow=sh.getLastRow(),lastCol=sh.getLastColumn();if(lastRow<2||lastCol<1)return[];const v=sh.getRange(1,1,lastRow,lastCol).getValues();const h=v.shift().map(String);return v.filter(r=>r.some(c=>c!==''&&c!==null)).map((r,idx)=>Object.assign({__row:idx+2},Object.fromEntries(h.map((k,i)=>[k,r[i]]))))}
function dateTime_(v){if(!v)return'';if(Object.prototype.toString.call(v)==='[object Date]')return Utilities.formatDate(v,Session.getScriptTimeZone(),'dd/MM/yyyy HH:mm:ss');return String(v)}
function dateTimeInput_(v){
  if(!v)return'';
  if(Object.prototype.toString.call(v)==='[object Date]')return Utilities.formatDate(v,Session.getScriptTimeZone(),"yyyy-MM-dd'T'HH:mm");
  const s=String(v).trim();
  if(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s))return s.slice(0,16);
  if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s+'T23:59';
  return s;
}
function comp_(v){
  const c=String(v||'').trim().toUpperCase();
  if(!COMPONENTES.includes(c))throw new Error('Componente inválido: '+c);
  return c;
}
function ensureColumn_(sh,nome){
  const lastCol=Math.max(sh.getLastColumn(),1);
  const headers=sh.getRange(1,1,1,lastCol).getValues()[0].map(String);
  if(headers.indexOf(nome)>=0)return;
  sh.getRange(1,lastCol+1).setValue(nome);
}
function ensureSheet_(nome,headers){let sh=ss_().getSheetByName(nome);if(!sh){sh=ss_().insertSheet(nome);sh.getRange(1,1,1,headers.length).setValues([headers]);sh.setFrozenRows(1)}return sh}
function parseJson_(s,f){try{return s?JSON.parse(String(s)):f}catch(e){return f}}

function listarComponentes(){return COMPONENTES.map(c=>({id:c,nome:c}))}

function listarAtividades(componente){
  const c=comp_(componente);
  return rows_('ATIVIDADES').filter(x=>String(x.TURMA||'')===TURMA&&String(x.COMPONENTE||'').toUpperCase()===c).map(a=>({
    id:a.ID_ATIVIDADE,titulo:a.TITULO,descricao:a.DESCRICAO,tipoEnvio:a.TIPO_ENVIO,
    extensoes:a.EXTENSOES,maxArquivos:a.MAX_ARQUIVOS,liberacao:dateTimeInput_(a.LIBERACAO),prazo:dateTimeInput_(a.PRAZO),
    materialUrl:a.MATERIAL_APOIO_URL,correcaoIA:a.CORRECAO_IA,criterios:a.GABARITO_CRITERIOS,
    status:a.STATUS,ordem:a.ORDEM,componente:c
  })).sort((a,b)=>(Number(a.ordem)||999)-(Number(b.ordem)||999));
}

function salvarAtividade(d){
  if(!d||!d.id||!d.titulo)throw new Error('ID e título são obrigatórios');
  const c=comp_(d.componente);
  const sh=sh_('ATIVIDADES');
  ensureColumn_(sh,'LIBERACAO');
  const v=sh.getDataRange().getValues(),h=v[0].map(String),idx=h.indexOf('ID_ATIVIDADE'),idxTurma=h.indexOf('TURMA'),idxComp=h.indexOf('COMPONENTE');
  const now=new Date();
  const map={
    ID_ATIVIDADE:String(d.id).trim(),TURMA:TURMA,COMPONENTE:c,TITULO:String(d.titulo).trim(),DESCRICAO:d.descricao||'',
    TIPO_ENVIO:d.tipoEnvio||'SEM_ENVIO',EXTENSOES:d.extensoes||'',MAX_ARQUIVOS:Number(d.maxArquivos||0),
    LIBERACAO:d.liberacao||'',PRAZO:d.prazo||'',MATERIAL_APOIO_URL:d.materialUrl||'',CORRECAO_IA:d.correcaoIA||'NAO',
    GABARITO_CRITERIOS:d.criterios||'',STATUS:d.status||'RASCUNHO',ORDEM:Number(d.ordem||999),CRIADO_EM:now,ATUALIZADO_EM:now
  };
  let found=0;
  for(let i=1;i<v.length;i++){
    if(String(v[i][idx])===String(map.ID_ATIVIDADE) && (idxTurma<0||String(v[i][idxTurma])===TURMA) && (idxComp<0||String(v[i][idxComp]).toUpperCase()===c)){found=i+1;break}
  }
  if(found){
    const old=Object.fromEntries(h.map((k,i)=>[k,v[found-1][i]]));map.CRIADO_EM=old.CRIADO_EM||now;
    sh.getRange(found,1,1,h.length).setValues([h.map(k=>map[k]!==undefined?map[k]:'')]);
  }else sh.appendRow(h.map(k=>map[k]!==undefined?map[k]:''));
  return {ok:true,id:map.ID_ATIVIDADE,componente:c};
}

function excluirAtividade(componente,id){
  const c=comp_(componente);if(!id)throw new Error('ID da atividade não informado');
  const sh=sh_('ATIVIDADES'),v=sh.getDataRange().getValues(),h=v[0].map(String);
  const idxId=h.indexOf('ID_ATIVIDADE'),idxTurma=h.indexOf('TURMA'),idxComp=h.indexOf('COMPONENTE');
  for(let i=1;i<v.length;i++){
    if(String(v[i][idxId])===String(id)&&(idxTurma<0||String(v[i][idxTurma])===TURMA)&&(idxComp<0||String(v[i][idxComp]).toUpperCase()===c)){
      sh.deleteRow(i+1);return {ok:true,id:id,componente:c};
    }
  }
  throw new Error('Atividade não encontrada');
}

function listarMateriais(componente){
  const c=comp_(componente);
  return rows_('MATERIAIS').filter(x=>String(x.COMPONENTE||'').toUpperCase()===c && (!x.TURMA || String(x.TURMA)===TURMA)).map(m=>({
    id:String(m.ID_MATERIAL||''),titulo:String(m.TITULO||''),descricao:String(m.DESCRICAO||''),url:String(m.ARQUIVO_URL||''),
    tipo:String(m.TIPO||'MATERIAL'),ordem:Number(m.ORDEM||999),status:String(m.STATUS||'OCULTO'),publicadoEm:dateTime_(m.PUBLICADO_EM),componente:c
  })).sort((a,b)=>(Number(a.ordem)||999)-(Number(b.ordem)||999));
}

function salvarMaterial(d){
  if(!d||!d.titulo)throw new Error('Título é obrigatório');
  const c=comp_(d.componente),sh=sh_('MATERIAIS'),v=sh.getDataRange().getValues(),h=v[0].map(String),idx=h.indexOf('ID_MATERIAL');
  ensureColumn_(sh,'TURMA');
  const h2=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(String);
  const id=String(d.id||('MAT-'+Utilities.getUuid().slice(0,8).toUpperCase())).trim(),now=new Date();
  const map={ID_MATERIAL:id,TURMA:TURMA,COMPONENTE:c,TITULO:String(d.titulo||'').trim(),DESCRICAO:String(d.descricao||''),ARQUIVO_URL:String(d.url||'').trim(),TIPO:String(d.tipo||'MATERIAL'),ORDEM:Number(d.ordem||999),STATUS:String(d.status||'PUBLICADO'),PUBLICADO_EM:now};
  const data=sh.getDataRange().getValues(),idxId=h2.indexOf('ID_MATERIAL'),idxComp=h2.indexOf('COMPONENTE'),idxTurma=h2.indexOf('TURMA');
  let found=0;
  for(let i=1;i<data.length;i++)if(String(data[i][idxId])===id&&(idxComp<0||String(data[i][idxComp]).toUpperCase()===c)&&(idxTurma<0||String(data[i][idxTurma])===TURMA)){found=i+1;break}
  if(found){const old=Object.fromEntries(h2.map((k,i)=>[k,data[found-1][i]]));if(old.PUBLICADO_EM)map.PUBLICADO_EM=old.PUBLICADO_EM;sh.getRange(found,1,1,h2.length).setValues([h2.map(k=>map[k]!==undefined?map[k]:'')]);}
  else sh.appendRow(h2.map(k=>map[k]!==undefined?map[k]:''));
  return {ok:true,id:id,componente:c};
}

function excluirMaterial(componente,id){
  const c=comp_(componente);if(!id)throw new Error('ID do material não informado');
  const sh=sh_('MATERIAIS'),v=sh.getDataRange().getValues(),h=v[0].map(String),idxId=h.indexOf('ID_MATERIAL'),idxComp=h.indexOf('COMPONENTE'),idxTurma=h.indexOf('TURMA');
  for(let i=1;i<v.length;i++)if(String(v[i][idxId])===String(id)&&(idxComp<0||String(v[i][idxComp]).toUpperCase()===c)&&(idxTurma<0||!v[i][idxTurma]||String(v[i][idxTurma])===TURMA)){sh.deleteRow(i+1);return {ok:true,id:id,componente:c}}
  throw new Error('Material não encontrado');
}

function listarEntregas(componente,idAtividade){
  const c=comp_(componente);
  const ids=new Set(rows_('ATIVIDADES').filter(x=>String(x.TURMA||'')===TURMA&&String(x.COMPONENTE||'').toUpperCase()===c).map(x=>String(x.ID_ATIVIDADE||'')));
  return rows_('ENTREGAS').filter(x=>ids.has(String(x.ID_ATIVIDADE||''))&&(!idAtividade||String(x.ID_ATIVIDADE)===String(idAtividade))).map(e=>({
    id:String(e.ID_ENTREGA||''),idAtividade:String(e.ID_ATIVIDADE||''),aluno:String(e.ALUNO||''),email:String(e.EMAIL||''),arquivos:String(e.ARQUIVOS_URL||''),resposta:String(e.RESPOSTA_TEXTO||''),dataEnvio:dateTime_(e.DATA_ENVIO),status:String(e.STATUS||''),tentativa:Number(e.TENTATIVA||1),observacao:String(e.OBSERVACAO||'')
  }));
}

function provaSheets_(){
  const provas=ensureSheet_('PROVAS',['PROVA_ID','COMPONENTE','TITULO','CORRECAO_LIBERADA','ATUALIZADO_EM']);
  const tent=ensureSheet_('PROVA_TENTATIVAS',['ID_TENTATIVA','PROVA_ID','ALUNO','EMAIL','STATUS','INICIO_EM','ATUALIZADO_EM','FINALIZADO_EM','RESPOSTAS_JSON','ORDEM_JSON','ALTERNATIVAS_JSON','SNAPSHOT_JSON','ACERTOS','MENCAO','EMAIL_CORRECAO_EM']);
  if(!rows_('PROVAS').some(r=>String(r.PROVA_ID)===PROVA_EM_01))provas.appendRow([PROVA_EM_01,'EM','1ª Prova — Economia e Mercado','NAO',new Date()]);
  return {provas,tent};
}
function statusProvaEm(){
  provaSheets_();const provas=rows_('PROVAS'),tent=rows_('PROVA_TENTATIVAS').filter(r=>String(r.PROVA_ID)===PROVA_EM_01),p=provas.find(r=>String(r.PROVA_ID)===PROVA_EM_01)||{};
  return {ok:true,provaId:PROVA_EM_01,titulo:'1ª Prova — Economia e Mercado',correcaoLiberada:String(p.CORRECAO_LIBERADA||'NAO').toUpperCase()==='SIM',total:tent.length,emAndamento:tent.filter(r=>String(r.STATUS)==='EM_ANDAMENTO').length,finalizadas:tent.filter(r=>String(r.STATUS)==='FINALIZADA').length,emailsEnviados:tent.filter(r=>r.EMAIL_CORRECAO_EM).length,tentativas:tent.map(r=>({aluno:r.ALUNO,email:r.EMAIL,status:r.STATUS,acertos:r.ACERTOS,mencao:r.MENCAO,inicio:dateTime_(r.INICIO_EM),fim:dateTime_(r.FINALIZADO_EM),emailEnviado:dateTime_(r.EMAIL_CORRECAO_EM)}))};
}
function definirCorrecaoProvaEm(liberar){
  const ps=provaSheets_(),sh=ps.provas,v=sh.getDataRange().getValues(),h=v[0].map(String),idx=h.indexOf('PROVA_ID');
  for(let i=1;i<v.length;i++)if(String(v[i][idx])===PROVA_EM_01){const obj=Object.fromEntries(h.map((k,j)=>[k,v[i][j]]));obj.CORRECAO_LIBERADA=liberar?'SIM':'NAO';obj.ATUALIZADO_EM=new Date();sh.getRange(i+1,1,1,h.length).setValues([h.map(k=>obj[k]!==undefined?obj[k]:'')]);return {ok:true,liberada:!!liberar}}
  throw new Error('Prova não encontrada');
}
function montarCorrecao_(r){const ans=parseJson_(r.RESPOSTAS_JSON,{}),snap=parseJson_(r.SNAPSHOT_JSON,[]);return (Array.isArray(snap)?snap:[]).map((q,i)=>{const marcada=String(ans[q.id]||''),correta=String(GABARITO_EM_01[q.id]||''),opts=Array.isArray(q.options)?q.options:[],f=id=>opts.find(o=>String(o.id)===id)||{};return{numero:i+1,text:q.text||'',marcadaTexto:(f(marcada).text||''),corretaTexto:(f(correta).text||''),acertou:marcada===correta}})}
function enviarCorrecoesProvaEm(){
  const st=statusProvaEm();if(!st.correcaoLiberada)throw new Error('Libere a correção antes de enviar os e-mails.');
  const sh=sh_('PROVA_TENTATIVAS'),v=sh.getDataRange().getValues(),h=v[0].map(String),idxProva=h.indexOf('PROVA_ID'),idxStatus=h.indexOf('STATUS');let enviados=0,pulados=0;
  for(let i=1;i<v.length;i++){
    if(String(v[i][idxProva])!==PROVA_EM_01||String(v[i][idxStatus])!=='FINALIZADA')continue;
    const r=Object.fromEntries(h.map((k,j)=>[k,v[i][j]]));if(!r.EMAIL){pulados++;continue}if(r.EMAIL_CORRECAO_EM){pulados++;continue}
    const corr=montarCorrecao_(r);let html='<h2>Correção — 1ª Prova de Economia e Mercado</h2><p><b>Aluno:</b> '+r.ALUNO+'</p><p><b>Resultado:</b> '+r.ACERTOS+'/20 &nbsp; <b>Menção:</b> '+r.MENCAO+'</p><hr>';
    corr.forEach(q=>{html+='<p><b>Questão '+q.numero+'</b><br>'+q.text+'<br><b>Sua resposta:</b> '+(q.marcadaTexto||'—')+'<br><b>Resposta correta:</b> '+(q.corretaTexto||'—')+'<br><b>'+ (q.acertou?'Acertou':'Errou') +'</b></p><hr>'});
    MailApp.sendEmail({to:String(r.EMAIL),subject:'Correção da 1ª Prova de Economia e Mercado',htmlBody:html,body:'Correção disponível. Resultado: '+r.ACERTOS+'/20. Menção: '+r.MENCAO});
    r.EMAIL_CORRECAO_EM=new Date();sh.getRange(i+1,1,1,h.length).setValues([h.map(k=>r[k]!==undefined?r[k]:'')]);enviados++;
  }
  return {ok:true,enviados,pulados};
}

function statusPainel(){return {ok:true,turma:TURMA,componentes:COMPONENTES,timeZone:Session.getScriptTimeZone()}}
