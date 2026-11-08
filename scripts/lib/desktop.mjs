// OpenCode Desktop aberto pelo atalho do repositório (decisão do mantenedor em 2026-11-08).
// O atalho roda 'desktop': primeiro atualiza a configuração global (regras e modelo padrão que não treina),
// depois abre o Desktop. Assim quem usa o Desktop recebe as correções e o modelo do dia sem lembrar de nada.
// Só Windows foi testado; no Ubuntu o caminho do Desktop ainda é pendente.
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import * as configGlobal from "./configglobal.mjs";
import { IS_WINDOWS, REPO_DIR, confirm, runCapture, title, UserError } from "./util.mjs";

export const NOME_ATALHO = "OpenCode (gratuito).lnk";

// Caminho observado no Windows 11 em 2026-11-08 (instalação por usuário, sem administrador).
export function desktopExe(env = process.env) {
  if (!IS_WINDOWS) return null;
  return path.join(env.LOCALAPPDATA || "", "Programs", "ai.opencode.desktop", "OpenCode.exe");
}

const INSTALAR = "Instale o OpenCode Desktop conforme docs/interface-grafica.md (seção 'Instalar o Desktop').";

export async function abrir({ modeloDoDia = configGlobal.modeloDoDiaPadrao } = {}) {
  title("OpenCode Desktop");
  console.log("Atualizando a configuração global (regras e modelo padrão que não treina)...");
  console.log(configGlobal.descreverAtualizacao(configGlobal.atualizar(await modeloDoDia())));
  const exe = desktopExe();
  if (!exe) throw new UserError("Abrir o Desktop pelo script só foi preparado e testado no Windows.", "No Ubuntu, abra o Desktop pelo menu de aplicativos e rode antes 'config-global atualizar'.");
  if (!fs.existsSync(exe)) throw new UserError(`OpenCode Desktop não encontrado em ${exe}.`, INSTALAR);
  const filho = spawn(exe, [], { detached: true, stdio: "ignore", windowsHide: false });
  filho.unref();
  console.log("OpenCode Desktop aberto.");
}

// PowerShell com os valores passados por variáveis de ambiente (sem montar texto com caminhos).
function powershell(script, extra) {
  return runCapture("powershell", ["-NoProfile", "-NonInteractive", "-Command", script], { timeoutMs: 20000, env: { ...process.env, ...extra } });
}

const PASTA_DESKTOP = "$d = [Environment]::GetFolderPath('Desktop'); $f = Join-Path $d $env:IA_ATALHO;";

export async function criarAtalho() {
  title("Atalho do OpenCode Desktop");
  if (!IS_WINDOWS) throw new UserError("O atalho só foi preparado para o Windows.", "No Ubuntu, rode 'config-global atualizar' antes de abrir o Desktop.");
  const exe = desktopExe();
  if (!fs.existsSync(exe)) throw new UserError(`OpenCode Desktop não encontrado em ${exe}.`, INSTALAR);
  const st = configGlobal.estado();
  if (!st.arquivos.some((a) => a.existe && a.nosso)) {
    throw new UserError("A configuração global ainda não foi aplicada.", "Rode 'node scripts/ia-local.mjs config-global aplicar' antes de criar o atalho.");
  }
  console.log(`Vai criar na sua Área de Trabalho o atalho "${NOME_ATALHO.replace(/\.lnk$/, "")}".`);
  console.log("Ao abrir por ele, o script atualiza SEM PERGUNTAR o arquivo de configuração global criado pelo repositório");
  console.log("(regras de segurança e modelo padrão que não treina) e depois abre o Desktop.");
  console.log("O atalho original do OpenCode continua existindo, mas abre o Desktop SEM essa atualização.");
  if (!(await confirm("Criar o atalho?", { defaultYes: false }))) {
    console.log("Nada foi alterado.");
    return;
  }
  const script = `${PASTA_DESKTOP} $s = (New-Object -ComObject WScript.Shell).CreateShortcut($f); $s.TargetPath = $env:IA_NODE; $s.Arguments = '"' + $env:IA_SCRIPT + '" desktop --pausar-se-erro'; $s.WorkingDirectory = $env:IA_REPO; $s.IconLocation = $env:IA_EXE + ',0'; $s.Description = 'Atualiza a configuração global e abre o OpenCode Desktop'; $s.Save(); Write-Output $f`;
  const r = powershell(script, { IA_ATALHO: NOME_ATALHO, IA_NODE: process.execPath, IA_SCRIPT: path.join(REPO_DIR, "scripts", "ia-local.mjs"), IA_REPO: REPO_DIR, IA_EXE: exe });
  if (!r.ok) throw new UserError(`Não foi possível criar o atalho: ${(r.stderr || r.error?.message || "").trim().slice(0, 300)}`, "Crie à mão: veja docs/interface-grafica.md.");
  console.log(`Atalho criado: ${r.stdout.trim()}`);
  console.log("Se você mover a pasta do repositório, crie o atalho de novo.");
}

export async function removerAtalho() {
  title("Atalho do OpenCode Desktop");
  if (!IS_WINDOWS) return console.log("Nada a remover: o atalho só existe no Windows.");
  if (!(await confirm(`Remover o atalho "${NOME_ATALHO.replace(/\.lnk$/, "")}" da Área de Trabalho? (o programa e as configurações não são afetados)`, { defaultYes: false }))) {
    console.log("Nada foi alterado.");
    return;
  }
  const r = powershell(`${PASTA_DESKTOP} if (Test-Path -LiteralPath $f) { Remove-Item -LiteralPath $f; 'removido' } else { 'não existe' }`, { IA_ATALHO: NOME_ATALHO });
  console.log(r.ok ? `Atalho: ${r.stdout.trim()}.` : `Falha: ${(r.stderr || "").trim().slice(0, 300)}`);
}

export async function run(args = []) {
  const sub = args.find((a) => !a.startsWith("--"));
  if (!sub) {
    // Pelo atalho, a janela fecharia sozinha e a mensagem de erro se perderia.
    if (!args.includes("--pausar-se-erro")) return abrir();
    try {
      return await abrir();
    } catch (e) {
      console.error(`\nERRO: ${e.message}`);
      if (e.recovery) console.error(`O que fazer: ${e.recovery}`);
      await confirm("Pressione Enter para fechar", { defaultYes: true });
      process.exitCode = 1;
      return;
    }
  }
  if (sub === "atalho") return criarAtalho();
  if (sub === "remover-atalho") return removerAtalho();
  throw new UserError(`'desktop ${sub}' não existe.`, "Use: desktop | desktop atalho | desktop remover-atalho.");
}
