/**
 * ATD2 - AI
 * Backend para GitHub Pages -> Google Drive + Google Sheets
 * Prof. Dr. Junior P. Colombo
 */

const CONFIG = {
  SPREADSHEET_ID: '10H9XgzlYQiP7BXKodFfo98jUw7nx0UHp8jEHxRtbG04',
  SHEET_NAME: 'Respostas',
  PASTA_RESPOSTAS_PDF_ID: '1Kr76zzOv53QnDxLxjJNow3L2S9qiekRo',
  TURMA: '1º TANE - Extensão Ibiúna',
  COMPONENTE: 'Aplicativos Informatizados',
  ATIVIDADE: 'ATD2 - AI',
  TIMEZONE: 'America/Sao_Paulo',
  TEMPO_REFERENCIA_MINUTOS: 40,
  MAX_PDF_BYTES: 15 * 1024 * 1024
};

function doGet() {
  return json_({
    ok: true,
    sistema: CONFIG.ATIVIDADE,
    turma: CONFIG.TURMA,
    status: 'online'
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
    const aluno1 = String(data.aluno1 || data.student1 || data.nome || '').trim();
    const aluno2 = String(data.aluno2 || data.student2 || '').trim();
    const nomes = aluno2 ? `${aluno1} / ${aluno2}` : aluno1;

    validar_(data, aluno1, aluno2);

    const agora = new Date();
    const protocolo = gerarProtocolo_();
    const nomeLimpo = limparNome_(nomes);
    const nomeArquivo = `${nomeLimpo} - ATD2 AI - ${protocolo}.pdf`;

    const pdfBytes = Utilities.base64Decode(removerPrefixoBase64_(data.pdfBase64));
    if (pdfBytes.length > CONFIG.MAX_PDF_BYTES) {
      throw new Error('O PDF excede o limite de 15 MB.');
    }

    const blob = Utilities.newBlob(pdfBytes, 'application/pdf', nomeArquivo);
    const pasta = DriveApp.getFolderById(CONFIG.PASTA_RESPOSTAS_PDF_ID);
    const arquivo = pasta.createFile(blob);

    const inicio = data.inicio ? new Date(data.inicio) : null;
    const fimCliente = data.fim ? new Date(data.fim) : agora;
    const tempoMs = inicio && !isNaN(inicio.getTime())
      ? Math.max(0, fimCliente.getTime() - inicio.getTime())
      : null;
    const tempoMin = tempoMs === null ? '' : Math.round((tempoMs / 60000) * 100) / 100;
    const excedente = tempoMin === ''
      ? ''
      : Math.max(0, Math.round((tempoMin - CONFIG.TEMPO_REFERENCIA_MINUTOS) * 100) / 100);

    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
    if (!sheet) throw new Error(`Aba '${CONFIG.SHEET_NAME}' não encontrada.`);

    const horarioInicio = inicio && !isNaN(inicio.getTime())
      ? Utilities.formatDate(inicio, CONFIG.TIMEZONE, 'dd/MM/yyyy HH:mm:ss')
      : '';
    const horarioEnvio = Utilities.formatDate(agora, CONFIG.TIMEZONE, 'dd/MM/yyyy HH:mm:ss');

    sheet.appendRow([
      protocolo,
      horarioInicio,
      nomes,
      String(data.email || '').trim(),
      CONFIG.TURMA,
      data.versao || '',
      data.tema || data.titulo || '',
      horarioEnvio,
      tempoMin,
      CONFIG.TEMPO_REFERENCIA_MINUTOS,
      excedente,
      nomeArquivo,
      arquivo.getUrl(),
      'PENDENTE',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      montarObservacoes_(data, aluno1, aluno2),
      ''
    ]);

    return json_({
      ok: true,
      protocolo,
      arquivo: nomeArquivo,
      url: arquivo.getUrl(),
      horarioEnvio
    });

  } catch (err) {
    return json_({
      ok: false,
      erro: err && err.message ? err.message : String(err)
    });
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

function validar_(data, aluno1, aluno2) {
  if (!data) throw new Error('Dados ausentes.');
  if (!aluno1) throw new Error('Informe o nome do primeiro aluno.');
  if (aluno1.length < 3) throw new Error('Informe o nome completo do primeiro aluno.');
  if (aluno2 && aluno2.length < 3) throw new Error('Informe o nome completo do segundo aluno.');
  if (!validarEmail_(String(data.email || '').trim())) throw new Error('Informe um e-mail válido.');
  if (!data.pdfBase64) throw new Error('Arquivo PDF não recebido.');
  if (String(data.mimeType || 'application/pdf').toLowerCase() !== 'application/pdf') {
    throw new Error('Somente arquivos PDF são aceitos.');
  }
}

function montarObservacoes_(data, aluno1, aluno2) {
  const partes = [
    'Envio realizado pela interface da ATD2 - AI.',
    `Aluno 1: ${aluno1}`,
    aluno2 ? `Aluno 2: ${aluno2}` : 'Atividade individual',
    data.titulo ? `Título sorteado: ${data.titulo}` : '',
    data.textoFolhaRosto ? `Texto folha de rosto: ${data.textoFolhaRosto}` : '',
    data.observacoes || ''
  ];
  return partes.filter(Boolean).join(' | ');
}

function validarEmail_(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
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
