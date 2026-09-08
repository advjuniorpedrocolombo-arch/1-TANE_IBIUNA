const ATD2_CORRECAO = {
  PASTA_CORRECOES_PDF_ID: '1rkq_T_00r4xkkctePxGCo7eljvKO1Ln9',
  PASTA_DEVOLUTIVAS_ID: '1qeJTPbzY8yPd5eb4qVAnVOIYfsmMSZWF',
  MODELO_CORRECAO_DOC_ID: '1VZ8UKynq6Cunc1ObBMd59pbcPAuw9NKP1m9thv7W3Uk',
  MODELO_OFICIAL_PDF_ID: '1WskdCX0lYBc9zrVKmubzaDVxcMp3oWLg',
  OPENAI_ENDPOINT: 'https://api.openai.com/v1/responses',
  OPENAI_MODEL_PADRAO: 'gpt-5.6-luna'
};

function instalarGatilhoATD2() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'onEditATD2') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('onEditATD2').forSpreadsheet(ss).onEdit().create();
}

function onEditATD2(e) {
  if (!e || !e.range || String(e.value || '').toUpperCase() !== 'TRUE') return;
  const sheet = e.range.getSheet();
  if (sheet.getName() !== CONFIG.SHEET_NAME || e.range.getRow() <= 1) return;
  const mapa = mapaCabecalhosATD2_(sheet);
  const linha = e.range.getRow();
  if (e.range.getColumn() === mapa['CORRIGIR COM IA']) corrigirATD2_(sheet, linha, mapa);
  if (e.range.getColumn() === mapa['REVISADO PELO PROFESSOR']) revisarATD2_(sheet, linha, mapa);
  if (e.range.getColumn() === mapa['APROVAR E ENVIAR']) enviarATD2_(sheet, linha, mapa);
}

function corrigirATD2_(sheet, linha, mapa) {
  const status = celATD2_(sheet, linha, mapa, 'STATUS');
  const check = celATD2_(sheet, linha, mapa, 'CORRIGIR COM IA');
  try {
    const linkExistente = String(celATD2_(sheet, linha, mapa, 'ARQUIVO CORREÇÃO').getDisplayValue() || '').trim();
    if (linkExistente) {
      check.setValue(false);
      throw new Error('Esta entrega já possui correção. A IA não foi executada novamente.');
    }
    status.setValue('CORRIGINDO COM IA');
    SpreadsheetApp.flush();

    const nome = String(celATD2_(sheet, linha, mapa, 'NOME DO ALUNO').getDisplayValue() || '').trim();
    const email = String(celATD2_(sheet, linha, mapa, 'E-MAIL PARA DEVOLUTIVA').getDisplayValue() || '').trim();
    const titulo = String(celATD2_(sheet, linha, mapa, 'TEMA').getDisplayValue() || '').trim();
    const link = String(celATD2_(sheet, linha, mapa, 'LINK/ID DO ARQUIVO NO DRIVE').getDisplayValue() || '').trim();
    if (!titulo) throw new Error('Título sorteado não encontrado na linha.');
    if (!link) throw new Error('PDF do aluno não encontrado na linha.');

    const aluno = DriveApp.getFileById(extrairDriveIdATD2_(link));
    const modelo = DriveApp.getFileById(ATD2_CORRECAO.MODELO_OFICIAL_PDF_ID);
    const resultado = analisarATD2OpenAI_(aluno, modelo, nome, titulo);
    const data = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'dd/MM/yyyy HH:mm:ss');
    const dev = gerarDevolutivaATD2_(resultado, nome, email, titulo, data);

    celATD2_(sheet, linha, mapa, 'DATA CORREÇÃO IA').setValue(data);
    celATD2_(sheet, linha, mapa, 'MENÇÃO IA').setValue(resultado.mencao);
    celATD2_(sheet, linha, mapa, 'MENÇÃO FINAL').setValue(resultado.mencao);
    celATD2_(sheet, linha, mapa, 'ARQUIVO CORREÇÃO').setValue(dev.pdfUrl);
    status.setValue('AGUARDANDO REVISÃO DO PROFESSOR');
    obsATD2_(sheet, linha, mapa, 'Correção IA concluída. Menção sugerida: ' + resultado.mencao + '.');
  } catch (err) {
    status.setValue('ERRO NA CORREÇÃO');
    check.setValue(false);
    obsATD2_(sheet, linha, mapa, 'ERRO CORREÇÃO IA: ' + (err.message || err));
    throw err;
  }
}

function analisarATD2OpenAI_(arquivoAluno, arquivoModelo, nome, titulo) {
  const props = PropertiesService.getScriptProperties();
  const apiKey = String(props.getProperty('OPENAI_API_KEY') || '').trim();
  const model = String(props.getProperty('OPENAI_MODEL') || ATD2_CORRECAO.OPENAI_MODEL_PADRAO).trim();
  if (!apiKey) throw new Error('OPENAI_API_KEY não configurada.');

  const prompt = `Corrija a ATD2 de Formatação ABNT comparando visualmente os dois PDFs anexados. O primeiro é o arquivo do aluno e o segundo é o MODELO OFICIAL DO PROFESSOR.\n\nAluno(s): ${nome}\nTítulo sorteado obrigatório: ${titulo}\n\nAVALIE SOMENTE: 1) CAPA; 2) FOLHA DE ROSTO; 3) TÍTULO DO TEXTO SORTEADO; 4) FORMATAÇÃO DO TEXTO.\n\nNÃO avalie nem exija sumário, introdução, desenvolvimento, conclusão, citações, referências, pesquisa ou fundamentação teórica.\n\nCAPA: compare identificação institucional, Etec de Mairinque – Extensão Ibiúna, nome(s), título exato sorteado, Ibiúna, 2026, posição, alinhamento, fonte, tamanho, margens e distribuição visual.\n\nFOLHA DE ROSTO: compare nome(s), título, Ibiúna, 2026, posição e formatação. O texto obrigatório é: “Avaliação apresentada ao Curso Técnico em Administração da Etec de Mairinque – Extensão Ibiúna, orientado pelo Prof. Junior Pedro Colombo, como requisito parcial para obtenção do título de técnico em Administração.”\n\nTÍTULO DO TEXTO: deve ser exatamente “${titulo}” e seguir o modelo visual, centralizado, em maiúsculas, negrito e destacado antes do texto.\n\nTEXTO: avalie somente fidelidade ao texto fornecido e apresentação visual/ABNT: margens, fonte/tamanho, espaçamento, justificação, recuo da primeira linha e distribuição visual. Não invente medidas se o PDF não permitir determiná-las com segurança.\n\nMENÇÕES: MB = praticamente integral; B = pequenos erros; R = vários erros perceptíveis; I = incompleto ou fora do padrão.`;

  const schema = {
    type:'object', additionalProperties:false,
    properties:{
      resumo_geral:{type:'string'},
      capa_resultado:{type:'string',enum:['CORRETO','PARCIAL','INCORRETO']}, capa_analise:{type:'string'},
      folha_rosto_resultado:{type:'string',enum:['CORRETO','PARCIAL','INCORRETO']}, folha_rosto_analise:{type:'string'},
      titulo_resultado:{type:'string',enum:['CORRETO','PARCIAL','INCORRETO']}, titulo_analise:{type:'string'},
      texto_resultado:{type:'string',enum:['CORRETO','PARCIAL','INCORRETO']}, texto_analise:{type:'string'},
      correcoes_necessarias:{type:'string'}, pontos_positivos:{type:'string'}, parecer_final:{type:'string'},
      mencao:{type:'string',enum:['MB','B','R','I']}
    },
    required:['resumo_geral','capa_resultado','capa_analise','folha_rosto_resultado','folha_rosto_analise','titulo_resultado','titulo_analise','texto_resultado','texto_analise','correcoes_necessarias','pontos_positivos','parecer_final','mencao']
  };

  const payload = {
    model:model,
    input:[{role:'user',content:[
      {type:'input_text',text:prompt},
      {type:'input_file',filename:'PDF_DO_ALUNO.pdf',file_data:Utilities.base64Encode(arquivoAluno.getBlob().getBytes())},
      {type:'input_file',filename:'MODELO_OFICIAL.pdf',file_data:Utilities.base64Encode(arquivoModelo.getBlob().getBytes())}
    ]}],
    text:{format:{type:'json_schema',name:'correcao_atd2_ai',strict:true,schema:schema}}
  };

  const resposta = UrlFetchApp.fetch(ATD2_CORRECAO.OPENAI_ENDPOINT, {
    method:'post', contentType:'application/json',
    headers:{Authorization:'Bearer ' + apiKey},
    payload:JSON.stringify(payload), muteHttpExceptions:true
  });
  if (resposta.getResponseCode() < 200 || resposta.getResponseCode() >= 300) {
    throw new Error('OpenAI HTTP ' + resposta.getResponseCode() + ': ' + resposta.getContentText().substring(0,700));
  }
  const json = JSON.parse(resposta.getContentText());
  const texto = extrairOutputATD2_(json);
  if (!texto) throw new Error('A IA não retornou resultado estruturado.');
  return JSON.parse(texto);
}

function extrairOutputATD2_(resp) {
  if (resp && typeof resp.output_text === 'string' && resp.output_text.trim()) return resp.output_text.trim();
  const output = Array.isArray(resp && resp.output) ? resp.output : [];
  for (const item of output) {
    if (item && item.type === 'message' && Array.isArray(item.content)) {
      for (const c of item.content) if (c && c.type === 'output_text' && c.text) return String(c.text).trim();
    }
  }
  return '';
}

function gerarDevolutivaATD2_(r, nome, email, titulo, data) {
  const pastaDocs = DriveApp.getFolderById(ATD2_CORRECAO.PASTA_DEVOLUTIVAS_ID);
  const pastaPdf = DriveApp.getFolderById(ATD2_CORRECAO.PASTA_CORRECOES_PDF_ID);
  const base = limparNome_(nome) + ' - DEVOLUTIVA ATD2 AI - ' + Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyyMMdd-HHmmss');
  const copia = DriveApp.getFileById(ATD2_CORRECAO.MODELO_CORRECAO_DOC_ID).makeCopy(base, pastaDocs);
  const doc = DocumentApp.openById(copia.getId());
  const body = doc.getBody();
  const trocas = {
    '{{NOME_ALUNO}}':nome, '{{EMAIL_ALUNO}}':email, '{{DATA_CORRECAO}}':data,
    '{{TITULO_SORTEADO}}':titulo, '{{MENCAO_FINAL}}':r.mencao,
    '{{CAPA_RESULTADO}}':r.capa_resultado, '{{CAPA_ANALISE}}':r.capa_analise,
    '{{FOLHA_ROSTO_RESULTADO}}':r.folha_rosto_resultado, '{{FOLHA_ROSTO_ANALISE}}':r.folha_rosto_analise,
    '{{TITULO_RESULTADO}}':r.titulo_resultado, '{{TITULO_ANALISE}}':r.titulo_analise,
    '{{TEXTO_RESULTADO}}':r.texto_resultado, '{{TEXTO_ANALISE}}':r.texto_analise,
    '{{CORRECOES_NECESSARIAS}}':r.correcoes_necessarias, '{{PONTOS_POSITIVOS}}':r.pontos_positivos,
    '{{PARECER_FINAL}}':r.parecer_final
  };
  Object.keys(trocas).forEach(k => body.replaceText(escapeRegexATD2_(k), String(trocas[k] || '')));
  doc.saveAndClose();
  const pdf = pastaPdf.createFile(DriveApp.getFileById(copia.getId()).getAs(MimeType.PDF).setName(base + '.pdf'));
  return {docUrl:copia.getUrl(),pdfUrl:pdf.getUrl()};
}

function revisarATD2_(sheet, linha, mapa) {
  if (!String(celATD2_(sheet, linha, mapa, 'ARQUIVO CORREÇÃO').getDisplayValue() || '').trim()) {
    celATD2_(sheet, linha, mapa, 'REVISADO PELO PROFESSOR').setValue(false);
    obsATD2_(sheet, linha, mapa, 'ERRO REVISÃO: ainda não existe correção da IA.');
    return;
  }
  if (!String(celATD2_(sheet, linha, mapa, 'MENÇÃO FINAL').getDisplayValue() || '').trim()) {
    celATD2_(sheet, linha, mapa, 'MENÇÃO FINAL').setValue(celATD2_(sheet, linha, mapa, 'MENÇÃO IA').getValue());
  }
  celATD2_(sheet, linha, mapa, 'STATUS').setValue('REVISADO PELO PROFESSOR');
}

function enviarATD2_(sheet, linha, mapa) {
  const aprovar = celATD2_(sheet, linha, mapa, 'APROVAR E ENVIAR');
  if (celATD2_(sheet, linha, mapa, 'REVISADO PELO PROFESSOR').getValue() !== true) {
    aprovar.setValue(false); obsATD2_(sheet, linha, mapa, 'ENVIO BLOQUEADO: revise primeiro.'); return;
  }
  if (String(celATD2_(sheet, linha, mapa, 'STATUS ENVIO').getDisplayValue()) === 'ENVIADO') {
    aprovar.setValue(false); return;
  }
  const email = String(celATD2_(sheet, linha, mapa, 'E-MAIL PARA DEVOLUTIVA').getDisplayValue()).trim();
  const nome = String(celATD2_(sheet, linha, mapa, 'NOME DO ALUNO').getDisplayValue()).trim();
  const mencao = String(celATD2_(sheet, linha, mapa, 'MENÇÃO FINAL').getDisplayValue()).trim();
  const link = String(celATD2_(sheet, linha, mapa, 'ARQUIVO CORREÇÃO').getDisplayValue()).trim();
  if (!['MB','B','R','I'].includes(mencao)) throw new Error('Defina MENÇÃO FINAL válida.');
  const anexo = DriveApp.getFileById(extrairDriveIdATD2_(link)).getBlob();
  MailApp.sendEmail({to:email,subject:'ATD2 - Aplicativos Informatizados | Devolutiva - Menção ' + mencao,body:'Olá, ' + nome + '.\n\nSegue em anexo a devolutiva da ATD2 - Formatação ABNT, revisada pelo professor.\n\nMenção final: ' + mencao + '\n\nProfessor Dr. Junior P. Colombo\nEtec de Mairinque - Extensão Ibiúna',attachments:[anexo]});
  const agora = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'dd/MM/yyyy HH:mm:ss');
  celATD2_(sheet, linha, mapa, 'DATA ENVIO').setValue(agora);
  celATD2_(sheet, linha, mapa, 'STATUS ENVIO').setValue('ENVIADO');
  celATD2_(sheet, linha, mapa, 'STATUS').setValue('ENVIADO');
}

function mapaCabecalhosATD2_(sheet) {
  const vals = sheet.getRange(1,1,1,sheet.getLastColumn()).getDisplayValues()[0], m = {};
  vals.forEach((v,i) => { if (String(v).trim()) m[String(v).trim().toUpperCase()] = i + 1; });
  return m;
}
function celATD2_(sheet,linha,mapa,nome) { const c=mapa[nome.toUpperCase()]; if(!c) throw new Error('Coluna não encontrada: '+nome); return sheet.getRange(linha,c); }
function obsATD2_(sheet,linha,mapa,texto) { const c=celATD2_(sheet,linha,mapa,'OBSERVAÇÕES'); const a=String(c.getValue()||'').trim(); c.setValue(a ? a+'\n'+texto : texto); }
function extrairDriveIdATD2_(v) { const m=String(v||'').match(/[-\w]{20,}/); if(!m) throw new Error('ID do Drive não identificado.'); return m[0]; }
function escapeRegexATD2_(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); }
