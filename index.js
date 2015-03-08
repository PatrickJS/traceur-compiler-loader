'use strict';

var extend = require('extend-object');
var loaderUtils = require('loader-utils');
var SourceNode = require("source-map").SourceNode;
var SourceMapConsumer = require("source-map").SourceMapConsumer;
var os = require('os');
var path = require('path');
var traceur = require('traceur');

var defaults = {
  modules: 'commonjs',
  runtime: false,
  sourceMaps: true
};

module.exports = function(source, originalSourceMap) {
  if (this.cacheable) this.cacheable();
  var filename = loaderUtils.getRemainingRequest(this);
  var content = source;
  var map;
  var result;
  var runtime;
  var imports;
  var moduleName = filename;

  // Process query and setup options/defaults/forced for Traceur
  var options = extend({}, defaults, loaderUtils.parseQuery(this.query));


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


  // relative module names
  if (options.moduleName) {
    var interpolateName = options.interpolateName || this.interpolateName;
    if (interpolateName) {
      moduleName = loaderUtils.urlToRequest(this, interpolateName, {
        content: source,
        context: this.context,
        regExp: options.regExp || null
      });
    } else {
      var directory = '';
      var resourcePath = this.resourcePath;
      directory = path.relative(this.context, resourcePath + "_").replace(/\\/g, "/").replace(/\.\.(\/)?/g, "_$1");
      directory = directory.substr(0, directory.length-1);
      moduleName = directory;
    }
  }


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
    // console.log('options.moduleName:', options.moduleName);
    var compiler = new traceur.NodeCompiler(options, this.context);
    result = compiler.compile(content, moduleName);
    // console.log('result:', result);

    // Include runtime after compilation due to generators hoisting the
    // runtime usage to the very top

    // Process source map (if available) and return result
    if (options.sourceMaps && originalSourceMap) {
      var node = SourceNode.fromStringWithSourceMap(result, new SourceMapConsumer(originalSourceMap));
      if (runtime) {
        node.prepend('require("' + imports + '' + traceur.RUNTIME_PATH + '");');
      }
      // node.add(postfix);
      var newSource = node.toStringWithSourceMap({
        file: filename
      });
      this.callback(null, newSource.code, newSource.map.toJSON());
    }
    else if (options.sourceMaps) {
      if (runtime) {
        result = 'require("' + imports + '' + traceur.RUNTIME_PATH + '");' + result;
      }
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
