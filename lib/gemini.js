const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash-image-preview";

function parseDataUrl(dataUrl) {
  const match = String(dataUrl || "").match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error("صيغة الصورة غير صحيحة.");
  return { mimeType: match[1], data: match[2] };
}

const prompt = `
You are Al Mulhim AI, a premium architectural visualization assistant.

Use the PROJECT IMAGE as the geometry source and the REFERENCE IMAGE as the style/material source.

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

Final output: photorealistic architectural image, same project viewpoint, inspired by the reference image.
`;

export async function generateArchitecturalImage({ source, reference }) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("خدمة الذكاء الاصطناعي غير مفعلة حالياً.");
  }

  const sourceImage = parseDataUrl(source);
  const referenceImage = parseDataUrl(reference);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            { text: "PROJECT IMAGE:" },
            { inlineData: sourceImage },
            { text: "REFERENCE IMAGE:" },
            { inlineData: referenceImage },
            { text: prompt }
          ]
        }
      ],
      generationConfig: {
        responseModalities: ["IMAGE", "TEXT"]
      }
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.error?.message || "تعذر توليد الصورة حالياً.";
    console.error("Gemini generation failed", { status: response.status, message });
    throw new Error(message);
  }

  const parts = data?.candidates?.[0]?.content?.parts || [];
  const imagePart = parts.find((part) => part.inlineData?.data);
  if (!imagePart) {
    throw new Error("لم يرجع محرك التوليد صورة. حاول مرة أخرى.");
  }

  const mimeType = imagePart.inlineData.mimeType || "image/png";
  return `data:${mimeType};base64,${imagePart.inlineData.data}`;
}
