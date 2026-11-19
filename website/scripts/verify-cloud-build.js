const fs = require("fs");
const path = require("path");
const { nodeFileTrace } = require("@vercel/nft");
async function verifyCloudBuild() {
  const root = path.resolve(__dirname, "..");
  const entry = path.join(root, "api", "index.js");
  const { fileList } = await nodeFileTrace([entry], {
    base: root,
    processCwd: root,
  });
  const banned = [
    /server\/db\//,
    /server\/certs\//,
    /server\/voice\/(?!intent\.js$)/,
    /server\/scripts\//,
    /\.local\//,
    /\.node$/,
    /node_modules\/(vosk|ffi-napi|ref-napi|sql\.js|mqtt)\//,
  ];
  const forbidden = [...fileList].filter((file) =>
    banned.some((rule) => rule.test(file.replaceAll("\\", "/"))),
  );
  if (forbidden.length)
    throw new Error(
      "Cloud bundle includes local-only modules: " + forbidden.join(", "),
    );
  const config = JSON.parse(
    fs.readFileSync(path.join(root, "vercel.json"), "utf8"),
  );
  if (
    config.outputDirectory !== "public" ||
    !config.rewrites[0].source.startsWith("/api/")
  )
    throw new Error("Cloud routes must precede the SPA fallback.");
  for (const file of [
    "public/index.html",
    "public/js/api.js",
    "public/js/state.js",
    "public/css/tokens.css",
  ])
    if (!fs.existsSync(path.join(root, file)))
      throw new Error("Missing static app asset.");
  console.log(
    JSON.stringify({
      result: "passed",
      traced_files: fileList.size,
      native_hub_files: 0,
      static_directory: "public",
      deployment_performed: false,
    }),
  );
  return { fileList };
}
if (require.main === module)
  verifyCloudBuild().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
module.exports = { verifyCloudBuild };
