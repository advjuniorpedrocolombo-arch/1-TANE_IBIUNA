/**
 * PROVA AI - 22/09/2026
 * Backend para GitHub Pages -> Google Drive + Google Sheets
 * Prof. Dr. Junior P. Colombo
 */

const CONFIG = {
  SPREADSHEET_ID: '1TeQ6BxWQDd4Z3aMnmkhbEbhnD0GSU_ZA0lIIwAs5B6A',
  SHEET_NAME: 'Respostas',
  PASTA_RESPOSTAS_PDF_ID: '1rCiiDen-3xCeZ6Qy1-XdGiN8cj-14TDc',
  TURMA: '1º TANE - Extensão Ibiúna',
  COMPONENTE: 'Aplicativos Informatizados',
  PROVA: '1ª Prova - 22/09/2026',
  TIMEZONE: 'America/Sao_Paulo',
  TEMPO_REFERENCIA_MINUTOS: 20,
  MAX_PDF_BYTES: 15 * 1024 * 1024
};

function doGet() {
  return json_({
    ok: true,
    sistema: CONFIG.PROVA,
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
    validar_(data);

    const agora = new Date();
    const protocolo = gerarProtocolo_();
    const nomeLimpo = limparNome_(data.nome);
    const nomeArquivo = `${nomeLimpo} - PROVA AI - ${protocolo}.pdf`;

    const pdfBytes = Utilities.base64Decode(removerPrefixoBase64_(data.pdfBase64));
    if (pdfBytes.length > CONFIG.MAX_PDF_BYTES) {
      throw new Error('O PDF excede o limite de 15 MB.');
    }

    const blob = Utilities.newBlob(pdfBytes, 'application/pdf', nomeArquivo);
    const pasta = DriveApp.getFolderById(CONFIG.PASTA_RESPOSTAS_PDF_ID);
    const arquivo = pasta.createFile(blob);

    const inicio = data.inicio ? new Date(data.inicio) : null;
    const fimCliente = data.fim ? new Date(data.fim) : agora;
    const tempoMs = inicio && !isNaN(inicio.getTime()) ? Math.max(0, fimCliente.getTime() - inicio.getTime()) : null;
    const tempoMin = tempoMs === null ? '' : Math.round((tempoMs / 60000) * 100) / 100;
    const excedente = tempoMin === '' ? '' : Math.max(0, Math.round((tempoMin - CONFIG.TEMPO_REFERENCIA_MINUTOS) * 100) / 100);

    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
    if (!sheet) throw new Error(`Aba '${CONFIG.SHEET_NAME}' não encontrada.`);

    const horarioInicio = inicio && !isNaN(inicio.getTime())
      ? Utilities.formatDate(inicio, CONFIG.TIMEZONE, 'dd/MM/yyyy HH:mm:ss')
      : '';
    const horarioEnvio = Utilities.formatDate(agora, CONFIG.TIMEZONE, 'dd/MM/yyyy HH:mm:ss');

    // Colunas A:Y conforme a planilha PROVA AI - Controle e Correção
    sheet.appendRow([
      protocolo,                                  // A ID
      horarioInicio,                              // B HORÁRIO DE INÍCIO
      data.nome.trim(),                           // C NOME DO ALUNO
      data.email.trim(),                          // D E-MAIL PARA DEVOLUTIVA
      CONFIG.TURMA,                               // E TURMA
      data.versao || '',                          // F VERSÃO
      data.tema || '',                            // G TEMA
      horarioEnvio,                               // H HORÁRIO DE ENVIO DA PROVA
      tempoMin,                                   // I TEMPO UTILIZADO
      CONFIG.TEMPO_REFERENCIA_MINUTOS,            // J TEMPO DE REFERÊNCIA
      excedente,                                  // K EXCEDENTE
      nomeArquivo,                                // L ARQUIVO PDF
      arquivo.getUrl(),                           // M LINK/ID DO ARQUIVO NO DRIVE
      'PENDENTE',                                 // N STATUS
      '',                                         // O CORRIGIR COM IA
      '',                                         // P DATA CORREÇÃO IA
      '',                                         // Q MENÇÃO IA
      '',                                         // R ARQUIVO CORREÇÃO
      '',                                         // S REVISADO PELO PROFESSOR
      '',                                         // T MENÇÃO FINAL
      '',                                         // U APROVAR E ENVIAR
      '',                                         // V DATA ENVIO
      '',                                         // W STATUS ENVIO
      data.observacoes || '',                     // X OBSERVAÇÕES
      ''                                          // Y reserva
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

function validar_(data) {
  if (!data) throw new Error('Dados ausentes.');
  if (!String(data.nome || '').trim()) throw new Error('Informe o nome do aluno.');
  if (!validarEmail_(String(data.email || '').trim())) throw new Error('Informe um e-mail válido.');
  if (!data.pdfBase64) throw new Error('Arquivo PDF não recebido.');
  if (String(data.mimeType || 'application/pdf').toLowerCase() !== 'application/pdf') {
    throw new Error('Somente arquivos PDF são aceitos.');
  }
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
  return `AI-${data}-${aleatorio}`;
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
