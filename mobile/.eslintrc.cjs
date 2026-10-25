const base=require('@react-native/eslint-config');
module.exports={...base,root:true,overrides:base.overrides.filter(override=>!override.env?.['jest/globals']),ignorePatterns:['android/**','ios/**','dist/**'],rules:{...base.rules,'react-native/no-inline-styles':'off','no-void':'off'}};
