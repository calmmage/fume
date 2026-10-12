import { sampler, texture, type Gpu, type Texture } from "vgpu";
import type { RoomStyle } from "./look";

// Generated environment plates. Decode/mip once, only when a style is selected.
// Geometry starts immediately and never downloads material textures.
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
  const neutral = solid(gpu, [16, 16, 16, 255]);
  const bindings = {
    environmentMap: neutral,
    materialSampler: sampler(gpu, {
      addressModeU: "repeat", addressModeV: "repeat",
      magFilter: "linear", minFilter: "linear", mipmapFilter: "linear",
    }),
  };
  const controller = new AbortController();
  const cache = new Map<string, Promise<Texture | null>>();
  let current: RoomStyle | null = null;
  let revision = 0;
  let retryAt = Infinity;
  let retryAttempt = 0;
  function get(name: string) {
    if (!cache.has(name)) {
      const pending = material(gpu, `/styles/${name}.webp`, controller.signal).then((map) => {
        if (!map) cache.delete(name);
        return map;
      }).catch((error) => {
        cache.delete(name);
        throw error;
      });
      cache.set(name, pending);
    }
    return cache.get(name)!;
  }
  function selectStyle(style: RoomStyle) {
    if (controller.signal.aborted) return;
    const changed = current !== style;
    if (!changed && performance.now() < retryAt) return;
    if (changed) {
      retryAttempt = 0;
      bindings.environmentMap = neutral;
    } else {
      retryAttempt += 1;
    }
    current = style;
    const request = ++revision;
    retryAt = Infinity;
    const retry = () => {
      if (controller.signal.aborted || request !== revision) return;
      // draw() calls selectStyle every frame; failed maps retry with backoff,
      // while successful maps stay bound and cached without another upload.
      retryAt = Math.min(retryAt, performance.now() + Math.min(30_000, 1000 * 2 ** retryAttempt));
    };
    const maps: ["environmentMap", string][] =
      style === "geometry" || style === "cosmos" ? [] : [["environmentMap", `${style}-room`]];
    for (const [key, name] of maps) {
      void get(name).then((map) => {
        if (map && !controller.signal.aborted && request === revision) bindings[key] = map;
        if (!map) retry();
      }).catch((error) => {
        if (!controller.signal.aborted) console.warn("Fume material fallback:", name, error);
        retry();
      });
    }
  }
  return { bindings, selectStyle, dispose: () => { controller.abort(); } };
}
