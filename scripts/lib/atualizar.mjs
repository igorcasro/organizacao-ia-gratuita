// Atualiza este repositório com 'git pull' (decisão do mantenedor em 2026-11-08). Roda só quando a pessoa pede:
// pelo comando 'atualizar' ou por '/atualizar-ia' dentro do OpenCode (comando gravado pelo config-global).
// Nunca é automático: assim nada novo roda no computador sem a pessoa pedir.
// Depois do pull, atualiza a configuração global (regras novas e modelo do dia que não treina), se ela existir.
import * as configGlobal from "./configglobal.mjs";
import { REPO_DIR, runCapture, title, UserError } from "./util.mjs";

export async function run({ modeloDoDia = configGlobal.modeloDoDiaPadrao, repoDir = REPO_DIR, env = process.env } = {}) {
  const git = (args, timeoutMs = 60000) => runCapture("git", ["-C", repoDir, ...args], { timeoutMs });
  title("Atualizar o repositório organizacao-ia-gratuita");
  if (!git(["rev-parse", "--is-inside-work-tree"]).ok) {
    throw new UserError("Esta pasta não é um repositório git (ou o git não está instalado).", "Baixe o repositório com 'git clone', conforme o Passo A3 do manual.");
  }
  const f = git(["fetch", "--quiet"], 120000);
  if (!f.ok) throw new UserError(`Não foi possível consultar o GitHub: ${(f.stderr || f.error?.message || "").trim().slice(0, 200)}`, "Confira a internet e tente de novo.");
  const n = Number(git(["rev-list", "--count", "HEAD..@{upstream}"]).stdout.trim() || 0);
  if (n === 0) {
    console.log("O repositório já está na versão mais recente.");
  } else {
    console.log(`${n} atualização(ões) disponível(is):`);
    console.log(git(["log", "--oneline", "--no-decorate", "HEAD..@{upstream}"]).stdout.trim());
    const p = git(["pull", "--ff-only", "--quiet"], 120000);
    if (!p.ok) {
      throw new UserError(
        `O 'git pull' não foi concluído: ${(p.stderr || "").trim().slice(0, 300)}`,
        "Provável causa: arquivos do repositório alterados neste computador. Rode 'git status' na pasta do repositório e veja docs/problemas.md (seção 'Atualização').",
      );
    }
    console.log("Repositório atualizado.");
  }
  console.log(configGlobal.descreverAtualizacao(configGlobal.atualizar(await modeloDoDia(), env)));
}
