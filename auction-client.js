var cheerio = require('cheerio');
var async = require('async');
var md5 = require('./md5.js');

exports.connect = function(email, password, securityAnswer, userCallback) {
  var request = require('request').defaults({jar:true});

  async.auto({
    loginHtml: function(callback, results) {
      request('http://www.easports.com/login', function(err, resp, body) {
        callback(null, cheerio.load(body));
      });
    },
    loginForm: ['loginHtml', function(callback, results) {
      callback(null, results.loginHtml('form[name="homepage_login_form"]'));
    }],
    loginFields: ['loginForm', function(callback, results) {
      callback(null, results.loginHtml('input', results.loginForm));
    }],
    submitLogin: ['loginFields', function(callback, results) {
      var url = results.loginForm[0].attribs.action;
      var headers = {'referer': 'http://www.easports.com/login'};
      var data = {};

      for (var i = 0; i < results.loginFields.length; i++) {
        var field = results.loginFields[i];
        data[field.attribs.name] = field.attribs.value;
      }
      data['email'] = email;
      data['password'] = password;

      request.post(url, {form: data, headers: headers}, function(err, resp, body) {
        callback(err, body);
      });
    }],
    accountInfo: ['submitLogin', function(callback, results) {
      request('http://www.easports.com/p/fut/a/card-pc/l/en_US/s/p/ut/game/fifa13/user/accountinfo?timestamp='+Date.now(), function(err, resp, body) {
        var json = JSON.parse(body);
        var res = {
          personaId: json.userAccountInfo.personas[0].personaId,
          personaDisplayName: json.userAccountInfo.personas[0].personaName,
          platform: json.userAccountInfo.personas[0].userClubList[0].platform,
        }
        callback(err, res);
      });
    }],
    mainPageHtml: ['submitLogin', function(callback, results) {
      request('http://www.easports.com/fifa/football-club/ultimate-team', function(err, resp, body) {
        callback(null, body);
      });
    }],
    userCode: ['mainPageHtml', function(callback, results) {
      var html = results.mainPageHtml;
      var regex = /xp1_qs\['ssv_custid'\] *= '(.*)';/;
      var match = regex.exec(html);
      callback(null, parseInt(match[1]));
    }],
    tradingAuth: ['accountInfo', 'userCode', function(callback, results) {
      var form = {
        clientVersion: 3,
        identification: {'EASW-Token':""},
        isReadOnly: false,
        locale: "en-GB",
        method: "idm",
        nuc: results.userCode,
        nucleusPersonaDisplayName: results.accountInfo.personaDisplayName,
        nucleusPersonaId: results.accountInfo.personaId,
        nucleusPersonaPlatform: results.accountInfo.platform,
        priorityLevel: 4,
        sku: "393A0001"
      };
      var headers = {"content-type": "application/json;"};
      request.post('http://www.easports.com/p/fut/a/card-ps3/l/en_US/s/p/ut/auth', {json: form}, function(err, resp, body) {
        callback(err, body);
      });
    }],
    sid: ['tradingAuth', function(callback, results) {
      callback(null, results.tradingAuth.sid);
    }],
    validatePhishing: ['sid', function(callback, results) {
      var headers = {'X-Ut-Sid': results.sid};
      var form = {'answer': md5.md5(securityAnswer)};
      request.post('http://www.easports.com/p/fut/a/card-ps3/l/en_US/s/p/ut/game/fifa13/phishing/validate', {form:form, headers:headers}, function(err, resp, body) {
        callback(err, body);
      });
    }],
    phishingToken: ['validatePhishing', function(callback, results) {
      var token = JSON.parse(results.validatePhishing).token;
      callback(null, token);
    }]
  }, function(errors, results) {
    var client = new AuctionClient(request, results.sid, results.phishingToken);
    userCallback(errors, client);
  });
};

var AuctionClient = function(request, sid, phishingToken) {
  this.request = request;
  this.sid = sid;
  this.phishingToken = phishingToken;
  this.headers = {
    'X-UT-PHISHING-TOKEN': phishingToken,
    'X-UT-SID': sid,
    'Referer': 'http://cdn.easf.www.easports.com/fifa/football-club/static/flash/futFifaUltimateTeamPlugin/FifaUltimateTeam.swf',
    'X-UT-Embed-Error': 'true',
    'X-HTTP-Method-Override': 'GET'
  };
};

AuctionClient.prototype.search = function(qs, userCallback) {
  var url = 'https://utas.s2.fut.ea.com/ut/game/fifa13/auctionhouse';
  var json = {};
  qs.blank = qs.blank || "10";
  qs.start = qs.start || 0;
  qs.num = qs.num || 16;
  
  userCallback = userCallback || function() {};
  this.request.post(url, {json:json, qs: qs, headers: this.headers}, function(err, resp, body) {
    userCallback(null, body);
  });
};

AuctionClient.prototype.updateItems = function(tradeIds, userCallback) {
  var url = 'https://utas.s2.fut.ea.com/ut/game/fifa13/trade';
  var json = {};
  var qs = {tradeIds: tradeIds.join(',')};
  
  userCallback = userCallback || function() {};
  this.request.post(url, {json:json, qs: qs, headers: this.headers}, function(err, resp, body) {
    userCallback(null, body);
  });
};

AuctionClient.prototype.bid = function(tradeId, bid, userCallback) {
  var json = {bid: bid};
  var url = 'https://utas.s2.fut.ea.com/ut/game/fifa13/trade/'+tradeId+'/bid';
  this.request.post(url, {json:json, headers: this.headers}, function(err, resp, body) {
    userCallback(null, body);
  });
};