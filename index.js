'use strict';

var extend = require('extend-object');
var loaderUtils = require('loader-utils');
var SourceNode = require("source-map").SourceNode;
var SourceMapConsumer = require("source-map").SourceMapConsumer;
var os = require('os');
var traceur = require('traceur');

var defaults = {
  modules: 'commonjs',
  runtime: false,
  sourceMaps: true
};

module.exports = function(source, originalSourceMap) {
  var filename = loaderUtils.getRemainingRequest(this);
  var content = source;
  var map;
  var options = {};
  var result;
  var runtime;
  var imports;

  if (this.cacheable) {
    this.cacheable();
  }

  // Process query and setup options/defaults/forced for Traceur
  extend(options, defaults, loaderUtils.parseQuery(this.query));

  Object.keys(options).forEach(function(key) {
    switch(options[key]) {
      case 'true':
        options[key] = true;
        break;
      case 'false':
        options[key] = false;
        break;
      case 'undefined':
        options[key] = undefined;
        break;
      case 'null':
        options[key] = null;
        break;
    }
  });

  // Move runtime option from options to variable
  runtime = options.runtime;
  delete options.runtime;

  // Include imports
  imports = options.imports === false ? '' : 'imports?global=>window!';
  delete options.imports;

  // Handle Traceur runtime
  if (filename === traceur.RUNTIME_PATH) {
    return content;
  }



  // Parse code through Traceur
  try {
    delete options.runtime;
    var compiler = new traceur.NodeCompiler(options);
    result = compiler.compile(content, filename);

    // Include runtime after compilation due to generators hoisting the
    // runtime usage to the very top
    if (runtime) {
      result = 'require("' + imports + '' + traceur.RUNTIME_PATH + '");' + result;
    }

    // Process source map (if available) and return result
    if (options.sourceMaps) {
      map = JSON.parse(compiler.getSourceMap());
      map.sourcesContent = [source];
      this.callback(null, result, map);
    }
    else {
      return result;
    }
  }
  catch(errors) {
    throw new Error(errors.join(os.EOL));
  }
};

module.exports.runtime = traceur.RUNTIME_PATH;
