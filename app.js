require('dotenv').config();
require('colors');

const express = require('express');
const ExpressWs = require('express-ws');

// const { GptService } = require('./services/gpt-service');
const VoAIService = require('./services/vo-ai-service');
const { StreamService } = require('./services/stream-service');
const { TranscriptionService } = require('./services/transcription-service');
const { TextToSpeechService } = require('./services/tts-service');
const { recordingService } = require('./services/recording-service');
const { makeOutBoundCall } = require('./scripts/outbound-call')

const VoiceResponse = require('twilio').twiml.VoiceResponse;
const cors = require('cors');
const app = express();
app.use(express.json());
ExpressWs(app);

const PORT = process.env.PORT || 3001;

app.use(cors()); // Enable CORS for all routes

app.get('/', (req, res) => {
  res.send('Hello World');
}
)

app.post('/incoming', (req, res) => {
  try {
    const response = new VoiceResponse();
    console.log('Twilio -> Incoming call'.red, req.body,response);
    const connect = response.connect();
    connect.stream({ url: `wss://${process.env.SERVER}/connection` });
  
    res.type('text/xml');
    res.end(response.toString());
  } catch (err) {
    console.log(err);
  }
});

app.post('/outbound-call', (req, res) => {
  try {
    // console.log('Twilio -> Outbound call'.red);
    console.log('Twilio -> Outbound call', req.body?.to,"from",req.body?.from);
    if(req.body?.to && req.body?.from){ 
      makeOutBoundCall(req.body?.to,req.body?.from);
    }
    res.status(200).send('Outbound call initiated',);
  } catch (err) {
    console.log(err);
  }
}
)


app.ws('/connection', (ws) => {
  try {
    ws.on('error', console.error);
    // Filled in from start message
    let streamSid;
    let callSid;

    // const gptService = new GptService();
    const voAIService = new VoAIService();
    const streamService = new StreamService(ws);
    const transcriptionService = new TranscriptionService();
    const ttsService = new TextToSpeechService({});
  
    let marks = [];
    let interactionCount = 0;
  
    // Incoming from MediaStream
    ws.on('message', function message(data) {
      const msg = JSON.parse(data);
      if (msg.event === 'start') {
        streamSid = msg.start.streamSid;
        callSid = msg.start.callSid;
        
        streamService.setStreamSid(streamSid);
        // gptService.setCallSid(callSid);

        // Set RECORDING_ENABLED='true' in .env to record calls
        recordingService(ttsService, callSid).then(() => {
          console.log(`Twilio -> Starting Media Stream for ${streamSid}`.underline.red);
          // ttsService.generate({partialResponseIndex: null, partialResponse: 
          //   'Hello, this is a test call. Please respond with your favorite color.'
          // }, 0);
          ttsService.generate('Hello, this is a test call. Please respond with your favorite color.', 0);
        });
      } else if (msg.event === 'media') {
        transcriptionService.send(msg.media.payload);
      } else if (msg.event === 'mark') {
        const label = msg.mark.name;
        console.log(`Twilio -> Audio completed mark (${msg.sequenceNumber}): ${label}`.red);
        marks = marks.filter(m => m !== msg.mark.name);
      } else if (msg.event === 'stop') {
        console.log(`Twilio -> Media stream ${streamSid} ended.`.underline.red);
      }
    });
  
    transcriptionService.on('utterance', async (text) => {
      // This is a bit of a hack to filter out empty utterances
      if(marks.length > 0 && text?.length > 5) {
        console.log('Twilio -> Interruption, Clearing stream'.red);
        ws.send(
          JSON.stringify({
            streamSid,
            event: 'clear',
          })
        );
      }
    });
  
    transcriptionService.on('transcription', async (text) => {
      if (!text) { return; }
      console.log(`Interaction ${interactionCount} – STT -> GPT: ${text}`.yellow);
      // gptService.completion(text, interactionCount);
      voAIService.response(text);
      interactionCount += 1;
    });
    
    // gptService.on('gptreply', async (gptReply, icount) => {
    //   console.log(`Interaction ${icount}: GPT -> TTS: ${gptReply.partialResponse}`.green );
    //   ttsService.generate(gptReply, icount);
    // });

    voAIService.on('textreply', async (voAIReply) => {
      console.log(`Interaction ${interactionCount}: GPT -> TTS: ${voAIReply}`.green);
      ttsService.generate(voAIReply, interactionCount);
    } );
  
    ttsService.on('speech', (responseIndex, audio, label, icount) => {
      console.log(`Interaction ${icount}: TTS -> TWILIO: ${label}`.blue);
      console.log(`Twilio -> Audio sent index: ${responseIndex}`.red);
      streamService.buffer(responseIndex, audio);
    });
  
    streamService.on('audiosent', (markLabel) => {
      console.log(`Twilio -> Audio sent mark: ${markLabel}`.red);
      marks.push(markLabel);
    });
  } catch (err) {
    console.log(err);
  }
});

app.listen(PORT);
console.log(`Server running on port ${PORT}`);
