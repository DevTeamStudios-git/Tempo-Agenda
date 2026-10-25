const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const propertiesPath = path.join(root, 'android', 'local.properties');
function setupAndroidEnvironment(base = process.env) {
  const properties = fs.existsSync(propertiesPath) ? fs.readFileSync(propertiesPath, 'utf8') : '';
  const configured = properties.match(/^sdk\.dir\s*[=:]\s*(.+)$/m)?.[1]?.trim().replace(/\\([\\: ])/g, '$1');
  const candidates = [base.ANDROID_HOME, base.ANDROID_SDK_ROOT, configured,
    process.platform === 'win32' ? path.join(base.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'Android', 'Sdk') : null,
    process.platform === 'darwin' ? path.join(os.homedir(), 'Library', 'Android', 'sdk') : null,
    path.join(os.homedir(), 'Android', 'Sdk')].filter(Boolean);
  const sdk = candidates.find(candidate => fs.existsSync(path.join(candidate, 'platform-tools')) && fs.existsSync(path.join(candidate, 'platforms')));
  if (!sdk) throw new Error('Android SDK not found. Install it through Android Studio → SDK Manager, or set ANDROID_HOME to its SDK directory.');
  const normalized = sdk.replace(/\\/g, '/');
  const line = 'sdk.dir=' + normalized;
  const next = /^sdk\.dir\s*[=:].*$/m.test(properties) ? properties.replace(/^sdk\.dir\s*[=:].*$/m, line) : properties + (properties && !properties.endsWith('\n') ? '\n' : '') + line + '\n';
  if (next !== properties) fs.writeFileSync(propertiesPath, next);
  const env = {...base, ANDROID_HOME:sdk, ANDROID_SDK_ROOT:sdk};
  const pathKey = Object.keys(base).find(key => key.toUpperCase() === 'PATH');
  const searchPath = pathKey ? base[pathKey] : '';
  for (const key of Object.keys(env)) if(key.toUpperCase() === 'PATH') delete env[key];
  env[process.platform === 'win32' ? 'Path' : 'PATH'] = [path.join(sdk, 'platform-tools'), path.join(sdk, 'emulator'), searchPath].join(path.delimiter);
  if (!env.JAVA_HOME) {
    const java = (searchPath || '').split(path.delimiter).map(dir => path.join(dir, process.platform === 'win32' ? 'java.exe' : 'java')).find(file => fs.existsSync(file));
    if (java) {
      const home=path.dirname(path.dirname(fs.realpathSync(java)));
      if(fs.existsSync(path.join(home,'bin',process.platform==='win32'?'javac.exe':'javac')))env.JAVA_HOME=home;
    }
  }
  return {env, sdk, root};
}
module.exports = {setupAndroidEnvironment};
if(require.main === module){try{const {sdk}=setupAndroidEnvironment();console.log('Android SDK configured: '+sdk);console.log('Saved android/local.properties (local machine only, ignored by Git).');}catch(error){console.error(error.message);process.exitCode=1;}}
