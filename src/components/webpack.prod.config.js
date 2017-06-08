// Webpack config for creating the production bundle.

var path = require('path');
var webpack = require('webpack');
var createLoaders = require('./webpack/createLoaders');
var CleanPlugin = require('clean-webpack-plugin');
var ExtractTextPlugin = require('extract-text-webpack-plugin');
var strip = require('strip-loader');

var relativeAssetsPath = 'static/dist/gen';
var assetsPath = path.join(__dirname, relativeAssetsPath);

var config = {
  devtool: 'source-map',
  context: path.resolve(__dirname),

  addVendor: function (name, relpath) {
    var abspath = path.join(__dirname, relpath);
    this.resolve.alias[name] = abspath;
    // this.module.noParse.push(new RegExp(abspath));
    this.entry.vendor.push(name);
  },

  entry: {
    educative: './index',
    vendor: [
        'jquery',
        'underscore',
        'bootstrap',
        'codemirror' ,
        'd3',
        'eventemitter2',
        'html5shiv',
        'jquery-ui',
        'katex',
        'markdown-it',
        'markdown-it-katex',
        'medium-editor',
        'pako',
        'perfect-scrollbar',
        'react',
        'react-bootstrap',
        'react-dnd',
        'react-router',
        'vivus'
    ]
  },
  output: {
    path: assetsPath,
    filename: "educative.prod.js",
    publicPath: '/dist/gen/',
  },
  module: {
    loaders: createLoaders({rootDirname: path.resolve(__dirname), isDebug: false})
  },
  progress: true,
  resolve: {
    root: __dirname,
    modulesDirectories: [
      'src',
      'node_modules'
    ],
    extensions: ['', '.json', '.js'],
    alias: { }
  },
  plugins: [
    new CleanPlugin([relativeAssetsPath]),

    // css files from the extract-text-plugin loader
    new ExtractTextPlugin('style.css'),
    // ignore dev config
    new webpack.IgnorePlugin(/\.\/dev/, /\/config$/),

    new webpack.optimize.CommonsChunkPlugin(
        'vendor',
        'vendor.prod.js'
      ),

    new webpack.ProvidePlugin({
        $: 'jquery',
        jQuery: 'jquery',
        "window.jQuery": 'jquery'
    }),

    // set global vars
    new webpack.DefinePlugin({
      'process.env': {
        // Useful to reduce the size of client-side libraries, e.g. react
        NODE_ENV: JSON.stringify('production')
      }
    }),

    // optimizations
    new webpack.optimize.DedupePlugin(),
    new webpack.optimize.OccurenceOrderPlugin(),
    new webpack.optimize.UglifyJsPlugin({
      compress: {
        warnings: false
      }
    })
  ]
};

config.addVendor('polyfills',"public/js/polyfills/polyfills.js");
config.addVendor('jquery-steps', "public/js/vendor/jquery-steps/jquery-steps.js");
config.addVendor('pace', "public/js/vendor/pace/pace.js");
config.addVendor('share-button',"public/js/vendor/share-button/dist/share-button.js");
config.addVendor('handsontable',"public/js/vendor/handsontable/handsontable.full.js");
//config.addVendor('jcrop',"public/js/vendor/jcrop/jcrop.js");

module.exports = config;

