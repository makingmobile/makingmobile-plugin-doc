/*jslint sub:true */
var path = require('path'),
    fs = require('fs'),
    crypto = require('crypto'),
    compressor = require('node-minify'),
    fsutil = require('../makingmobile/lib/util/fs.js'),
    mkdirr = fsutil.mkdirr,
    rmdirr = fsutil.rmdirr,
    _tmpdir = path.resolve(require('os').tmpdir(), 'makingmobile', 'autoupdate'),
    _config, _rootdir;


function _parseBundleHtml (htmlstr) {
    var res = {},
        bundlesec = [],
        m, tmpstr, tmparr, idx1, idx2, d, s, i, j;
    
    m = htmlstr.match(/<head>([\s\S]*?)<\/head>/im);
    if(!m) return {};
    tmpstr = m[1];
    while(!!(idx1 = tmpstr.search(/<!--\s+bundle\s+(js|css)/))){
        idx2 = tmpstr.substr(idx1).search(/<!--\s+bundle\s+end\s+-->/);
        if (idx2 === -1) break;
        bundlesec.push(tmpstr.substring(idx1, idx1 + idx2));
        tmpstr = tmpstr.substr(idx1 + idx2);
    }
    for(i = 0; i < bundlesec.length; i++){
        m = bundlesec[i].match(/<!--\s+bundle\s+js\s?:\s*(.*)\s+-->([\s\S]*)/);
        if(m){
            d = m[1];
            tmpstr = m[2]; 
            tmparr = tmpstr.match(/<script(.*?)src=(.*?)(.*?)>/ig);
            if (tmparr){
                res[d] = [];
                for(j = 0; j < tmparr.length; j++){
                    s = tmparr[j].match(/src=('|")([^'"]*)('|")/);
                    if (s && s.length === 4){
                        res[d].push(s[2]);
                    }
                }
            }
        } else {
            m = bundlesec[i].match(/<!--\s+bundle\s+css\s?:\s*(.*)\s+-->([\s\S]*)/);
            if(m){
                d = m[1];
                tmpstr = m[2]; 
                tmparr = tmpstr.match(/<link(.*?)href=(.*?)(.*?)>/ig);
                if (tmparr){
                    res[d] = [];
                    for(j = 0; j < tmparr.length; j++){
                        s = tmparr[j].match(/href=('|")([^'"]*)('|")/);
                        if (s && s.length === 4){
                            res[d].push(s[2]);
                        }
                    }
                }
            }
        }
    }
    return res;
}

function _bundle (dfile, sfileArr) {
    var dir = path.resolve(dfile, '..'),
        outstr = '',
        i;
    
    if (!fs.existsSync(dir)) {
        mkdirr(dir);
    }
    for (i = 0; i < sfileArr.length; i++){
        if (!fs.existsSync(sfileArr[i])) {
            console.trace();
            throw 'Autoupdater: bundle file "' + sfileArr[i] + '" does not exist';
        }
        outstr += '/* --------> Start of file: ' + sfileArr[i] + ' */\n';
        outstr += fs.readFileSync(sfileArr[i], {encoding: 'utf-8'});
        outstr += '/* <-------- End of file: ' + sfileArr[i] + ' */\n\n';
    }
    fs.writeFileSync(dfile, outstr, {encoding: 'utf8'});
}

function denormalizepath(p) {
    return p.split(path.sep).join('/');
}

function _fromSource () {
    var source = _config['source'],
        key = null, key2 = null, currSource = null, currDestination = null,
        ignore = null, bundle = null, rename = null,
        bfs = null, farr = null, 
        tmp, i, j;
    
    function copysource(currentdir){
        var farr = fs.readdirSync(path.resolve(currSource, currentdir)),
            skip = false,
            content, i, j;
        
        for(i = 0; i < farr.length; i++){
            skip = false;
            for(j = 0; j < ignore.length; j++){
                if (ignore[j] instanceof RegExp) {
                    if (denormalizepath(path.join(currentdir, farr[i])).match(ignore[j])) {
                        skip = true;
                        break;
                    }
                } else {
                    if (denormalizepath(path.join(currentdir, farr[i])) === ignore[j]) {
                        skip = true;
                        break;
                    }
                }
            }
            if (skip) continue;
            for(j = 0; j < bfs.length; j++){
                if (denormalizepath(bfs[j]) === denormalizepath(path.resolve(currSource, currentdir, farr[i]))){
                    skip = true;
                    break;
                }
            }
            if (skip) continue;
            if(fs.lstatSync(path.resolve(currSource, currentdir, farr[i])).isDirectory()){
                fs.mkdirSync(path.resolve(currDestination, currentdir, farr[i]));
                copysource(path.join(currentdir, farr[i]));
            } else {
                content = fs.readFileSync(path.resolve(currSource, currentdir, farr[i]));
                fs.writeFileSync(path.resolve(currDestination, currentdir, farr[i]), content);
            }
        }
    }
    
    
    //clear tmpdir
    farr = fs.readdirSync(_tmpdir);
    for(i = 0; i < farr.length; i++){
        if(fs.lstatSync(path.join(_tmpdir, farr[i])).isDirectory()){
            rmdirr(path.join(_tmpdir, farr[i]));
        }
    }
    //copy
    for(i = 0; i < source.length; i++){
        currDestination = path.join(_tmpdir, '' + i);
        fs.mkdirSync(currDestination);
        currSource = path.resolve(_rootdir, source[i]['from']);
        console.log('Autoupdater: copy from ' + currSource);
        ignore = source[i]['ignore'] || [];
        bundle = source[i]['bundle'] || {};
        rename = source[i]['rename'] || {};
        bfs = [];
        for(key in bundle){
            if (bundle.hasOwnProperty(key)){
                if (bundle[key] instanceof Array) {
                    for (j = 0; j < bundle[key].length; j++){
                        bfs.push(path.resolve(currSource, bundle[key][j]));
                    }
                } else {
                    tmp = _parseBundleHtml(fs.readFileSync(path.resolve(currSource, bundle[key]), {encoding: 'utf8'}));
                    for (key2 in tmp) {
                        for (j = 0; j < tmp[key2].length; j++){
                            bfs.push(path.resolve(currSource, bundle[key], '..', tmp[key2][j]));
                        }
                    }
                }
            }
        }
        copysource('.');
        //do bundle
        for (key in bundle){
            if (bundle.hasOwnProperty(key)){
                if (bundle[key] instanceof Array) {
                    bfs = [];
                    for (j = 0; j < bundle[key].length; j++){
                        bfs.push(path.resolve(currSource, bundle[key][j]));
                    }
                    console.log('Autoupdater: bundling file ' + key);
                    _bundle(path.resolve(currDestination, key), bfs);
                } else {
                    tmp = _parseBundleHtml(fs.readFileSync(path.resolve(currSource, bundle[key]), {encoding: 'utf8'}));
                    for (key2 in tmp) {
                        if (!tmp.hasOwnProperty(key2)) continue;
                        bfs = [];
                        for (j = 0; j < tmp[key2].length; j++){
                            bfs.push(path.resolve(currSource, bundle[key], '..', tmp[key2][j]));
                        }
                        console.log('Autoupdater: bundling file ' + key2);
                        _bundle(path.resolve(currDestination, key2), bfs);
                    }
                }
            }
        }
        //rename
        for (key in rename){
            if (rename.hasOwnProperty(key)){
                if (!fs.existsSync(path.resolve(currDestination, key))) {
                    console.trace();
                    throw 'Autoupdater: rename source file "' + path.resolve(currDestination, key) + '" does not exist';
                }
                if (fs.existsSync(path.resolve(currDestination, rename[key]))) {
                    console.trace();
                    throw 'Autoupdater: rename destination file "' + path.resolve(currDestination, rename[key]) + '" already exist';
                }
                if (!fs.existsSync(path.resolve(currDestination, rename[key], '..'))){
                    mkdirr(path.resolve(currDestination, rename[key], '..'));
                }
                tmp = fs.readFileSync(path.resolve(currDestination, key));
                fs.writeFileSync(path.resolve(currDestination, rename[key]), tmp);
                fs.unlinkSync(path.resolve(currDestination, key));
            }
        }
    }
}

function _safeCopy (from, to) {
    var farr = fs.readdirSync(from),
        content, i;
    
    for (i = 0; i < farr.length; i++) {
        if (fs.lstatSync(path.join(from, farr[i])).isDirectory()){
            if (!fs.existsSync(path.join(to, farr[i]))) {
                fs.mkdirSync(path.join(to, farr[i]));
            }
            _safeCopy(path.join(from, farr[i]), path.join(to, farr[i]));
        } else {
            if (!fs.existsSync(path.join(to, farr[i]))) {
                content = fs.readFileSync(path.join(from, farr[i]));
                fs.writeFileSync(path.join(to, farr[i]), content);
            }
        }
    }
}

function _minify (fileArr, next) {
    function _dominify(){
        var f = fileArr.pop(),
            type = 'yui-css',
            arr;
        
        if (!f){
            return next();
        } else {
            arr = f.split('.');
        }
        if (arr.length > 1){
            if (arr[arr.length - 1].toLowerCase() === 'css') {
                type = 'yui-css';
            } else if (arr[arr.length - 1].toLowerCase() === 'js') {
                type = 'yui-js';
            }
        }
        new compressor.minify({
            type: type,
            fileIn: f,
            fileOut: f,
            callback: function(err){
                if (err) {
                    next(err);
                } else {
                    process.nextTick(function(){
                        _dominify();
                    });
                }
            }
        });
    }
    _dominify();
}

function _findMinify (dir, ignore, minifyJs, minifyCss) { 
    var res = [],
        farr = fs.readdirSync(dir),
        skip = false,
        arr, i, j;
    
    if (!minifyJs && !minifyCss) return [];
    
    for (i = 0; i < farr.length; i++) {
        skip = false;
        for (j = 0; j < ignore.length; j++){
            if (denormalizepath(path.join(dir, farr[i])) === denormalizepath(ignore[j])){
                skip = true;
                break;
            }
        }
        if (skip) continue;
        if (fs.lstatSync(path.join(dir, farr[i])).isDirectory()){
            res = res.concat(_findMinify(path.join(dir, farr[i]), ignore));
        } else {
            arr = farr[i].split('.');
            if (arr.length > 1){
                if ((arr[arr.length - 1].toLowerCase() === 'css' && !!minifyJs) || (arr[arr.length - 1].toLowerCase() === 'js' && !!minifyCss)){
                    res.push(path.join(dir, farr[i]));
                }
            }
        }
    }
    return res;
}

function _makemd5 (dir) {
    var res = {},
        farr = fs.readdirSync(dir),
        hash, md5, content, i;
    
    for (i = 0; i < farr.length; i++) {
        if (fs.lstatSync(path.join(dir, farr[i])).isDirectory()) {
            res[farr[i]] = {items: _makemd5(path.join(dir, farr[i]))};
        } else {
            hash = crypto.createHash('md5');
            content = fs.readFileSync(path.join(dir, farr[i]));
            hash.update(content);
            md5 = hash.digest('hex');
            res[farr[i]] = {md5: md5};
        }
    }
    return res;
}

function _buildRepository (next) {
    var destination = _config['destination'],
        repository_dir = null, repository_file = null,
        now =  (new Date()).toISOString(),
        res, i;
    
    console.log('Autoupdater: building repository... ');
    for (i = 0; i < destination.length; i++){
        if (destination[i]['repository-meta-filename']) {
            repository_dir = path.resolve(_rootdir, destination[i]['path']);
            repository_file = destination[i]['repository-meta-filename'];
            break;
        }
    }
    if (repository_dir) {
        res = _makemd5(repository_dir);
        res[repository_file] = {md5: now};
        res = {'lastupdate': now, 'root': {"items": res}};
        fs.writeFileSync(path.join(repository_dir, repository_file), JSON.stringify(res), {encoding: 'utf8'});
        next();
    } else {
        next();
    }
}

function _toDestination (next) {
    var destination = _config['destination'],
        minify_arr = [], to = null,
        copy_sources, skip,
        i, j, k;
    
    for (i = 0; i < destination.length; i++) {
        if (fs.existsSync(path.resolve(_rootdir, destination[i]['path'])) && destination[i]['cleanBeforeBuild']) {
            rmdirr(path.resolve(_rootdir, destination[i]['path']));
        }
        destination[i]["skip-source"] = destination[i]["skip-source"] || [];
        destination[i]["minify-ignore"] = destination[i]["minify-ignore"] || [];
        copy_sources = [];
        for (j = 0; j < _config['source'].length; j++){
            skip = false;
            for (k = 0; k < destination[i]["skip-source"].length; k++){
                if (_config['source'][j]['from'] === destination[i]["skip-source"][k]){
                    skip = true;
                    break;
                }
            }
            if (!skip) copy_sources.push({
                idx: j,
                to: _config['source'][j]['to']
            });
        }
        for (j = 0; j < copy_sources.length; j++){
            to = path.resolve(_rootdir, destination[i]['path'], copy_sources[j]['to']);
            if(!fs.existsSync(to)){
                mkdirr(to);
            }
            _safeCopy(path.resolve(_tmpdir, '' + copy_sources[j]['idx']), to);
        }
        destination[i]['minify-ignore'] = destination[i]['minify-ignore'] || [];
        for (j = 0; j < destination[i]['minify-ignore'].length; j++){
            destination[i]['minify-ignore'][j] = path.resolve(to, destination[i]['minify-ignore'][j]);
        }
        minify_arr = minify_arr.concat(_findMinify(to, destination[i]['minify-ignore'], destination[i]['minify-js'], destination[i]['minify-css']));
    }
    console.log('Autoupdater: minifying files ... ');
    _minify(minify_arr, function(err){
        if (err){
            next('error when minify files -- ' + err);
        } else {
            _buildRepository(next);
        }
    });
}

function update (plugin_config, rootdir, next) {
    plugin_config['source'] = plugin_config['source'] || [];
    plugin_config['destination'] = plugin_config['destination'] || [];
    if (!fs.existsSync(_tmpdir)) {
        mkdirr(_tmpdir);
    }
    _config = plugin_config;
    _rootdir = rootdir;
    console.log('Autoupdater: Updating... ');
    _fromSource();
    _toDestination(function(err) {
        if (err){
            next('Autoupdater: ' + err);
        } else {
            console.log('Done');
            next();
        }
    });
}

module.exports = update;
