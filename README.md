# neato-server

Server that receives path from interface and sends to neato; also runs webcam proxy to send video from ffmpeg to web clients.

To run:

`$ npm start <config file>`
  
There are two provided config files: `path-config.json` and `local-config.json`. In both cases, you should also run the [NeatoPi](//github.com/CDR-IxD/NeatoPi) scripts on the Raspberry Pi for each neato chairbot.

### path-config

This mode relies on a webcam stream such as might be provided with: `$ ffmpeg -f avfoundation -framerate 30 -video_size 320x240 -i "default" -f mpegts -codec:v mpeg1video -s 320x240 -b:v 500k -bf 0         http://localhost:8081/supersecret` (on MacOS High Sierra)

You can chose a different URL secret using the `STREAM_SECRET` environemnt variable.

You'll also want to run the [aruco tracking server](//github.com/CDR-IxD/aruco-marker-tracking) and point it to this server -- this code assumes that each ChairBot's Raspberry Pi devices is accessible at hostname `neato-NN.local`, where NN is the number that corresponds to the ArUco marker's ID.

### local-config

This mode provides a WASD-style analog control option hosted on the raspberry pi directly. Run neato-pi in addition to this server.
