// Express application to receive paths from iPad
var express = require('express'),
    app = express(),
    bodyParser = require('body-parser'),
    fs = require('fs'),
    exec = child_process.exec;

app.use(bodyParser.json());
app.set('port', (process.env.PORT || 5000));
app.post('/path', function(req, res) {

  // Do something with req.body.path here
  // Convert to YAML file?

  var stream = fs.createWriteStream("../path_0.yml");
  stream.write("%YAML:1.0\n");
  stream.write("features:\n");

  req.body.path.forEach(function(element) {
    stream.write("   - { x:");
    stream.write(String(element[0]));
    stream.write(", y:");
    stream.write(String(element[1]));
    stream.write(" }\n");
  });

  console.log("Path received and printed. ");

  /*
  exec("../CVcontrol4", function(err, stdout, stderr) {
    if (err) {
        console.log('Child process exited with error code', err.code);
        return;
    }
    console.log(stdout);
  });
  */

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
