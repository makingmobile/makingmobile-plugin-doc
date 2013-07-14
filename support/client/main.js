/*jslint sub:true */
var LEVEL_INFO = 10,
    LEVEL_DEBUG = 20,
    LEVEL_WARN = 30,
    LEVEL_ERROR = 40,
    PROP_NAME = 'log';

/*
 * clientSide log-plugin class
 */
function MMP_log(mm, plugin_config){
    var self = this;
    this.config = plugin_config;
    this.mm = mm;
    this._ajax = mm.Ajax();
    this._buff = [];
    this._sendingData = '';
    if (this.mm.hasPhoneGap) {
        document.addEventListener("online", function() {
            self._send();
        }, false);
    }
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
    var levelstr = 'info: ';
    
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
    //Output to local console first
    console.log(levelstr + msg);
    
    if (this._buff.length >= this.config['client_buff_max']) {
        this._buff = this._buff.slice(2);
        this._buff.unshift({
            zone: zone,
            time: time,
            level: LEVEL_WARN,
            msg: 'buffer overflow'
        });
    }
    this._buff.push({
        zone: zone,
        time: time,
        level: level,
        msg: msg
    });
    this._send();
};

MMP_log.prototype._send = function () {
    var self = this,
        url = this.mm.config.url.replace(/\/$/, '') + 
              this.mm.util.slash_url(this.mm.config.urlprefix) +
              this.mm.util.slash_url(this.config.urlspace);
    
    if (this._buff.length === 0) return;
    
    if (this.mm.hasPhoneGap && navigator.connection.type === Connection.NONE) return;
    
    if (this._ajax.isCompleted()) {
        this._sendingData = JSON.stringify(this._buff);
        this._buff = [];
        this._ajax.send(url, this._sendingData, 1000, function() {
            setTimeout(function() {
                self._send();
            }, 10);
        }, function(){
            var c_buff = self._buff,
                i;
            self._buff = JSON.parse(self._sendingData);
            for (i = 0; i < c_buff.length; i++) {
                self._add(c_buff[i].level, c_buff[i].msg, c_buff[i].time, c_buff[i].zone);
            }
        });
    }
};


function plugin_init (mm, config) {
    var plugin_instance = new MMP_log(mm, config);
    mm.register(plugin_instance, PROP_NAME);
}

exports._init = plugin_init;
