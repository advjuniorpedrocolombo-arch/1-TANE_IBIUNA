/**
 * ATD2 - AI
 * Backend para GitHub Pages -> Google Drive + Google Sheets
 * Controle centralizado de tentativa por e-mail.
 * Prof. Dr. Junior P. Colombo
 *
 * Requer CONFIG em AppsScript_ATD2_Config.gs.
 */

function doGet(e) {
  const action = String((e && e.parameter && e.parameter.action) || 'status').trim();

  if (action === 'consultarTentativa') {
    return consultarTentativaGet_(e);
  }

  const janela = obterStatusJanela_();
  return json_({
    ok: true,
    sistema: CONFIG.ATIVIDADE,
    turma: CONFIG.TURMA,
    status: janela.status,
    aberto: janela.aberto,
    agoraServidor: janela.agora.toISOString(),
    abertura: CONFIG.ABERTURA_ISO,
    encerramento: CONFIG.ENCERRAMENTO_ISO,
    mensagem: janela.mensagem
  });
}

function doPost(e) {
  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(30000);

    if (!e || !e.postData || !e.postData.contents) {
      throw new Error('Requisição sem conteúdo.');
    }

    const data = JSON.parse(e.postData.contents);
    const action = String(data.action || 'enviar').trim();

    if (action === 'iniciarTentativa') {
      validarJanela_();
      return iniciarOuRetomarTentativa_(data);
    }

    if (action === 'consultarTentativa') {
      return consultarTentativaPost_(data);
    }

    validarJanela_();
    return enviarAtividade_(data);

  } catch (err) {
    return json_({
      ok: false,
      erro: err && err.message ? err.message : String(err)
    });
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

function iniciarOuRetomarTentativa_(data) {
  const aluno1 = String(data.aluno1 || data.student1 || '').trim();
  const aluno2 = String(data.aluno2 || data.student2 || '').trim();
  const email1 = normalizarEmail_(data.email1 || data.email || '');
  const email2 = normalizarEmail_(data.email2 || '');
  const qtdTextos = Math.max(1, Number(data.qtdTextos || 1));

  validarIdentificacao_(aluno1, aluno2, email1, email2);

  const sheet = obterPlanilhaTentativas_();
  const existente = localizarTentativaPorEmails_(sheet, email1, email2);

  if (existente) {
    return json_({
      ok: true,
      retomada: true,
      tentativa: serializarTentativa_(existente)
    });
  }

  const agora = new Date();
  const fimIndividual = new Date(agora.getTime() + CONFIG.TEMPO_REFERENCIA_MINUTOS * 60000);
  const encerramentoGeral = new Date(CONFIG.ENCERRAMENTO_ISO);
  const fimEfetivo = fimIndividual < encerramentoGeral ? fimIndividual : encerramentoGeral;
  const textIndex = Math.floor(Math.random() * qtdTextos);
  const token = gerarTokenTentativa_();

  sheet.appendRow([
    token,
    'EM_ANDAMENTO',
    aluno1,
    email1,
    aluno2,
    email2,
    agora.toISOString(),
    fimEfetivo.toISOString(),
    textIndex,
    '',
    '',
    '',
    ''
  ]);

  const tentativa = {
    row: sheet.getLastRow(),
    token,
    status: 'EM_ANDAMENTO',
    aluno1,
    email1,
    aluno2,
    email2,
    inicioIso: agora.toISOString(),
    fimIso: fimEfetivo.toISOString(),
    textIndex,
    protocoloEnvio: '',
    enviadoEm: ''
  };

  return json_({
    ok: true,
    retomada: false,
    tentativa: serializarTentativa_(tentativa)
  });
}

function consultarTentativaGet_(e) {
  try {
    const email1 = normalizarEmail_((e && e.parameter && e.parameter.email1) || '');
    const email2 = normalizarEmail_((e && e.parameter && e.parameter.email2) || '');
    return consultarTentativaPorEmails_(email1, email2);
  } catch (err) {
    return json_({ok:false, erro:err.message || String(err)});
  }
}

function consultarTentativaPost_(data) {
  const email1 = normalizarEmail_(data.email1 || data.email || '');
  const email2 = normalizarEmail_(data.email2 || '');
  return consultarTentativaPorEmails_(email1, email2);
}

function consultarTentativaPorEmails_(email1, email2) {
  if (!validarEmail_(email1)) {
    throw new Error('Informe um e-mail válido para consultar a tentativa.');
  }

  const sheet = obterPlanilhaTentativas_();
  const encontrada = localizarTentativaPorEmails_(sheet, email1, email2);

  if (!encontrada) {
    return json_({ok:true, encontrada:false});
  }

  return json_({
    ok:true,
    encontrada:true,
    tentativa: serializarTentativa_(encontrada)
  });
}

function enviarAtividade_(data) {
  const aluno1 = String(data.aluno1 || data.student1 || data.nome || '').trim();
  const aluno2 = String(data.aluno2 || data.student2 || '').trim();
  const email1 = normalizarEmail_(data.email1 || data.email || '');
  const email2 = normalizarEmail_(data.email2 || '');
  const token = String(data.tokenTentativa || data.token || '').trim();
  const nomes = aluno2 ? `${aluno1} / ${aluno2}` : aluno1;

  validarIdentificacao_(aluno1, aluno2, email1, email2);

  if (!data.pdfBase64) {
    throw new Error('Arquivo PDF não recebido.');
  }
  if (String(data.mimeType || 'application/pdf').toLowerCase() !== 'application/pdf') {
    throw new Error('Somente arquivos PDF são aceitos.');
  }

  const tentativasSheet = obterPlanilhaTentativas_();
  let tentativa = token
    ? localizarTentativaPorToken_(tentativasSheet, token)
    : localizarTentativaPorEmails_(tentativasSheet, email1, email2);

  if (!tentativa) {
    throw new Error('Tentativa não localizada no servidor. Inicie ou retome a ATD2 antes de enviar.');
  }

  if (String(tentativa.status).toUpperCase() === 'ENVIADA') {
    throw new Error('Esta tentativa já foi enviada.');
  }

  if (![tentativa.email1, tentativa.email2].filter(Boolean).includes(email1)) {
    throw new Error('O e-mail informado não corresponde à tentativa registrada.');
  }

  if (email2 && ![tentativa.email1, tentativa.email2].filter(Boolean).includes(email2)) {
    throw new Error('O segundo e-mail não corresponde à tentativa registrada.');
  }

  const agora = new Date();
  const protocolo = gerarProtocolo_();
  const nomeArquivo = `${limparNome_(nomes)} - ATD2 AI - ${protocolo}.pdf`;

  const pdfBytes = Utilities.base64Decode(removerPrefixoBase64_(data.pdfBase64));
  if (pdfBytes.length > CONFIG.MAX_PDF_BYTES) {
    throw new Error('O PDF excede o limite de 15 MB.');
  }

  const arquivo = DriveApp
    .getFolderById(CONFIG.PASTA_RESPOSTAS_PDF_ID)
    .createFile(Utilities.newBlob(pdfBytes, 'application/pdf', nomeArquivo));

  const inicio = new Date(tentativa.inicioIso);
  const tempoMs = Math.max(0, agora.getTime() - inicio.getTime());
  const tempoMin = Math.round((tempoMs / 60000) * 100) / 100;
  const excedente = Math.max(0, Math.round((tempoMin - CONFIG.TEMPO_REFERENCIA_MINUTOS) * 100) / 100);

  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) throw new Error(`Aba '${CONFIG.SHEET_NAME}' não encontrada.`);

  const horarioInicio = Utilities.formatDate(inicio, CONFIG.TIMEZONE, 'dd/MM/yyyy HH:mm:ss');
  const horarioEnvio = Utilities.formatDate(agora, CONFIG.TIMEZONE, 'dd/MM/yyyy HH:mm:ss');
  const emails = tentativa.email2 ? `${tentativa.email1} / ${tentativa.email2}` : tentativa.email1;

  sheet.appendRow([
    'PENDENTE',
    protocolo,
    horarioInicio,
    nomes,
    emails,
    CONFIG.TURMA,
    data.versao || `Texto ${Number(tentativa.textIndex) + 1}`,
    data.tema || data.titulo || '',
    horarioEnvio,
    tempoMin,
    CONFIG.TEMPO_REFERENCIA_MINUTOS,
    excedente,
    nomeArquivo,
    arquivo.getUrl(),
    false,
    '',
    '',
    '',
    false,
    '',
    false,
    '',
    'PENDENTE',
    montarObservacoes_(data, tentativa),
    ''
  ]);

  aplicarValidacoesNaUltimaLinha_(sheet);

  tentativasSheet.getRange(tentativa.row, 2).setValue('ENVIADA');
  tentativasSheet.getRange(tentativa.row, 10).setValue(protocolo);
  tentativasSheet.getRange(tentativa.row, 11).setValue(agora.toISOString());
  tentativasSheet.getRange(tentativa.row, 12).setValue(nomeArquivo);
  tentativasSheet.getRange(tentativa.row, 13).setValue(arquivo.getUrl());

  return json_({
    ok: true,
    protocolo,
    arquivo: nomeArquivo,
    url: arquivo.getUrl(),
    horarioEnvio
  });
}

function obterPlanilhaTentativas_() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const nome = CONFIG.TENTATIVAS_SHEET_NAME || 'Tentativas_ATD2';
  let sheet = ss.getSheetByName(nome);

  if (!sheet) {
    sheet = ss.insertSheet(nome);
    sheet.appendRow([
      'TOKEN',
      'STATUS',
      'ALUNO 1',
      'EMAIL 1',
      'ALUNO 2',
      'EMAIL 2',
      'INÍCIO ISO',
      'FIM INDIVIDUAL ISO',
      'TEXT INDEX',
      'PROTOCOLO ENVIO',
      'ENVIADO EM ISO',
      'ARQUIVO',
      'URL ARQUIVO'
    ]);
    sheet.setFrozenRows(1);
  }

  return sheet;
}

function localizarTentativaPorEmails_(sheet, email1, email2) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;

  const valores = sheet.getRange(2, 1, lastRow - 1, 13).getValues();
  const procurados = [email1, email2].filter(Boolean).map(normalizarEmail_);

  for (let i = valores.length - 1; i >= 0; i--) {
    const r = valores[i];
    const emailsLinha = [normalizarEmail_(r[3]), normalizarEmail_(r[5])].filter(Boolean);
    const coincide = procurados.some(e => emailsLinha.includes(e));

    if (coincide) {
      return linhaParaTentativa_(r, i + 2);
    }
  }

  return null;
}

function localizarTentativaPorToken_(sheet, token) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;

  const valores = sheet.getRange(2, 1, lastRow - 1, 13).getValues();
  for (let i = valores.length - 1; i >= 0; i--) {
    if (String(valores[i][0] || '').trim() === token) {
      return linhaParaTentativa_(valores[i], i + 2);
    }
  }
  return null;
}

function linhaParaTentativa_(r, row) {
  return {
    row,
    token: String(r[0] || ''),
    status: String(r[1] || ''),
    aluno1: String(r[2] || ''),
    email1: normalizarEmail_(r[3]),
    aluno2: String(r[4] || ''),
    email2: normalizarEmail_(r[5]),
    inicioIso: normalizarIso_(r[6]),
    fimIso: normalizarIso_(r[7]),
    textIndex: Number(r[8] || 0),
    protocoloEnvio: String(r[9] || ''),
    enviadoEm: normalizarIso_(r[10])
  };
}

function serializarTentativa_(t) {
  const inicio = new Date(t.inicioIso);
  const fim = new Date(t.fimIso);
  const agora = new Date();

  return {
    token: t.token,
    status: t.status,
    student1: t.aluno1,
    student2: t.aluno2,
    email1: t.email1,
    email2: t.email2,
    email: t.email1,
    textIndex: Number(t.textIndex || 0),
    startTime: inicio.getTime(),
    endTime: fim.getTime(),
    remainingMs: Math.max(0, fim.getTime() - agora.getTime()),
    submitted: String(t.status).toUpperCase() === 'ENVIADA',
    protocoloEnvio: t.protocoloEnvio || '',
    enviadoEm: t.enviadoEm || ''
  };
}

function validarIdentificacao_(aluno1, aluno2, email1, email2) {
  if (!aluno1 || aluno1.length < 3) {
    throw new Error('Informe o nome completo do primeiro aluno.');
  }
  if (!validarEmail_(email1)) {
    throw new Error('Informe um e-mail válido para o primeiro aluno.');
  }
  if (aluno2) {
    if (aluno2.length < 3) throw new Error('Informe o nome completo do segundo aluno.');
    if (!validarEmail_(email2)) throw new Error('Informe um e-mail válido para o segundo aluno.');
    if (email1 === email2) throw new Error('Os dois alunos devem informar e-mails diferentes.');
  } else if (email2) {
    throw new Error('Informe o nome do segundo aluno ou deixe o segundo e-mail em branco.');
  }
}

function obterStatusJanela_() {
  const agora = new Date();
  const abertura = new Date(CONFIG.ABERTURA_ISO);
  const encerramento = new Date(CONFIG.ENCERRAMENTO_ISO);

  if (agora < abertura) {
    return {agora, aberto:false, status:'AGUARDANDO', mensagem:'A ATD2 será liberada hoje às 21h00.'};
  }

  if (agora >= encerramento) {
    return {agora, aberto:false, status:'ENCERRADA', mensagem:'A ATD2 foi encerrada às 22h30.'};
  }

  return {agora, aberto:true, status:'DISPONIVEL', mensagem:'ATD2 disponível para acesso e envio até 22h30.'};
}

function validarJanela_() {
  const janela = obterStatusJanela_();
  if (!janela.aberto) throw new Error(janela.mensagem);
}

function aplicarValidacoesNaUltimaLinha_(sheet) {
  const linha = sheet.getLastRow();
  if (linha <= 2) return;

  const colunas = [1, 15, 17, 19, 20, 21, 23];
  colunas.forEach(col => {
    const origem = sheet.getRange(linha - 1, col);
    const destino = sheet.getRange(linha, col);
    const regra = origem.getDataValidation();
    if (regra) destino.setDataValidation(regra);
  });
}

function montarObservacoes_(data, tentativa) {
  return [
    'Envio realizado pela interface da ATD2 - AI.',
    `Token da tentativa: ${tentativa.token}`,
    `Aluno 1: ${tentativa.aluno1}`,
    `E-mail 1: ${tentativa.email1}`,
    tentativa.aluno2 ? `Aluno 2: ${tentativa.aluno2}` : 'Atividade individual',
    tentativa.email2 ? `E-mail 2: ${tentativa.email2}` : '',
    data.titulo ? `Título sorteado: ${data.titulo}` : '',
    data.textoFolhaRosto ? `Texto folha de rosto: ${data.textoFolhaRosto}` : '',
    data.observacoes || ''
  ].filter(Boolean).join(' | ');
}

function validarEmail_(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

function normalizarEmail_(email) {
  return String(email || '').trim().toLowerCase();
}

function normalizarIso_(valor) {
  if (!valor) return '';
  if (valor instanceof Date) return valor.toISOString();
  const d = new Date(valor);
  return isNaN(d.getTime()) ? String(valor) : d.toISOString();
}

function removerPrefixoBase64_(valor) {
  const s = String(valor || '');
  const idx = s.indexOf('base64,');
  return idx >= 0 ? s.substring(idx + 7) : s;
}

function limparNome_(nome) {
  return String(nome || 'Aluno')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 _-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 80) || 'Aluno';
}

function gerarTokenTentativa_() {
  return Utilities.getUuid();
}

function gerarProtocolo_() {
  const agora = new Date();
  const data = Utilities.formatDate(agora, CONFIG.TIMEZONE, 'yyyyMMdd-HHmmss');
  const aleatorio = Math.floor(1000 + Math.random() * 9000);
  return `ATD2-AI-${data}-${aleatorio}`;
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
