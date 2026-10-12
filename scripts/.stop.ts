import { Sandbox } from "@vercel/sandbox";
Sandbox.get({ name: process.argv[2] }).then((s) => s.stop()).then((r) => console.log("stopped, active cpu ms", r.activeCpuDurationMs));
