# neato-server

Server that receives path from interface and sends to neato; also runs webcam proxy to send video from ffmpeg to web clients.

To run:

`$ STREAM_SECRET=<your secret here> node interface-server.js`
  
Make sure your secret here matches the path that ffmpeg sends to. You might run ffmpeg like this (macOS High Sierra):

`$ ffmpeg -f avfoundation -framerate 30 -video_size 320x240 -i "default" -f mpegts -codec:v mpeg1video -s 320x240 -b:v 500k -bf 0         http://localhost:8081/<your secret here>`

You'll also want to run the [aruco tracking server](//github.com/CDR-IxD/aruco-marker-tracking) and point it to this server.
