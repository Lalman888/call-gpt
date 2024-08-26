require('dotenv').config();
const { Buffer } = require('node:buffer');
const EventEmitter = require('events');
const fetch = require('node-fetch');

class TextToSpeechService extends EventEmitter {
  constructor() {
    super();
    this.nextExpectedIndex = 0;
    this.speechBuffer = {};
  }

  async generate(textreply, interactionCount) {
    // const { partialResponseIndex, partialResponse } = gptReply;

    // if (!partialResponse) { return; }

    // const {  } = textreply;
    console.log(textreply, " Text reply deepgram ",interactionCount);
    // console.log(`Interaction ${interactionCount}: GPT -> TTS: ${textreply}`.green);

    try {
      const response = await fetch(
        `https://api.deepgram.com/v1/speak?model=${process.env.VOICE_MODEL}&encoding=mulaw&sample_rate=8000&container=none`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Token ${process.env.DEEPGRAM_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: textreply,
          }),
        }
      );
      //  console.log(response,"Deepgram TTS response");
      if (response.status === 200) {
        try {
          const blob = await response.blob();
          const audioArrayBuffer = await blob.arrayBuffer();
          const base64String = Buffer.from(audioArrayBuffer).toString('base64');
          // this.emit('speech', partialResponseIndex, base64String, textreply, interactionCount);
          this.emit('speech', interactionCount, base64String, textreply, interactionCount+1);
        } catch (err) {
          console.log(err);
        }
      } else {
        console.log('Deepgram TTS error:');
        console.log(response);
      }
    } catch (err) {
      console.error('Error occurred in TextToSpeech service');
      console.error(err);
    }
  }
}

module.exports = { TextToSpeechService };