const {spawn} = require('node:child_process');
const path = require('node:path');
const {setupAndroidEnvironment} = require('./android-environment.cjs');
try {
 const {env,sdk,root}=setupAndroidEnvironment();
 console.log('Using Android SDK: '+sdk);
 const cli=path.join(root,'node_modules','react-native','cli.js');
 const child=spawn(process.execPath,[cli,'run-android',...process.argv.slice(2)],{cwd:root,env,stdio:'inherit'});
 child.on('error',error=>{console.error(error.message);process.exitCode=1;});
 child.on('exit',code=>process.exit(code??1));
}catch(error){console.error(error.message);process.exitCode=1;}
