require("colors");
const EventEmitter = require("events");
const axios = require("axios");

class VoAIService extends EventEmitter {
  constructor() {
    super();
    this.partialResponseIndex = 0;
    this.textBuffer = ""; // To accumulate tokens
  }

  async sendTOAPI(text, Id, encryptedId) {
    console.log("Sending text to API", text, Id, encryptedId);
    try {
      const response = await axios.post(
        "https://voice-ai-backend-ly7dzrkywq-ue.a.run.app/chat",
        {
          message: text,
          thread_id: Id,
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${encryptedId}`,
          },
          responseType: "stream",
        }
      );
      // console.log("Response from API", response);

      // Reset the textBuffer before accumulating new data
      this.textBuffer = "";

      // Handling data chunks from the stream
      response.data.on("data", (chunk) => {
        // console.log(`Received ${chunk.length} bytes of data.`);
        console.log(chunk.toString());

        // Handle incoming data to accumulate tokens
        this.handleIncomingData(chunk.toString());
      });

      response.data.on("end", () => {
        console.log("No more data in response.");
        // Send the accumulated text to Twilio once all data is received
        this.sendCompleteTextToTwilio();
      });
    } catch (error) {
      console.error("Error in sending text to API", error);
      return null;
    }
  }

  // Handle incoming data by accumulating tokens
  handleIncomingData(data) {
    try {
      const tokenObject = JSON.parse(data.split("data: ")[1]); // Extract the JSON object
      const token = tokenObject.token; // Extract the token
      this.textBuffer += token; // Accumulate tokens in textBuffer
    } catch (error) {
      console.error("Error in handling incoming data", error);
    }
  }

  // Send the accumulated text to Twilio
  sendCompleteTextToTwilio() {
    const completeText = this.textBuffer.trim(); // Trim any extra spaces
    if (completeText) {
      this.emit("textreply", completeText); // Send the complete text
      console.log("Sending complete text to Twilio:", completeText);
    }
  }

  async response(text) {
    const id = "66ccadd8fb1db8d145832f43";
    const encryptedId = "jnYngFItm0bpkIycRaF28646aJJL2cOVFkFsa7H11wE=";
    await this.sendTOAPI(text, id, encryptedId);
  }
}

module.exports = VoAIService;
