module.exports = function (grunt) {
  var pkg = grunt.file.readJSON('package.json');

  grunt.file.defaultEncoding = 'utf-8';
  grunt.file.preserveBOM = true;

  grunt.initConfig({
    concat: {
      target_js: {
        // 元ファイルの指定
        src: [
          'static/d3.4.3.0/d3.js',
          'static/site/js/d3cdp.startup.js',
          'static/site/js/d3cdp.datamanager.js',
          'static/site/js/d3cdp.checkbox.js',
          'static/site/js/d3cdp.radiolink.js',
          'static/site/js/d3cdp.cdpChart.js'
          ],
        // 出力ファイルの指定
        dest: 'static/site/dist/d3cdp.js'
      },
      target_css: {
        src: [
          'static/site/css/d3cdp.css'
          ],
        dest: 'static/site/dist/d3cdp.css'
      }
    },

    uglify: {
      target_js: {
        files: {
          // 出力ファイル: 元ファイル
          'static/site/dist/d3cdp-min.js': ['static/site/dist/d3cdp.js']
        }
      }
    }
  });

  // プラグインのロード・デフォルトタスクの登録
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.registerTask('default', ['concat', 'uglify']);
};
