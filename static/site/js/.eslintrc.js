module.exports = {
  "extends": "google",
  "installedESLint": true,
  "env": {
    "browser": true,
  },
  "rules": {
    // インデントは2スペース
    "indent": ["error", 2],

    // 改行コードはWindows
    "linebreak-style": ["error", "windows"],

    // コメント要否
    "require-jsdoc": ["error", {
      "require": {
        "FunctionDeclaration": false,
        "MethodDefinition": false,
        "ClassDeclaration": false
      }
    }],

    // 無視する設定
    "max-len": "off",
    "dot-notation": "off",
    "camelcase": "off"

  }
};
