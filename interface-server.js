// Express application to receive paths from iPad
var express = require('express'),
    app = express(),
    bodyParser = require('body-parser');

app.use(bodyParser.json());
app.set('port', (process.env.PORT || 5000));
app.post('/path', function(req, res) {
  console.log(req.body);

  // Do something with req.body.path here
  // Convert to YAML file?
  res.send({ status: 'SUCCESS' });
});
app.listen(app.get('port'), function() {
  console.log('Server running on port ', app.get('port'));
});

/****

TODO:
1. Convert path received from iPad into YAML format.
2. Start OpenCV process using the path received from iPad.

****/
