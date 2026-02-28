import os from "node:os";

import { TsTuiMvpApp } from "./core/app-controller.js";

process.env.TERM = process.env.TERM || "xterm-256color";
process.env.HOME = process.env.HOME || os.homedir();

new TsTuiMvpApp().run();
