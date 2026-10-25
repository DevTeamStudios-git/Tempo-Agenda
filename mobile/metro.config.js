const path = require('path');
const {getDefaultConfig,mergeConfig} = require('@react-native/metro-config');
module.exports = mergeConfig(getDefaultConfig(__dirname),{watchFolders:[path.resolve(__dirname,'../shared')],resolver:{resolveRequest(context,name,platform){return context.resolveRequest(context,name.startsWith('@/') ? path.resolve(__dirname,'src',name.slice(2)) : name,platform);}}});
