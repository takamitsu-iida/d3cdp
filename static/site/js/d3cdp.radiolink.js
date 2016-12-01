/* global d3, d3cdp */

// 2016.11.21
// Takamitsu IIDA

// radiolinkモジュール
(function() {
  d3cdp.radiolink = function module(_accessor) {
    // タイトル
    var title = '';

    // 選択されているリンク
    var selectedIndex = 0;

    // ダミーデータ
    var dummy = ['dummy'];

    // カスタムイベント
    var dispatch = d3.dispatch('selectedIndexChanged');

    // このモジュールをcall()したコンテナ
    var container;

    // コンテナに紐付いているデータは文字列の配列であることを想定
    var datas;

    // 返却する関数オブジェクト
    function exports(_selection) {
      container = _selection;
      _selection.each(function(_data) {
        if (!_data) {
          container.select('div').remove();
          return;
        }

        // インスタンス変数に保管
        datas = _data;

        // <div class="rl-contents">
        //   <h3>Filter</h3>
        //   <a class="active">Switch[1-2]</a>
        //   <a>Switch[1]</a>
        //   <a>Switch[2]</a>
        // </div>

        // 全体を束ねるグループ
        var contentsAll = container.selectAll('.rl-contents').data(dummy);
        var contents = contentsAll
          .enter()
          .append('div')
          .classed('rl-contents', true)
          .merge(contentsAll);

        // 表題のタイトル
        if (title) {
          contents
            .append('p')
            .datum(title)
            .text(function(d) {
              return d;
            });
        }

        // リンクとなる<a>を展開する
        var aAll = contents.selectAll('a').data(datas);
        aAll
          .enter()
          .append('a')
          .on('click', function(d, i) {
            // クリックした際のイベント
            contents.selectAll('a').classed('active', false);
            d3.select(this).classed('active', true);
            // console.log(i);
            if (i !== selectedIndex) {
              selectedIndex = i;
              dispatch.call('selectedIndexChanged', this, i);
            }
          })
          .merge(aAll)
          .html(function(d) {
            return d;
          })
          .each(function(d, i) {
            d3.select(this).classed('active', (i === selectedIndex));
          });

        aAll.exit().remove();

        //
      });
    }

    exports.selectedIndex = function(_) {
      if (!arguments.length) {
        return selectedIndex;
      }
      selectedIndex = _;
      return this;
    };

    exports.title = function(_) {
      if (!arguments.length) {
        return title;
      }
      title = _;
      return this;
    };

    exports.on = function() {
      var value = dispatch.on.apply(dispatch, arguments);
      return value === dispatch ? exports : value;
    };

    return exports;
  };
  //
})();
