/* global d3, d3cdp */

// データマネージャモジュール
(function() {
  d3cdp.dataManager = function module() {
    // このモジュールは関数ではなくマップを返す
    var exports = {};

    // このモジュールで保持しているデータ
    var data;

    // 外部からデータを取得するための公開関数
    exports.getData = function() {
      return data;
    };

    // カスタムイベント。
    var dispatch = d3.dispatch('dataReady', 'dataLoading');

    // csvを取得して、_cleaningFunc()で加工して、dataオブジェクトにする
    exports.loadCsvData = function(_file, _cleaningFunc) {
      // d3.csv()でCSVファイルを要求する。ローカルファイルは読めないのでサーバが必要。
      var loadCsv = d3.csv(_file);

      // d3.csv()が発行するprogressイベントをカスタムイベントdataLoadingとして発火させる
      loadCsv.on('progress', function() {
        // カスタムイベントをディスパッチする
        dispatch.call('dataLoading', this, d3.event.loaded);
      });

      // HTTP GETで取得。非同期処理。
      loadCsv.get(function(_err, _response) {
        // _cleaningFuncで渡された関数を実行してデータを整形する
        _response.forEach(function(d) {
          _cleaningFunc(d);
        });

        // dataに整形後のデータを格納する
        data = _response;

        // 読み込んだCSVデータをCrossfilterに渡すならここで処理。
        // dataCrossfilter.add(_response);
        // ディメンジョン定義。データ内のLOCATIONを渡す。
        // location = dataCrossfilter.dimension(function(d) {
        //   return d.LOCATION;
        // });

        // カスタムイベント dataReady を発火させる。
        dispatch.call('dataReady', this, _response);
      });
    };

    exports.parseText = function(text) {
      return parseText(text);
    };

    // show cdp neighborの出力テキストを引数に与えてパース処理
    function parseText(text) {
      text = String() + text;
      // 改行で分割して配列にする
      var lines = text.split(/\r\n|\r|\n/);
      // console.log(lines.length);

      return parseLines(lines);
    }

    exports.parseLines = function(text) {
      return parseLines(text);
    };

    // show cdp neighborの出力を改行で分割した配列をもとにパース処理
    function parseLines(lines) {
      // show cdp neighbor表示を各ネイバー毎に分割。ホスト名が長すぎると2行に割れるので1ネイバー2行の場合あり。
      var neighborTextArray = text2neighborTextArray(lines);

      // テキストの配列ではなく、オブジェクトの配列にする
      var neighbors = neighborTextArray2neighborObjects(neighborTextArray);

      return neighbors;
    }

    // テキスト配列からneighborごとに区切ったテキストの配列に分割する
    // 1台のneighborが2行になることがあるので、2次元配列とする
    function text2neighborTextArray(lines) {
      var line = '';
      var i = 0;

      // 2次元配列(名前を付けてわかりやすくした)
      var neighborTextArray = [];
      var n = [];

      // 新しいセクションを検出したかどうか
      var isSection = false;

      // これを検出したら処理開始
      var startStr = 'Device ID        ';

      // これを検出したらそれ以降は無視する
      // ホスト名に#を使われると都合が悪い
      var skipStr = '#';

      // セクションに分ける
      for (i = 0; i < lines.length; i++) {
        line = lines[i];

        // 途中でゴミが登場したら、それ以降はセクションとみなさない
        if (line.indexOf(skipStr) >= 0) {
          isSection = false;
          continue;
        }

        // セクションの開始を検出
        if (line.indexOf(startStr) >= 0) {
          isSection = true;
          continue; // その行は不要
        }

        // セクションのなかにいるときの処理
        if (isSection) {
          if (line.length < 68) {
            // こんなに短いはずはないので、ホスト名が長すぎて2行に分割されてるか、空白行か。
            if (line.trim().length > 0) {
              n.push(line);
            }
            continue;
          }

          if (line.lastIndexOf(' ', 0) === 0) {
            // 先頭が空白なら、分割された2行目と判断
            n.push(line);
            neighborTextArray.push(n);
            n = [];
            continue;
          }

          n.push(line);
          neighborTextArray.push(n);
          n = [];
        }
      }

      return neighborTextArray;
    }

    function neighborTextArray2neighborObjects(neighborTextArray) {
      var neighbors = [];
      var i;
      var n;
      for (i = 0; i < neighborTextArray.length; i++) {
        n = makeNeighbor(neighborTextArray[i]);
        if (n !== null) {
          neighbors.push(n);
        }
      }

      return neighbors;
    }

    // プロトタイプ
    // neighbor
    var proto_neighbor = {
      device_id: undefined,
      local_interface: undefined,
      holdtime: undefined,
      capability: undefined,
      platform: undefined,
      port_id: undefined
    };

    // 文字列配列を受け取ってneighborオブジェクトに変換する
    function makeNeighbor(strs) {
      // strs配列の中身はこういう感じ
      /*
          1         2         3         4         5         6         7
01234567890123456789012345678901234567890123456789012345678901234567890123456789
Device ID        Local Intrfce     Holdtme    Capability  Platform  Port ID
E-Cat3750X-41Stack
                 Ten 2/4/4         169            R T S I WS-C3750X Ten 2/1/2
      */

      var neighbor = Object.create(proto_neighbor);

      // strsは1行の場合と2行の場合がある
      var str;
      if (strs.length === 1) {
        // 1行の場合、17文字目までがdevice id
        str = String() + strs[0];
        neighbor.device_id = str.substr(0, 17).trim();
      } else {
        // 2行の場合、1行目に格納されているのはdevice_id
        neighbor.device_id = String() + strs[0];
        str = String() + strs[1];
      }

      if (str.length >= 35) {
        neighbor.local_interface = str.slice(17, 35).trim();
      }
      if (str.length >= 46) {
        neighbor.holdtime = str.slice(35, 46).trim();
      }
      if (str.length >= 58) {
        neighbor.capability = str.slice(46, 58).trim();
      }
      if (str.length >= 68) {
        neighbor.platform = str.slice(58, 68).trim();
      }
      if (str.length > 68) {
        neighbor.port_id = str.substr(68).trim();
      }

      return neighbor;
    }

    var SAMPLE_LINES = [
      'WS-C6880X-01#show cdp ne',
      'Load for five secs: 8%/1%; one minute: 6%; five minutes: 6%',
      'Time source is NTP, 20:17:47.804 JST Thu Jan 7 2016',
      '',
      'Capability Codes: R - Router, T - Trans Bridge, B - Source Route Bridge',
      '                  S - Switch, H - Host, I - IGMP, r - Repeater, P - Phone, ',
      '                  D - Remote, C - CVTA, M - Two-port Mac Relay ',
      '',
      'Device ID        Local Intrfce     Holdtme    Capability  Platform  Port ID',
      'WS-C3750X--41Stack',
      '                 Ten 2/4/4         147            R T S I WS-C3750X Ten 2/1/2',
      'WS-C3750X--41Stack',
      '                 Ten 2/4/3         175            R T S I WS-C3750X Ten 1/1/2',
      'WS-C3750X--41Stack',
      '                 Ten 1/4/4         147            R T S I WS-C3750X Ten 2/1/1',
      'WS-C3750X--41Stack',
      '                 Ten 1/4/3         175            R T S I WS-C3750X Ten 1/1/1',
      'WS-C3750X--17Stack',
      '                 Ten 2/2/5         153             R S I  WS-C3750X Gig 2/1/1',
      'WS-C3750X--17Stack',
      '                 Ten 1/2/5         153             R S I  WS-C3750X Gig 1/1/1',
      'WS-C3750X--25Stack',
      '                 Ten 2/2/7         173             R S I  WS-C3750X Ten 2/1/2',
      'WS-C3750X--07Stack',
      '                 Ten 2/2/8         168              S I   WS-C3750X Gig 2/1/1',
      'WS-C3750X--25Stack',
      '                 Ten 2/2/6         173             R S I  WS-C3750X Ten 1/1/2',
      'WS-C3750X--07Stack',
      '                 Ten 1/2/8         168              S I   WS-C3750X Gig 1/1/1',
      'WS-C3750X--25Stack',
      '                 Ten 1/2/7         173             R S I  WS-C3750X Ten 2/1/1',
      'WS-C3750X--25Stack',
      '                 Ten 1/2/6         173             R S I  WS-C3750X Ten 1/1/1',
      'WS-C3750X--11Stack',
      '                 Ten 2/4/7         141              S I   WS-C3750X Gig 2/1/1',
      'WS-C3750X--11Stack',
      '                 Ten 1/4/7         141              S I   WS-C3750X Gig 1/1/1',
      'WS-C3750X--23Stack',
      '                 Ten 2/4/6         144             R S I  WS-C3750X Ten 2/1/2',
      'WS-C3750X--23Stack',
      '                 Ten 2/4/5         144             R S I  WS-C3750X Ten 1/1/2',
      'WS-C3750X--23Stack',
      '                 Ten 1/4/6         144             R S I  WS-C3750X Ten 2/1/1',
      'WS-C3750X--23Stack',
      '                 Ten 1/4/5         144             R S I  WS-C3750X Ten 1/1/1',
      'WS-C3750X--09Stack',
      '                 Ten 2/2/10        133              S I   WS-C3750X Gig 2/1/2',
      'WS-C3750X--09Stack',
      '                 Ten 2/2/9         133              S I   WS-C3750X Gig 1/1/2',
      '          ',
      'Device ID        Local Intrfce     Holdtme    Capability  Platform  Port ID',
      'WS-C3750X--09Stack',
      '                 Ten 1/2/9         132              S I   WS-C3750X Gig 1/1/1',
      'WS-C3750X--09Stack',
      '                 Ten 1/2/10        132              S I   WS-C3750X Gig 2/1/1',
      'WS-C3750X--39Stack',
      '                 Ten 2/2/4         171             R S I  WS-C3750X Gig 2/0/48',
      'WS-C3750X--39Stack',
      '                 Ten 2/2/3         171             R S I  WS-C3750X Gig 1/0/48',
      'WS-C3750X--39Stack',
      '                 Ten 1/2/4         171             R S I  WS-C3750X Gig 2/0/47',
      'WS-C3750X--39Stack',
      '                 Ten 1/2/3         171             R S I  WS-C3750X Gig 1/0/47',
      'WS-C4500X--19VSS Ten 2/3/9         132             R S I  WS-C4500X Ten 2/1/4',
      'WS-C4500X--19VSS Ten 2/1/9         131             R S I  WS-C4500X Ten 1/1/4',
      'WS-C4500X--19VSS Ten 1/3/9         131             R S I  WS-C4500X Ten 2/1/3',
      'WS-C4500X--19VSS Ten 1/1/9         131             R S I  WS-C4500X Ten 1/1/3',
      'WS-C4500X--19VSS Ten 2/3/10        137             R S I  WS-C4500X Ten 2/1/6',
      'WS-C4500X--19VSS Ten 2/1/10        135             R S I  WS-C4500X Ten 1/1/6',
      'WS-C4500X--19VSS Ten 1/1/10        135             R S I  WS-C4500X Ten 1/1/5',
      'WS-C4500X--19VSS Ten 1/3/10        134             R S I  WS-C4500X Ten 2/1/5',
      'WS-C4500X--19VSS Ten 2/1/11        157             R S I  WS-C4500X Ten 1/1/2',
      'WS-C4500X--19VSS Ten 1/1/11        138             R S I  WS-C4500X Ten 1/1/1',
      'WS-C4500X--19VSS Ten 2/3/11        157             R S I  WS-C4500X Ten 2/1/2',
      'WS-C4500X--19VSS Ten 1/3/11        156             R S I  WS-C4500X Ten 2/1/1',
      'WS-C4500X--09VSS Ten 2/2/1         119             R S I  WS-C4500X Ten 1/1/4',
      'WS-C4500X--09VSS Ten 2/2/2         120             R S I  WS-C4500X Ten 2/1/4',
      'WS-C4500X--09VSS Ten 1/2/1         119             R S I  WS-C4500X Ten 1/1/3',
      'WS-C4500X--09VSS Ten 1/2/2         134             R S I  WS-C4500X Ten 2/1/3',
      'WS-C4500X--01VSS Ten 2/4/2         162             R S I  WS-C4500X Ten 2/1/4',
      'WS-C4500X--01VSS Ten 2/4/1         162             R S I  WS-C4500X Ten 1/1/4',
      'WS-C4500X--01VSS Ten 1/4/1         135             R S I  WS-C4500X Ten 1/1/3',
      'WS-C4500X--01VSS Ten 1/4/2         135             R S I  WS-C4500X Ten 2/1/3',
      'WS-C3560-24--02  Ten 1/4/8         159             R S I  WS-C3560- Gig 0/1',
      'WS-C3850--01Stack',
      '                 Ten 2/4/10        170             R S I  WS-C3850- Gig 2/0/2',
      'WS-C3850--01Stack',
      '                 Ten 1/4/10        133             R S I  WS-C3850- Gig 2/0/1',
      'WS-C3850--01Stack',
      '                 Ten 2/4/9         175             R S I  WS-C3850- Gig 1/0/2',
      'WS-C3850--01Stack',
      '                 Ten 1/4/9         151             R S I  WS-C3850- Gig 1/0/1',
      'WS-C6880X-01# '
    ];

    // 外部からデータを取得するための公開関数
    exports.sampleLines = function(_) {
      if (!arguments.length) {
        return SAMPLE_LINES;
      }
      SAMPLE_LINES = _;
      return this;
    };

    exports.sampleText = function(_) {
      if (!arguments.length) {
        return SAMPLE_LINES.join('\n');
      }
      SAMPLE_LINES = _.split(/\r\n|\r|\n/);
      return this;
    };

    // カスタムイベントを'on'で発火できるようにリバインドする
    // v3までのやり方
    // d3.rebind(exports, dispatch, 'on');
    // v4のやり方
    exports.on = function() {
      var value = dispatch.on.apply(dispatch, arguments);
      return value === dispatch ? exports : value;
    };

    return exports;
  };
  //
})();
