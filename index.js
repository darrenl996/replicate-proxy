import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(express.json({ limit: "10mb" }));

// ✅ CORS Fix — allow requests from any site
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*"); // Allow any origin
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST");
  next();
});

const MODEL_VERSION = "e70c94fdc3f6c4f7c377c6986a5eacba1db6e28b06ebdfb4d1e0520c1e0f1527";

app.post("/replicate", async (req, res) => {
  try {
    const { image } = req.body;

    const predictionRes = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        Authorization: `Token ${process.env.REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        version: MODEL_VERSION,
        input: {
          image: image,
          mode: "best"
        }
      })
    });

    const prediction = await predictionRes.json();
    const statusUrl = prediction.urls.get;

    // Poll until done
    let result = null;
    while (!result) {
      const checkRes = await fetch(statusUrl, {
        headers: {
          Authorization: `Token ${process.env.REPLICATE_API_TOKEN}`
        }
      });
      const status = await checkRes.json();
      if (status.status === "succeeded") {
        result = status.output;
        break;
      }
      await new Promise((r) => setTimeout(r, 1500));
    }

    res.json({ result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to call Replicate." });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`🧠 Proxy listening on port ${port}`);
});
