import { sampler, texture, type Gpu, type Texture } from "vgpu";

// Small, local CC0 maps. Mips are prepared once; the fluid has no dependency
// on these textures, and an unavailable image has a neutral material fallback.
async function material(gpu: Gpu, url: string, signal: AbortSignal): Promise<Texture | null> {
  let image: ImageBitmap | null = null;
  try {
    const response = await fetch(url, { signal });
    if (!response.ok) throw new Error(`Material returned ${response.status}`);
    image = await createImageBitmap(await response.blob());
  } catch (error) {
    if (!signal.aborted) console.warn("Fume material fallback:", url, error);
    return null;
  }
  if (signal.aborted) { image.close(); return null; }
  const width = image.width;
  const height = image.height;
  const levels = 1 + Math.floor(Math.log2(Math.max(width, height)));
  let map: Texture | null = null;
  try {
    map = texture(gpu, {
      kind: "2d", size: [width, height], format: "rgba8unorm",
      usage: ["texture_binding", "copy_dst", "render_attachment"],
      mipLevelCount: levels, label: url,
    });
    for (let mip = 0; mip < levels; mip++) {
      const w = Math.max(1, width >> mip);
      const h = Math.max(1, height >> mip);
      const canvas = new OffscreenCanvas(w, h);
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(image, 0, 0, w, h);
      gpu.gpu.queue.copyExternalImageToTexture(
        { source: canvas }, { texture: map.gpu, mipLevel: mip }, [w, h],
      );
    }
  } catch (error) {
    map?.destroy();
    throw error;
  } finally { image.close(); }
  return map;
}

function solid(gpu: Gpu, rgba: number[]): Texture {
  const map = texture(gpu, {
    kind: "2d", size: [1, 1], format: "rgba8unorm",
    usage: ["texture_binding", "copy_dst"],
  });
  gpu.gpu.queue.writeTexture({ texture: map.gpu }, new Uint8Array(rgba), {}, [1, 1]);
  return map;
}

export function loadRoomMaterials(gpu: Gpu) {
  const bindings = {
    woodColor: solid(gpu, [51, 54, 54, 255]),
    woodNormal: solid(gpu, [128, 128, 255, 255]),
    garden: solid(gpu, [183, 181, 161, 255]),
    materialSampler: sampler(gpu, {
      addressModeU: "repeat", addressModeV: "repeat",
      magFilter: "linear", minFilter: "linear", mipmapFilter: "linear",
    }),
  };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3500);
  const maps = [
    ["woodColor", "/materials/painted-wood-color.jpg"],
    ["woodNormal", "/materials/painted-wood-normal.jpg"],
    ["garden", "/materials/window-garden.jpg"],
  ] as const;
  // The first frame uses neutral maps; optional decoration cannot delay smoke.
  void Promise.allSettled(maps.map(async ([key, url]) => {
    const map = await material(gpu, url, controller.signal);
    if (!map) return;
    if (controller.signal.aborted) { map.destroy(); return; }
    const previous = bindings[key];
    bindings[key] = map;
    previous.destroy();
  })).then((results) => {
    if (controller.signal.aborted) return;
    for (const result of results) {
      if (result.status === "rejected") console.warn("Fume material fallback:", result.reason);
    }
  }).finally(() => clearTimeout(timeout));
  return { bindings, dispose: () => { controller.abort(); clearTimeout(timeout); } };
}
