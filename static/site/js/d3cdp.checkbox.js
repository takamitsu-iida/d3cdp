/* global d3, d3cdp */

// 2016.11.21
// Takamitsu IIDA

// checkboxモジュール
(function() {
  d3cdp.checkbox = function module(_accessor) {
    // タイトル
    var title = '対向装置';

    // チェックボックスの初期状態
    var initialState = true;

    // カスタムイベント
    var dispatch = d3.dispatch('click');

    // このモジュールをcall()したコンテナ
    var container;

    // コンテナに紐付いているデータは文字列の配列であることを想定
    var datas;

    // 渡されたデータと真偽値の対応表
    var onoffmap = {};

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

        // チェックボックスの初期状態を設定する
        initOnoffmap(initialState);

        // <div class="cb-contents">
        //   <label>対向装置</label>'
        //   <div class="cb-interaction-group"></div>'
        //     <div class="cb-checkbox-container"></div>
        //     <div class="cb-checkbox-container"></div>
        //     <div class="cb-checkbox-container"></div>

        // 全体を束ねるグループ
        var contentsAll = container.selectAll('.cb-contents').data(['dummy']);
        var contents = contentsAll
          .enter()
          .append('div')
          .classed('cb-contents', true)
          .merge(contentsAll);

        // 表題のタイトル
        var titleAll = contents.selectAll('.cb-title').data([title]);
        titleAll
          .enter()
          .append('label')
          .classed('cb-title', true)
          .merge(titleAll)
          .text(function(d) {
            return d;
          });

        // checkboxを束ねるcb-interaction-group
        var interactionGroupAll = contents.selectAll('.cb-interaction-group').data(['dummy']);
        var interactionGroup = interactionGroupAll
          .enter()
          .append('div')
          .classed('cb-interaction-group', true)
          .merge(interactionGroupAll);

        // 既存を全消し
        interactionGroup
          .selectAll('.cb-checkbox-container')
          .remove();

        // チェックボックスを新規に展開する
        var cbCheckboxContainerAll = interactionGroup.selectAll('.cb-checkbox-container').data(datas);
        cbCheckboxContainerAll
          .enter()
          .append('div')
          .classed('cb-checkbox-container', true)
          .each(function(d) {
            // データごとにチェックボックスを作る
            d3.select(this)
              .append('input')
              .attr('type', 'checkbox')
              .attr('id', function(d) {
                // ID名はユニークでなければならない
                return 'chk_' + d;
              })
              .attr('checked', function(d) {
                // チェックしない場合はfalseではなく、nullを指定する
                return onoffmap[d] ? true : null;
              })
              .on('click', function(d, i) {
                // クリックした際のイベント
                var isChecked = this.checked;
                onoffmap[d] = isChecked;
                dispatch.call('click', this, onoffmap);
              });

            // 機器名をチェックボックスの横に表示
            d3.select(this)
              .append('span')
              .text(function(d) {
                return d;
              });
          });

        // 全選択、全解除を追加する
        var cbLinksAll = contents.selectAll('.cb-links').data(['dummy']);
        var cbLinks = cbLinksAll
          .enter()
          .append('div')
          .classed('cb-links', true)
          .merge(cbLinksAll);

        cbLinks
          .selectAll('a')
          .data(['ON', 'OFF'])
          .enter()
          .append('a')
          .html(function(d) {
            return 'ALL ' + d;
          })
          .on('click', function(d) {
            var isChecked = (d === 'ON');
            container.selectAll('.cb-checkbox-container').selectAll('input').property('checked', isChecked);
            initOnoffmap(isChecked);
            dispatch.call('click', this, onoffmap);
          });
        //
      });
    }

    function initOnoffmap(isChecked) {
      onoffmap = {};
      var i;
      for (i = 0; i < datas.length; i++) {
        var data = datas[i];
        onoffmap[data] = isChecked;
      }
    }

    exports.onoffmap = function() {
      return onoffmap;
    };

    exports.initialState = function(_) {
      if (!arguments.length) {
        return initialState;
      }
      initialState = _;
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
