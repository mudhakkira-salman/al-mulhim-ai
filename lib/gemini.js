const DEFAULT_IMAGE_MODEL = "gemini-3-pro-image";
const FALLBACK_IMAGE_MODELS = [
  "gemini-3-pro-image-preview",
  "gemini-3.1-flash-image",
  "gemini-2.5-flash-image"
];
const deprecatedModels = new Set([
  "gemini-2.5-flash-image-preview",
  "gemini-2.0-flash-preview-image-generation"
]);
const requestedModel = process.env.GEMINI_MODEL;
export const MODEL = !requestedModel || deprecatedModels.has(requestedModel)
  ? DEFAULT_IMAGE_MODEL
  : requestedModel;

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
  if (data?.output_image?.data) {
    return {
      mimeType: data.output_image.mime_type || data.output_image.mimeType || "image/png",
      data: data.output_image.data
    };
  }

  for (const step of data?.steps || []) {
    for (const block of step?.content || []) {
      if (block?.type === "image" && block?.data) {
      return {
          mimeType: block.mime_type || block.mimeType || "image/png",
          data: block.data
      };
    }
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
  const modelsToTry = [MODEL, ...FALLBACK_IMAGE_MODELS.filter((model) => model !== MODEL)];
  let lastError = null;

  for (const model of modelsToTry) {
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": process.env.GEMINI_API_KEY
      },
      body: JSON.stringify({
        model,
        input: [
          { type: "text", text: prompt },
          { type: "text", text: "PROJECT IMAGE - preserve its geometry and viewpoint." },
          { type: "image", mime_type: sourceImage.mimeType, data: sourceImage.data },
          { type: "text", text: "REFERENCE IMAGE - use only for style, materials, colors, and architectural language." },
          { type: "image", mime_type: referenceImage.mimeType, data: referenceImage.data }
        ],
        response_format: {
          type: "image",
          aspect_ratio: "16:9",
          image_size: model.includes("pro-image") ? "4K" : "2K"
        }
      })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = extractErrorMessage(data, "تعذر توليد الصورة حالياً.");
      lastError = { status: response.status, model, message, details: data };
      console.error("Gemini image generation failed", lastError);

      if (response.status === 404 || response.status === 400) {
        continue;
      }

      throw new Error(message);
    }

    const image = extractOutputImage(data);
    if (!image) {
      lastError = { status: response.status, model, message: "No image in response", details: data };
      console.error("Gemini response without output image", lastError);
      continue;
    }

  console.log("Gemini generation succeeded", {
      model,
      requestId: data?.id || data?.response_id || null
  });

  return `data:${image.mimeType};base64,${image.data}`;
}

  throw new Error(lastError?.message || "لم يرجع محرك التوليد صورة. حاول مرة أخرى.");
}
