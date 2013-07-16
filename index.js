/*jslint sub:true */
var CMDS = ['  info \t show convert status information'],
    PYTHON_VERSION = '2.7',
    IMAGEMAGICK_VERSION = '6.7.6',
    TAG_ERROR = 'error',
    path = require('path'),
    fs = require('fs'),
    Doc = require('./doc'),
    exec = require('child_process').exec;

function find_plugin_config(config) {
    for (var i = 0; i < config.plugins.length; i++) {
        if (config.plugins[i].name === 'doc') {
            return config.plugins[i];
        }
    }
    return null;
}

function info (rootdir, pconfig) {
    var rootfolder = path.resolve(rootdir, pconfig.docfolder),
        errlist = [],
        count = 0,
        errcount = 0,
        j;
    
    function _find (dir) {
        var ds = fs.readdirSync(path.join(rootfolder, dir)),
            filename, i;
        if (ds.length === 0) return;
        if (fs.existsSync(path.join(rootfolder, dir, 'origin'))) {
            count++;
            if (fs.existsSync(path.join(rootfolder, dir, TAG_ERROR))) {
                filename = fs.readdirSync(path.join(rootfolder, dir, 'origin'))[0];
                errlist.push(path.resolve(rootfolder, dir, 'origin', filename));
                errcount++;
            }
            return;
        }
        for (i = 0; i < ds.length; i++) {
            if (fs.lstatSync(path.join(rootfolder, dir, ds[i])).isDirectory()) {
                _find(path.join(dir, ds[i]));
            }  
        }
        return;
    }
    process.stdout.write('\nGathering doc convert status information... ');
    _find('.');
    process.stdout.write('done\n\n');
    if (errcount > 0) {
        console.log('Error converting ' + errcount + ':\n');
        for (j = 0; j < errlist.length; j++) {
            console.log('  ' + errlist[j]);
        }
        console.log('\n');
    }
    console.log('  Total docs: ' + count + ', Total error: ' + errcount);
}

function docmd (argv, config, rootdir) {
    var pconfig = {};
    if (argv.length === 0 || argv[0] === '-h' || argv[0] === '--help') {
        return console.log('Available commands: \n' + CMDS[0] + '\n');
    }
    if (argv[0] === 'info') {
        pconfig = find_plugin_config(config);
        info(rootdir, pconfig);
    }
}

function check_python (next) {
    exec('python -V', function(error, stdout, stderr) {
        if (error) {
            next('Python no found');
        } else if (('' + stderr).indexOf(PYTHON_VERSION) === -1){
            next('Bad version: ' + stderr + ' But Python ' + PYTHON_VERSION + '.x is needed');
        } else {
            next();
        }
    });
}

function check_imageMagick (next) {
    exec('convert --version', function(error, stdout, stderr) { 
        if (error) {
            next('Command "convert" no found -- perhaps imageMagick and Ghostscript not installed, or not in path environment variables');
        } else if (('' + stdout).indexOf(IMAGEMAGICK_VERSION) === -1){
            next('Bad imageMagick version --- ' + IMAGEMAGICK_VERSION + ' is needed');
        } else {
            next();
        }
    });
}

function pdfconvert_test (rootdir, pconfig, next) {
    var script = path.resolve(__dirname, 'support', 'scripts', pconfig.msoffice2pdf ? 'msoffice2pdf.py' : 'unoconv'),
        pathstr = path.resolve(__dirname, 'support', 'convertest', 'test'),
        cmdstr = 'python "' + script + '"' + ' -o "' + pathstr + '.pdf" "' + pathstr + '.docx"',
        option = {};
    
    option = {
        timeout: 60 * 2 * 1000
    };
    exec(cmdstr, option, function(error, stdout, stderr) { 
        if (error) {
            next('pdf convert fail -- please check office environment');
        } else if (fs.existsSync(path.join(__dirname, 'test.pdf'))){
            next('pdf convert fail -- please check office environment');
        } else {
            next();
        }
    });
}

function imageconvert_test (rootdir, pconfig, next) {
    var cmdstr = 'convert -density 96 test.pdf test.png',
        option = {};
    
    option = {
        timeout: 60 * 1 * 1000,
        cwd: path.join(__dirname, 'support', 'convertest')
    };
    exec(cmdstr, option, function(error, stdout, stderr) { 
        if (error) {
            next('image convert fail -- please check imageMagick and Ghostscript environment');
        } else if (fs.existsSync(path.join(__dirname, 'test.pdf'))){
            next('image convert fail -- please check imageMagick and Ghostscript environment');
        } else {
            next();
        }
    });
}

function build (config, rootdir, next) {
    var pconfig = find_plugin_config(config);
    
    if (fs.existsSync(path.join(__dirname, 'convertest', 'test-0.png'))) {
        console.log('Doc converter: found test result image files, bypass convert test');
    } else {
        console.log('Doc converter: testing python...');
        check_python(function(err) {
            if (err) {
                console.log('\t' + err);
                next('Doc-plugin fail');
            } else {
                console.log('Doc converter: testing imageMagick and Ghostscript...');
                check_imageMagick(function(err) {
                    if (err) {
                        console.log('\t' + err);
                        next('Doc-plugin fail');
                    } else {
                        console.log('Doc converter: testing pdf convert...');
                        pdfconvert_test(rootdir, pconfig, function(err) {
                            if (err) {
                                console.log('\t' + err);
                                next('Doc-plugin fail');
                            } else {
                                console.log('Doc converter: testing pdf convert...');
                                imageconvert_test(rootdir, pconfig, function(err) {
                                    if (err) {
                                        console.log('\t' + err);
                                        next('Doc-plugin fail');
                                    } else {
                                        console.log('Convert test success!');
                                        next();
                                    }
                                });
                            }
                        });
                    }
                });
            }
        });
    }
}

function init (mm) {
    var pconfig = find_plugin_config(mm.config),
        libreofficescript = path.resolve(__dirname, 'scripts', 'unoconv');
    
    //start a permanent listener to use by unoconv clients
    exec('python "' + libreofficescript + '" -l');
    new Doc(mm, pconfig);
}

exports.docmd = docmd;
exports.build = build;
exports.post_build = null;
exports.init = init;
exports.post_init = null;