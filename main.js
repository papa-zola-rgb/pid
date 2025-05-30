var express = require("express");
var router = express.Router();
var mqttClientModule = require("../mqtt/client");
var io = require("socket.io")();

module.exports = function (db) {
  // Middleware untuk memeriksa apakah pengguna sudah login
  function requireLogin(req, res, next) {
    if (!req.session.user) {
      return res.redirect("/"); // Redirect ke halaman login jika belum login
    }
    mqttClientModule.connectMQTT(io);
    next(); // Lanjutkan ke rute berikutnya jika sudah login
  }
  /* GET main page. */
  router.get("/", requireLogin, function (req, res, next) {
    res.set("Cache-Control", "no-store"); // Menghindari caching
    // Jika pengguna sudah login, render halaman main
    return res.render("main", { user: req.session.user });
  });

  mqttClientModule.reconnectMQTT(io);

  router.post("/data", requireLogin, async function (req, res, next) {
    if (!req.session.user) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const parseFloatValue = (value) => {
      if (value === null || value === undefined || value === "") {
        return 0.0; // Ganti null, undefined, atau string kosong dengan 0.0
      }
      const num = parseFloat(value);
      return isNaN(num) ? 0.0 : num; // Kembalikan null jika bukan angka
    };

    const {
      set_point = null,
      kp = null,
      ki = null,
      kd = null,
      time_sampling = null,
      mode,
      set_point_atas = null,
      set_point_bawah = null,
    } = req.body;

    const validatedKp = parseFloatValue(kp);
    const validatedKi = parseFloatValue(ki);
    const validatedKd = parseFloatValue(kd);
    const validatedTimeSampling = parseFloatValue(time_sampling);
    const validatedSetPoint = parseFloatValue(set_point);
    const validatedSetPointAtas = parseFloatValue(set_point_atas);
    const validatedSetPointBawah = parseFloatValue(set_point_bawah);

    if (mode === null || mode === undefined) {
      return res.status(400).json({ error: "Mode is required." });
    }

    const nim = req.session.user.nim;

    const values = [
      validatedSetPoint,
      validatedKp,
      validatedKi,
      validatedKd,
      validatedTimeSampling,
      mode,
      validatedSetPointAtas,
      validatedSetPointBawah,
      nim,
    ];

    try {
      const checkQuery = "SELECT 1 FROM public.variabel WHERE nim = $1";
      const checkResult = await db.query(checkQuery, [nim]);

      if (checkResult.rows.length > 0) {
        const updateQuery = `
              UPDATE public.variabel
              SET set_point = $1, kp = $2, ki = $3, kd = $4, time_sampling = $5, mode = $6, set_point_atas = $7, set_point_bawah = $8
              WHERE nim = $9
                RETURNING *
            `;
        await db.query(updateQuery, values);
        res.status(200).json({ message: "Data saved successfully" });
        console.log("Data updated successfully");
        const result = await db.query(updateQuery, values);
        if (result.rowCount === 0) {
          res
            .status(500)
            .json({ error: "Database error", details: err.message });
          console.warn("No rows were updated.");
        } else {
          console.log("Rows updated:", result.rowCount);
          console.log("updated:", values);
        }
      } else {
        const insertQuery = `
              INSERT INTO public.variabel (set_point, kp, ki, kd, time_sampling, mode, set_point_atas, set_point_bawah, nim)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                RETURNING *
            `;
        await db.query(insertQuery, values);
        res.status(200).json({ message: "Data saved successfully" });
        console.log("Data inserted successfully");
      }
    } catch (err) {
      console.error("Database error:", err.stack);
      res
        .status(500)
        .json({ error: "Database query error", details: err.message });
    }

    const checkQuery = "SELECT 1 FROM public.user WHERE nim = $1";
    const checkResult = await db.query(checkQuery, [nim]);

    if (checkResult.rows.length === 0) {
      return res
        .status(404)
        .json({ error: "NIM tidak ditemukan di database." });
    }

    const keys = [
      "Sp",
      "Kp",
      "Ki",
      "Kd",
      "Time",
      "Mode",
      "TSPH",
      "TSPL",
      "NIM",
    ];
    const dataToSend = {
      Sp: validatedSetPoint,
      Kp: validatedKp,
      Ki: validatedKi,
      Kd: validatedKd,
      Time: validatedTimeSampling,
      Mode: mode,
      TSPH: validatedSetPointAtas,
      TSPL: validatedSetPointBawah,
      NIM: nim,
    };

    for (let i = 0; i < keys.length; i++) {
      dataToSend[keys[i]];
    }

    const mqttClient = mqttClientModule.getClient();
    if (mqttClient) {
      try {
        await mqttClient.publish("set", JSON.stringify(dataToSend));
        console.log("Data sent:", dataToSend);
      } catch (err) {
        console.error("Publish error:", err);
      }
    } else {
      console.error("MQTT client is not initialized");
    }
  });

  return router;
};
