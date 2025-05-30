var express = require("express");
var router = express.Router();

module.exports = function (db) {
  router.get("/", function (req, res, next) {
    if (req.session.user) {
      // Jika pengguna sudah login, redirect ke /main
      return res.redirect("/routes/main");
    }
    // Jika pengguna belum login, render halaman login
    res.render("login", { title: "kendali_pemanas" });
  });
  router.post("/", function (req, res) {
    console.log("req.body:", req.body);
    const { nama, kelas, nim } = req.body; // Ambil data dari form
    // Validasi input (opsional, tapi disarankan)
    if (
      !nama ||
      nama.trim() === "" ||
      !kelas ||
      kelas.trim() === "" ||
      !nim ||
      nim.trim() === ""
    ) {
      return res.status(400).send("Semua field harus diisi.");
    }
    // Cek apakah user dengan NIM yang sama sudah ada
    db.query(
      "SELECT * FROM public.user WHERE nama = $1",
      [nama],
      (err, data) => {
        if (err) {
          console.log(err);
          return res.status(500).send(err);
        }
        if (data.rows.length > 0) {
          // User dengan NIM ini sudah ada
          const userId = data.rows[0].user_id; // Ganti dengan kolom ID yang sesuai
          db.query(
            "UPDATE public.user SET updated_at = NOW() WHERE user_id = $1 RETURNING *",
            [userId],
            (err, result) => {
              if (err) {
                console.log("Error UPDATE:", err);
                return res.status(500).send(err);
              }
              req.session.user = result.rows[0];
              return res.redirect("/main");
            }
          );
        } else {
          console.log("nama:", nama);
          console.log("nim:", nim);
          console.log("kelas:", kelas);
          // User belum ada, insert ke database
          db.query(
            "INSERT INTO public.user (nama, kelas, nim) VALUES ($1, $2, $3) RETURNING *",
            [nama, kelas, nim],
            (err, result) => {
              if (err) {
                console.log("Error INSERT:", err);
                return res.status(500).send(err);
              }
              console.log("Result INSERT:", result);
              req.session.user = result.rows[0];
              res.redirect("/main");
            }
          );
        }
      }
    );
  });

  //logout
  router.post("/logout", async function (req, res) {
    // try {
    //   await mqttClientModule.disconnectMQTT(); // Panggil fungsi yang benar
    //   console.log("MQTT and socket disconnected on logout");
    // } catch (err) {
    //   console.error("Error disconnecting MQTT:", err.message);
    // }

    req.session.destroy((err) => {
      if (err) {
        console.log(err);
        return res.status(500).send(err);
      }
      res.redirect("/");
    });
  });

  return router;
};
