const DEFAULT_IMAGE_MODEL = "gemini-3.1-flash-image";
const FALLBACK_IMAGE_MODELS = [
  "gemini-2.5-flash-image",
  "gemini-3-pro-image",
  "gemini-3-pro-image-preview"
];
const deprecatedModels = new Set([
  "gemini-2.5-flash-image-preview",
  "gemini-2.0-flash-preview-image-generation"
]);
const requestedModel = process.env.GEMINI_MODEL;
export const MODEL = !requestedModel || deprecatedModels.has(requestedModel)
  ? DEFAULT_IMAGE_MODEL
  : requestedModel;

export class AiGenerationError extends Error {
  constructor(message, { publicMessage = "لم ينجح التوليد حالياً. لم يتم خصم أي محاولة.", reason = "generation_failed" } = {}) {
    super(message);
    this.name = "AiGenerationError";
    this.publicMessage = publicMessage;
    this.reason = reason;
  }
}

function parseDataUrl(dataUrl) {
  const match = String(dataUrl || "").match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error("صيغة الصورة غير صحيحة.");
  return { mimeType: match[1], data: match[2] };
}

const prompt = `
ARCHITECTURAL GEOMETRY LOCK MODE

The first image is the master geometry source and has absolute priority over all other inputs.

Treat the first image as immutable architectural geometry.

The architectural geometry of image 1 must be preserved with near-perfect fidelity.

Preserve exactly:

* Building massing
* Building silhouette
* Floor count
* Width, height and proportions
* Window locations
* Door locations
* Opening dimensions
* Roof shape
* Parapets
* Corners
* Projections
* Recesses
* Structural composition
* Camera position
* Camera height
* Camera focal length
* Perspective
* Framing

Geometry preservation priority: 100%

Reference image hierarchy:

Image 1 = Geometry Authority
Image 2 = Material and Design Inspiration Only

The second image must NEVER override the geometry of the first image.

Transfer only:

* Materials
* Colors
* Textures
* Surface treatments
* Architectural detailing
* Facade articulation
* Shading devices
* Lighting mood
* Premium design language

Allowed facade enhancements:

* Surface depth
* Facade frames
* Material transitions
* Architectural grooves
* Premium detailing
* Contemporary Najdi detailing
* Elegant facade articulation

Maximum facade depth modification:
10 cm visual depth only.

Strictly forbidden:

* New floors
* New building volumes
* New wings
* New roofs
* New openings
* Moving windows
* Moving doors
* Changing proportions
* Changing massing
* Changing silhouette
* Streets
* Cars
* Trees
* Landscape
* Signage
* Logos
* Labels
* Numbers
* Text
* Commercial boards

If a conflict exists between image 1 and image 2:

ALWAYS FOLLOW IMAGE 1.

The final result must appear as if the original building from image 1 was professionally upgraded by a world-class architect while maintaining the exact same architecture.

Target similarity to image 1 geometry:
99.9%

Material transfer and facade enhancement only.

NO ARCHITECTURAL REDESIGN.
NO MASSING MODIFICATIONS.
NO GEOMETRY CHANGES.
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
    throw new AiGenerationError("GEMINI_API_KEY is missing", {
      publicMessage: "خدمة التوليد غير مفعلة حالياً.",
      reason: "missing_api_key"
    });
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
          { type: "text", text: "PROJECT IMAGE: this is the required final camera angle, perspective, massing, openings, and geometry. The output must follow this image viewpoint." },
          { type: "image", mime_type: sourceImage.mimeType, data: sourceImage.data },
          { type: "text", text: "REFERENCE IMAGE: material and design inspiration only. Do not override the PROJECT IMAGE geometry." },
          { type: "image", mime_type: referenceImage.mimeType, data: referenceImage.data }
        ],
        response_format: {
          type: "image",
          aspect_ratio: "16:9",
          image_size: model.includes("pro-image") ? "2K" : "1K"
        }
      })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = extractErrorMessage(data, "تعذر توليد الصورة حالياً.");
      lastError = { status: response.status, model, message, details: data };
      console.error("Gemini image generation failed", lastError);

      if ([400, 404, 429, 500, 503].includes(response.status)) {
        continue;
      }

      throw new AiGenerationError(message, {
        publicMessage: "لم ينجح التوليد حالياً. لم يتم خصم أي محاولة.",
        reason: "gemini_error"
      });
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

  const busyStatuses = new Set([429, 500, 503]);
  const isBusy = busyStatuses.has(lastError?.status);
  throw new AiGenerationError(lastError?.message || "No image model returned an image", {
    publicMessage: isBusy
      ? "الخدمة مشغولة حالياً. حاول مرة أخرى بعد قليل. لم يتم خصم أي محاولة."
      : "لم ينجح التوليد حالياً. لم يتم خصم أي محاولة.",
    reason: isBusy ? "server_busy" : "generation_failed"
  });
}
