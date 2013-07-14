/*jslint sub:true */
var CMDS = ['  last n \t show last n log entries in database'],
    LEVEL_INFO = 10,
    LEVEL_DEBUG = 20,
    LEVEL_WARN = 30,
    LEVEL_ERROR = 40,
    format = require('util').format,
    path = require('path'),
    fs = require('fs');

function find_plugin_config(config) {
    for (var i = 0; i < config.plugins.length; i++) {
        if (config.plugins[i].name === 'log') {
            return config.plugins[i];
        }
    }
    return null;
}

function showLast (n, db, collection) {
    collection.find({}, {
        'limit': n,
        'sort': 'time'
    }).toArray(function(err, logs) {
        var levelstr, i, data;
        
        if (err) {
            console.error(err);
            return db.close();
        }
        
        for (i = 0; i < logs.length; i++) {
            levelstr = 'info: ',
            data = '-----> + ';
        
            if (logs[i].level === LEVEL_DEBUG) {
                levelstr = 'debug: ';
            } else if (logs[i].level === LEVEL_WARN) {
                levelstr = 'warn: ';
            } else if (logs[i].level === LEVEL_ERROR) {
                levelstr = 'error: ';
            }
            data += levelstr;
            data += format('%s %s \n', logs[i].time, logs[i].zone);
            data += JSON.stringify(logs[i].msg) + '\n';
            //data += '<-----';
            console.log(data);
        }
        db.close();
    });
}

function docmd (argv, config, rootdir) {
    var MongoClient = require('mongodb').MongoClient,
        pconfig = {},
        n;
    if (argv.length === 0 || argv[0] === '-h' || argv[0] === '--help') {
        return console.log('Available commands: \n' + CMDS[0] + '\n');
    }
    if (argv.length === 2 && argv[0] === 'last') {
        n = Number(argv[1]);
        if (n > 0 && n < 1000) {
            pconfig = find_plugin_config(config);
            if (!pconfig.db) {
                return console.log('db-log is disabled, please use tail to see entries in file.');
            }
            MongoClient.connect(pconfig.db, function(err, db) {
                if(err) throw err;
                var collection = db.collection(pconfig.collection);
                showLast(n, db, collection);
            });
        } else {
            console.log('param n must between 0 and 1000');
        }
    }
}

function build (config, rootdir, next) {
    var pconfig = find_plugin_config(config),
        MongoClient = require('mongodb').MongoClient;
    
    if(pconfig.db) {
        MongoClient.connect(pconfig.db, function(err, db) {
            if (err) {
                console.error(err);
                console.error('Cannot open:' + pconfig.db);
                //Process will halt when MongoClient.connect has error
                process.exit(1);
                //next('log');
            } else {
                db.close();
                next();
            }
        });
    } else {
        next();
    }
}

function init (mm) {
    var Log = require('./log'),
        pconfig = find_plugin_config(mm.config);
    
    if(pconfig.file && !fs.existsSync(path.resolve(mm._rootdir, pconfig.file, '..'))){
        mm.util.fs.mkdirr(path.resolve(rootdir, pconfig.file, '..'));
    }
    new Log(mm, pconfig);
}

exports.docmd = docmd;
exports.build = build;
exports.post_build = null;
exports.init = init;
exports.post_init = null;