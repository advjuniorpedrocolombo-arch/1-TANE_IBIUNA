const SHEET_ID='1TmsiHct_EdfPvUTjHyUV7O3GZJ_y6lVQgPRmMHf_edI';
const TURMA='1º TANE - Extensão Ibiúna';
const COMPONENTES=['AI','EM','CFE','PORA'];
const ABAS={ATIVIDADES:'ATIVIDADES',ENTREGAS:'ENTREGAS',MATERIAIS:'MATERIAIS',CONFIG:'CONFIG',PROVAS:'PROVAS',PROVA_TENTATIVAS:'PROVA_TENTATIVAS'};
const PROVAS={
  'EM-PROVA-01':{componente:'EM',titulo:'1ª Prova — Economia e Mercado',gabarito:{q01:'b',q02:'a',q03:'b',q04:'c',q05:'b',q06:'c',q07:'b',q08:'c',q09:'b',q10:'d',q11:'b',q12:'a',q13:'a',q14:'b',q15:'c',q16:'b',q17:'b',q18:'d',q19:'a',q20:'a'}},
  'PORA-PROVA-01':{componente:'PORA',titulo:'1ª Prova — Processos Organizacionais',gabarito:{q01:'b',q02:'c',q03:'a',q04:'d',q05:'b',q06:'a',q07:'c',q08:'d',q09:'b',q10:'a',q11:'b',q12:'c',q13:'a',q14:'d',q15:'b',q16:'c',q17:'a',q18:'d',q19:'b',q20:'c'}}
};
const PROVA_PADRAO='EM-PROVA-01';

function doGet(e){
  const p=(e&&e.parameter)||{};
  const action=String(p.action||'ping').trim();
  try{
    if(action==='listar')return json_(listar_(p.turma||TURMA,p.componente));
    if(action==='atividade')return json_({ok:true,atividade:atividade_(p.id,p.componente),agoraServidor:new Date().toISOString()});
    if(action==='provaTentativa')return json_(provaTentativa_(p.provaId||PROVA_PADRAO,p.nome,p.email));
    if(action==='ping')return json_({ok:true,sistema:'1º TANE',versao:'1.2',componentes:COMPONENTES,provas:Object.keys(PROVAS),agora:new Date().toISOString()});
    return json_({ok:false,erro:'Ação inválida'});
  }catch(err){return json_({ok:false,erro:String(err.message||err)})}
}
function doPost(e){
  try{
    const d=JSON.parse((e&&e.postData&&e.postData.contents)||'{}');
    if(d.action==='enviarAtividade')return json_(enviarAtividade_(d));
    if(d.action==='salvarProva')return json_(salvarProva_(d));
    if(d.action==='finalizarProva')return json_(finalizarProva_(d));
    return json_({ok:false,erro:'Ação inválida'});
  }catch(err){return json_({ok:false,erro:String(err.message||err)})}
}
function ss_(){return SpreadsheetApp.openById(SHEET_ID)}
function sh_(nome){const sh=ss_().getSheetByName(nome);if(!sh)throw new Error('Aba não encontrada: '+nome);return sh}
function json_(obj){return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON)}
function eq_(a,b){return String(a??'').trim()===String(b??'').trim()}
function comp_(v){const c=String(v||'').trim().toUpperCase();if(!COMPONENTES.includes(c))throw new Error('Componente inválido');return c}
function ensureSheet_(nome,headers){let sh=ss_().getSheetByName(nome);if(!sh){sh=ss_().insertSheet(nome);sh.getRange(1,1,1,headers.length).setValues([headers]);sh.setFrozenRows(1)}return sh}
function sheetData_(sh){const v=sh.getDataRange().getValues();if(!v.length)return{headers:[],rows:[]};const headers=v[0].map(String);const rows=v.slice(1).filter(r=>r.some(c=>c!==''&&c!==null)).map((r,idx)=>{const o={__row:idx+2};headers.forEach((h,i)=>o[h]=r[i]);return o});return{headers,rows}}
function rows_(nome){return sheetData_(sh_(nome)).rows}
function parseJson_(s,fallback){try{return s?JSON.parse(String(s)):fallback}catch(e){return fallback}}
function provaDef_(id){const d=PROVAS[String(id||'')];if(!d)throw new Error('Prova não cadastrada');return d}

function listar_(turma,componente){
  const c=comp_(componente);
  const atividades=rows_(ABAS.ATIVIDADES).filter(x=>eq_(x.TURMA,turma)&&eq_(String(x.COMPONENTE||'').toUpperCase(),c)).sort((a,b)=>Number(a.ORDEM||999)-Number(b.ORDEM||999)).map(mapAtividadePublica_);
  const materiais=rows_(ABAS.MATERIAIS).filter(x=>eq_(String(x.COMPONENTE||'').toUpperCase(),c)&&(!x.TURMA||eq_(x.TURMA,turma))).sort((a,b)=>Number(a.ORDEM||999)-Number(b.ORDEM||999)).map(m=>({id:m.ID_MATERIAL,titulo:m.TITULO,descricao:m.DESCRICAO,url:m.ARQUIVO_URL,tipo:m.TIPO,status:m.STATUS,publicadoEm:dateTimeOut_(m.PUBLICADO_EM)}));
  return{ok:true,atividades,materiais,agoraServidor:new Date().toISOString()};
}
function atividade_(id,componente){if(!id)return null;const c=comp_(componente);const a=rows_(ABAS.ATIVIDADES).find(x=>eq_(x.ID_ATIVIDADE,id)&&eq_(x.TURMA,TURMA)&&eq_(String(x.COMPONENTE||'').toUpperCase(),c));return a?mapAtividadePublica_(a):null}
function mapAtividadePublica_(a){const agora=new Date(),lib=parseDateTime_(a.LIBERACAO,false),prazo=parseDateTime_(a.PRAZO,true),status=String(a.STATUS||'RASCUNHO').toUpperCase();let situacao='FECHADA';if(status==='PUBLICADA'){if(lib&&agora<lib)situacao='AGENDADA';else if(prazo&&agora>prazo)situacao='ENCERRADA';else situacao='ABERTA'}return{id:a.ID_ATIVIDADE,turma:a.TURMA,componente:a.COMPONENTE,titulo:a.TITULO,descricao:a.DESCRICAO,tipoEnvio:a.TIPO_ENVIO||'SEM_ENVIO',extensoes:a.EXTENSOES||'',maxArquivos:Number(a.MAX_ARQUIVOS||0),liberacao:dateTimeOut_(a.LIBERACAO),prazo:dateTimeOut_(a.PRAZO),materialUrl:a.MATERIAL_APOIO_URL||'',status,ordem:Number(a.ORDEM||999),situacao,disponivel:situacao==='ABERTA'}}
function enviarAtividade_(d){
  const c=comp_(d.componente);if(!d.idAtividade)throw new Error('Atividade não informada');if(!String(d.aluno||'').trim())throw new Error('Nome do aluno é obrigatório');const atividade=atividade_(d.idAtividade,c);if(!atividade)throw new Error('Atividade não encontrada');if(atividade.status!=='PUBLICADA'||atividade.situacao!=='ABERTA')throw new Error(atividade.situacao==='AGENDADA'?'Atividade ainda não foi liberada':atividade.situacao==='ENCERRADA'?'Prazo de entrega encerrado':'Atividade não está aberta para envio');
  const arquivos=Array.isArray(d.arquivos)?d.arquivos:[],isTexto=['FORMULARIO','TEXTO'].includes(String(atividade.tipoEnvio||'').toUpperCase());if(!isTexto&&atividade.tipoEnvio!=='SEM_ENVIO'){if(!arquivos.length)throw new Error('Selecione ao menos um arquivo');if(atividade.maxArquivos&&arquivos.length>atividade.maxArquivos)throw new Error('Máximo de '+atividade.maxArquivos+' arquivo(s)')}if(isTexto&&!String(d.respostaTexto||'').trim())throw new Error('Digite a resposta da atividade');validaArquivos_(arquivos,atividade.extensoes);
  const cfg=config_(),pastaId=cfg['PASTA_ENTREGAS_'+c+'_ID']||cfg.PASTA_ENTREGAS_ID;if(!pastaId)throw new Error('Pasta de entregas não configurada para '+c);const raiz=DriveApp.getFolderById(pastaId),pastaAtividade=getOrCreateFolder_(raiz,sanitize_(atividade.id+' - '+atividade.titulo)),pastaAluno=getOrCreateFolder_(pastaAtividade,sanitize_(d.aluno)),urls=[];arquivos.forEach((f,i)=>{const raw=String(f.data||'').replace(/^data:[^;]+;base64,/,'');const bytes=Utilities.base64Decode(raw),nome=sanitizeFile_(f.name||('arquivo-'+(i+1))),blob=Utilities.newBlob(bytes,f.mime||MimeType.PLAIN_TEXT,nome);urls.push(pastaAluno.createFile(blob).getUrl())});
  const sh=sh_(ABAS.ENTREGAS),dados=sheetData_(sh),id='ENT-'+Utilities.getUuid().slice(0,12).toUpperCase(),obj={ID_ENTREGA:id,ID_ATIVIDADE:atividade.id,ALUNO:String(d.aluno).trim(),EMAIL:d.email||'',ARQUIVOS_URL:urls.join('\n'),RESPOSTA_TEXTO:d.respostaTexto||'',DATA_ENVIO:new Date(),STATUS:'RECEBIDA',TENTATIVA:Number(d.tentativa||1),OBSERVACAO:d.observacao||''};sh.appendRow(dados.headers.map(h=>obj[h]!==undefined?obj[h]:''));return{ok:true,idEntrega:id,arquivos:urls.length};
}

function provaSheets_(){
  const provas=ensureSheet_(ABAS.PROVAS,['PROVA_ID','COMPONENTE','TITULO','CORRECAO_LIBERADA','ATUALIZADO_EM']);
  const tent=ensureSheet_(ABAS.PROVA_TENTATIVAS,['ID_TENTATIVA','PROVA_ID','ALUNO','EMAIL','STATUS','INICIO_EM','ATUALIZADO_EM','FINALIZADO_EM','RESPOSTAS_JSON','ORDEM_JSON','ALTERNATIVAS_JSON','SNAPSHOT_JSON','ACERTOS','MENCAO','EMAIL_CORRECAO_EM']);
  const existentes=new Set(sheetData_(provas).rows.map(r=>String(r.PROVA_ID||'')));Object.entries(PROVAS).forEach(([id,d])=>{if(!existentes.has(id))provas.appendRow([id,d.componente,d.titulo,'NAO',new Date()])});return{provas,tent};
}
function provaConfig_(provaId){provaDef_(provaId);const ps=provaSheets_(),r=sheetData_(ps.provas).rows.find(x=>eq_(x.PROVA_ID,provaId));return{liberada:String((r&&r.CORRECAO_LIBERADA)||'NAO').toUpperCase()==='SIM'}}
function tentativaRow_(provaId,email){provaDef_(provaId);const sh=provaSheets_().tent,d=sheetData_(sh),e=String(email||'').trim().toLowerCase(),r=d.rows.find(x=>eq_(x.PROVA_ID,provaId)&&String(x.EMAIL||'').trim().toLowerCase()===e);return{sh,data:d,row:r}}
function mencao_(acertos){const n=Number(acertos||0);if(n>=18)return'MB';if(n>=16)return'B';if(n>=9)return'R';return'I'}
function provaTentativa_(provaId,nome,email){provaDef_(provaId);if(!String(email||'').trim())return{ok:true,encontrada:false};const t=tentativaRow_(provaId,email),r=t.row;if(!r)return{ok:true,encontrada:false};const cfg=provaConfig_(provaId),finished=String(r.STATUS||'').toUpperCase()==='FINALIZADA',out={ok:true,encontrada:true,idTentativa:r.ID_TENTATIVA,provaId:r.PROVA_ID,nome:r.ALUNO,email:r.EMAIL,status:r.STATUS,finished,acertos:finished?Number(r.ACERTOS||0):null,mencao:finished?String(r.MENCAO||''):null,correcaoLiberada:cfg.liberada};if(!finished){out.answers=parseJson_(r.RESPOSTAS_JSON,{});out.order=parseJson_(r.ORDEM_JSON,[]);out.altOrder=parseJson_(r.ALTERNATIVAS_JSON,{});out.startedAt=dateTimeOut_(r.INICIO_EM)}if(finished&&cfg.liberada)out.correcao=montarCorrecao_(r);return out}
function salvarProva_(d){const provaId=String(d.provaId||PROVA_PADRAO);provaDef_(provaId);const nome=String(d.nome||'').trim(),email=String(d.email||'').trim().toLowerCase();if(!nome||!email)throw new Error('Nome e e-mail são obrigatórios');const t=tentativaRow_(provaId,email),sh=t.sh,now=new Date();if(t.row&&String(t.row.STATUS||'').toUpperCase()==='FINALIZADA')return{ok:true,finished:true,acertos:Number(t.row.ACERTOS||0),mencao:String(t.row.MENCAO||'')};const obj={ID_TENTATIVA:t.row?t.row.ID_TENTATIVA:'PRV-'+Utilities.getUuid().slice(0,12).toUpperCase(),PROVA_ID:provaId,ALUNO:nome,EMAIL:email,STATUS:'EM_ANDAMENTO',INICIO_EM:t.row&&t.row.INICIO_EM?t.row.INICIO_EM:now,ATUALIZADO_EM:now,FINALIZADO_EM:'',RESPOSTAS_JSON:JSON.stringify(d.answers||{}),ORDEM_JSON:JSON.stringify(d.order||[]),ALTERNATIVAS_JSON:JSON.stringify(d.altOrder||{}),SNAPSHOT_JSON:t.row?t.row.SNAPSHOT_JSON||'':'',ACERTOS:'',MENCAO:'',EMAIL_CORRECAO_EM:t.row?t.row.EMAIL_CORRECAO_EM||'':''},headers=sheetData_(sh).headers;if(t.row)sh.getRange(t.row.__row,1,1,headers.length).setValues([headers.map(h=>obj[h]!==undefined?obj[h]:'')]);else sh.appendRow(headers.map(h=>obj[h]!==undefined?obj[h]:''));return{ok:true,idTentativa:obj.ID_TENTATIVA,finished:false}}
function finalizarProva_(d){const provaId=String(d.provaId||PROVA_PADRAO),def=provaDef_(provaId),nome=String(d.nome||'').trim(),email=String(d.email||'').trim().toLowerCase(),answers=d.answers||{};if(!nome||!email)throw new Error('Nome e e-mail são obrigatórios');if(Object.keys(answers).length<20)throw new Error('A prova ainda possui questões não respondidas');const t=tentativaRow_(provaId,email),sh=t.sh,now=new Date();if(t.row&&String(t.row.STATUS||'').toUpperCase()==='FINALIZADA')return{ok:true,finished:true,acertos:Number(t.row.ACERTOS||0),mencao:String(t.row.MENCAO||'')};let acertos=0;Object.keys(def.gabarito).forEach(q=>{if(String(answers[q]||'')===String(def.gabarito[q]))acertos++});const mencao=mencao_(acertos),obj={ID_TENTATIVA:t.row?t.row.ID_TENTATIVA:'PRV-'+Utilities.getUuid().slice(0,12).toUpperCase(),PROVA_ID:provaId,ALUNO:nome,EMAIL:email,STATUS:'FINALIZADA',INICIO_EM:t.row&&t.row.INICIO_EM?t.row.INICIO_EM:(d.startedAt||now),ATUALIZADO_EM:now,FINALIZADO_EM:now,RESPOSTAS_JSON:JSON.stringify(answers),ORDEM_JSON:JSON.stringify(d.order||[]),ALTERNATIVAS_JSON:JSON.stringify(d.altOrder||{}),SNAPSHOT_JSON:JSON.stringify(d.snapshot||[]),ACERTOS:acertos,MENCAO:mencao,EMAIL_CORRECAO_EM:t.row?t.row.EMAIL_CORRECAO_EM||'':''},headers=sheetData_(sh).headers;if(t.row)sh.getRange(t.row.__row,1,1,headers.length).setValues([headers.map(h=>obj[h]!==undefined?obj[h]:'')]);else sh.appendRow(headers.map(h=>obj[h]!==undefined?obj[h]:''));return{ok:true,finished:true,acertos,mencao,correcaoLiberada:provaConfig_(provaId).liberada}}
function montarCorrecao_(r){const def=provaDef_(r.PROVA_ID),answers=parseJson_(r.RESPOSTAS_JSON,{}),snapshot=parseJson_(r.SNAPSHOT_JSON,[]);if(!Array.isArray(snapshot))return[];return snapshot.map((q,i)=>{const marcada=String(answers[q.id]||''),correta=String(def.gabarito[q.id]||''),opts=Array.isArray(q.options)?q.options:[],find=id=>opts.find(o=>String(o.id)===id)||null;return{numero:i+1,id:q.id,text:q.text||'',marcada,correta,marcadaTexto:(find(marcada)||{}).text||'',corretaTexto:(find(correta)||{}).text||'',acertou:marcada===correta}})}

function config_(){const o={};rows_(ABAS.CONFIG).forEach(r=>o[String(r.CHAVE||'').trim()]=r.VALOR);return o}
function getOrCreateFolder_(pai,nome){const it=pai.getFoldersByName(nome);return it.hasNext()?it.next():pai.createFolder(nome)}
function sanitize_(s){return String(s||'').replace(/[\\/:*?"<>|#%{}~]/g,'-').replace(/\s+/g,' ').trim().slice(0,120)||'Sem nome'}
function sanitizeFile_(s){return String(s||'arquivo').replace(/[\\/:*?"<>|]/g,'-').slice(0,160)}
function validaArquivos_(arquivos,extensoes){const permitidas=String(extensoes||'').toLowerCase().split(',').map(x=>x.trim().replace(/^\./,'')).filter(Boolean);if(!permitidas.length)return;arquivos.forEach(f=>{const nome=String(f.name||''),ext=nome.includes('.')?nome.split('.').pop().toLowerCase():'';if(!permitidas.includes(ext))throw new Error('Arquivo não permitido: '+nome)})}
function parseDateTime_(v,fimDoDiaSeSoData){if(!v)return null;if(Object.prototype.toString.call(v)==='[object Date]')return v;const s=String(v).trim();let m=s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);if(m)return new Date(Number(m[1]),Number(m[2])-1,Number(m[3]),Number(m[4]),Number(m[5]),Number(m[6]||0),0);m=s.match(/^(\d{4})-(\d{2})-(\d{2})$/);if(m)return new Date(Number(m[1]),Number(m[2])-1,Number(m[3]),fimDoDiaSeSoData?23:0,fimDoDiaSeSoData?59:0,fimDoDiaSeSoData?59:0,0);const d=new Date(s);return isNaN(d.getTime())?null:d}
function dateTimeOut_(v){if(!v)return'';if(Object.prototype.toString.call(v)==='[object Date]')return Utilities.formatDate(v,Session.getScriptTimeZone(),"yyyy-MM-dd'T'HH:mm");const s=String(v).trim();if(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s))return s.slice(0,16);if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s+'T23:59';return s}
