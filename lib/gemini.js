const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash-image-preview";

function parseDataUrl(dataUrl) {
  const match = String(dataUrl || "").match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error("صيغة الصورة غير صحيحة.");
  return { mimeType: match[1], data: match[2] };
}

const prompt = `
You are Al Mulhim AI, a premium architectural visualization assistant.

The PROJECT IMAGE is the geometry source.
The REFERENCE IMAGE is the architectural style and material source.

Create a professional architectural visualization that:
- preserves the project massing, camera angle, proportions, openings, and main geometry
- applies the reference image's architectural language, materials, colors, facade character, lighting quality, and detailing philosophy
- improves realism with believable construction quality, shadows, reflections, joints, and material behavior
- looks like a completed real-world architectural project photographed professionally

Avoid:
- changing the building identity
- changing floor count
- inventing unrelated masses
- fantasy architecture
- obvious AI/CGI appearance

Final output:
Photorealistic architectural image, same project viewpoint, inspired by the reference image.
`;

function extractOutputImage(data) {
  const parts = data?.candidates?.[0]?.content?.parts || [];
  for (const part of parts) {
    const inlineData = part.inlineData || part.inline_data;
    if (inlineData?.data) {
      return {
        mimeType: inlineData.mimeType || inlineData.mime_type || "image/png",
        data: inlineData.data
      };
    }
  }
  return null;
}

function extractErrorMessage(data, fallback) {
  return data?.error?.message || data?.message || fallback;
}

export async function generateArchitecturalImage({ source, reference }) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("خدمة التوليد غير مفعلة حالياً. أضف GEMINI_API_KEY في Render Environment.");
  }

  const sourceImage = parseDataUrl(source);
  const referenceImage = parseDataUrl(reference);
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            { text: "PROJECT IMAGE - preserve its geometry and viewpoint." },
            { inlineData: { mimeType: sourceImage.mimeType, data: sourceImage.data } },
            { text: "REFERENCE IMAGE - use only for style, materials, colors, and architectural language." },
            { inlineData: { mimeType: referenceImage.mimeType, data: referenceImage.data } }
          ]
        }
      ],
      generationConfig: {
        responseModalities: ["TEXT", "IMAGE"]
      }
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = extractErrorMessage(data, "تعذر توليد الصورة حالياً.");
    console.error("Gemini generation failed", {
      status: response.status,
      model: MODEL,
      message,
      details: data
    });
    throw new Error(message);
  }

  const image = extractOutputImage(data);
  if (!image) {
    console.error("Gemini response without output image", { model: MODEL, response: data });
    throw new Error("لم يرجع محرك التوليد صورة. حاول مرة أخرى.");
  }

  console.log("Gemini generation succeeded", {
    model: MODEL,
    promptFeedback: data?.promptFeedback || null,
    finishReason: data?.candidates?.[0]?.finishReason || null
  });

  return `data:${image.mimeType};base64,${image.data}`;
}
