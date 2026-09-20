# Painel unificado do professor — 1º TANE

Este diretório contém a nova administração central da turma **1º TANE — Extensão Ibiúna**.

## Regra de arquitetura

- **Professor:** um único painel para a turma.
- **Alunos:** continuam com páginas totalmente separadas por componente:
  - `/ai/`
  - `/em/`
  - `/cfe/`
  - `/pora/`

O painel do professor permite alternar entre **AI, EM, CFE e PORA** sem misturar o conteúdo exibido para os alunos.

## Arquivos

- `Admin.html`: interface do painel do professor.
- `Code.gs`: backend do Google Apps Script.

## Banco de dados

Usar uma única Planilha Google para o 1º TANE, seguindo o mesmo padrão usado no sistema LTP.

Abas esperadas:

### ATIVIDADES

`ID_ATIVIDADE | TURMA | COMPONENTE | TITULO | DESCRICAO | TIPO_ENVIO | EXTENSOES | MAX_ARQUIVOS | LIBERACAO | PRAZO | MATERIAL_APOIO_URL | CORRECAO_IA | GABARITO_CRITERIOS | STATUS | ORDEM | CRIADO_EM | ATUALIZADO_EM`

### MATERIAIS

`ID_MATERIAL | TURMA | COMPONENTE | TITULO | DESCRICAO | ARQUIVO_URL | TIPO | ORDEM | STATUS | PUBLICADO_EM`

### ENTREGAS

`ID_ENTREGA | ID_ATIVIDADE | ALUNO | EMAIL | ARQUIVOS_URL | RESPOSTA_TEXTO | DATA_ENVIO | STATUS | TENTATIVA | OBSERVACAO`

### CORRECOES

Pode manter a estrutura utilizada nos sistemas LTP/PE para a etapa de correção por IA e aprovação do professor.

## Implantação

1. Criar ou escolher a Planilha Google que será o banco do 1º TANE.
2. Copiar o ID da planilha.
3. No `Code.gs`, substituir:

```javascript
const SHEET_ID='COLE_AQUI_O_ID_DA_PLANILHA_1_TANE';
```

pelo ID real.

4. Criar um projeto do Google Apps Script.
5. Adicionar os arquivos `Code.gs` e `Admin.html`.
6. Em **Configurações do projeto**, usar o fuso horário **America/Sao_Paulo**.
7. Implantar como **Aplicativo da Web**, executando como o proprietário.
8. Testar primeiro apenas com o professor.

## Migração

Não alterar as páginas atuais dos alunos até o painel estar validado. A migração de AI, EM, CFE e PORA para consumir a nova base deve ser feita componente por componente, preservando os links existentes.
