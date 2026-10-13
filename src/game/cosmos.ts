import { draw, storage, target, type Frame, type Gpu, type StorageBuffer, type Target } from "vgpu";
import { buildCosmosPoints, COSMOS_COUNT } from "./cosmos-model";
import type { LookState } from "./look";
import cosmosShader from "./wgsl/cosmos.wgsl";

/** Native-resolution instanced stars; no low-resolution backdrop or per-pixel star loop. */
export class Cosmos {
  private image: Target;
  private points: StorageBuffer;
  private stars;
  private previous = "";
  private dirty = true;

  constructor(gpu: Gpu) {
    this.image = target(gpu, {
      size: [1, 1],
      format: "rgba8unorm",
      clearColor: [0.0003, 0.0005, 0.0014, 1],
      label: "cosmos-native",
    });
    const data = buildCosmosPoints();
    this.points = storage(gpu, data.byteLength, "read");
    this.points.write(data as unknown as BufferSource);
    this.stars = draw(gpu, {
      shader: cosmosShader,
      vertices: 6,
      instances: COSMOS_COUNT,
      blend: "additive",
      label: "cosmos-volume",
      set: { stars: this.points },
    });
  }

  async compile() {
    await this.stars.compile(this.image);
  }

  update(width: number, height: number, density: number, look: LookState) {
    const key = [width, height, density, look.parallaxX, look.parallaxY].join(",");
    if (key !== this.previous) {
      if (this.image.size[0] !== width || this.image.size[1] !== height)
        this.image.resize([width, height]);
      this.stars.set({
        view: {
          size: [width, height],
          // Room drag describes scenery movement, opposite to camera travel.
          // Match the preserved smoke/device plane instead of counter-scrolling.
          camera: [-look.parallaxX * 12, -look.parallaxY * 12],
          density,
        },
      });
      this.previous = key;
      this.dirty = true;
    }
    return this.image.color;
  }

  render(f: Frame) {
    if (!this.dirty) return;
    f.pass({ target: this.image, clear: true }, this.stars);
    this.dirty = false;
  }

  dispose() {
    // Storage buffers are owned and released by the renderer's GPU context.
    this.image.color.destroy();
  }
}
