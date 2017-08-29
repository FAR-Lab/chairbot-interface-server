
/*
 *  An express application to accept a path from an iPad
 *  and connect to the OpenCV control system for ChairBot.
 *
 */

// Require the modules needed
var express = require('express'),
    app = express(),
    bodyParser = require('body-parser');

// Express app setup
app.use(bodyParser.json());
app.set('port', (process.env.PORT || 5000));

// Define /path route
app.post('/path', function(req, res) {
  res.send({ status: 'SUCCESS' });
});

app.post('/stop', function(req, res) {
  res.send({ status: 'SUCCESS' });
});

// Start server
app.listen(app.get('port'), function() {
  console.log('Server running on port ', app.get('port'));
});
