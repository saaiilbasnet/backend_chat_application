const DATA_IMAGE_PATTERN = /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export const validateDataImage = (image: unknown) => {
  if (typeof image !== "string" || !image.trim()) {
    return { valid: false, message: "Image must be a base64 data URL" };
  }

  if (!DATA_IMAGE_PATTERN.test(image)) {
    return { valid: false, message: "Only PNG, JPEG, WebP, and GIF images are supported" };
  }

  const base64 = image.split(",", 2)[1] ?? "";
  const estimatedBytes = Math.floor((base64.length * 3) / 4);

  if (estimatedBytes > MAX_IMAGE_BYTES) {
    return { valid: false, message: "Image must be 5MB or smaller" };
  }

  return { valid: true };
};
