import { render } from "ink";
import { bootstrap } from "./src/bootstrap.ts";
import { TerminalApp } from "./src/infra/ink/terminal-app.tsx";

const { app, options } = bootstrap();

render(<TerminalApp app={app} options={options} />);
