/*jslint sub:true */
var PROP_NAME = 'doc',
    path = require('path'),
    fs = require('fs');

/*
 * nodeSide log-plugin class
 */
function MMP_log(mm, plugin_config){
    var self = this;
    this.config = plugin_config;
    this.mm = mm;
    this._buff = [];
    this._sendingData = '';
    mm.register(this, PROP_NAME);
    mm.app.use(this.mm.util.slash_url(this.mm.config.urlprefix) + this.mm.util.slash_url(this.config.urlspace), function(req, res, next) {
        self._remoteLog(req, res);
    });
}

MMP_log.prototype.info = MMP_log.prototype.log = function (msg) {
    this._add(LEVEL_INFO, msg);
};

MMP_log.prototype.debug = function (msg) {
    this._add(LEVEL_DEBUG, msg);
};

MMP_log.prototype.warn = MMP_log.prototype.warning = function (msg) {
    this._add(LEVEL_WARN, msg);
};

MMP_log.prototype.error = MMP_log.prototype.err = function (msg) {
    this._add(LEVEL_ERROR, msg);
};

MMP_log.prototype._add = function (level, msg, time, zone) {
    var levelstr = 'info: ',
        data = '-----> ',
        obj = {};
    
    if (time === undefined) {
        time = (new Date()).toISOString();
    }
    
    if (zone === undefined) {
        zone = this.mm.gateway.getZone();
    }
    
    if (level === LEVEL_DEBUG) {
        levelstr = 'debug: ';
    } else if (level === LEVEL_WARN) {
        levelstr = 'warn: ';
    } else if (level === LEVEL_ERROR) {
        levelstr = 'error: ';
    }
    data += levelstr;
    data += format('%s %s \n', time, zone);
    data += JSON.stringify(msg) + '\n';

    //Output to local console first
    console.log(data);
    
    obj = {
        time: time,
        level: level,
        zone: zone,
        msg: msg
    };
    if (this.config.file) {
        this._writetofile(obj);
    }
    if (this.config.db) {
        this._writetodb(obj);
    }
};

MMP_log.prototype._writetofile = function (obj) {
    var levelstr = 'info: ',
        data = '-----> ';
    
    if (obj.level === LEVEL_DEBUG) {
        levelstr = 'debug: ';
    } else if (obj.level === LEVEL_WARN) {
        levelstr = 'warn: ';
    } else if (obj.level === LEVEL_ERROR) {
        levelstr = 'error: ';
    }
    data += levelstr;
    data += format('%s %s \n', obj.time, obj.zone);
    data += JSON.stringify(obj.msg) + '\n';

    fs.appendFile(path.resolve(this.mm._rootdir, this.config.file), data, {encoding: 'utf8'}, function (err) {
        if (err) {
            console.log('Error when log to file: ' + err);
        }
    });
};

MMP_log.prototype._writetodb = function (obj) {
    var self = this;
    MongoClient.connect(this.config.db, function(err, db) {
        if(err) throw err;
        var collection = db.collection(self.config.collection);
        collection.insert({
            time: new Date(obj.time),
            level: obj.level,
            zone: obj.zone,
            msg: obj.msg
        }, function(err, logs) {
            if (err) {
                console.error('Error when log to db:' + err);
            }
            db.close();
        });
        
    });
};

MMP_log.prototype._remoteLog = function (req, res) {
    var self = this,
        txt = '',
        logarr = [],
        i;
    
    res.set('Access-Control-Allow-Credentials', 'true');
    res.set('Access-Control-Allow-Headers', req.headers['access-control-request-headers'] || 'origin, content-type');
    res.set('Access-Control-Allow-Origin', req.headers['origin'] || '*');
    res.set('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.set('Access-Control-Max-Age', '3628800');
    if (req.method.toUpperCase() === 'OPTINOS') {
        return res.end();
    }
    req.on('readable', function () {
        txt += req.read();
    });
    req.on('end', function() {
        try {
            logarr = JSON.parse(txt);
        } catch (e) {
            logarr = [];
        }
        for (i = 0; i < logarr.length; i++) {
            self._add(logarr[i].level, logarr[i].msg, logarr[i].time, logarr[i].zone);
        }
        res.send(200);
    });
};

module.exports = MMP_log;
