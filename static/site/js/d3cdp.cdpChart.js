/* global d3, d3cdp */

(function() {
  d3cdp.cdpChart = function module(_accessor) {
    // SVGの枠の大きさ
    // widthはコンテナの大きさに合わせて自動調整する
    var width = 800;
    var height = 1500;

    // 'g'の描画領域となるデフォルトのマージン
    var margin = {
      top: 70,
      right: 100,
      bottom: 20,
      left: 70
    };

    // チャート描画領域のサイズw, h
    // 軸や凡例がはみ出てしまうので、マージンの分だけ小さくしておく。
    var w = width - margin.left - margin.right;
    var h = height - margin.top - margin.bottom;

    //
    // クラス名定義
    //

    // 一番下のレイヤ
    var CLASS_BASE_LAYER = 'cdp-base-layer';

    // ノードの中の箱の大きさ
    var boxHeight = 20;
    var portWidth = 55;

    // ノードをドラッグできるようにするか
    var node_draggable = true;

    // svgへのセレクタ
    var svg;

    // 描画領域へのセレクタ
    var layer;

    // call()したセレクタ
    var container;

    // セレクタに関連付けられたデータの原本
    // neighborオブジェクトの配列
    var neighbors;

    // 選択条件を適用して表示対象にするノードとリンクの配列
    // neighbors配列からフィルタ条件に一致するものを抽出して、それをdatasに変換して作成する
    var nodes;
    var links;

    var localSwitchId = 0;
    var deviceSelectMap = {};

    // call()されたときに呼ばれる公開関数
    function exports(_selection) {
      container = _selection;
      _selection.each(function(_data) {
        if (!_data) {
          // データにnullを指定してcall()した場合は、既存の描画領域を削除して終了
          container.selectAll('div').remove();
          container.select('svg').remove();
          return;
        }

        // 渡されるデータはneighbors配列
        neighbors = _data;

        // 横幅を取り出す
        var containerWidth = container.node().clientWidth;

        // svgの大きさはそれに合わせる
        exports.width(containerWidth);

        // 左上にスイッチ番号を指定するフィルタを表示するためのコンテナを配置
        initLocalSelector();

        // 右下にチェックボックスを使ったフィルタを表示するためのコンテナを配置
        initDeviceSelector();

        // svgを作成する
        var svgAll = container.selectAll('svg').data(['dummy']);
        svg = svgAll
          .enter()
          .append('svg')
          .merge(svgAll)
          .attr('width', width)
          .attr('height', height);

        // svgの上にチャート描画領域'g'を追加
        var layerAll = svg.selectAll('.' + CLASS_BASE_LAYER).data(['dummy']);
        layer = layerAll
          // ENTER領域
          .enter()
          .append('g')
          .classed(CLASS_BASE_LAYER, true)
          // ENTER + UPDATE領域
          .merge(layerAll)
          .attr('width', w)
          .attr('height', h)
          .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

        // 描画
        drawChart();
      });
    }

    // ラジオリンクに渡すデータ
    var rlDatas = ['swid[1-2]', 'swid[1]', 'swid[2]'];

    // ラジオリンクモジュールのインスタンス
    var rl = d3cdp.radiolink().on('selectedIndexChanged', rlOnSelectedIndexChanged);

    function rlOnSelectedIndexChanged(i) {
      // console.log(i);
      localSwitchId = i;
      drawChart();
    }

    function initLocalSelector() {
      var localSelectorAll = container.selectAll('.cdp-local-selector').data(['dummy']);
      var localSelector = localSelectorAll
        .enter()
        .append('div')
        .classed('cdp-local-selector', true)
        .merge(localSelectorAll);

      // 初期状態にする
      localSwitchId = 0;
      rl.selectedIndex(0);

      localSelector.datum(rlDatas).call(rl);
    }

    // チェックボックスモジュールをインスタンス化する
    var cb = d3cdp.checkbox().on('click', cbOnClick);

    function cbOnClick(d) {
      // onoffmapが返ってくる
      // console.log(d);
      deviceSelectMap = d;
      drawChart();
    }

    function initDeviceSelector() {
      var deviceSelectorAll = container.selectAll('.cdp-device-selector').data(['dummy']);
      var deviceSelector = deviceSelectorAll
        .enter()
        .append('div')
        .classed('cdp-device-selector', true)
        .merge(deviceSelectorAll);

      // neighbors配列からdevice_idキーの値を取り出してフィルタの項目にする
      var devices = [];
      var i;
      for (i = 0; i < neighbors.length; i++) {
        var nbr = neighbors[i];
        if (nbr.hasOwnProperty('device_id')) {
          var name = nbr['device_id'];
          if (devices.indexOf(name) < 0) {
            devices.push(name);
          }
        }
      }

      // コンテナにデバイス名の配列を指定してcall()する
      deviceSelector.datum(devices).call(cb);

      // この時点でのonoffmapを入手する
      deviceSelectMap = cb.onoffmap();
    }

    function drawChart() {
      // dataオブジェクトの配列datasをフィルタして表示したいものだけにする

      // localSwitchIdでneighbors配列をフィルタする
      var nbrs = filterByLocalSwitchId(neighbors);

      // 対向装置をdeviceSelectMapに従って絞り込む
      nbrs = filterByDevice(nbrs);

      // ref情報を付与したdatasオブジェクトに変換
      var datas = createDatas(nbrs);

      // ツリー構造を作り出す
      var tree = data2tree(datas);
      if (!tree.children) {
        svg.selectAll('.cdp-node').remove();
        svg.selectAll('.cdp-link').remove();
        svg.selectAll('.cdp-linklabel').remove();
        return;
      }

      // d3.hierarchy()を通すことで、ツリーレイアウトに必要なプロパティ情報を追加したルートノードを作る
      // d3.js version 4でここの挙動が変わっている
      // 元のデータに直接プロパティを追加するのではなく、node.dataに元データを移している
      // node.data - the associated data, as specified to the constructor
      // node.depth - zero for the root node, and increasing by one for each descendant generation
      // node.height - zero for leaf nodes, and the greatest distance from any descendant leaf for internal nodes
      // node.parent - the parent node, or null for the root node
      // node.children - an array of child nodes, if any; undefined for leaf nodes.
      var root = d3.hierarchy(tree, function(d) {
        return d.children;
      });

      // ツリーの深さを探る
      var maxDepth = 0;
      root.each(function(d) {
        if (d.hasOwnProperty('depth')) {
          if (d.depth > maxDepth) {
            maxDepth = d.depth;
          }
        }
      });

      var treeWidth = (maxDepth + 2) * 200;
      if (treeWidth > w - 200) {
        treeWidth = w - 200;
      }

      var treeHeight = (boxHeight + 5) * tree.children.length;
      if (treeHeight > h - 10) {
        treeHeight = h - 10;
      }

      // ツリーレイアウトを作る
      var layout = d3.tree().size([treeHeight, treeWidth]);

      // ツリーレイアウトを使ってノードの位置を付与する
      root = layout(root);

      // このrootを起点に順にたどって、プロパティを付与したnodes配列にする
      var ns = [];
      root.each(function(d) {
        var data = d.data; // これが元データ
        data.depth = d.depth;
        data.x = d.x;
        data.y = d.y;

        // 新たな配列に格納しておく
        ns.push(data);
      });

      // 必要な情報はコピーしたので、rootはここで用無し

      // ノードの配列からエッジを作る
      var ls = buildLinks(ns);

      // ドラッグで移動したノードの位置をそのままキープしたいので、座標をコピーするテスト
      var TEST = false;
      if (TEST) {
        if (node_draggable) {
          copyCoord(ns, ls);
        }
      }

      // インスタンス変数を差し替える
      nodes = ns;
      links = ls;

      // 描画
      drawEdges();
      drawNodes();

      var debug = false;
      if (debug) {
        drawEdgeLabel();
      }
    }

    // 座標(x, y)をコピー
    function copyCoord(ns, ls) {
      var old = {};
      if (nodes && nodes.length > 0) { // 既にnodesに値があるなら
        nodes.forEach(function(d) {
          old[d.uname] = d; // unameをキーにしてdを保管
        });

        // oldすなわち元々のnodesの値をnsにコピー
        ns.forEach(function(d) {
          if (old[d.uname]) { // oldDataのid番目にデータがあるなら(x, y)をコピー
            d.x = old[d.uname].x;
            d.y = old[d.uname].y;
          }
        });
      }
    }

    // プロトタイプ
    var proto_data = {
      id: -1,
      name: '',
      uname: '',
      isDevice: false, // isDeviceかisPortのどちらかをtrueにする
      isPort: false
    };

    // プロトタイプをもとにしてオブジェクト化する
    function make_data() {
      var data = Object.create(proto_data);
      data.prop = {};
      data.ref = []; // [{ from:0, to:1, w:1.0, name }, { from:, to:, w:1.0, name }]
      return data;
    }

    // ns[]から同じdevice_idを持つ物を返す。なければnullが返る。
    function getDataByDeviceId(ns, id) {
      if (!ns || ns.length === 0) {
        return null;
      }
      var n = ns.filter(function(d) {
        if (d.prop && d.prop.device_id && d.prop.device_id === id) {
          return true;
        }
        return false;
      });
      if (n.length === 0) {
        return null;
      }
      return n[0];
    }

    function createDatas(nbrs) {
      // datas配列
      var datas;

      // 通し番号
      var id = 0;

      // ルートノードを追加
      var nd;
      nd = make_data();
      nd.id = id++; // このidはneighbor配列が変更になると変わってしまうのでデータの紐付けには不適切
      nd.type = 'root';
      nd.name = 'local'; // 表示用の名前。ポート名は同じ物が複数登場するのでデータの紐付けには不適切
      nd.uname = 'local'; // データの紐付け用。ユニークな名前としてデバイス名とインタフェース名の組み合わせを使う
      nd.isDevice = true;
      nd.ref = [];

      // datas配列に加える
      datas = [].concat(nd);

      // 同じdevice_idの物は作らないように気をつけながらdeviceをノード化する
      var i;
      var nbr;
      var ds = [];
      for (i = 0; i < nbrs.length; i++) {
        nbr = nbrs[i];
        if (getDataByDeviceId(ds, nbr.device_id) === null) {
          nd = make_data();
          nd.id = id++;
          nd.type = 'device_id';
          nd.name = nbr.device_id;
          nd.uname = nbr.device_id;
          nd.isDevice = true;
          nd.prop = nbr;
          ds = ds.concat(nd);
        }
      }

      // neighborsのlocal_interfaceをノード化する
      var ls = [];
      for (i = 0; i < nbrs.length; i++) {
        nbr = nbrs[i];
        nd = make_data();
        nd.id = id++;
        nd.type = 'local_interface';
        nd.name = nbr.local_interface;
        nd.uname = nbr.device_id + nbr.local_interface;
        nd.isPort = true;
        nd.prop = nbr;
        ls = ls.concat(nd);
      }
      for (i = 0; i < ls.length; i++) {
        datas[0].ref = datas[0].ref.concat({
          from: 0,
          to: ls[i].id,
          w: 1,
          name: ''
        });
      }

      // port_idをノード化する
      var ps = [];
      for (i = 0; i < nbrs.length; i++) {
        nbr = nbrs[i];
        nd = make_data();
        nd.id = id++;
        nd.type = 'port_id';
        nd.name = nbr.port_id;
        nd.uname = nbr.device_id + nbr.port_id;
        nd.isPort = true;
        nd.prop = nbr;
        var to_id = getDataByDeviceId(ds, nbr.device_id).id;
        nd.ref = [{
          from: nd.id,
          to: to_id,
          w: 1,
          name: nd.id + '-' + to_id
        }];
        ps = ps.concat(nd);
      }

      for (i = 0; i < ls.length; i++) {
        ls[i].ref.push({
          from: ls[i].id,
          to: ps[i].id,
          w: 1.0,
          name: ls[i].id + '-' + ps[i].id
        });
      }

      datas = datas.concat(ls);
      datas = datas.concat(ps);
      datas = datas.concat(ds);

      return datas;
    }

    function data2tree(datas) {
      var root = datas[0];
      var hasParentFlag = {};

      hasParentFlag[root.id] = true;
      traverseEdge(datas, function(source, target) {
        if (!hasParentFlag[target.id] && source.id !== target.id) {
          if (!source.children) {
            source.children = [];
          }
          source.children.push(target);
          hasParentFlag[target.id] = true;
        }
      });
      return root;
    }

    function buildLinks(data) {
      var result = [];
      traverseEdge(data, function(source, target, ref) {
        result.push({
          source: source,
          target: target,
          ref: ref
        });
      });

      return result;
    }

    // 全ノードを探索する
    // その際にcallback(node)を実行するだけで、この関数自体は何もしない
    function traverse(datas, callback) {
      // 再起探索用の内部関数
      function _traverse(parent, callback) {
        if (!parent) {
          return;
        }
        parent.visited = true;
        // console.debug('traverse node:' + parent.id);
        callback(parent);

        // toで指定してあるノードを指定して再起探索する
        if (parent.ref) {
          parent.ref.forEach(function(ref) {
            var childNode = getDataById(datas, ref.to);
            if (childNode && !childNode.visited) {
              _traverse(childNode, callback);
            }
          });
        }
      }

      // 全てのdata.visitedプロパティをfalseに初期化
      var i;
      for (i = 0; i < datas.length; i++) {
        datas[i].visited = false;
      }

      // データの先頭から再帰処理を開始
      _traverse(datas[0], callback);
    }

    // 全てのエッジを探索する
    // その際にcallback(sourceNode, targetNode, ref)を実行するだけで、この関数自体は何もしない。
    function traverseEdge(datas, callback) {
      // 全ノードを探索する。その際にfunction(node){}で加工する。
      traverse(datas, function(node) {
        if (node.ref) {
          node.ref.forEach(function(ref) {
            // toで指定してあるノードを見つける
            var childNode = getDataById(datas, ref.to);
            if (childNode) {
              // node.idがsourceで、childNodeがtoになったリンクを見つけたことになる
              // console.debug('traverse edge:' + node.id + '-' + childNode.id);
              callback(node, childNode, ref);
            }
          });
        }
      });
    }

    function getDataById(datas, id) {
      var i;
      for (i = 0; i < datas.length; i++) {
        if (datas[i].id === id) {
          return datas[i];
        }
      }
      return null;
    }

    function drawEdges() {
      /* d3.js v3のときは、pathジェネレータがあったけど、v4で削除されてしまった
      // diagonal曲線のpathジェネレータ
      // データにはsourceとtargetを含むマップが必要。{source: {x:20, y:10}, target: {x:200, y:500}}
      var diagonal = d3.svg.diagonal()
        .projection(function(d) {
          return [d.y - boxHeight / 2, d.x];
        });
      */

      // クラス名cdp-linkでデータと紐付け
      var path = layer.selectAll('.cdp-link').data(links);

      // ノードが消えた場合はexit()領域が存在する
      path.exit().remove();

      // enter領域
      path
        .enter()
        .insert('path', ':first-child') // 先頭に挿入
        .attr('class', function(d) {
          return 'cdp-link link-' + d.ref.from + ' link-' + d.ref.to;
        })
        .attr('id', function(d) {
          return 'link' + d.ref.from + '-' + d.ref.to;
        }) // idはxlinkと連動するのでユニークでなければならない
        .merge(path)
        // .attr('d', diagonal)
        .attr('d', function(d) {
          return 'M' + d.target.y + ',' + d.target.x +
            'C' + (d.source.y + 100) + ',' + d.target.x +
            ' ' + (d.source.y + 100) + ',' + d.source.x +
            ' ' + d.source.y + ',' + d.source.x;
        })
        .style('stroke-width', function(d) {
          if (d.ref.w) {
            return d.ref.w;
          }
        });
    }

    function drawEdgeLabel() {
      // クラス名linklabelでデータと紐付け。このクラスは作らないので常にenter領域しかない。
      var label = layer.selectAll('.cdp-linklabel').data(links);

      label.enter()
        .append('text')
        .append('textPath')
        .attr('xlink:xlink:href', function(d) {
          return '#link' + d.ref.from + '-' + d.ref.to;
        })
        .attr('startOffset', '50%')
        .text(function(d) {
          console.log(d);
          return d.ref.name;
        });
    }

    function drawNodes() {
      var fontSize = 8;
      var lineSpace = 2;

      // グループgのクラスcdp-nodeに対してデータを名前で紐付ける。
      var nodeAll = layer.selectAll('.cdp-node').data(nodes, function(d) {
        if (d.uname) {
          return d.uname;
        }
      });

      // update領域
      // 位置のみ更新する
      nodeAll
        .attr('transform', function(d) {
          return 'translate(' + d.y + ',' + d.x + ')';
        });

      // exit領域
      // 削除する
      nodeAll
        .exit()
        .remove();

      // enter領域
      // テキストを上に表示するのでグループ化してまとめて位置を指定する。クラス名はnodeとする。各種オペレーションはnodeクラスに対して行う
      var node = nodeAll
        .enter()
        .append('g')
        .attr('class', 'cdp-node')
        .attr('transform', function(d) {
          return 'translate(' + d.y + ',' + d.x + ')';
        });

      // 箱を描画
      node
        .append('rect')
        .attr('class', function(d) {
          if (d.isDevice) {
            return 'cdp-device';
          }
          return 'cdp-port';
        })
        .attr('rx', 6)
        .attr('ry', 6)
        .attr('width', function(d) {
          if (d.isDevice) {
            return portWidth * 2;
          }
          return portWidth;
        })
        .attr('height', boxHeight)
        .attr('x', function(d) {
          if (d.isDevice) {
            return -portWidth;
          }
          return -portWidth / 2;
        })
        .attr('y', -boxHeight / 2);

      // タイトル
      node
        .append('text')
        .attr('class', 'cdp-node-title')
        .attr('y', -boxHeight / 2 + fontSize + 2 * lineSpace)
        .attr('text-anchor', 'middle')
        .text(function(d) {
          return d.name;
        });

      // ドラッグできるようにする
      if (node_draggable) {
        node.call(d3.drag().on('drag', nodeDragged));
        node.selectAll('rect').style('cursor', 'pointer');
      }
    }

    function nodeDragged(d) {
      // 縦軸をxにしているのでややこしい。
      d3.select(this).attr('transform', function(d) {
        return 'translate(' + [d.y, d.x] + ')';
      });
      d.x += d3.event.dy;
      d.y += d3.event.dx;
      drawEdges();
    }

    function filterByDevice(neighbors) {
      // 配列として認識させる
      var nbrs = [].concat(neighbors);

      // neighbors配列を表示するもの、しないものに分割する。
      var enter = [];

      nbrs.forEach(function(d) {
        if (deviceSelectMap[d.device_id]) {
          enter.push(d);
        }
      });

      return enter;
    }

    function filterByLocalSwitchId(neighbors) {
      // 配列として認識させる
      neighbors = [].concat(neighbors);

      var regex;
      if (localSwitchId === 1) {
        // Switch[1]だけを表示
        regex = new RegExp('(.*)(\\s)1/(\\d)/(\\d*)$');
      } else if (localSwitchId === 2) {
        // Switch[2]だけを表示
        regex = new RegExp('(.*)(\\s)2/(\\d)/(\\d*)$');
      } else {
        return neighbors;
      }

      var enter = [];
      neighbors.forEach(function(d) {
        if (regex.test(d.local_interface)) {
          // console.log(d.local_interface + ' is match!');
          enter = enter.concat(d);
        }
      });

      return enter;
    }

    exports.width = function(_) {
      if (!arguments.length) {
        return width;
      }
      width = _;
      w = width - margin.left - margin.right;
      return this;
    };

    exports.height = function(_) {
      if (!arguments.length) {
        return height;
      }
      height = _;
      h = height - margin.top - margin.bottom;
      return this;
    };

    return exports;
  };

  //
})();
