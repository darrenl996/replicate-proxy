import fetch from "node-fetch";

export default async function handler(req, res) {
  // ✅ CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const MODEL_VERSION = "e70c94fdc3f6c4f7c377c6986a5eacba1db6e28b06ebdfb4d1e0520c1e0f1527";
  const token = process.env.REPLICATE_API_TOKEN;

  if (!token) {
    console.error("❌ Missing API token");
    return res.status(500).json({ error: "Missing Replicate API token" });
  }

  try {
    const { image } = req.body;
    console.log("📤 Sending to Replicate:", {
      imagePreview: image?.slice(0, 100),
      length: image?.length,
      startsWith: image?.startsWith("data:image")
    });

    const replicateRes = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        Authorization: `Token ${token}`,
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

    const prediction = await replicateRes.json();
    console.log("📦 Raw Replicate Response:", prediction);

    if (!prediction?.urls?.get) {
      throw new Error("Replicate response missing status URL");
    }

    const statusUrl = prediction.urls.get;

    let result = null;
    while (!result) {
      const checkRes = await fetch(statusUrl, {
        headers: { Authorization: `Token ${token}` }
      });

      const status = await checkRes.json();
      console.log("🔁 Polling status:", status.status);

      if (status.status === "succeeded") {
        result = status.output;
        break;
      }

      if (status.status === "failed") {
        throw new Error("Prediction failed.");
      }

      await new Promise((r) => setTimeout(r, 1500));
    }

    res.status(200).json({ result });
  } catch (err) {
    console.error("❌ Replicate API Error:", err);
    res.status(500).json({ error: err.message || "Failed to call Replicate API" });
  }
}
