const {spawn}=require('node:child_process');
const path=require('node:path');
const {setupAndroidEnvironment}=require('./android-environment.cjs');
try{const {env,root}=setupAndroidEnvironment();const task=process.argv[2]==='release'?'assembleRelease':'assembleDebug';const win=process.platform==='win32';const child=spawn(win?'cmd.exe':'./gradlew',win?['/d','/c','gradlew.bat',task,'--console=plain']:[task,'--console=plain'],{cwd:path.join(root,'android'),env,stdio:'inherit'});child.on('error',error=>{console.error(error.message);process.exitCode=1;});child.on('exit',code=>process.exit(code??1));}catch(error){console.error(error.message);process.exitCode=1;}
