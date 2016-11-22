/* global d3, d3cdp */

// グローバルに独自の名前空間を定義する
(function() {
  // このthisはグローバル空間
  this.d3cdp = this.d3cdp || (function() {
    // アプリのデータを取り込む場合、appdata配下にぶら下げる
    var appdata = {};

    // ヒアドキュメント経由で静的データを取り込む場合、テキストデータをheredoc配下にぶら下げる
    var heredoc = {};

    // 地図データを取り込む場合、geodata配下にぶら下げる
    var geodata = {};

    // 公開するオブジェクト
    return {
      appdata: appdata,
      heredoc: heredoc,
      geodata: geodata
    };
  })();
  //
})();

// メイン関数
(function() {
  d3cdp.main = function() {
    var dm = d3cdp.dataManager();

    d3.select('textarea').property('value', function() {
      return dm.sampleText();
    });

    // mapChartをインスタンス化する
    var chart = d3cdp.cdpChart();

    // コンテナへのセレクタ
    var container = d3.select('#cdp-body');

    d3.select('button').on('click', function() {
      var text = d3.select('textarea').property('value');
      var neighbors = dm.parseText(text);
      // console.log(neighbors); return;

      // コンテナにデータを紐付けてcall()する
      container.datum(neighbors).call(chart);
    });

    //
  };
  //
})();
