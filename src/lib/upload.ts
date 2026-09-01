function toDataUrl(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read the image."));
    reader.readAsDataURL(file);
  });
}

/** Stores an image alongside the journal data and returns its local URL. */
export async function uploadImage(file: File | Blob): Promise<string> {
  const dataUrl = await toDataUrl(file);
  const response = await fetch("/api/screenshots", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dataUrl }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? "Upload failed.");
  }
  const { url } = (await response.json()) as { url: string };
  return url;
}
