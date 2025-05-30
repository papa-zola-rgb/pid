var mqtt = require("async-mqtt");
var { Pool } = require("pg");

const pool = new Pool({
  user: "postgres", // Ganti dengan username PostgreSQL kamu
  host: "localhost", // atau IP/hostname dari database
  database: "pemanas", // Ganti sesuai database kamu
  password: "123", // Password
  port: 5432, // Default PostgreSQL port
});

const brokerUrl = "mqtts://c0edc1d431244359956f48c792bcbe9e.s1.eu.hivemq.cloud";
const options = {
  username: "MQTTSERVER",
  password: "Indonesia24",
  port: 8883,
};

let mqttClient;
let receivedData = null;

async function connectMQTT(io) {
  try {
    mqttClient = await mqtt.connectAsync(brokerUrl, options);
    console.log("Connected to MQTT broker");

    await mqttClient.subscribe("suhu");
    console.log("Subscribed to topic suhu");
    await clearRetained(); // Hapus pesan retained

    mqttClient.on("message", async (topic, message, packet) => {
      if (packet.retain) {
        console.log("Ignored retained message:", message.toString());
        return; // Lewati pesan retained
      }

      if (topic === "suhu") {
        const rawMessage = message.toString();
        if (!rawMessage.trim()) {
          console.error("Received empty MQTT message, ignoring.");
          return;
        }
        console.log("Raw message received:", rawMessage);
        let suhu, nim, time;

        try {
          const parsed = JSON.parse(rawMessage);

          if (
            typeof parsed === "object" &&
            parsed !== null &&
            "suhu" in parsed &&
            "NIM" in parsed &&
            "time" in parsed
          ) {
            suhu = parseFloat(parsed.suhu);
            nim = parsed.NIM;
            time = parsed.time;
          } else {
            console.error(
              "Parsed JSON does not contain 'suhu' , 'NIM' and 'time' properties."
            );
            return;
          }
        } catch (err) {
          console.error("Error parsing MQTT message:", err.message);
          return;
        }

        console.log("Received MQTT:", suhu, nim, time);

        if (!time) {
          console.error("time not found in message.");
          return;
        }

        if (!nim) {
          console.error("NIM not found in message.");
          return;
        }

        if (!isNaN(suhu)) {
          try {
            await pool.query(
              "INSERT INTO public.output (suhu, nim, time) VALUES ($1, $2, $3)",
              [suhu, nim, time]
            );
            console.log(`Waktu ${time} Suhu ${suhu} disimpan untuk NIM ${nim}`);
          } catch (dbErr) {
            console.error("Database insert error:", dbErr.message);
          }
        } else {
          console.error("Received suhu is not a valid number");
          return;
        }

        //emit frontend
        if (io) {
          console.log("Emit suhu to frontend", time, suhu, nim);
          io.emit("new_suhu", { time, suhu, NIM: nim });
        } else {
          console.error("Socket.IO instance is undefined.");
        }
      }
    });
  } catch (err) {
    console.error("MQTT connection error:", err);
  }
}

async function reconnectMQTT(io) {
  try {
    await connectMQTT(io);
  } catch (err) {
    console.error("Reconnect attempt failed:", err.message);
    setTimeout(reconnect, 5000); // Coba reconnect setelah 5 detik
  }
}

async function disconnectMQTT() {
  if (mqttClient && mqttClient.end) {
    try {
      await mqttClient.end();
      console.log("MQTT connection closed");
    } catch (err) {
      console.error("Error while closing MQTT connection:", err.message);
    }
  }
}

async function clearRetained() {
  await mqttClient.publish("suhu", "", { retain: true });
}

module.exports = {
  connectMQTT,
  disconnectMQTT,
  reconnectMQTT,
  getClient: () => mqttClient,
  getReceivedData: () => receivedData,
};
