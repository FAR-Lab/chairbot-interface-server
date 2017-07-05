var express = require('express');
var app = express();

app.set('port', (process.env.PORT || 5000));

app.post('/path', function(req, res) {
  res.send('Path received. ');
});

app.listen(app.get('port'), function() {
  console.log('Server running on port ', app.get('port'));
});
