self.onmessage = async ({ data }) => {
  try {
    if (data.op === "jpg" || data.op === "webp") {
      const jpeg = data.op === "jpg",
        name = jpeg ? "mozjpeg_enc" : "webp_enc";
      const { default: factory } = await import("./engines/" + name + ".js");
      const { defaultOptions } = await import(
        "./engines/" + (jpeg ? "jpeg" : "webp") + "-options.js"
      );
      const m = await factory({
        locateFile: () => "./engines/" + name + ".wasm",
      });
      const options = {
        ...defaultOptions,
        quality: data.quality,
        ...(jpeg
          ? { progressive: data.progressive }
          : { lossless: Number(data.lossless) }),
      };
      const bytes = m.encode(data.rgba, data.w, data.h, options);
      if (!bytes) throw Error("Encoding failed");
      self.postMessage(
        new Blob([bytes], { type: jpeg ? "image/jpeg" : "image/webp" }),
      );
      return;
    }
    if (data.op === "avif") {
      const { default: factory } = await import("./engines/avif_enc.js");
      const m = await factory({ locateFile: () => "./engines/avif_enc.wasm" });
      const bytes = m.encode(data.rgba, data.w, data.h, {
        quality: data.quality,
        qualityAlpha: -1,
        denoiseLevel: 0,
        tileRowsLog2: 0,
        tileColsLog2: 0,
        speed: data.speed || 8,
        subsample: 1,
        chromaDeltaQ: false,
        sharpness: 0,
        enableSharpYUV: false,
        tune: 0,
        bitDepth: 8,
      });
      if (!bytes) throw Error("AVIF");
      self.postMessage(new Blob([bytes], { type: "image/avif" }));
      return;
    }
    importScripts("./engines/qpdf.js");
    const m = await Module({
      noInitialRun: true,
      locateFile: () => "./engines/qpdf.wasm",
    });
    m.FS.writeFile("/in.pdf", new Uint8Array(await data.file.arrayBuffer()));
    const args =
      data.op === "unlock"
        ? ["--password=" + data.password, "--decrypt"]
        : [
            "--object-streams=generate",
            "--recompress-flate",
            "--compression-level=9",
          ];
    const code = m.callMain([...args, "/in.pdf", "/out.pdf"]);
    if (code && code !== 3) throw Error("PDF: " + code);
    self.postMessage(
      new Blob([m.FS.readFile("/out.pdf")], { type: "application/pdf" }),
    );
  } catch (e) {
    self.postMessage({ error: String(e.message || e) });
  }
};
