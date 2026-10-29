# Correção por IA — implantação segura (1º TANE)

## Arquivos atualizados
- `backend-admin/CorrecaoIA.gs`: novo motor de leitura das imagens, análise por gabarito, registro de notas sugeridas e aprovação docente.
- `backend-admin/Code.gs`: nova rota `?page=correcoes`.
- `backend-admin/Admin.html`: botão `Correção por IA`.

## Etapas para ativar no Apps Script do professor
1. Abra o projeto Apps Script já implantado do **painel do professor** (não o backend de recebimento dos alunos).
2. Faça uma cópia de segurança do projeto e do deployment anterior.
3. Substitua os arquivos `Code.gs` e `Admin.html` pelos arquivos atualizados deste diretório. Crie um arquivo Apps Script chamado `CorrecaoIA.gs` e cole seu código.
4. Em **Configurações do projeto > Propriedades do script**, adicione:
   - `OPENAI_API_KEY` = sua chave de API do OpenAI (não compartilhar nem publicar).
   - `IA_ADMIN_EMAIL` = e-mail exato da conta docente que utilizará o painel.
5. Implante **uma nova versão** da aplicação web do professor, com acesso limitado à sua própria conta. O sistema bloqueia correções se o e-mail ativo estiver ausente ou não coincidir com `IA_ADMIN_EMAIL`.
6. Abra o painel de administração, clique em **Correção por IA**. Selecione CFE e clique **Corrigir com IA** para uma entrega de teste.
7. Confira a nota, os seis critérios e as fotografias originais. Clique em **Aprovar correção** somente após revisão.

## Regras
- A nota inicialmente fica em `CORRECOES` com `STATUS=AGUARDANDO_REVISAO`.
- Nunca se publica nem envia a nota automaticamente ao aluno.
- Entregas aprovadas não podem ser corrigidas de novo pelo módulo.
- Todas as imagens da célula `ARQUIVOS_URL` são analisadas conjuntamente, com até 5 imagens por entrega.
- O gabarito é carregado da própria atividade na aba `ATIVIDADES`. Se não houver gabarito ou `CORRECAO_IA` não for `SIM`, a correção é impedida.
- Em caso de erro da API, arquivo incompatível ou conteúdo ilegível, não deve ser lançada nota sem revisão.
- O uso da API é tarifado conforme consumo. Os dados das imagens são enviados ao provedor de IA; providencie transparência institucional e base legal aplicável para dados de alunos.
- `IA_ADMIN_EMAIL` utiliza `Session.getActiveUser().getEmail()`. Se estiver vazio na modalidade de implantação atual, o acesso será recusado em vez de tornar as notas públicas. Faça teste com conta docente no deployment.

## O que não é possível ativar apenas alterando o GitHub
O Apps Script implantado não é automaticamente sincronizado com o GitHub. É necessária publicação manual dos arquivos atualizados no projeto Apps Script correspondente, definição das propriedades seguras e nova implantação. Sem isso, o botão não aparecerá no painel em produção e nenhuma entrega será corrigida.
