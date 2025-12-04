import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { App } from "./app";

const renderer = await createCliRenderer({ exitOnCtrlC: true, useMouse: false });

createRoot(renderer).render(<App />);
