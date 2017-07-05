var express = require('express');
var app = express();

app.post('/path', function(req, res) {
  res.send('Path received. ');
});

app.listen(3000, function() {
  console.log('Server running on port 3000. ');
});
