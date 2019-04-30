# ChairBot-interface-server

Server that receives path from interface and sends to neato; also runs webcam proxy to send video from ffmpeg to web clients.

To run:

`$ npm start <config file>`
  
There are two provided config files: `path-config.json` and `local-config.json`. In both cases, you should also run motor control code on the Raspberry Pi for each chairbot -- either the [NeatoPi](//github.com/CDR-IxD/NeatoPi) server for Neato-based chairbots, of the [chairbot-motor-websocket-proxy](//github.com/FAR-Lab/chairbot-motor-websocket-proxy) for the Hoverboard-based chairbots.

### path-config

This mode relies on a webcam stream such as might be provided with: `$ ffmpeg -f avfoundation -framerate 30 -video_size 320x240 -i "default" -f mpegts -codec:v mpeg1video -s 320x240 -b:v 500k -bf 0         http://localhost:8081/supersecret` (on MacOS High Sierra)

You can chose a different URL secret using the `STREAM_SECRET` environemnt variable.

You'll also want to run the [aruco tracking server](//github.com/CDR-IxD/aruco-marker-tracking) and point it to this server -- this code assumes that each ChairBot's Raspberry Pi devices is accessible at hostname `neato-NN.local`, where NN is the number that corresponds to the ArUco marker's ID.

### local-config

This mode provides a WASD-style analog (and digital) control options hosted on the raspberry pi directly. To run in this mode, you'll also need to run the the [chairbot motor websocket proxy](//github.com/FAR-Lab/chairbot-motor-websocket-proxy) that proxies messages from this interface server to the firmware for your motor drive.


