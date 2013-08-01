var config = require('./config.js');

require('./auction-client.js').connect(config.email, config.password, config.securityAnswer, function(err, client) {
  client.search({
    'cat': 'contract',
    'type':'development',
    'lev':'gold'
  }, function(err, res) {
    console.log(res);
  });
  
  client.updateItems([
    136218925703,
    136216726562,
    136218916746,
    136218919560,
    136218922598,
    136218922599,
    136218928895,
    136218925702,
    136218928896,
    136218925704,
    136218935302,
    136218935305,
    136218922600,
    136218278899,
    136218928894,
    136218928897
  ], function(err, res) {
    console.log(res);
  });
});