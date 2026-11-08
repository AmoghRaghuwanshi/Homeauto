const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
function inspect(paths, root = path.resolve(__dirname, "..")) {
  const issues = [];
  for (const filename of paths) {
    const p = filename.replaceAll("\\", "/");
    if (
      /(^|\/)(\.local|\.vercel|\.neon|node_modules|\.venv|venv|__pycache__|\.ssh)(\/|$)|^server\/certs\/|^server\/voice\/models\//i.test(
        p,
      ) ||
      /(^|\/)\.env(?!\.example$)|(^|\/)(\.npmrc|\.pypirc|id_rsa|id_ed25519)$|\.(db|sqlite3?|bak|backup|key|pem|wav|mp3|mp4|onnx|gguf|zip|pyc)(?:$|[.-])/i.test(
        p,
      )
    ) {
      issues.push({
        file: p,
        reason: "private/generated/credential/model path",
      });
      continue;
    }
    const full = path.resolve(root, p);
    if (!full.startsWith(root + path.sep))
      throw new Error("Publication path leaves repository");
    const st = fs.lstatSync(full);
    if (st.isSymbolicLink() || st.size > 10 * 1024 * 1024) {
      issues.push({ file: p, reason: "symlink or oversized asset" });
      continue;
    }
    if (
      !/\.(js|json|md|html|css|sql|ino|py|txt|ya?ml|example|conf|toml)$/.test(
        p,
      ) &&
      !p.startsWith(".")
    )
      continue;
    const content = fs.readFileSync(full, "utf8");
    if (
      /-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----[\s\S]{20,}?-----END (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/.test(
        content,
      )
    )
      issues.push({ file: p, reason: "private key material" });
    if (
      /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,}|AKIA[A-Z0-9]{16})\b/.test(
        content,
      )
    )
      issues.push({ file: p, reason: "credential token shape" });
    for (const m of content.matchAll(/postgres(?:ql)?:\/\/[^\s"'<>`]+/g)) {
      try {
        const u = new URL(m[0]);
        if (
          u.password &&
          !/(?:^|\.)(?:invalid|example|test)$/.test(u.hostname) &&
          !["localhost", "127.0.0.1", "[::1]"].includes(u.hostname)
        )
          issues.push({
            file: p,
            reason: "password-bearing database URL outside synthetic host",
          });
      } catch {}
    }
  }
  return issues;
}
function main() {
  const paths = execFileSync("git", ["ls-files", "-z"], {
    cwd: path.resolve(__dirname, ".."),
    encoding: "utf8",
  })
    .split("\0")
    .filter(Boolean);
  if (!paths.length) throw new Error("No tracked/staged publication candidate");
  const issues = inspect(paths);
  for (const file of ['README.md','vercel.json','api/index.js','package-lock.json','server/package-lock.json','server/online/migrations/001_online.sql','server/online/migrations/002_bounded_maintenance.sql','server/online/migrations/003_self_service_signup.sql','server/online/migrations/004_gateway_onboarding.sql','.github/workflows/verify.yml']) if(!paths.includes(file)) issues.push({file,reason:'required publication file is not tracked'});
  console.log(JSON.stringify({ tracked_files: paths.length, issues }, null, 2));
  if (issues.length) process.exitCode = 1;
  return { paths, issues };
}
if (require.main === module)
  try {
    main();
  } catch {
    console.error(
      "Publication inspection failed; no sensitive content is printed.",
    );
    process.exitCode = 1;
  }
module.exports = { inspect, main };
